import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";
import { strokeCloudAroundPath } from "../utils/renderObject";

export class RectTool extends BaseTool {
  static inspector = [
    { group: "Position", label: "X", type: "number", path: "data.x" },
    { group: "Position", label: "Y", type: "number", path: "data.y" },
    { group: "Size", label: "W", type: "number", path: "data.width", min: 1 },
    { group: "Size", label: "H", type: "number", path: "data.height", min: 1 },

    { group: "Style", label: "Stroke", type: "color", path: "style.stroke" },
    { group: "Style", label: "Fill", type: "color", path: "style.fill" },
    {
      group: "Style",
      label: "Width",
      type: "number",
      path: "style.lineWidth",
      min: 1,
      step: 1,
    },

    {
      group: "FX",
      label: "Opacity",
      type: "range",
      path: "style.opacity",
      min: 0,
      max: 1,
      step: 0.05,
    },
  ];

  constructor() {
    super();
    this.name = "rect"; // MUST match toolDefaults key
    this.startPos = null;
    this.snapshot = null;
    this._styleSnapshot = null;
  }

  // ---- helpers (preview only) ---------------------------------------------

  _applyDashForRect(ctx, s) {
    // Only solid/dashed/dotted for rectangle preview.
    // (Cloud is drawn with a custom path, no dash.)
    const lt = s.lineType || "solid";
    if (lt === "dashed") {
      const dash = Math.max(1, Math.floor(s.dashSize ?? s.lineWidth * 3));
      const gap = Math.max(1, Math.floor(s.dashGap ?? s.lineWidth * 2));
      ctx.setLineDash([dash, gap]);
      ctx.lineCap = s.lineCap || "butt"; // cleaner dashes
    } else if (lt === "dotted") {
      // short dash + round cap => circular dots, diameter ≈ lineWidth
      const dot = Math.max(1, Math.floor(s.dotSize ?? 1));
      const gap = Math.max(1, Math.floor(s.dotGap ?? s.lineWidth * 1.5));
      ctx.setLineDash([dot, gap]);
      ctx.lineCap = "round";
    } else {
      ctx.setLineDash([]);
      ctx.lineCap = s.lineCap || "butt";
    }
  }

  _applyStroke(ctx, s) {
    ctx.globalAlpha = typeof s.opacity === "number" ? s.opacity : 1;
    ctx.strokeStyle = s.stroke ?? "#000";
    ctx.lineWidth = s.lineWidth ?? 2;
    ctx.lineJoin = s.lineJoin || "miter";
    ctx.miterLimit = s.miterLimit ?? 10;
    if (s.composite) ctx.globalCompositeOperation = s.composite;
  }

  _drawRevisionCloudRect(ctx, x, y, w, h, s) {
    const r = Math.max(2, Math.floor(s.cloudAmplitude ?? 8));
    // Let spacing follow CAD overlap unless user set cloudStep explicitly
    const opts = {
      overlap: s.cloudOverlap ?? 0.35,
      sweepDeg: s.cloudSweepDeg ?? 150,
    };
    if (typeof s.cloudStep === "number")
      opts.spacing = Math.max(2, Math.floor(s.cloudStep));
    const path = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
      { x, y },
    ];
    ctx.setLineDash([]);
    const keepCap = ctx.lineCap,
      keepJoin = ctx.lineJoin;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokeCloudAroundPath(ctx, path, r, opts);
    ctx.lineCap = keepCap;
    ctx.lineJoin = keepJoin;
  }

  // ---- events --------------------------------------------------------------

  onMouseDown(event, pos, engine) {
    this.startPos = pos;
    this.snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);

    // Freeze current per-tool defaults
    const { style } = this.getToolOptions(engine.store);
    this._styleSnapshot = {
      stroke: style.stroke ?? "#000",
      fill: style.fill,
      fillEnabled: style.fillEnabled ?? false,
      fillOpacity: style.fillOpacity ?? 1,
      lineWidth: style.lineWidth ?? 2,
      opacity: typeof style.opacity === "number" ? style.opacity : 1,
      lineType: style.lineType || "solid", // "solid" | "dashed" | "dotted" | "cloud"
      lineJoin: style.lineJoin || "miter",
      lineCap: style.lineCap || "butt",
      miterLimit: style.miterLimit ?? 10,
      composite: style.composite,

      // dot/dash tuning (optional)
      dashSize: style.dashSize,
      dashGap: style.dashGap,
      dotSize: style.dotSize,
      dotGap: style.dotGap,

      // cloud tuning
      cloudAmplitude: style.cloudAmplitude ?? 8,
      cloudStep: style.cloudStep ?? 12,
    };

    // apply stroke state for preview
    const ctx = engine.ctx;
    ctx.save();
    this._applyStroke(ctx, this._styleSnapshot);
    if (this._styleSnapshot.lineType !== "cloud") {
      this._applyDashForRect(ctx, this._styleSnapshot);
    } else {
      ctx.setLineDash([]); // ensure no dash for cloud
    }
  }

  onMouseMove(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    const ctx = engine.ctx;
    ctx.putImageData(this.snapshot, 0, 0);

    // re-apply preview stroke state after restore
    this._applyStroke(ctx, this._styleSnapshot);
    if (this._styleSnapshot.lineType !== "cloud") {
      this._applyDashForRect(ctx, this._styleSnapshot);
    } else {
      ctx.setLineDash([]);
    }

    const x = Math.min(this.startPos.x, pos.x);
    const y = Math.min(this.startPos.y, pos.y);
    const w = Math.abs(this.startPos.x - pos.x);
    const h = Math.abs(this.startPos.y - pos.y);

    if (this._styleSnapshot.lineType === "cloud") {
      // draw revision cloud preview
      this._drawRevisionCloudRect(ctx, x, y, w, h, this._styleSnapshot);
    } else {
      ctx.beginPath();
      ctx.rect(x, y, w, h);

      // optional live fill preview
      const fillOn =
        this._styleSnapshot.fillEnabled &&
        this._styleSnapshot.fill &&
        this._styleSnapshot.fill !== "none";
      if (fillOn) {
        const prev = ctx.globalAlpha;
        ctx.fillStyle = this._styleSnapshot.fill;
        ctx.globalAlpha = prev * (this._styleSnapshot.fillOpacity ?? 1);
        ctx.fill();
        ctx.globalAlpha = prev;
      }
      ctx.stroke();
    }
  }

  onMouseUp(event, pos, engine) {
    const store = useCanvasStore.getState();
    if (!this.startPos) return;

    const rectX = Math.min(this.startPos.x, pos.x);
    const rectY = Math.min(this.startPos.y, pos.y);
    const width = Math.abs(this.startPos.x - pos.x);
    const height = Math.abs(this.startPos.y - pos.y);

    // compute next layer
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map((o) => o.layer || 0))
      : 0;

    // Final object uses the frozen style snapshot
    const obj = new CanvasObject({
      type: "rect",
      data: { x: rectX, y: rectY, width, height },
      style: { ...this._styleSnapshot },
      layer: maxLayer + 1,
    });

    store.addObject(obj);
    engine.renderAllObjects?.();

    // cleanup preview state
    try {
      engine.ctx.restore();
    } catch {}
    this.startPos = null;
    this.snapshot = null;
    this._styleSnapshot = null;
  }
}

export default RectTool;
