// src/canvasTool/tools/HighlighterTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class HighlighterTool extends BaseTool {
  static inspector = [
    { group: "Style", label: "Color", type: "color", path: "style.stroke" },
    {
      group: "Style",
      label: "Width",
      type: "number",
      path: "style.lineWidth",
      min: 2,
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
        group: "Ink",
        label: "Color",
        type: "color",
        path: "style.stroke",
        default: "#ffff00",
      },
      {
        group: "Ink",
        label: "Width",
        type: "number",
        path: "style.lineWidth",
        default: 12,
        min: 2,
        max: 64,
        step: 1,
      },
      {
        group: "Ink",
        label: "Opacity",
        type: "range",
        path: "style.opacity",
        default: 0.35,
        min: 0.05,
        max: 1,
        step: 0.05,
      },
      {
        group: "Ink",
        label: "Cap",
        type: "select",
        path: "style.lineCap",
        default: "round",
        options: [
          { label: "Butt", value: "butt" },
          { label: "Round", value: "round" },
          { label: "Square", value: "square" },
        ],
      },
    ],
  };

  constructor() {
    super();
    this.name = "highlighter";

    this.drawing = false;
    this.points = [];

    // offscreen buffer for silky preview
    this.buffer = null;
    this.bctx = null;

    // “locked” stroke for the current gesture
    this.lockedStroke = null;
    this.lockedWidth = null;
    this.lockedOpacity = null;
    this.lockedComposite = null;

    // sensible defaults (used if not present in tool defaults)
    this.defaultOpacity = 0.25;
    this.defaultComposite = "multiply";

    // motion / smoothing
    this.minMove = 0.6; // smaller => denser sampling, fewer gaps
  }

  // ---------- helpers ----------
  _store(engine) {
    return engine?.store && typeof engine.store.getState === "function"
      ? engine.store
      : useCanvasStore;
  }

  _ensureBuffer(engine) {
    const src = engine.canvas || engine.ctx?.canvas;
    const W = src?.width ?? engine.width ?? 0;
    const H = src?.height ?? engine.height ?? 0;

    if (!this.buffer) {
      this.buffer = document.createElement("canvas");
      this.bctx = this.buffer.getContext("2d");
    }
    if (this.buffer.width !== W || this.buffer.height !== H) {
      this.buffer.width = W;
      this.buffer.height = H;
      this.bctx.clearRect(0, 0, W, H);
    }
  }

  _clearBuffer() {
    if (this.bctx && this.buffer)
      this.bctx.clearRect(0, 0, this.buffer.width, this.buffer.height);
  }

  _dist(a, b) {
    const dx = a.x - b.x,
      dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  _strokeSetup(ctx) {
    ctx.save();
    ctx.globalAlpha = this.lockedOpacity ?? this.defaultOpacity;
    ctx.globalCompositeOperation =
      this.lockedComposite ?? this.defaultComposite;
    ctx.strokeStyle = this.lockedStroke ?? "#ffeb3b";
    ctx.lineWidth = Math.max(2, this.lockedWidth ?? 10);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }

  // Draw newest segment smoothly into buffer
  _drawToBuffer() {
    const pts = this.points;
    const n = pts.length;
    if (n < 2) return;

    const ctx = this.bctx;
    this._strokeSetup(ctx);

    if (n === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const p_1 = pts[n - 3];
    const p0 = pts[n - 2];
    const p1 = pts[n - 1];

    // midpoint smoothing
    const m0x = (p_1.x + p0.x) / 2,
      m0y = (p_1.y + p0.y) / 2;
    const m1x = (p0.x + p1.x) / 2,
      m1y = (p0.y + p1.y) / 2;

    ctx.beginPath();
    ctx.moveTo(m0x, m0y);
    ctx.quadraticCurveTo(p0.x, p0.y, m1x, m1y);
    // tiny tail to actual point to avoid hairline gaps
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
  }

  _compose(engine) {
    engine.renderAllObjects();
    if (this.buffer) engine.ctx.drawImage(this.buffer, 0, 0);
  }

  _commit(engine) {
    if (this.points.length < 2) {
      this._reset(engine);
      engine.renderAllObjects();
      return;
    }

    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map((o) => o.layer || 0))
      : 0;

    store.addObject(
      new CanvasObject({
        type: "highlighter",
        data: { points: this.points.slice() },
        style: {
          stroke: this.lockedStroke ?? store.color,
          lineWidth: this.lockedWidth ?? Math.max(8, store.lineWidth),
          opacity: this.lockedOpacity ?? this.defaultOpacity,
          composite: this.lockedComposite ?? this.defaultComposite,
        },
        layer: maxLayer + 1,
      })
    );

    this._reset(engine);
    engine.renderAllObjects();
  }

  _reset(engine) {
    this.drawing = false;
    this.points = [];
    this.lockedStroke = null;
    this.lockedWidth = null;
    this.lockedOpacity = null;
    this.lockedComposite = null;
    this._clearBuffer();
    this.buffer = null;
    this.bctx = null;
  }

  // ---------- events ----------
  onMouseDown(event, pos, engine) {
    // lock current defaults for this stroke
    const storeRef = this._store(engine);
    const s = storeRef.getState ? storeRef.getState() : {};
    const td = (s.toolDefaults && s.toolDefaults[this.name]) || {};
    const st = td.style || {};

    this.lockedStroke = st.stroke ?? s.color ?? "#ffeb3b";
    this.lockedWidth = Math.max(
      2,
      Number(st.lineWidth ?? (s.lineWidth ?? 10) * 2)
    );
    this.lockedOpacity =
      typeof st.opacity === "number" ? st.opacity : this.defaultOpacity;
    this.lockedComposite = st.composite || this.defaultComposite;

    this._ensureBuffer(engine);

    this.drawing = true;
    this.points = [pos];

    // seed preview (noop for first point but safe)
    this._drawToBuffer();
    this._compose(engine);
  }

  onMouseMove(event, pos, engine) {
    if (!this.drawing) return;

    const last = this.points[this.points.length - 1];
    if (!last || this._dist(last, pos) < this.minMove) {
      this._compose(engine);
      return;
    }

    // densify long jumps to avoid breaks
    const step = this.minMove;
    const dx = pos.x - last.x,
      dy = pos.y - last.y;
    const dist = Math.hypot(dx, dy);
    if (dist > step * 2) {
      const steps = Math.ceil(dist / step);
      for (let i = 1; i < steps; i++) {
        this.points.push({
          x: last.x + (dx * i) / steps,
          y: last.y + (dy * i) / steps,
        });
        this._drawToBuffer();
      }
    }

    this.points.push(pos);
    this._drawToBuffer();
    this._compose(engine);
  }

  onMouseUp(event, pos, engine) {
    if (!this.drawing) return;

    // ensure final point recorded even if engine doesn't pass pos
    const last = this.points[this.points.length - 1];
    if (pos && (!last || this._dist(last, pos) >= this.minMove)) {
      this.points.push(pos);
      this._drawToBuffer();
    }

    this._compose(engine);
    this._commit(engine);
  }

  onKeyDown(event, engine) {
    if (!event) return;
    if (event.key === "Escape" && this.drawing) {
      this._reset(engine);
      engine.renderAllObjects();
    }
    // Optional quick toggles:
    if (event.key.toLowerCase() === "m") {
      this.lockedComposite =
        (this.lockedComposite || this.defaultComposite) === "multiply"
          ? "source-over"
          : "multiply";
      this._compose(engine);
    }
  }

  onDeactivate(engine) {
    if (this.drawing) this._commit(engine);
  }

  onBlur(engine) {
    if (this.drawing) this._commit(engine);
  }
}

export default HighlighterTool;
