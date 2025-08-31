import { toolRegistry } from "../tools";
import { renderObject } from "../utils/renderObject";

export class CanvasEngine {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.store = store;
    this.width = canvas.width;
    this.height = canvas.height;

    this.toolRegistry = toolRegistry; // map: name -> instance
    this.tools = toolRegistry;

    // Layer snapshots
    this.backgroundSnapshot = null;
    this.drawingSnapshot = null;

    this.setupCanvas();
    this.bindEvents();
    this.attachZOrderHotkeys();
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
    let pos = this.getMousePos(e);
    // keep callout clicks raw (no snap)
    if (this.handleCalloutClick(pos.x, pos.y)) return;

    // now snap for drawing tools
    pos = this.snapPoint(pos);
    const { currentTool } = this.store.getState();
    const tool = toolRegistry[currentTool];
    if (tool) {
      this.store.getState().setIsDrawing(true);
      tool.onMouseDown(e, pos, this);
    }
  }

  handleMouseMove(e) {
    const { isDrawing, currentTool } = this.store.getState();
    if (!isDrawing) return;
    let pos = this.getMousePos(e);
    pos = this.snapPoint(pos);
    const tool = toolRegistry[currentTool];
    if (tool) tool.onMouseMove(e, pos, this);
  }

  handleMouseUp(e) {
    const { isDrawing, currentTool } = this.store.getState();
    if (!isDrawing) return;
    let pos = this.getMousePos(e);
    pos = this.snapPoint(pos);
    const tool = toolRegistry[currentTool];
    if (tool) tool.onMouseUp(e, pos, this);
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
    if (pdfImage) this.ctx.drawImage(pdfImage, 0, 0);
    this.drawGrid(); // <-- add
    objects
      .sort((a, b) => a.layer - b.layer)
      .forEach((o) => renderObject(this.ctx, o));
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

  snapPoint(p) {
    const { grid } = this.store.getState();
    if (!grid?.snap) return p;
    const s = Math.max(1, grid.size || 16);
    return { x: Math.round(p.x / s) * s, y: Math.round(p.y / s) * s };
  }

  // Draw grid behind everything
  drawGrid() {
    const { grid } = this.store.getState();
    if (!grid?.show) return;

    const {
      size = 16,
      thickEvery = 5,
      color = "#e0e0e0",
      boldColor = "#c0c0c0",
      alpha = 0.6,
    } = grid;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;

    // vertical lines
    for (let x = 0; x <= this.width; x += size) {
      const isBold = Math.round(x / size) % thickEvery === 0;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, this.height);
      ctx.strokeStyle = isBold ? boldColor : color;
      ctx.lineWidth = isBold ? 1.25 : 1;
      ctx.stroke();
    }
    // horizontal lines
    for (let y = 0; y <= this.height; y += size) {
      const isBold = Math.round(y / size) % thickEvery === 0;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(this.width, Math.round(y) + 0.5);
      ctx.strokeStyle = isBold ? boldColor : color;
      ctx.lineWidth = isBold ? 1.25 : 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  // (Optional but handy) keyboard toggles
  attachGridHotkeys() {
    this._gridKeyHandler = (e) => {
      const k = (e.key || "").toLowerCase();
      const s = this.store.getState();
      if (k === "g") {
        s.toggleGrid();
        this.renderAllObjects();
      }
      if (k === "s") {
        s.toggleSnapToGrid();
      }
    };
    window.addEventListener("keydown", this._gridKeyHandler);
  }

  clearAll() {
    this.store.getState().clearObjects();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.store.getState().setCallouts([]);
    this.drawingSnapshot = null;
  }

  attachZOrderHotkeys() {
  this._zKeyHandler = (e) => {
    const S = this.store.getState();
    const ctrl = e.ctrlKey || e.metaKey;
    // Ctrl/Cmd + ] => forward, Ctrl/Cmd + [ => backward
    if (ctrl && e.key === "]") { S.bringForward();  this.renderAllObjects(); this.saveDrawingSnapshot(); }
    if (ctrl && e.key === "[") { S.sendBackward();  this.renderAllObjects(); this.saveDrawingSnapshot(); }
    // Ctrl/Cmd + Shift + ] => front, Ctrl/Cmd + Shift + [ => back
    if (ctrl && e.shiftKey && e.key === "]") { S.bringToFront(); this.renderAllObjects(); this.saveDrawingSnapshot(); }
    if (ctrl && e.shiftKey && e.key === "[") { S.sendToBack();   this.renderAllObjects(); this.saveDrawingSnapshot(); }
  };
  window.addEventListener("keydown", this._zKeyHandler);
}




  exportCanvas() {
    return this.canvas.toDataURL("image/png");
  }

  renderAllObjects() {
    const { objects } = this.store.getState();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawGrid(); // <-- add
    const ordered = [...objects].sort(
      (a, b) =>
        (Number.isFinite(a.layer) ? a.layer : 0) -
        (Number.isFinite(b.layer) ? b.layer : 0)
    );
    const base = [],
      blurs = [];
    for (const o of ordered) (o.type === "blur" ? blurs : base).push(o);
    base.forEach((o) => renderObject(this.ctx, o));
    blurs.forEach((o) => renderObject(this.ctx, o));
    this.redrawCallouts();
  }
}
