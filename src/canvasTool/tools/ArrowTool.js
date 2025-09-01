// src/canvasTool/tools/ArrowTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class ArrowTool extends BaseTool {
  static inspector = [
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
      label: "Head size",
      type: "number",
      path: "style.headSize",
      min: 4,
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
        group: "Arrow",
        label: "Head Size",
        type: "number",
        path: "meta.arrowSize",
        default: 10,
        min: 4,
        max: 48,
        step: 1,
      },
      {
        group: "Arrow",
        label: "Closed",
        type: "checkbox",
        path: "meta.arrowClosed",
        default: true,
      },
    ],
  };

  constructor() {
    super();
    this.name = "arrow"; // MUST match toolDefaults key
    this.startPos = null;
    this.snapshot = null;
    this._styleSnapshot = null; // frozen per-stroke style
  }

  // ---- helpers (preview) ----------------------------------------------------

  _applyStroke(ctx, s) {
    ctx.globalAlpha = typeof s.opacity === "number" ? s.opacity : 1;
    ctx.strokeStyle = s.stroke ?? "#000";
    ctx.lineWidth = s.lineWidth ?? 2;
    ctx.lineJoin = s.lineJoin || "miter";
    ctx.lineCap = s.lineCap || "butt";
    ctx.miterLimit = s.miterLimit ?? 10;
    if (s.composite) ctx.globalCompositeOperation = s.composite;
  }

  _applyDash(ctx, s) {
    const lt = s.lineType || "solid";
    if (lt === "dashed") {
      const dash = Math.max(1, Math.floor(s.dashSize ?? s.lineWidth * 3));
      const gap = Math.max(1, Math.floor(s.dashGap ?? s.lineWidth * 2));
      ctx.setLineDash([dash, gap]);
      if (!s.lineCap) ctx.lineCap = "butt";
    } else if (lt === "dotted") {
      const dot = Math.max(1, Math.floor(s.dotSize ?? 1));
      const gap = Math.max(1, Math.floor(s.dotGap ?? s.lineWidth * 1.5));
      ctx.setLineDash([dot, gap]);
      ctx.lineCap = "round";
    } else {
      ctx.setLineDash([]);
    }
  }

  _drawArrowPreview(ctx, from, to, s) {
    // shaft
    this._applyStroke(ctx, s);
    this._applyDash(ctx, s);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // head (triangle)
    const headLen = Math.max(
      4,
      Number(s.headSize ?? Math.max(10, (s.lineWidth ?? 2) * 3))
    );
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const a = angle - Math.PI / 6;
    const b = angle + Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLen * Math.cos(a), to.y - headLen * Math.sin(a));
    ctx.lineTo(to.x - headLen * Math.cos(b), to.y - headLen * Math.sin(b));
    ctx.closePath();

    // fill head (use stroke color unless a fill is provided and enabled)
    const fillOn = s.fillEnabled ?? true; // default filled head
    const fillCol = s.fill || s.stroke || "#000";
    if (fillOn) {
      const prev = ctx.globalAlpha;
      ctx.fillStyle = fillCol;
      ctx.globalAlpha =
        prev * (typeof s.fillOpacity === "number" ? s.fillOpacity : 1);
      ctx.fill();
      ctx.globalAlpha = prev;
    }
    ctx.stroke(); // outline the head with same dash/width
  }

  // ---- events ---------------------------------------------------------------

  onMouseDown(e, pos, engine) {
    this.startPos = pos;
    this.snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);

    // Freeze per-tool defaults from the dock
    const { style } = this.getToolOptions(engine.store);
    this._styleSnapshot = {
      stroke: style.stroke ?? "#000",
      fill: style.fill, // if you expose a separate head fill, set here
      fillEnabled: style.fillEnabled ?? true,
      fillOpacity: style.fillOpacity ?? 1,
      lineWidth: style.lineWidth ?? 2,
      opacity: typeof style.opacity === "number" ? style.opacity : 1,
      lineType:
        (style.lineType === "cloud" ? "solid" : style.lineType) || "solid",
      lineJoin: style.lineJoin,
      lineCap: style.lineCap,
      miterLimit: style.miterLimit,
      composite: style.composite,
      headSize: Number(
        style.headSize ?? Math.max(10, (style.lineWidth ?? 2) * 3)
      ),
      // dash/dot tuning (optional)
      dashSize: style.dashSize,
      dashGap: style.dashGap,
      dotSize: style.dotSize,
      dotGap: style.dotGap,
    };
  }

  onMouseMove(e, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    engine.ctx.putImageData(this.snapshot, 0, 0);
    this._drawArrowPreview(engine.ctx, this.startPos, pos, this._styleSnapshot);
  }

  onMouseUp(e, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map((o) => o.layer || 0))
      : 0;

    // Save final object with the frozen style
    store.addObject(
      new CanvasObject({
        type: "arrow",
        data: {
          x1: this.startPos.x,
          y1: this.startPos.y,
          x2: pos.x,
          y2: pos.y,
        },
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

export default ArrowTool;
