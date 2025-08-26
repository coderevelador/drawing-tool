// src/canvasTool/tools/CalloutTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class CalloutTool extends BaseTool {
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
      group: "Text",
      label: "Font size",
      type: "number",
      path: "style.fontSize",
      min: 8,
      step: 1,
    },
    {
      group: "Text",
      label: "Font family",
      type: "text",
      path: "style.fontFamily",
    },
    {
      group: "Text",
      label: "Text color",
      type: "color",
      path: "style.textColor",
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
        group: "Text",
        label: "Color",
        type: "color",
        path: "style.fill",
        default: "#111111",
      },
      {
        group: "Text",
        label: "Size",
        type: "number",
        path: "style.fontSize",
        default: 14,
        min: 8,
        max: 72,
        step: 1,
      },
      {
        group: "Text",
        label: "Weight",
        type: "select",
        path: "style.fontWeight",
        default: "500",
        options: [
          { label: "400", value: "400" },
          { label: "500", value: "500" },
          { label: "600", value: "600" },
          { label: "700", value: "700" },
        ],
      },

      {
        group: "Box",
        label: "Padding",
        type: "number",
        path: "style.padding",
        default: 6,
        min: 0,
        max: 64,
        step: 1,
      },
      {
        group: "Box",
        label: "Background",
        type: "color",
        path: "style.background",
        default: "#fffbea",
      },
      {
        group: "Box",
        label: "Border",
        type: "color",
        path: "style.stroke",
        default: "#f59e0b",
      },
      {
        group: "Box",
        label: "Border W",
        type: "number",
        path: "style.lineWidth",
        default: 1,
        min: 0,
        max: 8,
        step: 0.5,
      },

      {
        group: "Leader",
        label: "Tail",
        type: "checkbox",
        path: "meta.hasLeader",
        default: true,
      },
      {
        group: "Leader",
        label: "Tail Width",
        type: "number",
        path: "meta.leaderWidth",
        default: 1.5,
        min: 0.5,
        max: 8,
        step: 0.5,
      },
    ],
  };

  constructor() {
    super();
    this.name = "callout";
    this.startPos = null;
    this.snapshot = null;
    this._styleSnapshot = null;
    this._editor = null;
  }

  // ---------- helpers (preview) ----------

  _applyStroke(ctx, s) {
    ctx.globalAlpha = typeof s.opacity === "number" ? s.opacity : 1;
    ctx.strokeStyle = s.stroke ?? "#000";
    ctx.lineWidth = s.lineWidth ?? 2;
    ctx.lineJoin = s.lineJoin || "round";
    ctx.lineCap = s.lineCap || "round";
    ctx.miterLimit = s.miterLimit ?? 10;
    ctx.setLineDash([]); // <— NO line type for callout
    if (s.composite) ctx.globalCompositeOperation = s.composite;
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

  _bubblePath(ctx, x, y, w, h, s) {
    const r = Math.max(0, Number(s.cornerRadius ?? 15));
    const tw = Math.max(0, Number(s.tailWidth ?? 20));
    const th = Math.max(0, Number(s.tailHeight ?? 15));
    const tailStartX =
      x +
      Math.max(0, Math.min(w, s.tailOffset != null ? s.tailOffset : w * 0.7));

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);

    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);

    // tail (bottom edge)
    ctx.lineTo(tailStartX + tw, y + h);
    ctx.lineTo(tailStartX + tw / 2, y + h + th);
    ctx.lineTo(tailStartX, y + h);

    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);

    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ---------- events ----------

  onMouseDown(e, pos, engine) {
    this.startPos = pos;
    this.snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);

    // Freeze per-tool defaults (ignore any lineType)
    const { style } = this.getToolOptions(engine.store);
    this._styleSnapshot = {
      stroke: style.stroke ?? "#fff",
      fill: style.fill ?? "#00000000",
      fillEnabled: style.fillEnabled ?? true,
      fillOpacity: style.fillOpacity ?? 1,
      lineWidth: style.lineWidth ?? 2,
      opacity: typeof style.opacity === "number" ? style.opacity : 1,
      lineJoin: style.lineJoin || "round",
      lineCap: style.lineCap || "round",
      miterLimit: style.miterLimit ?? 10,
      composite: style.composite,

      // text style
      fontSize: Math.max(8, Number(style.fontSize ?? 16)),
      fontFamily:
        style.fontFamily ||
        "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      textColor: style.textColor || style.stroke || "#000",

      // bubble geometry
      cornerRadius: style.cornerRadius ?? 15,
      tailWidth: style.tailWidth ?? 20,
      tailHeight: style.tailHeight ?? 15,
      tailOffset: style.tailOffset, // optional
    };
  }

  onMouseMove(e, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    const ctx = engine.ctx;
    ctx.putImageData(this.snapshot, 0, 0);

    const x = Math.min(this.startPos.x, pos.x);
    const y = Math.min(this.startPos.y, pos.y);
    const w = Math.abs(pos.x - this.startPos.x);
    const h = Math.abs(pos.y - this.startPos.y);

    this._applyStroke(ctx, this._styleSnapshot);
    this._bubblePath(ctx, x, y, w, h, this._styleSnapshot);
    this._fillPreview(ctx, this._styleSnapshot);
    ctx.stroke();
  }

  onMouseUp(e, pos, engine) {
    if (!this.snapshot || !this.startPos) return;

    // Final rect
    const x = Math.min(this.startPos.x, pos.x);
    const y = Math.min(this.startPos.y, pos.y);
    const w = Math.abs(pos.x - this.startPos.x);
    const h = Math.abs(pos.y - this.startPos.y);

    // clear preview
    engine.ctx.putImageData(this.snapshot, 0, 0);

    // open live editor
    this._openEditor(engine, { x, y, width: w, height: h }, (text) => {
      const store = useCanvasStore.getState();
      const maxLayer = store.objects.length
        ? Math.max(...store.objects.map((o) => o.layer || 0))
        : 0;

      store.addObject(
        new CanvasObject({
          type: "callout",
          data: { x, y, width: w, height: h, text },
          style: { ...this._styleSnapshot }, // no lineType saved
          layer: maxLayer + 1,
        })
      );

      engine.renderAllObjects?.();
    });

    // reset drag state
    this.startPos = null;
    this.snapshot = null;
  }

  // ---------- inline editor ----------

  _openEditor(engine, rect, onCommit) {
    // Remove existing editor if any
    if (this._editor) {
      this._editor.remove();
      this._editor = null;
    }

    const ta = document.createElement("textarea");
    this._editor = ta;

    const pad = 10;
    const { x, y, width: w, height: h } = rect;
    const canvas = engine.canvas;
    const bb = canvas.getBoundingClientRect();

    Object.assign(ta.style, {
      position: "fixed",
      left: `${bb.left + x + pad}px`,
      top: `${bb.top + y + pad}px`,
      width: `${Math.max(20, w - pad * 2)}px`,
      height: `${Math.max(20, h - pad * 2)}px`,
      zIndex: 10060,
      margin: "0",
      padding: "0",
      border: "0",
      outline: "none",
      background: "transparent",
      color:
        this._styleSnapshot.textColor || this._styleSnapshot.stroke || "#000",
      font: `${this._styleSnapshot.fontSize}px ${this._styleSnapshot.fontFamily}`,
      lineHeight: "1.25",
      resize: "none",
      overflow: "hidden",
      whiteSpace: "pre-wrap",
    });

    // put a thin visual caret boundary if fill is very dark
    // (optional) ta.style.textShadow = "0 0 1px #000";

    document.body.appendChild(ta);
    ta.focus();

    const done = (commit) => {
      const text = commit ? ta.value : "";
      ta.remove();
      this._editor = null;
      if (commit) onCommit?.(text);
    };

    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        done(false);
      } else if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        done(true);
      }
    });
    ta.addEventListener("blur", () => done(true));
  }
}

export default CalloutTool;
