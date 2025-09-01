// src/canvasTool/tools/WatermarkTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class WatermarkTool extends BaseTool {
  static inspector = [
    { group: "Position", label: "X", type: "number", path: "data.x" },
    { group: "Position", label: "Y", type: "number", path: "data.y" },
    { group: "Text",     label: "Content", type: "textarea", path: "data.text" },
    { group: "Style",    label: "Font size", type: "number", path: "style.fontSize", min: 8 },
    { group: "Style",    label: "Color", type: "color", path: "style.fill" },
    { group: "FX",       label: "Opacity", type: "range", path: "style.opacity", min: 0, max: 1, step: 0.05 },
    { group: "Options",  label: "Tiled", type: "checkbox", path: "data.tiled" },
    { group: "Options",  label: "Angle (tiled)", type: "number", path: "data.rotationDeg", step: 1 },
    { group: "Options",  label: "Spacing xFS", type: "number", path: "data.spacingFactor", step: 0.5 },
  ];

  constructor() {
    super();
    this.name = "watermark";

    this.editing = false;
    this.pos = null;
    this.text = ""; // no default words; caret only until user types

    this.input = null;   // overlay textarea for caret & input
    this._unsub = null;  // store subscription

    // sensible defaults if not set in tool defaults
    this.defaultOpacity = 0.18;
    this.defaultFontSize = 32;
    this.defaultRotationDeg = -30;
    this.defaultSpacingFactor = 6;
  }

  // ---- helpers ----
  _store(engine) {
    return engine?.store && typeof engine.store.getState === "function"
      ? engine.store
      : useCanvasStore;
  }

  _readStyle(engine) {
    const s = this._store(engine).getState();
    const td = (s.toolDefaults && s.toolDefaults[this.name]) || {};
    const st = td.style || {};
    const dt = td.data  || {};

    // NOTE: no lineType / lineWidth here (not used for watermark)
    const color   = st.fill ?? st.stroke ?? s.color ?? "#000000";
    const fontSize = Math.max(8, Number(st.fontSize ?? this.defaultFontSize));
    const opacity  = (typeof st.opacity === "number") ? st.opacity : this.defaultOpacity;

    const tiled         = !!dt.tiled;
    const rotationDeg   = Number(dt.rotationDeg ?? this.defaultRotationDeg);
    const spacingFactor = Number(dt.spacingFactor ?? this.defaultSpacingFactor);

    return { color, fontSize, opacity, tiled, rotationDeg, spacingFactor };
  }

  _toClient(engine, p) {
    const canvas = engine.canvas || engine.ctx?.canvas;
    const r = canvas.getBoundingClientRect();
    const sx = r.width / canvas.width;
    const sy = r.height / canvas.height;
    return { left: r.left + p.x * sx, top: r.top + p.y * sy };
  }

  _ensureInput(engine) {
    if (this.input) return;

    const ta = document.createElement("textarea");
    Object.assign(ta.style, {
      position: "absolute",
      left: "0px",
      top: "0px",
      width: "320px",
      height: "1.8em",
      background: "transparent",
      color: "transparent",    // hide DOM text; we paint to canvas
      caretColor: "#00ffd0",   // blinking caret
      outline: "none",
      border: "1px dashed rgba(0,0,0,0.25)",
      padding: "4px 8px",
      resize: "none",
      zIndex: 10060,
      font: "16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      whiteSpace: "pre-wrap",
      overflow: "hidden",
    });
    document.body.appendChild(ta);
    this.input = ta;

    // type => live paint
    ta.addEventListener("input", () => {
      this.text = ta.value;
      this._composePreview(engine);
      const { fontSize } = this._readStyle(engine);
      const lines = Math.max(1, this.text.split("\n").length);
      ta.style.height = Math.min(6, lines) * (fontSize * 1.35) + "px";
    });

    // commit/cancel
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._commit(engine); }
      else if (e.key === "Escape") { e.preventDefault(); this._cancel(engine); }
    });

    // reflect dock/default changes live
    const store = this._store(engine);
    this._unsub = store.subscribe((state, prev) => {
      if (state.toolDefaults !== prev.toolDefaults ||
          state.color !== prev.color) {
        if (this.editing) this._composePreview(engine);
      }
    });
  }

  _positionInput(engine) {
    if (!this.input || !this.pos) return;
    const { left, top } = this._toClient(engine, this.pos);
    const { fontSize } = this._readStyle(engine);
    this.input.style.left = Math.round(left) + "px";
    this.input.style.top  = Math.round(top - fontSize * 0.8) + "px";
    this.input.style.fontSize = fontSize + "px";
  }

  _destroyInput() {
    if (this._unsub) { try { this._unsub(); } catch {} this._unsub = null; }
    if (this.input) { this.input.remove(); this.input = null; }
  }

  _composePreview(engine) {
    if (!this.editing || !this.pos) return;

    const { color, fontSize, opacity } = this._readStyle(engine);
    const ctx = engine.ctx;

    // baseline
    engine.renderAllObjects();

    // draw typed text (if any). If empty, we draw nothing — only caret blinks
    if (this.text && this.text.length) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;

      const lines = String(this.text).split("\n");
      const lh = Math.round(fontSize * 1.3);
      let y = this.pos.y - ((lines.length - 1) * lh) / 2;
      for (const ln of lines) {
        ctx.fillText(ln, this.pos.x, y);
        y += lh;
      }
      ctx.restore();
    }

    // keep input caret aligned
    this._positionInput(engine);
  }

  _commit(engine) {
    if (!this.editing || !this.pos) return;
    const txt = (this.text || "").trim();
    if (!txt) { this._cancel(engine); return; }

    const { color, fontSize, opacity, tiled, rotationDeg, spacingFactor } = this._readStyle(engine);
    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map(o => o.layer || 0))
      : 0;

    store.addObject(new CanvasObject({
      type: "watermark",
      data: {
        x: this.pos.x,
        y: this.pos.y,
        text: txt,
        tiled,
        opacity,
        rotationDeg,
        spacingFactor,
      },
      style: {
        // renderer uses s.stroke || s.fill for color and style.fontSize
        stroke: color,
        fill: color,
        fontSize,
      },
      layer: maxLayer + 1,
    }));

    this._endEditing(engine);
    engine.renderAllObjects();
  }

  _cancel(engine) {
    this._endEditing(engine);
    engine.renderAllObjects();
  }

  _endEditing(engine) {
    this.editing = false;
    this.pos = null;
    this.text = "";
    this._destroyInput();
  }

  // ---- events ----
  onMouseDown(e, pos, engine) {
    // If we're already typing, clicking elsewhere should COMMIT first.
    if (this.editing) {
      if (this.text.trim()) this._commit(engine);
      else this._cancel(engine);
    }

    // Start a new caret (no default wording)
    this._ensureInput(engine);
    this.editing = true;
    this.pos = pos;
    this.text = "";                 // keep empty until user types
    this.input.value = "";
    this._positionInput(engine);
    this.input.focus();
    this.input.setSelectionRange(0, 0);
    this._composePreview(engine);   // paints nothing (caret only)
  }

  onMouseMove(e, pos, engine) {
    if (!this.editing) return;
    this.pos = pos;
    this._composePreview(engine);
  }

  onMouseUp(e, pos, engine) {
    // commit is via Enter; clicking elsewhere handled in next mousedown
  }

  onKeyDown(e, engine) {
    if (!this.editing) return;
    if (e.key === "Escape") this._cancel(engine);
  }

  onDeactivate(engine) { if (this.editing) this._endEditing(engine); }
  onBlur(engine)       { if (this.editing) this._endEditing(engine); }
}

export default WatermarkTool;
