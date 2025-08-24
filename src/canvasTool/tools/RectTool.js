import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class RectTool extends BaseTool {
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
    this.name = "rect";
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
    const width = pos.x - this.startPos.x;
    const height = pos.y - this.startPos.y;
    engine.ctx.strokeRect(this.startPos.x, this.startPos.y, width, height);
  }

  onMouseUp(event, pos, engine) {
    const store = useCanvasStore.getState();
    if (!this.startPos) return;

    const rectX = Math.min(this.startPos.x, pos.x);
    const rectY = Math.min(this.startPos.y, pos.y);
    const width = Math.abs(this.startPos.x - pos.x);
    const height = Math.abs(this.startPos.y - pos.y);

    const obj = this.makeStyledObject(
      "rect",
      { x: rectX, y: rectY, width, height },
      engine
    );

    store.addObject(new CanvasObject(obj));
    engine.renderAllObjects?.();

    this.startPos = null;
    this.snapshot = null;
  }
}
