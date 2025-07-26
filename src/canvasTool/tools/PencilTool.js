import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class PencilTool extends BaseTool {
  constructor() {
    super();
    this.name = "pencil";
    this.points = [];
  }

  onMouseDown(event, pos, engine) {
    const { color, lineWidth } = this.getToolOptions(engine.store);
    
    engine.ctx.strokeStyle = color;
    engine.ctx.lineWidth = lineWidth;
    engine.ctx.beginPath();
    engine.ctx.moveTo(pos.x, pos.y);

    this.points = [pos];
  }

  onMouseMove(event, pos, engine) {

    this.points.push(pos);
    engine.ctx.lineTo(pos.x, pos.y);
    engine.ctx.stroke();
  }

  onMouseUp(event, pos, engine) {

    const store = useCanvasStore.getState();
    const maxLayer =
      store.objects.length > 0
        ? Math.max(...store.objects.map((o) => o.layer))
        : 0;

    store.addObject(
      new CanvasObject({
        type: "pencil",
        data: { path: this.points.slice() },
        style: {
          stroke: store.color,
          lineWidth: store.lineWidth,
        },
        layer: maxLayer + 1,
      })
    );

    engine.ctx.closePath();
    this.points = [];
  }
}
