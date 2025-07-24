import { BaseTool } from './BaseTool';

export class LineTool extends BaseTool {
  constructor() {
    super();
    this.name = 'line';
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
    this.startPos = null;
    this.snapshot = null;
  }
}
