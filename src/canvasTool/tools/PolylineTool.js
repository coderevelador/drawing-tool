// src/canvasTool/tools/PolylineTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class PolylineTool extends BaseTool {
  constructor() {
    super();
    this.name = "polyline"; // MUST match toolDefaults key

    this._points = [];
    this._drawing = false;
    this._styleSnapshot = null;
    this._snapshot = null;

    this._closedOnFinish = false;

    // dbl-click detection
    this._lastClickAt = 0;
    this._lastClickPos = null;
    this._dblMs = 280;
    this._dblDist2 = 100;
  }

  // ---------- helpers ----------
  _applyStroke(ctx, s) {
    ctx.globalAlpha = typeof s.opacity === "number" ? s.opacity : 1;
    ctx.strokeStyle = s.stroke ?? "#000";
    ctx.lineWidth   = s.lineWidth ?? 2;
    ctx.lineJoin    = s.lineJoin || "round";
    ctx.lineCap     = s.lineCap  || "round";
    ctx.miterLimit  = s.miterLimit ?? 10;
    if (s.composite) ctx.globalCompositeOperation = s.composite;
  }

  _applyDash(ctx, s) {
    const lt = s.lineType || "solid";
    if (lt === "dashed") {
      const dash = Math.max(1, Math.floor(s.dashSize ?? (s.lineWidth * 3)));
      const gap  = Math.max(1, Math.floor(s.dashGap  ?? (s.lineWidth * 2)));
      ctx.setLineDash([dash, gap]);
      if (!s.lineCap) ctx.lineCap = "butt";
    } else if (lt === "dotted") {
      const dot = Math.max(1, Math.floor(s.dotSize ?? 1));
      const gap = Math.max(1, Math.floor(s.dotGap  ?? (s.lineWidth * 1.5)));
      ctx.setLineDash([dot, gap]);
      ctx.lineCap = "round";
    } else {
      ctx.setLineDash([]);
    }
  }

  _isDoubleClick(now, pos) {
    if (!this._lastClickAt || !this._lastClickPos) return false;
    const dt = now - this._lastClickAt;
    const dx = pos.x - this._lastClickPos.x;
    const dy = pos.y - this._lastClickPos.y;
    return dt <= this._dblMs && (dx * dx + dy * dy) <= this._dblDist2;
  }

  _beginStroke(engine, pos) {
    this._drawing = true;
    this._points = [{ x: pos.x, y: pos.y }];

    // Freeze dock toggle "Closed path" for this stroke
    const s = engine.store.getState();
    const defaults = (s.toolDefaults && s.toolDefaults[this.name]) || {};
    this._closedOnFinish = !!defaults.closed;

    // Freeze style
    const { style } = this.getToolOptions(engine.store);
    this._styleSnapshot = {
      stroke: style.stroke ?? "#000",
      lineWidth: style.lineWidth ?? 2,
      opacity: typeof style.opacity === "number" ? style.opacity : 1,
      lineType: style.lineType || "solid",
      lineJoin: style.lineJoin || "round",
      lineCap:  style.lineCap  || "round",
      miterLimit: style.miterLimit ?? 10,
      composite: style.composite,
      dashSize: style.dashSize, dashGap: style.dashGap,
      dotSize:  style.dotSize,  dotGap:  style.dotGap,
      // (renderer uses these only if closed)
      fill: style.fill,
      fillEnabled: style.fillEnabled,
      fillOpacity: style.fillOpacity,
      cloudAmplitude: style.cloudAmplitude,
      cloudStep: style.cloudStep,
      cloudOverlap: style.cloudOverlap,
      cloudSweepDeg: style.cloudSweepDeg,
    };

    // Baseline = current canvas
    this._snapshot = engine.ctx.getImageData(0, 0, engine.width, engine.height);

    // --- draw the FIRST vertex dot immediately and resnapshot so it persists ---
    const ctx = engine.ctx;
    ctx.putImageData(this._snapshot, 0, 0);

    // Use solid caps when drawing dots
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = this._styleSnapshot.stroke ?? "#000";
    const r = Math.max(2, Math.min(3, (this._styleSnapshot.lineWidth ?? 2)));
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // now capture baseline that includes the start anchor
    this._snapshot = ctx.getImageData(0, 0, engine.width, engine.height);
  }

  _preview(engine, cursorPos) {
    const ctx = engine.ctx;
    ctx.putImageData(this._snapshot, 0, 0);
    if (this._points.length === 0) return;

    const s = { ...this._styleSnapshot };
    if (s.lineType === "cloud") s.lineType = "solid"; // cloud preview after close only

    this._applyStroke(ctx, s);
    this._applyDash(ctx, s);

    ctx.beginPath();
    ctx.moveTo(this._points[0].x, this._points[0].y);
    for (let i = 1; i < this._points.length; i++) ctx.lineTo(this._points[i].x, this._points[i].y);
    if (cursorPos) ctx.lineTo(cursorPos.x, cursorPos.y);
    ctx.stroke();

    // fixed vertex dots
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = s.stroke ?? "#000";
    const r = Math.max(2, Math.min(3, (s.lineWidth ?? 2)));
    for (const p of this._points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // (optional) live cursor anchor
    if (cursorPos) {
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _finish(engine) {
    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length
      ? Math.max(...store.objects.map((o) => o.layer || 0))
      : 0;

    store.addObject(
      new CanvasObject({
        type: "polyline",
        data: { points: this._points.slice(), closed: !!this._closedOnFinish },
        style: { ...this._styleSnapshot },
        layer: maxLayer + 1,
      })
    );

    engine.renderAllObjects?.();

    this._drawing = false;
    this._points = [];
    this._styleSnapshot = null;
    this._snapshot = null;
  }

  // ---------- events ----------
  onMouseDown(e, pos, engine) {
    const now = performance.now ? performance.now() : Date.now();

    // double-click finishes (closed/open per dock)
    if (this._drawing && this._isDoubleClick(now, pos)) {
      this._finish(engine);
      this._lastClickAt = 0;
      this._lastClickPos = null;
      return;
    }

    if (!this._drawing) {
      this._beginStroke(engine, pos);
    } else {
      // ---- draw the new segment + vertex onto canvas, then resnapshot ----
      const ctx = engine.ctx;

      // restore to last baseline
      ctx.putImageData(this._snapshot, 0, 0);

      const s = { ...this._styleSnapshot };
      if (s.lineType === "cloud") s.lineType = "solid";
      this._applyStroke(ctx, s);
      this._applyDash(ctx, s);

      ctx.beginPath();
      ctx.moveTo(this._points[0].x, this._points[0].y);
      for (let i = 1; i < this._points.length; i++) ctx.lineTo(this._points[i].x, this._points[i].y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      // vertex dots (existing + new)
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = s.stroke ?? "#000";
      const r = Math.max(2, Math.min(3, (s.lineWidth ?? 2)));
      for (const p of this._points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // commit vertex and freeze baseline including it
      this._points.push({ x: pos.x, y: pos.y });
      this._snapshot = ctx.getImageData(0, 0, engine.width, engine.height);
    }

    this._lastClickAt = now;
    this._lastClickPos = { x: pos.x, y: pos.y };
  }

  onMouseMove(e, pos, engine) {
    if (!this._drawing || !this._snapshot) return;
    this._preview(engine, pos);
  }

  onMouseUp(e, pos, engine) {
    // vertices are committed on mousedown
  }

  onKeyDown(e, engine) {
    if (!this._drawing) return;
    if (e.key === "Escape") {
      if (this._snapshot) engine.ctx.putImageData(this._snapshot, 0, 0);
      this._drawing = false;
      this._points = [];
      this._styleSnapshot = null;
      this._snapshot = null;
    } else if (e.key === "Enter") {
      this._finish(engine);
    }
  }
}

export default PolylineTool;
