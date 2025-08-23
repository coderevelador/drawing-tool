import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";
 
export class PolylineTool extends BaseTool {
  static inspector = [
  { group:"Style",   label:"Stroke", type:"color", path:"style.stroke" },
  { group:"Style",   label:"Width",  type:"number", path:"style.lineWidth", min:1, step:1 },
  { group:"Options", label:"Closed", type:"checkbox", path:"data.closed" }
];

  constructor() {
    super();
    this.name = "polyline";
 
    // drawing state
    this.points = [];
    this.drawing = false;
    this.lastClickTime = 0;
    this.finishDblClickMs = 300;
    this.closeHitRadius = 8;
 
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
 
  // Compose: store → full current polyline path (confirmed legs) → live leg to cursor
  _compose(engine, pos) {
    // 1) draw already-committed objects from store
    engine.renderAllObjects();
 
    // 2) draw the full current polyline path
    if (!this.drawing || this.points.length === 0) return;
 
    const ctx = engine.ctx;
    this._applyStroke(ctx);
 
    const first = this.points[0];
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
 
    // draw confirmed legs
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
 
    // draw live leg
    if (pos) {
      if (this.points.length >= 2 && this._dist(pos, first) <= this.closeHitRadius) {
        ctx.lineTo(first.x, first.y);
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
          : useCanvasStore;
 
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
 
      // first preview
      this._compose(engine, pos);
      this.lastClickTime = now;
      return;
    }
 
    // while drawing…
    if (isRightClick) {
      this._compose(engine, null);
      this._commit(engine, false);
      this.lastClickTime = now;
      return;
    }
 
    // click near first point => close polygon
    if (this.points.length >= 2 && this._dist(pos, this.points[0]) <= this.closeHitRadius) {
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
 
    // Extend: just push the point; the full path is redrawn on the next compose
    this.points.push(pos);
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