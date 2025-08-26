// src/canvasTool/tools/TextTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";
import { ensureTextToolbar } from "../ui/TextToolbar";

// tiny safe getter used by inspector
const dget = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

export class TextTool extends BaseTool {
  static inspector = [
    { group: "Position", label: "X", type: "number", path: "data.x" },
    { group: "Position", label: "Y", type: "number", path: "data.y" },
    { group: "Size",     label: "W", type: "number", path: "data.width" },
    { group: "Size",     label: "H", type: "number", path: "data.height" },

    { group: "Text",     label: "Content",   type: "textarea", path: "data.text" },
    { group: "Text",     label: "Font size", type: "number",   path: "style.fontSize", min: 8, step: 1 },
    {
      group: "Text",
      label: "Font",
      type: "select",
      path: "style.fontFamily",
      options: [
        "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        "Georgia, serif",
        "'Courier New', monospace",
      ],
    },

    { group: "Style", label: "Fill",   type: "color", path: "style.fill" },
    {
      group: "Style",
      label: "Stroke",
      type: "color",
      path: "style.stroke",
      showIf: (o) => dget(o, "style.stroke") !== undefined,
    },

    {
      group: "FX",
      label: "Opacity",
      type: "range",
      path: "style.opacity",
      min: 0, max: 1, step: 0.05,
    },
  ];

  static defaultsPanel = {
  fields: [
    { group: "Font",  label: "Color",       type: "color",  path: "style.fill",       default: "#111111" },
    { group: "Font",  label: "Family",      type: "text",   path: "style.fontFamily", default: "Inter, system-ui, sans-serif" },
    { group: "Font",  label: "Size",        type: "number", path: "style.fontSize",   default: 18, min: 8, max: 128, step: 1 },
    { group: "Font",  label: "Weight",      type: "select", path: "style.fontWeight", default: "500",
      options: [{label:"400 (Regular)",value:"400"},{label:"500 (Medium)",value:"500"},{label:"600 (Semibold)",value:"600"},{label:"700 (Bold)",value:"700"}]
    },
    { group: "Font",  label: "Italic",      type: "checkbox", path: "style.italic",     default: false },
    { group: "Type",  label: "Align",       type: "select",  path: "style.textAlign",  default: "left",
      options: [{label:"Left",value:"left"},{label:"Center",value:"center"},{label:"Right",value:"right"}]
    },
    { group: "Type",  label: "Line Height", type: "number", path: "style.lineHeight", default: 1.25, min: 0.8, max: 3, step: 0.05 },
    { group: "Box",   label: "Padding",     type: "number", path: "style.padding",    default: 4, min: 0, max: 64, step: 1 },
    { group: "Box",   label: "Background",  type: "color",  path: "style.background", default: "transparent" }
  ]
};


  constructor() {
    super();
    this.name = "text";

    // drag-to-create
    this.drawing = false;
    this.start = null;         // {x,y}
    this.curr  = null;         // {x,y}
    this.minBox = 6;

    // editor overlay
    this.editor = null;        // HTMLDivElement (contentEditable)
    this.toolbar = null;       // toolbar DOM
    this.activeRect = null;

    // style state (kept in sync with Tool Defaults)
    this.state = {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      fontSize: 18,
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      align: "left",
      opacity: 1.0,
      color: "#000000",
      rotationDeg: 0,
      lineHeight: undefined,
      letterSpacing: undefined,
    };

    this._unsub = null;        // store subscription while editing
  }

  _store(engine) {
    return (engine?.store && typeof engine.store.getState === "function")
      ? engine.store
      : useCanvasStore;
  }

  _defaultFontSize(storeState) {
    const lw = Number(storeState.lineWidth ?? 2);
    return Math.max(12, Math.round(lw * 8)); // 2 -> 16, 5 -> 40
  }

  _normRect(a, b) {
    const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x), y2 = Math.max(a.y, b.y);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  _clearCanvas(engine) {
    const canvas = engine.canvas || engine.ctx?.canvas;
    const W = canvas?.width ?? engine.width ?? 0;
    const H = canvas?.height ?? engine.height ?? 0;
    engine.ctx.clearRect(0, 0, W, H);
  }

