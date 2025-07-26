import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class CalloutTool extends BaseTool {
  constructor() {
    super();
    this.name = "callout";
    this.startPos = null;
    this.snapshot = null;
  }

  onMouseDown(event, pos, engine) {
    const { color, lineWidth, fontSize, fontFamily } = this.getToolOptions(engine.store);
    this.startPos = pos;
    this.snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);
    engine.ctx.strokeStyle = color;
    engine.ctx.lineWidth = lineWidth;
    engine.ctx.font = `${fontSize}px ${fontFamily}`;
  }

  onMouseMove(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;
    
    engine.ctx.putImageData(this.snapshot, 0, 0);
    
    const w = pos.x - this.startPos.x;
    const h = pos.y - this.startPos.y;
    
    
    this.drawSpeechBubble(engine.ctx, this.startPos.x, this.startPos.y, w, h, false);
  }

  onMouseUp(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;
    
    const text = prompt("Enter callout text:") || "";
    const w = pos.x - this.startPos.x;
    const h = pos.y - this.startPos.y;
    
    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map((o) => o.layer))
      : 0;

    store.addObject(
      new CanvasObject({
        type: "callout",
        data: {
          x: this.startPos.x,
          y: this.startPos.y,
          width: w,
          height: h,
          text,
        },
        style: {
          stroke: store.color,
          fill: "white",
          lineWidth: store.lineWidth,
          fontSize: store.fontSize,
          fontFamily: store.fontFamily,
        },
        layer: maxLayer + 1,
      })
    );

    this.startPos = null;
    this.snapshot = null;
  }

  drawSpeechBubble(ctx, x, y, width, height, filled = true) {
    const cornerRadius = 15;
    const tailWidth = 20;
    const tailHeight = 15;
    
    ctx.beginPath();
    
    
    ctx.moveTo(x + cornerRadius, y);
    
   
    ctx.lineTo(x + width - cornerRadius, y);
    ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
    
    
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
    
    
    const tailStartX = x + width * 0.7;
    ctx.lineTo(tailStartX + tailWidth, y + height);
    ctx.lineTo(tailStartX + tailWidth/2, y + height + tailHeight); 
    ctx.lineTo(tailStartX, y + height);

    ctx.lineTo(x + cornerRadius, y + height);
    ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
    

    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    
    ctx.closePath();
    
    if (filled) {
      ctx.fill();
    }
    ctx.stroke();
  }
}