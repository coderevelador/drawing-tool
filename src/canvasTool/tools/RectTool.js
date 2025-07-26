import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class RectTool extends BaseTool {
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
    const width = pos.x - this.startPos.x;
    const height = pos.y - this.startPos.y;

    const store = useCanvasStore.getState(); 

    store.addObject(
      new CanvasObject({
        type: "rectangle",
        data: {
          x: this.startPos.x,
          y: this.startPos.y,
          width,
          height,
        },
        style: {
          stroke: store.color,
          fill: "none",
        },
        layer: 0,
      })
    );

    this.startPos = null;
    this.snapshot = null;
  }
}
