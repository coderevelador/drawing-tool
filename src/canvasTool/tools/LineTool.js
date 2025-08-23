import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class LineTool extends BaseTool {
  static inspector = [
    { group: "Style", label: "Stroke", type: "color", path: "style.stroke" },
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
    this.name = "line";
    this.startPos = null;
    this.snapshot = null;
  }

  onMouseDown(event, pos, engine) {
    const { color, lineWidth } = this.getToolOptions(engine.store);

    this.startPos = pos;
    this.snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);

    engine.ctx.strokeStyle = color;
    engine.ctx.lineWidth = lineWidth;
  }

  onMouseMove(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    engine.ctx.putImageData(this.snapshot, 0, 0);

    engine.ctx.beginPath();
    engine.ctx.moveTo(this.startPos.x, this.startPos.y);
    engine.ctx.lineTo(pos.x, pos.y);
    engine.ctx.stroke();
  }

  onMouseUp(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    const store = useCanvasStore.getState();

    store.addObject(
      new CanvasObject({
        type: "line",
        data: {
          x1: this.startPos.x,
          y1: this.startPos.y,
          x2: pos.x,
          y2: pos.y,
        },
        style: {
          stroke: store.color,
          lineWidth: store.lineWidth,
        },
        layer: 0,
      })
    );

    this.startPos = null;
    this.snapshot = null;
  }
}
