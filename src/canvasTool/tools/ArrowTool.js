import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class ArrowTool extends BaseTool {
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
      group: "Options",
      label: "Head size",
      type: "number",
      path: "data.headSize",
      min: 4,
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
    this.name = "arrow";
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

    this._drawArrow(engine.ctx, this.startPos, pos, engine.store);
  }

  onMouseUp(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    const store = useCanvasStore.getState();

    store.addObject(
      new CanvasObject({
        type: "arrow",
        data: {
          x1: this.startPos.x,
          y1: this.startPos.y,
          x2: pos.x,
          y2: pos.y,
        },
        style: {
          stroke: store.color,
          lineWidth: store.lineWidth,
          fill: "none",
        },
        layer: 0,
      })
    );

    this.startPos = null;
    this.snapshot = null;
  }

  _drawArrow(ctx, from, to, store) {
    const headLen = 10;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // left wing
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLen * Math.cos(angle - Math.PI / 6),
      to.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      to.x - headLen * Math.cos(angle + Math.PI / 6),
      to.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.lineTo(to.x, to.y);
    ctx.fillStyle = store.color;
    ctx.fill();
  }
}
