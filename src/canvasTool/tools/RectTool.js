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

  static defaultsPanel = {
    // optional: hide the dock for this tool
    hideDock: false,
    // optional per-tool toggle persisted at toolDefaults.rect.__enabled
    hasEnableToggle: true,
    fields: [
      { group: "Style", label: "Stroke", type: "color", path: "style.stroke" },
      {
        group: "Style",
        label: "Width",
        type: "number",
        path: "style.lineWidth",
        min: 1,
        step: 1,
      },
      {
        group: "Style",
        label: "Line type",
        type: "select",
        path: "style.lineType",
        options: ["solid", "dashed", "dotted", "cloud"],
      },

      // fill block
      {
        group: "Fill",
        label: "Filled",
        type: "checkbox",
        path: "style.fillEnabled",
      },
      { group: "Fill", label: "Fill color", type: "color", path: "style.fill" },
      {
        group: "Fill",
        label: "Fill opacity",
        type: "range",
        path: "style.fillOpacity",
        min: 0,
        max: 1,
        step: 0.05,
      },

      // stroke opacity
      {
        group: "FX",
        label: "Stroke opacity",
        type: "range",
        path: "style.opacity",
        min: 0,
        max: 1,
        step: 0.05,
      },

      // only show when lineType === 'cloud'
      {
        group: "Cloud",
        label: "Amplitude",
        type: "number",
        path: "style.cloudAmplitude",
        min: 2,
        step: 1,
        showIf: (d) => d?.style?.lineType === "cloud",
      },
      {
        group: "Cloud",
        label: "Step",
        type: "number",
        path: "style.cloudStep",
        min: 2,
        step: 1,
        showIf: (d) => d?.style?.lineType === "cloud",
      },
      // --- Fill mode switch ---
      {
        group: "Fill",
        label: "Mode",
        type: "select",
        path: "style.fillMode",
        default: "solid",
        options: [
          { label: "Solid", value: "solid" },
          { label: "Gradient", value: "gradient" },
          { label: "Pattern", value: "pattern" },
        ],
      },

      // --- Gradient controls ---
      {
        group: "Fill · Gradient",
        label: "Type",
        type: "select",
        path: "style.gradientType",
        default: "linear",
        options: [
          { label: "Linear", value: "linear" },
          { label: "Radial", value: "radial" },
        ],
      },
      {
        group: "Fill · Gradient",
        label: "Start",
        type: "color",
        path: "style.gradientStart",
        default: "#ff8a00",
      },
      {
        group: "Fill · Gradient",
        label: "End",
        type: "color",
        path: "style.gradientEnd",
        default: "#e52e71",
      },
      {
        group: "Fill · Gradient",
        label: "Angle (°)",
        type: "number",
        path: "style.gradientAngle",
        default: 0,
        step: 1,
      },

      // --- Pattern controls ---
      {
        group: "Fill · Pattern",
        label: "Kind",
        type: "select",
        path: "style.patternType",
        default: "dots",
        options: [
          { label: "Dots", value: "dots" },
          { label: "Stripes", value: "stripes" },
        ],
      },
      {
        group: "Fill · Pattern",
        label: "Size",
        type: "number",
        path: "style.patternSize",
        default: 8,
        min: 2,
        step: 1,
      },
      {
        group: "Fill · Pattern",
        label: "Color",
        type: "color",
        path: "style.patternColor",
        default: "#000000",
      },
      {
        group: "Fill · Pattern",
        label: "Background",
        type: "color",
        path: "style.patternBg",
        default: "transparent",
      },
      {
        group: "Fill · Pattern",
        label: "Angle (°)",
        type: "number",
        path: "style.patternAngle",
        default: 45,
        step: 1,
      },
    ],
  };

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

  _makeFillForRect(ctx, s, x, y, w0, h0) {
    const mode = s.fillMode || "solid";
    let w = Math.abs(w0),
      h = Math.abs(h0);
    let xx = w0 >= 0 ? x : x - w;
    let yy = h0 >= 0 ? y : y - h;

    const cx = xx + w / 2,
      cy = yy + h / 2;

    if (mode === "gradient") {
      const start = s.gradientStart || s.fill || "#fff";
      const end = s.gradientEnd || "#000";
      if ((s.gradientType || "linear") === "radial") {
        // radius large enough to cover corners
        const R = 0.5 * Math.hypot(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, start);
        g.addColorStop(1, end);
        return g;
      } else {
        const ang = (Number(s.gradientAngle || 0) * Math.PI) / 180;
        const L = 0.5 * Math.hypot(w, h); // half-diagonal for nice coverage
        const dx = Math.cos(ang) * L,
          dy = Math.sin(ang) * L;
        const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
        g.addColorStop(0, start);
        g.addColorStop(1, end);
        return g;
      }
    }

    if (mode === "pattern") {
      const size = Math.max(2, Number(s.patternSize ?? 8));
      const tile = document.createElement("canvas");
      tile.width = tile.height = size;
      const tctx = tile.getContext("2d");

      if (s.patternBg && s.patternBg !== "transparent") {
        tctx.fillStyle = s.patternBg;
        tctx.fillRect(0, 0, size, size);
      } else {
        tctx.clearRect(0, 0, size, size);
      }

      tctx.fillStyle = s.patternColor || "#000";
      tctx.strokeStyle = s.patternColor || "#000";

      if ((s.patternType || "dots") === "dots") {
        const rr = Math.max(1, Math.floor(size / 6));
        tctx.beginPath();
        tctx.arc(size / 2, size / 2, rr, 0, Math.PI * 2);
        tctx.fill();
      } else {
        tctx.lineWidth = Math.max(1, Math.floor(size / 4));
        tctx.beginPath();
        tctx.moveTo(0, size / 2);
        tctx.lineTo(size, size / 2);
        tctx.stroke();
      }

      const p = ctx.createPattern(tile, "repeat");
      const ang = (Number(s.patternAngle || 0) * Math.PI) / 180;
      if (p && p.setTransform && ang) {
        const m = new DOMMatrix();
        m.a = Math.cos(ang);
        m.b = Math.sin(ang);
        m.c = -Math.sin(ang);
        m.d = Math.cos(ang);
        p.setTransform(m);
      }
      return p;
    }

    // solid
    return s.fill || "transparent";
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

      fillMode: style.fillMode || "solid",
      gradientType: style.gradientType || "linear",
      gradientStart: style.gradientStart || style.fill || "#ffffff",
      gradientEnd: style.gradientEnd || "#cccccc",
      gradientAngle: style.gradientAngle ?? 0,
      patternType: style.patternType || "dots",
      patternSize: style.patternSize ?? 8,
      patternColor: style.patternColor || style.stroke || "#000",
      patternBg: style.patternBg ?? "transparent",
      patternAngle: style.patternAngle ?? 45,
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

      ctx.fillStyle = this._makeFillForRect(
        ctx,
        this._styleSnapshot,
        x,
        y,
        w,
        h
      );
      this._fillPreview(ctx, this._styleSnapshot);

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