  _drawMarquee(engine) {
    if (!this.drawing || !this.start || !this.curr) return;
    this._clearCanvas(engine);
    engine.renderAllObjects();

    const ctx = engine.ctx;
    const rect = this._normRect(this.start, this.curr);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.setLineDash?.([6, 4]);
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(0, rect.w - 1), Math.max(0, rect.h - 1));
    ctx.restore();
  }

  // ---------- defaults <-> local state ----------
  _loadDefaults(engine) {
    const store = this._store(engine).getState();
    const td = (store.toolDefaults && store.toolDefaults[this.name]) || {};
    const st = td.style || {};
    const dt = td.data  || {};

    // fallbacks
    const color     = st.fill ?? st.stroke ?? store.color ?? "#000000";
    const fontSize  = Number(st.fontSize ?? this._defaultFontSize(store));
    const fontFamily= st.fontFamily ?? this.state.fontFamily;
    const opacity   = (typeof st.opacity === "number") ? st.opacity : (this.state.opacity ?? 1);

    const bold      = !!st.bold;
    const italic    = !!st.italic;
    const underline = !!dt.underline;
    const strike    = !!dt.strike;
    const align     = dt.align ?? this.state.align;
    const rotationDeg = Number(dt.rotationDeg ?? this.state.rotationDeg);
    const lineHeight = dt.lineHeight ?? this.state.lineHeight;
    const letterSpacing = dt.letterSpacing ?? this.state.letterSpacing;

    Object.assign(this.state, {
      color, fontSize, fontFamily, opacity, bold, italic, underline, strike,
      align, rotationDeg, lineHeight, letterSpacing,
    });
  }

  _writeDefaults(engine) {
    const storeRef = this._store(engine);
    const setToolDefaults = storeRef.getState().setToolDefaults;
    if (typeof setToolDefaults !== "function") return;

    setToolDefaults(this.name, {
      style: {
        fill: this.state.color,
        stroke: this.state.color,
        fontSize: this.state.fontSize,
        fontFamily: this.state.fontFamily,
        bold: !!this.state.bold,
        italic: !!this.state.italic,
        opacity: Number(this.state.opacity ?? 1),
      },
      data: {
        align: this.state.align,
        underline: !!this.state.underline,
        strike: !!this.state.strike,
        rotationDeg: Number(this.state.rotationDeg || 0),
        lineHeight: this.state.lineHeight,
        letterSpacing: this.state.letterSpacing,
      },
    });
  }

  // ---------- overlay creation ----------
  _createEditor(engine, rect) {
    const canvas = engine.canvas || engine.ctx.canvas;
    const host = canvas.parentElement || document.body;

    // pull current tool defaults once for this session
    this._loadDefaults(engine);

    // editor
    const ed = document.createElement("div");
    ed.contentEditable = "true";
    ed.spellcheck = false;
    Object.assign(ed.style, {
      position: "absolute",
      left: rect.x + "px",
      top: rect.y + "px",
      width: rect.w + "px",
      height: rect.h + "px",
      padding: "8px",
      outline: "2px solid #3b82f6",
      border: "0",
      borderRadius: "4px",
      background: "rgba(255,255,255,0.95)",
      whiteSpace: "pre-wrap",
      overflow: "auto",
      zIndex: 1000,
      userSelect: "text",
      WebkitUserSelect: "text",
    });

    // apply CSS from our state
    this._applyEditorStyles(ed);

    // toolbar (writes back to defaults & restyles editor live)
    const tb = ensureTextToolbar(
      host,
      (next) => {
        Object.assign(this.state, next);
        this._applyEditorStyles(ed);
        this._writeDefaults(engine);     // <— persist as tool defaults
        ed.focus();
      },
      this.state
    );

    // live subscribe to dock changes while editing
    const storeRef = this._store(engine);
    this._unsub = storeRef.subscribe((state, prev) => {
      if (state.toolDefaults !== prev.toolDefaults || state.color !== prev.color) {
        const before = { ...this.state };
        this._loadDefaults(engine);
        // if something changed, restyle editor
        const changed =
          JSON.stringify(before) !== JSON.stringify(this.state);
        if (changed && this.editor) this._applyEditorStyles(this.editor);
      }
    });

    // finish/cancel handlers
    const finish = (commit = true) => {
      tb.remove();
      this.toolbar = null;
      this._finalize(engine, rect, ed, commit);
    };

    ed.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); finish(true); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });

    // click outside -> commit
    const onClickOutside = (e) => {
      if (e.target === ed || tb.contains(e.target)) return;
      document.removeEventListener("mousedown", onClickOutside, true);
      finish(true);
    };
    setTimeout(() => document.addEventListener("mousedown", onClickOutside, true), 0);

    host.appendChild(ed);
    this.editor = ed;
    this.toolbar = tb;
    this.activeRect = rect;

    // focus caret at start
    ed.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount) sel.removeAllRanges();
  }

  _applyEditorStyles(ed) {
    ed.style.color = this.state.color;
    ed.style.opacity = String(this.state.opacity ?? 1);
    ed.style.fontFamily = this.state.fontFamily;
    ed.style.fontSize = `${this.state.fontSize}px`;
    ed.style.fontWeight = this.state.bold ? "700" : "400";
    ed.style.fontStyle = this.state.italic ? "italic" : "normal";
    ed.style.textDecoration =
      [
        this.state.underline ? "underline" : "",
        this.state.strike ? "line-through" : "",
      ].filter(Boolean).join(" ") || "none";
    ed.style.textAlign = this.state.align || "left";
    if (this.state.lineHeight) ed.style.lineHeight = String(this.state.lineHeight);
    if (this.state.letterSpacing !== undefined)
      ed.style.letterSpacing = `${this.state.letterSpacing}px`;
    // rotation is applied when committing (canvas render), not in DOM overlay
  }

  // ---------- commit/cancel ----------
  _finalize(engine, rect, ed, commit) {
    const canvas = engine.canvas || engine.ctx.canvas;
    const host = canvas.parentElement || document.body;

    const text = (ed.innerText || "").replace(/\u00A0/g, " ").trimEnd();
    try { host.removeChild(ed); } catch {}
    this.editor = null;

    // stop store subscription
    if (this._unsub) { try { this._unsub(); } catch {} this._unsub = null; }

    // clear overlay marquee
    this._clearCanvas(engine);
    engine.renderAllObjects();

    if (!commit || !text.trim()) {
      this.drawing = false;
      this.start = this.curr = null;
      this.activeRect = null;
      return;
    }

    const storeRef = this._store(engine);
    const s = storeRef.getState();
    const maxLayer = s.objects.length ? Math.max(...s.objects.map(o => o.layer || 0)) : 0;

    s.addObject(
      new CanvasObject({
        type: "text",
        data: {
          x: rect.x, y: rect.y, width: rect.w, height: rect.h,
          text,
          align: this.state.align,
          opacity: Number(this.state.opacity ?? 1),
          rotationDeg: Number(this.state.rotationDeg || 0),
          underline: !!this.state.underline,
        },
        style: {
          stroke: this.state.color,            // renderer uses stroke/fill as color
          fill: this.state.color,
          fontSize: Number(this.state.fontSize),
          fontFamily: this.state.fontFamily,
          bold: !!this.state.bold,
          italic: !!this.state.italic,
        },
        layer: maxLayer + 1,
      })
    );

    // reset
    this.drawing = false;
    this.start = this.curr = null;
    this.activeRect = null;

    engine.renderAllObjects();
  }

  // ------------- events -------------
  onMouseDown(event, pos, engine) {
    this.drawing = true;
    this.start = pos;
    this.curr = pos;
    this._drawMarquee(engine);
  }

  onMouseMove(event, pos, engine) {
    if (!this.drawing) return;
    this.curr = pos;
    this._drawMarquee(engine);
  }

  onMouseUp(event, pos, engine) {
    if (!this.drawing) return;
    this.curr = pos || this.curr;

    let rect = this._normRect(this.start, this.curr);
    if (rect.w < this.minBox && rect.h < this.minBox) {
      rect = { x: rect.x, y: rect.y, w: 240, h: 96 };
    }

    this._clearCanvas(engine);
    engine.renderAllObjects();
    this._createEditor(engine, rect);
  }

  onDeactivate(engine) {
    if (this.editor && this.activeRect) {
      this._finalize(engine, this.activeRect, this.editor, true);
    }
    this.drawing = false;
    this.start = this.curr = null;
    this.activeRect = null;
    this._clearCanvas(engine);
    engine.renderAllObjects();
  }

  onBlur(engine) {
    this.onDeactivate(engine);
  }
}

export default TextTool;
