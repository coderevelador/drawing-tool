// src/canvasTool/tools/LineTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class LineTool extends BaseTool {
  static inspector = [
    { group: "Style", label: "Stroke", type: "color", path: "style.stroke" },
    { group: "Style", label: "Width", type: "number", path: "style.lineWidth", min: 1, step: 1 },
    { group: "FX", label: "Opacity", type: "range", path: "style.opacity", min: 0, max: 1, step: 0.05 },
  ];

  constructor() {
    super();
    this.name = "line";           // MUST match store.toolDefaults key
    this.startPos = null;
    this.snapshot = null;
    this._styleSnapshot = null;   // freeze defaults for this stroke
  }

  _applyStrokeStyle(ctx, s) {
    ctx.globalAlpha = typeof s.opacity === "number" ? s.opacity : 1;
    ctx.strokeStyle = s.stroke ?? "#000";
    ctx.lineWidth   = s.lineWidth ?? 2;
    ctx.lineJoin    = s.lineJoin || "miter";
    ctx.lineCap     = s.lineCap  || "butt";
    ctx.miterLimit  = s.miterLimit ?? 10;
    // solid / dashed / dotted only (no cloud for line)
    const lt = s.lineType || "solid";
    if (lt === "dashed") {
      const dash = Math.max(1, Math.floor(s.dashSize ?? (s.lineWidth * 3)));
      const gap  = Math.max(1, Math.floor(s.dashGap  ?? (s.lineWidth * 2)));
      ctx.setLineDash([dash, gap]);
      if (!s.lineCap) ctx.lineCap = "butt";
    } else if (lt === "dotted") {
      const dot = Math.max(1, Math.floor(s.dotSize ?? 1));
      const gap = Math.max(1, Math.floor(s.dotGap  ?? (s.lineWidth * 1.5)));
      ctx.setLineDash([dot, gap]);
      ctx.lineCap = "round";
    } else {
      ctx.setLineDash([]);
    }
  }

  onMouseDown(event, pos, engine) {
    this.startPos = pos;
    this.snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);

    // Freeze current per-tool defaults
    const { style } = this.getToolOptions(engine.store);
    this._styleSnapshot = {
      stroke: style.stroke ?? "#000",
      lineWidth: style.lineWidth ?? 2,
      opacity: typeof style.opacity === "number" ? style.opacity : 1,
      lineType: (style.lineType === "cloud" ? "solid" : style.lineType) || "solid",
      lineJoin: style.lineJoin,
      lineCap: style.lineCap,
      miterLimit: style.miterLimit,
      dashSize: style.dashSize, dashGap: style.dashGap,
      dotSize: style.dotSize,   dotGap:  style.dotGap,
    };

    this._applyStrokeStyle(engine.ctx, this._styleSnapshot);
  }

  onMouseMove(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    // restore canvas then draw preview line with frozen style
    engine.ctx.putImageData(this.snapshot, 0, 0);
    this._applyStrokeStyle(engine.ctx, this._styleSnapshot);

    engine.ctx.beginPath();
    engine.ctx.moveTo(this.startPos.x, this.startPos.y);
    engine.ctx.lineTo(pos.x, pos.y);
    engine.ctx.stroke();
  }

  onMouseUp(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map((o) => o.layer || 0))
      : 0;

    // Use the frozen style snapshot (NOT store.color/lineWidth)
    store.addObject(
      new CanvasObject({
        type: "line",
        data: { x1: this.startPos.x, y1: this.startPos.y, x2: pos.x, y2: pos.y },
        style: { ...this._styleSnapshot },
        layer: maxLayer + 1,
      })
    );

    // Re-render from objects to clear preview artifacts
    engine.renderAllObjects?.();

    this.startPos = null;
    this.snapshot = null;
    this._styleSnapshot = null;
  }
}

export default LineTool;
