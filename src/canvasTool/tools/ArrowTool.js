import { BaseTool } from './BaseTool';

export class ArrowTool extends BaseTool {
  constructor() {
    super();
    this.name = 'arrow';
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
    this.drawArrow(engine.ctx, this.startPos.x, this.startPos.y, pos.x, pos.y);
  }
  
  onMouseUp(event, pos, engine) {
    this.startPos = null;
    this.snapshot = null;
  }
  
  drawArrow(ctx, startX, startY, endX, endY) {
    const headLength = 10;
    const angle = Math.atan2(endY - startY, endX - startX);
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle - Math.PI / 6),
      endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle + Math.PI / 6),
      endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }
}