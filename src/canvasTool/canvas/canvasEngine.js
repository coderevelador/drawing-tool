import { toolRegistry } from "../tools";
import { renderObject } from "../utils/renderObject";

export class CanvasEngine {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.store = store;
    this.width = canvas.width;
    this.height = canvas.height;

    // Layer snapshots
    this.backgroundSnapshot = null;
    this.drawingSnapshot = null;

    this.setupCanvas();
    this.bindEvents();
  }

  getContext() {
    return this.ctx;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
  }

  setupCanvas() {
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  bindEvents() {
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.handleMouseUp.bind(this));
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  handleMouseDown(e) {
    const pos = this.getMousePos(e);
    const { currentTool } = this.store.getState();

    // Check callout clicks first
    if (this.handleCalloutClick(pos.x, pos.y)) {
      return;
    }

    const tool = toolRegistry[currentTool];
    if (tool) {
      this.store.getState().setIsDrawing(true);
      tool.onMouseDown(e, pos, this);
    }
  }

  handleMouseMove(e) {
    const { isDrawing, currentTool } = this.store.getState();
    if (!isDrawing) return;

    const pos = this.getMousePos(e);
    const tool = toolRegistry[currentTool];
    if (tool) {
      tool.onMouseMove(e, pos, this);
    }
  }

  handleMouseUp(e) {
    const { isDrawing, currentTool } = this.store.getState();
    if (!isDrawing) return;

    const pos = this.getMousePos(e);
    const tool = toolRegistry[currentTool];
    if (tool) {
      tool.onMouseUp(e, pos, this);
    }

    this.store.getState().setIsDrawing(false);
    this.renderAllObjects();
    this.saveDrawingSnapshot();
  }

  handleCalloutClick(x, y) {
    const { callouts, setEditingCallout, setCalloutText } =
      this.store.getState();

    const clickedCallout = callouts.find((callout) =>
      this.isPointInCallout(x, y, callout)
    );

    if (clickedCallout) {
      setEditingCallout(clickedCallout);
      setCalloutText(
        clickedCallout.text === "Click to edit" ? "" : clickedCallout.text
      );
      return true;
    }
    return false;
  }

  isPointInCallout(x, y, callout) {
    const boxWidth = 140;
    const boxHeight = 60;
    return (
      x >= callout.x &&
      x <= callout.x + boxWidth &&
      y >= callout.y &&
      y <= callout.y + boxHeight
    );
  }

  // Layer management
  saveBackgroundSnapshot() {
    this.backgroundSnapshot = this.ctx.getImageData(
      0,
      0,
      this.width,
      this.height
    );
  }

  saveDrawingSnapshot() {
    this.drawingSnapshot = this.ctx.getImageData(0, 0, this.width, this.height);
  }

  restoreFromSnapshot(snapshot) {
    this.ctx.putImageData(snapshot, 0, 0);
  }

  redrawCanvas() {
    const { objects, pdfImage } = this.store.getState();

    this.ctx.clearRect(0, 0, this.width, this.height);

    if (pdfImage) {
      this.ctx.drawImage(pdfImage, 0, 0);
    }

    objects
      .sort((a, b) => a.layer - b.layer)
      .forEach((obj) => renderObject(this.ctx, obj));

    this.redrawCallouts();
  }

  redrawCallouts() {
    const { callouts } = this.store.getState();
    callouts.forEach((callout) => {
      this.drawCallout(callout);
    });
  }

  drawCallout(callout) {
    const { x, y, text, color, lineWidth } = callout;
    const boxWidth = 140;
    const boxHeight = 60;
    const cornerRadius = 8;

    // Draw callout box
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, boxWidth, boxHeight, cornerRadius);
    this.ctx.fillStyle = color + "30";
    this.ctx.fill();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();

    // Draw pointer
    const pointerSize = 12;
    const pointerX = x + 20;
    const pointerY = y + boxHeight;
    this.ctx.beginPath();
    this.ctx.moveTo(pointerX, pointerY);
    this.ctx.lineTo(pointerX - pointerSize, pointerY + pointerSize);
    this.ctx.lineTo(pointerX + pointerSize / 2, pointerY + pointerSize / 2);
    this.ctx.closePath();
    this.ctx.fillStyle = color + "30";
    this.ctx.fill();
    this.ctx.strokeStyle = color;
    this.ctx.stroke();

    // Draw text
    this.ctx.fillStyle = color;
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "top";

    const padding = 10;
    const words = text.split(" ");
    const maxWidth = boxWidth - padding * 2;
    let lines = [];
    let currentLine = "";

    for (let word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      const testWidth = this.ctx.measureText(testLine).width;
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = 14;
    lines.forEach((line, index) => {
      this.ctx.fillText(line, x + padding, y + padding + index * lineHeight);
    });
  }

  clear() {
    if (this.backgroundSnapshot) {
      this.ctx.putImageData(this.backgroundSnapshot, 0, 0);
      this.saveDrawingSnapshot();
    } else {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.drawingSnapshot = null;
    }
    this.store.getState().setCallouts([]);
  }

  clearAll() {
    this.store.getState().clearObjects();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.store.getState().setCallouts([]);
    this.drawingSnapshot = null;
  }

  exportCanvas() {
    return this.canvas.toDataURL("image/png");
  }

  renderAllObjects() {
    const { objects } = this.store.getState();
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Re-render all objects (like rectangles) from the state
    objects
      .sort((a, b) => a.layer - b.layer)
      .forEach((obj) => renderObject(this.ctx, obj));

    this.redrawCallouts();
  }
}
