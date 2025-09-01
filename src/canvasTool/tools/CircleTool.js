// src/canvasTool/tools/CircleTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class CircleTool extends BaseTool {
  static inspector = [
    { group: "Position", label: "X", type: "number", path: "data.x" },
    { group: "Position", label: "Y", type: "number", path: "data.y" },
    { group: "Size", label: "R", type: "number", path: "data.r", min: 1 },

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
    fields: [
      // Stroke
      {
        group: "Stroke",
        label: "Color",
        type: "color",
        path: "style.stroke",
        default: "#222222",
      },
      {
        group: "Stroke",
        label: "Width",
        type: "number",
        path: "style.lineWidth",
        default: 2,
        min: 0,
        step: 0.5,
      },
      {
        group: "Stroke",
        label: "Opacity",
        type: "range",
        path: "style.opacity",
        default: 1,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        group: "Stroke",
        label: "Line Type",
        type: "select",
        path: "style.lineType",
        default: "solid",
        options: [
          { label: "Solid", value: "solid" },
          { label: "Dashed", value: "dashed" },
          { label: "Dotted", value: "dotted" },
        ],
      },

      {
        group: "Fill",
        label: "Enabled",
        type: "checkbox",
        path: "style.fillEnabled",
        default: false,
      },
      {
        group: "Fill",
        label: "Color",
        type: "color",
        path: "style.fill",
        default: "#ffffff",
      },
      {
        group: "Fill",
        label: "Opacity",
        type: "range",
        path: "style.fillOpacity",
        default: 1,
        min: 0,
        max: 1,
        step: 0.05,
      },

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
        default: "radial",
        options: [
          { label: "Radial", value: "radial" },
          { label: "Linear", value: "linear" },
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
    this.name = "circle"; // MUST match toolDefaults key
    this.startPos = null;
    this.snapshot = null;
    this._styleSnapshot = null;
  }

  // --- preview helpers -------------------------------------------------------

  _applyStroke(ctx, s) {
    ctx.globalAlpha = typeof s.opacity === "number" ? s.opacity : 1;
    ctx.strokeStyle = s.stroke ?? "#000";
    ctx.lineWidth = s.lineWidth ?? 2;
    ctx.lineJoin = s.lineJoin || "miter";
    ctx.lineCap = s.lineCap || "butt";
    ctx.miterLimit = s.miterLimit ?? 10;
    if (s.composite) ctx.globalCompositeOperation = s.composite;
  }

  _applyDashForCircle(ctx, s) {
    // Only solid / dashed / dotted for circle
    const lt = s.lineType || "solid";
    if (lt === "dashed") {
      const dash = Math.max(1, Math.floor(s.dashSize ?? s.lineWidth * 3));
      const gap = Math.max(1, Math.floor(s.dashGap ?? s.lineWidth * 2));
      ctx.setLineDash([dash, gap]);
      if (!s.lineCap) ctx.lineCap = "butt";
    } else if (lt === "dotted") {
      // short dash + round cap => circular dots
      const dot = Math.max(1, Math.floor(s.dotSize ?? 1));
      const gap = Math.max(1, Math.floor(s.dotGap ?? s.lineWidth * 1.5));
      ctx.setLineDash([dot, gap]);
      ctx.lineCap = "round";
    } else {
      ctx.setLineDash([]);
    }
  }

  _fillPreview(ctx, s) {
    const on = s.fillEnabled ?? (s.fill && s.fill !== "none");
    if (!on) return;
    const prev = ctx.globalAlpha;
    const cx = this.startPos?.x ?? 0;
    const cy = this.startPos?.y ?? 0;

    ctx.globalAlpha =
      prev * (typeof s.fillOpacity === "number" ? s.fillOpacity : 1);
    ctx.fill();
    ctx.globalAlpha = prev;
  }

  // --- events ----------------------------------------------------------------

  _makeFillForCircle(ctx, s, cx, cy, r) {
    const mode = s.fillMode || "solid";
    if (mode === "gradient") {
      const start = s.gradientStart || s.fill || "#fff";
      const end = s.gradientEnd || "#000";
      if ((s.gradientType || "radial") === "radial") {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, start);
        g.addColorStop(1, end);
        return g;
      } else {
        const ang = (Number(s.gradientAngle || 0) * Math.PI) / 180;
        const dx = Math.cos(ang) * r,
          dy = Math.sin(ang) * r;
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
      // background
      if (s.patternBg && s.patternBg !== "transparent") {
        tctx.fillStyle = s.patternBg;
        tctx.fillRect(0, 0, size, size);
      } else tctx.clearRect(0, 0, size, size);
      // paint dots or stripes
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

  onMouseDown(event, pos, engine) {
    this.startPos = pos;
    this.snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);

    // Freeze per-tool defaults from the dock
    const { style } = this.getToolOptions(engine.store);
    this._styleSnapshot = {
      stroke: style.stroke ?? "#000",
      fill: style.fill,
      fillEnabled: style.fillEnabled ?? false,
      fillOpacity: style.fillOpacity ?? 1,
      lineWidth: style.lineWidth ?? 2,
      opacity: typeof style.opacity === "number" ? style.opacity : 1,
      lineType:
        (style.lineType === "cloud" ? "solid" : style.lineType) || "solid",
      lineJoin: style.lineJoin,
      lineCap: style.lineCap,
      miterLimit: style.miterLimit,
      composite: style.composite,
      dashSize: style.dashSize,
      dashGap: style.dashGap,
      dotSize: style.dotSize,
      dotGap: style.dotGap,

      fillMode: style.fillMode || "solid",
      gradientType: style.gradientType || "radial",
      gradientStart: style.gradientStart || style.fill || "#ffffff",
      gradientEnd: style.gradientEnd || "#cccccc",
      gradientAngle: style.gradientAngle ?? 0,
      patternType: style.patternType || "dots",
      patternSize: style.patternSize ?? 8,
      patternColor: style.patternColor || style.stroke || "#000",
      patternBg: style.patternBg ?? "transparent",
      patternAngle: style.patternAngle ?? 45,
    };
  }

  onMouseMove(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    const ctx = engine.ctx;
    ctx.putImageData(this.snapshot, 0, 0);

    // compute radius from center drag
    const dx = pos.x - this.startPos.x;
    const dy = pos.y - this.startPos.y;
    const r = Math.sqrt(dx * dx + dy * dy);

    // draw preview with frozen style
    this._applyStroke(ctx, this._styleSnapshot);
    this._applyDashForCircle(ctx, this._styleSnapshot);

    ctx.beginPath();
    ctx.arc(this.startPos.x, this.startPos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = this._makeFillStyleForCircle(
      ctx,
      this._styleSnapshot,
      this.startPos.x,
      this.startPos.y,
      r
    );
    this._fillPreview(ctx, this._styleSnapshot);
    ctx.stroke();
  }

  onMouseUp(event, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    const dx = pos.x - this.startPos.x;
    const dy = pos.y - this.startPos.y;
    const r = Math.sqrt(dx * dx + dy * dy);

    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map((o) => o.layer || 0))
      : 0;

    // Save final object using the style snapshot (NOT store.color/lineWidth)
    store.addObject(
      new CanvasObject({
        type: "circle",
        data: { x: this.startPos.x, y: this.startPos.y, r },
        style: { ...this._styleSnapshot },
        layer: maxLayer + 1,
      })
    );

    engine.renderAllObjects?.();

    this.startPos = null;
    this.snapshot = null;
    this._styleSnapshot = null;
  }

  _makeFillStyleForCircle(ctx, s, cx, cy, r) {
    const mode = s.fillMode || "solid";
    if (mode === "gradient") {
      const start = s.gradientStart || s.fill || "#fff";
      const end = s.gradientEnd || "#000";
      if ((s.gradientType || "radial") === "radial") {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, start);
        g.addColorStop(1, end);
        return g;
      } else {
        const ang = (Number(s.gradientAngle || 0) * Math.PI) / 180;
        const dx = Math.cos(ang) * r,
          dy = Math.sin(ang) * r;
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
      // background
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
        // stripes
        tctx.lineWidth = Math.max(1, Math.floor(size / 4));
        tctx.beginPath();
        tctx.moveTo(0, size / 2);
        tctx.lineTo(size, size / 2);
        tctx.stroke();
      }
      const pattern = ctx.createPattern(tile, "repeat");
      // rotate if supported
      const ang = (Number(s.patternAngle || 0) * Math.PI) / 180;
      if (pattern && pattern.setTransform && ang) {
        const m = new DOMMatrix();
        m.a = Math.cos(ang);
        m.b = Math.sin(ang);
        m.c = -Math.sin(ang);
        m.d = Math.cos(ang);
        pattern.setTransform(m);
      }
      return pattern;
    }
    // solid
    return s.fill || "transparent";
  }
}

export default CircleTool;
