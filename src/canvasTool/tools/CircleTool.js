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

      // ✅ Fill parity with Rect
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
    ctx.fillStyle = s.fill || "transparent";
    ctx.globalAlpha =
      prev * (typeof s.fillOpacity === "number" ? s.fillOpacity : 1);
    ctx.fill();
    ctx.globalAlpha = prev;
  }

  // --- events ----------------------------------------------------------------

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
}

export default CircleTool;
