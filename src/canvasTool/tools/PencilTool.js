import { BaseTool } from './BaseTool';

export class PencilTool extends BaseTool {
  constructor() {
    super();
    this.name = 'pencil';
  }
  
  onMouseDown(event, pos, engine) {
    const { color, lineWidth } = this.getToolOptions(engine.store);
    
    engine.ctx.strokeStyle = color;
    engine.ctx.lineWidth = lineWidth;
    engine.ctx.beginPath();
    engine.ctx.moveTo(pos.x, pos.y);
  }
  
  onMouseMove(event, pos, engine) {
    engine.ctx.lineTo(pos.x, pos.y);
    engine.ctx.stroke();
  }
  
  onMouseUp(event, pos, engine) {
    // Drawing complete
  }
}