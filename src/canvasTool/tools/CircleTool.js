import { BaseTool } from './BaseTool';

export class CircleTool extends BaseTool {
  constructor() {
    super();
    this.name = 'circle';
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
    const radius = Math.sqrt(
      Math.pow(pos.x - this.startPos.x, 2) + Math.pow(pos.y - this.startPos.y, 2)
    );
    engine.ctx.beginPath();
    engine.ctx.arc(this.startPos.x, this.startPos.y, radius, 0, 2 * Math.PI);
    engine.ctx.stroke();
  }
  
  onMouseUp(event, pos, engine) {
    this.startPos = null;
    this.snapshot = null;
  }
}