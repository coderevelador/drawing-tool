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

  constructor() {
    super();
    this.name = "highlighter";

    this.drawing = false;
    this.points = [];

    this.buffer = null;
    this.bctx = null;

    this.lockedStroke = null;
    this.lockedWidth = null;

    this.opacity = 0.25;
    this.composite = "multiply";
    this.minMove = 0.6; // was ~1.8; smaller -> fewer gaps
  }

  // ---------- helpers ----------
  _ensureBuffer(engine) {
    if (!this.buffer) {
      const c = document.createElement("canvas");
      const w = engine.canvas?.width ?? engine.width ?? 0;
      const h = engine.canvas?.height ?? engine.height ?? 0;
      c.width = w;
      c.height = h;
      this.buffer = c;
      this.bctx = c.getContext("2d");
    }
  }

  _clearBuffer() {
    if (this.bctx && this.buffer) {
      this.bctx.clearRect(0, 0, this.buffer.width, this.buffer.height);
    }
  }

  _dist(a, b) {
    const dx = a.x - b.x,
      dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  _strokeSetup(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = this.composite;
    ctx.strokeStyle = this.lockedStroke ?? "#ffeb3b";
    ctx.lineWidth = Math.max(2, this.lockedWidth ?? 10);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }

  // Draw the newest segment smoothly into buffer
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

    // tiny tail to the actual point to avoid visual gaps
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

    const storeRef = useCanvasStore;
    const state = storeRef.getState();
    const maxLayer = state.objects.length
      ? Math.max(...state.objects.map((o) => o.layer))
      : 0;

    state.addObject(
      new CanvasObject({
        type: "highlighter",
        data: { points: this.points.slice() },
        style: {
          stroke: this.lockedStroke ?? state.color,
          lineWidth: this.lockedWidth ?? Math.max(8, state.lineWidth),
          opacity: this.opacity,
          composite: this.composite,
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
    this._clearBuffer();
    this.buffer = null;
    this.bctx = null;
  }

  // ---------- events ----------
  onMouseDown(event, pos, engine) {
    // lock style same as other tools
    const storeRef =
      engine?.store && typeof engine.store.getState === "function"
        ? engine.store
        : useCanvasStore;
    let opts;
    try {
      opts =
        typeof super.getToolOptions === "function"
          ? super.getToolOptions(storeRef)
          : {
              color: storeRef.getState().color,
              lineWidth: storeRef.getState().lineWidth,
            };
    } catch {
      const s = storeRef.getState ? storeRef.getState() : {};
      opts = { color: s.color ?? "#ffeb3b", lineWidth: s.lineWidth ?? 10 };
    }

    this.lockedStroke = opts.color;
    this.lockedWidth = Math.max(8, opts.lineWidth * 2);

    this._ensureBuffer(engine);

    this.drawing = true;
    this.points = [pos];
    // seed stroke
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
    if (event.key.toLowerCase() === "o") {
      const v = parseFloat(
        window.prompt("Highlighter opacity (0..1):", String(this.opacity))
      );
      if (!Number.isNaN(v) && v >= 0 && v <= 1) this.opacity = v;
    }
    if (event.key.toLowerCase() === "m") {
      this.composite =
        this.composite === "multiply" ? "source-over" : "multiply";
    }
    if (event.key === "Escape" && this.drawing) {
      this._reset(engine);
      engine.renderAllObjects();
    }
  }

  onDeactivate(engine) {
    // finalize even if the engine didn't send mouseup
    if (this.drawing) this._commit(engine);
  }

  onBlur(engine) {
    if (this.drawing) this._commit(engine);
  }
}
