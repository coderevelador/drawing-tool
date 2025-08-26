// src/canvasTool/tools/PencilTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class PencilTool extends BaseTool {
  // Inspector schema (unchanged)
  static inspector = [
    { group: "Meta", label: "Name", type: "text", path: "name", showIf: (o) => o?.name != null },
    { group: "Meta", label: "Locked", type: "checkbox", path: "locked", showIf: (o) => o?.locked != null },

    { group: "Position", label: "X", type: "number", path: "data.x", showIf: (o) => o?.data?.x != null },
    { group: "Position", label: "Y", type: "number", path: "data.y", showIf: (o) => o?.data?.y != null },
    { group: "Size", label: "W", type: "number", path: "data.width", showIf: (o) => o?.data?.width != null },
    { group: "Size", label: "H", type: "number", path: "data.height", showIf: (o) => o?.data?.height != null },

    {
      group: "Path", label: "Points (JSON)", type: "textarea", path: "data.points",
      showIf: (o) => Array.isArray(o?.data?.points),
      parse: (v) => { try { return JSON.parse(v); } catch { return []; } },
      format: (v) => JSON.stringify(v ?? [], null, 0),
    },

    { group: "Style", label: "Stroke", type: "color", path: "style.stroke", showIf: (o) => o?.style?.stroke != null },
    { group: "Style", label: "Width", type: "number", path: "style.lineWidth", min: 1, step: 1, showIf: (o) => o?.style?.lineWidth != null },
    { group: "FX", label: "Opacity", type: "range", path: "style.opacity", min: 0, max: 1, step: 0.05, showIf: (o) => o?.style?.opacity != null },

    // Optional compositing & brush details if you store them:
    { group: "FX", label: "Composite", type: "select", path: "style.composite",
      options: ["source-over","multiply","screen","overlay","darken","lighten","color-burn","color-dodge","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity"],
      showIf: (o) => o?.style?.composite != null },

    { group: "Stroke", label: "Cap", type: "select", path: "style.lineCap", options: ["round","butt","square"], showIf: (o) => o?.style?.lineCap != null },
    { group: "Stroke", label: "Join", type: "select", path: "style.lineJoin", options: ["round","bevel","miter"], showIf: (o) => o?.style?.lineJoin != null },
    { group: "Stroke", label: "Miter Limit", type: "number", path: "style.miterLimit", min: 1, step: 1, showIf: (o) => o?.style?.miterLimit != null },

    // Dash/dot tuning (optional; used below)
    { group: "Stroke", label: "Dash size", type: "number", path: "style.dashSize", min: 1, step: 1, showIf: (o) => o?.style?.dashSize != null },
    { group: "Stroke", label: "Dash gap",  type: "number", path: "style.dashGap",  min: 1, step: 1, showIf: (o) => o?.style?.dashGap  != null },
    { group: "Stroke", label: "Dot size",  type: "number", path: "style.dotSize",  min: 1, step: 1, showIf: (o) => o?.style?.dotSize  != null },
    { group: "Stroke", label: "Dot gap",   type: "number", path: "style.dotGap",   min: 1, step: 1, showIf: (o) => o?.style?.dotGap   != null },
  ];

  static defaultsPanel = {
  fields: [
    { group: "Stroke",    label: "Color",      type: "color",  path: "style.stroke",    default: "#1f2937" },
    { group: "Stroke",    label: "Width",      type: "number", path: "style.lineWidth", default: 2, min: 0.5, max: 24, step: 0.5 },
    { group: "Stroke",    label: "Opacity",    type: "range",  path: "style.opacity",   default: 1, min: 0, max: 1, step: 0.05 },
    { group: "Behavior",  label: "Smoothing",  type: "range",  path: "meta.smoothing",  default: 0.5, min: 0, max: 1, step: 0.05 },
    { group: "Behavior",  label: "Streamline", type: "range",  path: "meta.streamline", default: 0.4, min: 0, max: 1, step: 0.05 },
    { group: "Caps",      label: "Line Cap",   type: "select", path: "style.lineCap",   default: "round",
      options: [{label:"Butt",value:"butt"},{label:"Round",value:"round"},{label:"Square",value:"square"}]
    }
  ]
};


  constructor() {
    super();
    this.name = "pencil";          // MUST match store.toolDefaults key
    this._isDrawing = false;
    this.points = [];
    this._styleSnapshot = null;
  }

  // compute dash pattern specifically for pencil (solid/dashed/dotted only)
  _applyDashForPencil(ctx, style) {
    const lt = style.lineType || "solid";
    if (lt === "dashed") {
      const dash = Math.max(1, Math.floor(style.dashSize ?? (style.lineWidth * 3)));
      const gap  = Math.max(1, Math.floor(style.dashGap  ?? (style.lineWidth * 2)));
      ctx.setLineDash([dash, gap]);
      // square/butt caps look cleaner for dashes
      ctx.lineCap = style.lineCap || "butt";
    } else if (lt === "dotted") {
      // round-capped tiny dashes => clean dots; dot diameter ≈ lineWidth
      const dot = Math.max(1, Math.floor(style.dotSize ?? 1)); // keep very short
      const gap = Math.max(1, Math.floor(style.dotGap  ?? (style.lineWidth * 1.5)));
      ctx.setLineDash([dot, gap]);
      ctx.lineCap = "round";
    } else {
      ctx.setLineDash([]);
      ctx.lineCap = style.lineCap || "round";
    }
  }

  onMouseDown(event, pos, engine) {
    this._isDrawing = true;
    this.points = [{ x: pos.x, y: pos.y }];

    // Freeze per-tool defaults at stroke start
    const { style } = this.getToolOptions(engine.store);
    this._styleSnapshot = {
      stroke: style.stroke ?? "#000",
      lineWidth: style.lineWidth ?? 2,
      opacity: typeof style.opacity === "number" ? style.opacity : 1,
      lineType: (style.lineType === "cloud" ? "solid" : style.lineType) || "solid", // pencil never uses cloud
      lineJoin: style.lineJoin || "round",
      lineCap: style.lineCap || "round",
      miterLimit: style.miterLimit ?? 10,
      composite: style.composite,
      // optional dash/dot tuning
      dashSize: style.dashSize,
      dashGap:  style.dashGap,
      dotSize:  style.dotSize,
      dotGap:   style.dotGap,
    };

    // live preview stroke
    const ctx = engine.ctx;
    if (ctx) {
      ctx.save();
      ctx.globalAlpha = this._styleSnapshot.opacity;
      ctx.strokeStyle = this._styleSnapshot.stroke;
      ctx.lineWidth   = this._styleSnapshot.lineWidth;
      ctx.lineJoin    = this._styleSnapshot.lineJoin;
      ctx.miterLimit  = this._styleSnapshot.miterLimit;
      if (this._styleSnapshot.composite) {
        ctx.globalCompositeOperation = this._styleSnapshot.composite;
      }
      this._applyDashForPencil(ctx, this._styleSnapshot);

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  }

  onMouseMove(event, pos, engine) {
    if (!this._isDrawing) return;
    this.points.push({ x: pos.x, y: pos.y });

    const ctx = engine.ctx;
    if (ctx) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  }

  onMouseUp(event, pos, engine) {
    if (!this._isDrawing) return;
    this._isDrawing = false;

    const ctx = engine.ctx;
    if (ctx) {
      try { ctx.closePath(); } catch {}
      try { ctx.restore(); }   catch {}
    }

    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length ? Math.max(...store.objects.map((o) => o.layer || 0)) : 0;

    // Final object -> renderer will also respect dotted/dashed via style.lineType
    const obj = new CanvasObject({
      type: "pencil",
      data: { points: this.points.slice(), path: this.points.slice() }, // keep both for compatibility
      style: { ...this._styleSnapshot },
      layer: maxLayer + 1,
    });

    store.addObject(obj);
    engine.renderAllObjects?.();

    this.points = [];
    this._styleSnapshot = null;
  }
}

export default PencilTool;
