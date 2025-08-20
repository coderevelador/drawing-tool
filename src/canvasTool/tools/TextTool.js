import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";
import { ensureTextToolbar } from "../ui/TextToolbar"; // new helper below

export class TextTool extends BaseTool {
  constructor() {
    super();
    this.name = "text";

    // drag-to-create
    this.drawing = false;
    this.start = null; // {x,y}
    this.curr = null; // {x,y}
    this.minBox = 6;

    // editor overlay
    this.editor = null; // HTMLDivElement contentEditable
    this.toolbar = null; // toolbar DOM
    this.activeRect = null;

    // style state (toolbar controls these)
    this.state = {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      fontSize: 18,
      bold: false,
      italic: false,
      underline: false,
      align: "left", // left | center | right
      opacity: 1.0,
      color: "#000000",
      rotationDeg: 0,
    };
  }

  // map your width slider into a starting font size (can be changed in toolbar)
  _defaultFontSize(storeState) {
    const lw = Number(storeState.lineWidth ?? 2);
    return Math.max(12, Math.round(lw * 8)); // 2 -> 16, 5 -> 40
  }

  // utils
  _normRect(a, b) {
    const x1 = Math.min(a.x, b.x),
      y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x),
      y2 = Math.max(a.y, b.y);
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
    ctx.strokeStyle = "#3b82f6"; // subtle blue
    ctx.lineWidth = 1;
    if (ctx.setLineDash) ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      rect.x + 0.5,
      rect.y + 0.5,
      Math.max(0, rect.w - 1),
      Math.max(0, rect.h - 1)
    );
    ctx.restore();
  }

  // --- overlay creation ---
  _createEditor(engine, rect) {
    const canvas = engine.canvas || engine.ctx.canvas;
    const host = canvas.parentElement || document.body;

    // editor (contentEditable)
    const ed = document.createElement("div");
    ed.contentEditable = "true";
    ed.spellcheck = false;
    ed.style.position = "absolute";
    ed.style.left = rect.x + "px";
    ed.style.top = rect.y + "px";
    ed.style.width = rect.w + "px";
    ed.style.height = rect.h + "px";
    ed.style.padding = "8px";
    ed.style.outline = "2px solid #3b82f6";
    ed.style.border = "0";
    ed.style.borderRadius = "4px";
    ed.style.background = "rgba(255,255,255,0.95)";
    ed.style.whiteSpace = "pre-wrap";
    ed.style.overflow = "auto";
    ed.style.zIndex = 1000;
    ed.style.userSelect = "text";
    ed.style.webkitUserSelect = "text";

    // apply initial style from store
    const sref =
      engine?.store && typeof engine.store.getState === "function"
        ? engine.store
        : useCanvasStore;
    const st = sref.getState();
    this.state.color = st.color ?? "#000000";
    this.state.fontSize = this._defaultFontSize(st);

    // set CSS from state
    this._applyEditorStyles(ed);

    // toolbar
    const tb = ensureTextToolbar(
      host,
      (next) => {
        // toolbar -> update editor styles live
        Object.assign(this.state, next);
        this._applyEditorStyles(ed);
        ed.focus();
      },
      this.state
    );

    // keyboard handling
    const finish = (commit = true) => {
      tb.remove();
      this.toolbar = null;
      this._finalize(engine, rect, ed, commit);
    };

    ed.addEventListener("keydown", (e) => {
      // Ctrl/Cmd+Enter -> commit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
      // Escape -> cancel
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });

    // click outside -> commit
    const onClickOutside = (e) => {
      if (e.target === ed || tb.contains(e.target)) return;
      document.removeEventListener("mousedown", onClickOutside, true);
      finish(true);
    };
    setTimeout(
      () => document.addEventListener("mousedown", onClickOutside, true),
      0
    );

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
      ]
        .filter(Boolean)
        .join(" ") || "none";
    ed.style.textAlign = this.state.align || "left";
    if (this.state.lineHeight)
      ed.style.lineHeight = String(this.state.lineHeight);
    if (this.state.letterSpacing !== undefined)
      ed.style.letterSpacing = `${this.state.letterSpacing}px`;
  }

  // commit/cancel
  _finalize(engine, rect, ed, commit) {
    const canvas = engine.canvas || engine.ctx.canvas;
    const host = canvas.parentElement || document.body;

    const text = (ed.innerText || "").replace(/\u00A0/g, " ").trimEnd();
    host.removeChild(ed);
    this.editor = null;

    // clear overlay marquee
    this._clearCanvas(engine);
    engine.renderAllObjects();

    if (!commit) {
      this.drawing = false;
      this.start = null;
      this.curr = null;
      this.activeRect = null;
      return;
    }

    // if nothing typed, don't add object
    if (!text || !text.trim()) {
      this.drawing = false;
      this.start = null;
      this.curr = null;
      this.activeRect = null;
      return;
    }

    // add object to store
    const storeRef =
      engine?.store && typeof engine.store.getState === "function"
        ? engine.store
        : useCanvasStore;
    const s = storeRef.getState();
    const maxLayer = s.objects.length
      ? Math.max(...s.objects.map((o) => o.layer))
      : 0;

    s.addObject(
      new CanvasObject({
        type: "text",
        data: {
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
          text,
          align: this.state.align,
          opacity: this.state.opacity,
          rotationDeg: this.state.rotationDeg,
          underline: this.state.underline,
        },
        style: {
          stroke: this.state.color,
          fontSize: this.state.fontSize,
          fontFamily: this.state.fontFamily,
          bold: this.state.bold,
          italic: this.state.italic,
        },
        layer: maxLayer + 1,
      })
    );

    // reset
    this.drawing = false;
    this.start = null;
    this.curr = null;
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
    this.start = null;
    this.curr = null;
    this.activeRect = null;
    this._clearCanvas(engine);
    engine.renderAllObjects();
  }

  onBlur(engine) {
    this.onDeactivate(engine);
  }
}
