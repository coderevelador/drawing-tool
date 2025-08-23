import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

/**
 * Sticky Note Tool
 * - Click or drag to create a note box.
 * - In-place edit via contentEditable overlay.
 * - Mini palette for color + opacity.
 * - Commit: Ctrl/Cmd+Enter or click outside. Cancel: Esc.
 */
export class StickyNoteTool extends BaseTool {
  static inspector = [
    { group: "Position", label: "X", type: "number", path: "data.x" },
    { group: "Position", label: "Y", type: "number", path: "data.y" },
    { group: "Size", label: "W", type: "number", path: "data.width" },
    { group: "Size", label: "H", type: "number", path: "data.height" },

    { group: "Text", label: "Content", type: "textarea", path: "data.text" },
    {
      group: "Text",
      label: "Font size",
      type: "number",
      path: "style.fontSize",
      min: 8,
    },

    { group: "Style", label: "Fill", type: "color", path: "style.fill" },
    { group: "Style", label: "Text color", type: "color", path: "style.color" },
    {
      group: "Style",
      label: "Radius",
      type: "number",
      path: "data.radius",
      min: 0,
      step: 1,
    },
    {
      group: "Style",
      label: "Padding",
      type: "number",
      path: "data.padding",
      min: 0,
      step: 1,
    },

    {
      group: "FX",
      label: "Opacity",
      type: "range",
      path: "data.opacity",
      min: 0.4,
      max: 1,
      step: 0.05,
    },
  ];

  constructor() {
    super();
    this.name = "stickynote";

    // gesture
    this.drawing = false;
    this.start = null; // {x,y}
    this.curr = null; // {x,y}
    this.minBox = 6;

    // overlay editor & palette
    this.editor = null;
    this.palette = null;
    this.activeRect = null;

    // note style state (saved into object)
    this.state = {
      bg: "#FFF9B1", // classic yellow
      opacity: 1.0,
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      fontSize: 16,
      color: "#111111",
      radius: 10, // corner radius
      padding: 10, // inner padding for render (editor uses CSS padding)
      shadow: true,
    };
  }

  _clearCanvas(engine) {
    const canvas = engine.canvas || engine.ctx?.canvas;
    const W = canvas?.width ?? engine.width ?? 0;
    const H = canvas?.height ?? engine.height ?? 0;
    engine.ctx.clearRect(0, 0, W, H);
  }

