import { BaseTool } from './BaseTool';

export class RectTool extends BaseTool {
  constructor() {
    super();
    this.name = 'rect';
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
    this.startPos = null;
    this.snapshot = null;
  }
}