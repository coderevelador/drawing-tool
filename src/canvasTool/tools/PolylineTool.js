import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class PolylineTool extends BaseTool {
  constructor() {
    super();
    this.name = "polyline";

    // drawing state
    this.points = [];
    this.drawing = false;
    this.lastClickTime = 0;
    this.finishDblClickMs = 300;
    this.closeHitRadius = 8;

    // offscreen buffer for confirmed segments (no flicker)
    this.buffer = null;
    this.bctx = null;

    // lock the tool's color/width when drawing starts (matches other tools)
    this.lockedStroke = null;
    this.lockedWidth = null;

    // visual hint when cursor is near the starting point (close polygon)
    this.aboutToClose = false;
  }

  // ----------------- helpers -----------------
  _dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _applyStroke(ctx) {
    ctx.strokeStyle = this.lockedStroke ?? "#000000";
    ctx.lineWidth   = this.lockedWidth  ?? 2;
    ctx.lineJoin = "round";
    ctx.lineCap  = "round";
  }

  _ensureBuffer(engine) {
    if (!this.buffer) {
      const c = document.createElement("canvas");
      // support engines that expose either canvas or width/height
      const w = (engine && engine.canvas && engine.canvas.width)  ? engine.canvas.width  : (engine.width  || 0);
      const h = (engine && engine.canvas && engine.canvas.height) ? engine.canvas.height : (engine.height || 0);
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

  _drawHandleDots(ctx) {
    ctx.save();
    ctx.fillStyle = "#00000080";
    for (const p of this.points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.points.length >= 2 && this.aboutToClose) {
      ctx.fillStyle = "#ff000080";
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 2;
      const first = this.points[0];
      ctx.beginPath();
      ctx.arc(first.x, first.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Compose: store → buffer (confirmed) → live segment to cursor
  _compose(engine, pos) {
    // 1) draw already-committed objects from store
    engine.renderAllObjects();

    // 2) draw confirmed segments from buffer
    if (this.buffer) engine.ctx.drawImage(this.buffer, 0, 0);

    // 3) draw the current live segment
    if (this.drawing && this.points.length) {
      const ctx = engine.ctx;
      this._applyStroke(ctx);

      const last = this.points[this.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);

      if (pos) {
        if (this.points.length >= 2 && this._dist(pos, this.points[0]) <= this.closeHitRadius) {
          // snap preview to first point to indicate closing
          ctx.lineTo(this.points[0].x, this.points[0].y);
          this.aboutToClose = true;
        } else {
          ctx.lineTo(pos.x, pos.y);
          this.aboutToClose = false;
        }
      } else {
        this.aboutToClose = false;
      }

      ctx.stroke();
      this._drawHandleDots(ctx);
    }
  }

  _commit(engine, asClosed = false) {
    const pts = this.points.slice();
    if (pts.length >= 2) {
      const storeRef = useCanvasStore; // zustand store
      const state = storeRef.getState();
      const maxLayer = state.objects.length ? Math.max(...state.objects.map(o => o.layer)) : 0;

      state.addObject(new CanvasObject({
        type: "polyline",
        data: { points: pts, closed: !!asClosed },
        style: {
          stroke: this.lockedStroke ?? state.color,
          lineWidth: this.lockedWidth ?? state.lineWidth
        },
        layer: maxLayer + 1
      }));
    }

    // reset local state
    this.points = [];
    this.drawing = false;
    this.lastClickTime = 0;
    this.lockedStroke = null;
    this.lockedWidth = null;
    this.aboutToClose = false;
    this._clearBuffer();
    this.buffer = null;
    this.bctx = null;

    // final render from store
    engine.renderAllObjects();
  }

  _cancel(engine) {
    this.points = [];
    this.drawing = false;
    this.lastClickTime = 0;
    this.lockedStroke = null;
    this.lockedWidth = null;
    this.aboutToClose = false;
    this._clearBuffer();
    this.buffer = null;
    this.bctx = null;
    engine.renderAllObjects();
  }

  // --------------- events ----------------
  onMouseDown(event, pos, engine) {
    const now = Date.now();
    const isRightClick = event && event.button === 2;
    const doubleClick = now - this.lastClickTime < this.finishDblClickMs;

    if (!this.drawing) {
      // LOCK STYLE at start using the same path as other tools (BaseTool -> zustand store)
      const storeRef =
        (engine && engine.store && typeof engine.store.getState === "function")
          ? engine.store
          : useCanvasStore; // fallback to real zustand store

      let opts;
      try {
        opts = (typeof super.getToolOptions === "function")
          ? super.getToolOptions(storeRef)
          : { color: storeRef.getState().color, lineWidth: storeRef.getState().lineWidth };
      } catch {
        const s = storeRef.getState ? storeRef.getState() : {};
        opts = { color: s.color ?? "#000000", lineWidth: s.lineWidth ?? 2 };
      }
      this.lockedStroke = opts.color;
      this.lockedWidth  = opts.lineWidth;

      // start polyline
      this.drawing = true;
      this.points = [pos];

      // prepare buffer and draw first preview
      this._ensureBuffer(engine);
      this._compose(engine, pos);
      this.lastClickTime = now;
      return;
    }

    // while drawing…
    if (isRightClick) {
      this._commit(engine, false);
      this.lastClickTime = now;
      return;
    }

    // click near first point => close polygon
    if (this.points.length >= 2 && this._dist(pos, this.points[0]) <= this.closeHitRadius) {
      // draw closing segment into buffer so it appears instantly
      this._ensureBuffer(engine);
      this._applyStroke(this.bctx);
      const last = this.points[this.points.length - 1];
      this.bctx.beginPath();
      this.bctx.moveTo(last.x, last.y);
      this.bctx.lineTo(this.points[0].x, this.points[0].y);
      this.bctx.stroke();

      this._compose(engine, null);
      this._commit(engine, true);
      this.lastClickTime = now;
      return;
    }

    // double-click => finish open polyline
    if (doubleClick) {
      this._compose(engine, null);
      this._commit(engine, false);
      this.lastClickTime = now;
      return;
    }

    // Extend: draw confirmed segment into buffer so it persists immediately
    const prev = this.points[this.points.length - 1];
    this.points.push(pos);

    this._ensureBuffer(engine);
    this._applyStroke(this.bctx);
    this.bctx.beginPath();
    this.bctx.moveTo(prev.x, prev.y);
    this.bctx.lineTo(pos.x, pos.y);
    this.bctx.stroke();

    // repaint: store + buffer + live segment
    this._compose(engine, pos);
    this.lastClickTime = now;
  }

  onMouseMove(event, pos, engine) {
    if (!this.drawing) return;
    this._compose(engine, pos);
  }

  onMouseUp() {
    // no-op (we build by clicks)
  }

  onKeyDown(event, engine) {
    if (!this.drawing || !event) return;
    if (event.key === "Enter") {
      this._compose(engine, null);
      this._commit(engine, false);
    }
    if (event.key === "Escape") {
      this._cancel(engine);
    }
  }

  onDeactivate(engine) {
    // If tool switches mid-draw, finalize gracefully (prevents chaining)
    if (this.drawing) {
      this._compose(engine, null);
      this._commit(engine, false);
    }
  }

  onBlur(engine) {
    if (this.drawing) {
      this._compose(engine, null);
      this._commit(engine, false);
    }
  }
}