  _normRect(a, b) {
    const x1 = Math.min(a.x, b.x),
      y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x),
      y2 = Math.max(a.y, b.y);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
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
    if (ctx.setLineDash) ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      rect.x + 0.5,
      rect.y + 0.5,
      Math.max(0, rect.w - 1),
      Math.max(0, rect.h - 1)
    );
    ctx.restore();
  }

  _applyEditorStyles(ed) {
    ed.style.background = this.state.bg;
    ed.style.opacity = String(this.state.opacity ?? 1);
    ed.style.color = this.state.color;
    ed.style.fontFamily = this.state.fontFamily;
    ed.style.fontSize = `${this.state.fontSize}px`;
    ed.style.lineHeight = "1.25";
    ed.style.borderRadius = `${this.state.radius}px`;
    ed.style.boxShadow = this.state.shadow
      ? "0 6px 22px rgba(0,0,0,0.18)"
      : "none";
    ed.style.textAlign = "left";
  }

  _makePalette(host, editorDiv) {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      zIndex: 1002,
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "8px",
      background: "#111",
      color: "#fff",
      borderRadius: "10px",
      boxShadow: "0 8px 32px rgba(0,0,0,.35)",
      userSelect: "none",
      cursor: "default",
    });

    // place to the left of editor
    const r = editorDiv.getBoundingClientRect();
    el.style.left = Math.max(8, r.left - 56) + "px";
    el.style.top = Math.max(8, r.top) + "px";

    // simple drag handle
    const handle = document.createElement("div");
    handle.textContent = "⋮⋮ Note";
    Object.assign(handle.style, { cursor: "grab", opacity: ".8" });
    el.appendChild(handle);

    let dragging = false,
      offX = 0,
      offY = 0;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      handle.style.cursor = "grabbing";
      const pr = el.getBoundingClientRect();
      offX = e.clientX - pr.left;
      offY = e.clientY - pr.top;
    });
    const moveDrag = (e) => {
      if (!dragging) return;
      el.style.left = e.clientX - offX + "px";
      el.style.top = e.clientY - offY + "px";
    };
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture?.(e.pointerId);
      handle.style.cursor = "grab";
    };
    handle.addEventListener("pointermove", moveDrag);
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    // color swatches
    const row1 = document.createElement("div");
    row1.style.display = "flex";
    row1.style.gap = "6px";
    const colors = [
      "#FFF9B1",
      "#FFD6A5",
      "#FDFFB6",
      "#CAFFBF",
      "#A0E7E5",
      "#BDB2FF",
      "#FFC6FF",
      "#FFADAD",
      "#FFFFFF",
      "#F1F5F9",
    ];
    colors.forEach((c) => {
      const b = document.createElement("button");
      Object.assign(b.style, {
        width: "24px",
        height: "24px",
        borderRadius: "6px",
        border: "2px solid #0b0b0b",
        background: c,
        cursor: "pointer",
      });
      b.onclick = () => {
        this.state.bg = c;
        this._applyEditorStyles(editorDiv);
      };
      row1.appendChild(b);
    });
    el.appendChild(row1);

    // opacity slider
    const row2 = document.createElement("div");
    row2.style.display = "flex";
    row2.style.gap = "8px";
    row2.style.alignItems = "center";
    const opLabel = document.createElement("span");
    opLabel.textContent = "Opacity";
    const op = document.createElement("input");
    Object.assign(op, {
      type: "range",
      min: "0.5",
      max: "1",
      step: "0.05",
      value: String(this.state.opacity),
    });
    op.oninput = () => {
      this.state.opacity = parseFloat(op.value);
      this._applyEditorStyles(editorDiv);
    };
    row2.append(opLabel, op);
    el.appendChild(row2);

    // font size quick +/- and color
    const row3 = document.createElement("div");
    row3.style.display = "flex";
    row3.style.gap = "6px";
    row3.style.alignItems = "center";
    const minus = document.createElement("button");
    minus.textContent = "−";
    minus.style.padding = "4px 8px";
    minus.onclick = () => {
      this.state.fontSize = Math.max(10, this.state.fontSize - 1);
      this._applyEditorStyles(editorDiv);
    };
    const plus = document.createElement("button");
    plus.textContent = "+";
    plus.style.padding = "4px 8px";
    plus.onclick = () => {
      this.state.fontSize = Math.min(48, this.state.fontSize + 1);
      this._applyEditorStyles(editorDiv);
    };
    const color = document.createElement("input");
    color.type = "color";
    color.value = this.state.color;
    color.oninput = () => {
      this.state.color = color.value;
      this._applyEditorStyles(editorDiv);
    };
    row3.append(minus, plus, color);
    el.appendChild(row3);

    host.appendChild(el);
    return el;
  }

  _createEditor(engine, rect) {
    const canvas = engine.canvas || engine.ctx.canvas;
    const host = canvas.parentElement || document.body;

    // editor DIV
    const ed = document.createElement("div");
    ed.contentEditable = "true";
    ed.spellcheck = false;

    Object.assign(ed.style, {
      position: "absolute",
      left: rect.x + "px",
      top: rect.y + "px",
      width: rect.w + "px",
      height: rect.h + "px",
      padding: "10px",
      outline: "2px solid #3b82f6",
      border: "0",
      borderRadius: "10px",
      whiteSpace: "pre-wrap",
      overflow: "auto",
      zIndex: 1001,
      userSelect: "text",
      WebkitUserSelect: "text",
      caretColor: "#111",
    });

    // initial style (pull color size baseline from store width/color if desired)
    const sref =
      engine?.store && typeof engine.store.getState === "function"
        ? engine.store
        : useCanvasStore;
    const st = sref.getState();
    if (st?.color) this.state.color = st.color;
    if (st?.lineWidth)
      this.state.fontSize = Math.max(12, Math.round(st.lineWidth * 6));

    this._applyEditorStyles(ed);

    // palette
    const pal = this._makePalette(host, ed);

    // finish helpers
    const finish = (commit = true) => {
      pal.remove();
      this.palette = null;
      this._finalize(engine, rect, ed, commit);
    };

    // keyboard
    ed.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });

    // click outside → commit
    const onClickOutside = (e) => {
      if (e.target === ed || pal.contains(e.target)) return;
      document.removeEventListener("mousedown", onClickOutside, true);
      finish(true);
    };
    setTimeout(
      () => document.addEventListener("mousedown", onClickOutside, true),
      0
    );

    host.appendChild(ed);
    this.editor = ed;
    this.palette = pal;
    this.activeRect = rect;

    ed.focus();
  }

  _finalize(engine, rect, ed, commit) {
    const canvas = engine.canvas || engine.ctx.canvas;
    const host = canvas.parentElement || document.body;
    const text = (ed.innerText || "").replace(/\u00A0/g, " ").trimEnd();

    if (ed.parentElement === host) host.removeChild(ed);
    this.editor = null;

    // clear marquee/overlay & baseline render
    this._clearCanvas(engine);
    engine.renderAllObjects();

    if (!commit || !text.trim()) {
      this.drawing = false;
      this.start = null;
      this.curr = null;
      this.activeRect = null;
      return;
    }

    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map((o) => o.layer))
      : 0;

    store.addObject(
      new CanvasObject({
        type: "sticky",
        data: {
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
          text,
          opacity: this.state.opacity,
          radius: this.state.radius,
          padding: this.state.padding,
          shadow: this.state.shadow,
        },
        style: {
          fill: this.state.bg,
          color: this.state.color,
          fontFamily: this.state.fontFamily,
          fontSize: this.state.fontSize,
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

  // ---------- events ----------
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
      rect = { x: rect.x, y: rect.y, w: 220, h: 140 };
    }

    // show editor overlay
    this._clearCanvas(engine);
    engine.renderAllObjects();
    this._createEditor(engine, rect);
  }

  onDeactivate(engine) {
    // if switching tools mid-edit → commit
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
