import { BaseTool } from './BaseTool';

export class EraserTool extends BaseTool {
  constructor() {
    super();
    this.name = 'eraser';
  }
  
  onMouseDown(event, pos, engine) {
    const { lineWidth } = this.getToolOptions(engine.store);
    
    engine.ctx.strokeStyle = 'white';
    engine.ctx.lineWidth = lineWidth * 2;
    engine.ctx.beginPath();
    engine.ctx.moveTo(pos.x, pos.y);
  }
  
  onMouseMove(event, pos, engine) {
    engine.ctx.lineTo(pos.x, pos.y);
    engine.ctx.stroke();
  }
  
  onMouseUp(event, pos, engine) {
    // Erasing complete
  }
}