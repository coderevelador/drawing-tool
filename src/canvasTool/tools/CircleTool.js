import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class CircleTool extends BaseTool {
  static inspector = [
    { group: "Position", label: "X", type: "number", path: "data.x" },
    { group: "Position", label: "Y", type: "number", path: "data.y" },
    { group: "Size", label: "W", type: "number", path: "data.width", min: 1 },
    { group: "Size", label: "H", type: "number", path: "data.height", min: 1 },

    { group: "Style", label: "Stroke", type: "color", path: "style.stroke" },
    { group: "Style", label: "Fill", type: "color", path: "style.fill" },
    {
      group: "Style",
      label: "Width",
      type: "number",
      path: "style.lineWidth",
      min: 1,
      step: 1,
    },

    {
      group: "FX",
      label: "Opacity",
      type: "range",
      path: "style.opacity",
      min: 0,
      max: 1,
      step: 0.05,
    },
  ];

  constructor() {
    super();
    this.name = "circle";
    this.startPos = null;
    this.snapshot = null;
  }

  onMouseDown(event, pos, engine) {
    // grab current style from the store
    const { color, lineWidth } = this.getToolOptions(engine.store);

    this.startPos = pos;
    // snapshot so we can redraw on move
    this.snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);

    engine.ctx.strokeStyle = color;
    engine.ctx.lineWidth = lineWidth;
  }

  onMouseMove(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    // restore background
    engine.ctx.putImageData(this.snapshot, 0, 0);

    // compute radius
    const dx = pos.x - this.startPos.x;
    const dy = pos.y - this.startPos.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    // draw preview
    engine.ctx.beginPath();
    engine.ctx.arc(this.startPos.x, this.startPos.y, radius, 0, 2 * Math.PI);
    engine.ctx.stroke();
  }

  onMouseUp(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    // compute final radius
    const dx = pos.x - this.startPos.x;
    const dy = pos.y - this.startPos.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    const store = useCanvasStore.getState();
    store.addObject(
      new CanvasObject({
        type: "circle",
        data: {
          x: this.startPos.x,
          y: this.startPos.y,
          r: radius,
        },
        style: {
          stroke: store.color,
          lineWidth: store.lineWidth,
          fill: "none",
        },
        layer: 0,
      })
    );

    // cleanup
    this.startPos = null;
    this.snapshot = null;
  }
}
