import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class SnapshotTool extends BaseTool {
  constructor() {
    super();
    this.name = "snapshot";

    this.drawing = false;
    this.start = null; // {x,y}
    this.curr  = null; // {x,y}
    this.minSize = 2;

    // UI
    this.borderWidth = 1.0;
    this.toastMs = 1100;
    this.fallbackToolName = "pencil";
    this.prevToolName = null;
  }

  // ---------- helpers ----------
  _normRect(a, b) {
    const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x), y2 = Math.max(a.y, b.y);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  _clampRectToCanvas(rect, engine) {
    const canvas = engine.canvas || engine.ctx?.canvas;
    const W = canvas?.width ?? engine.width ?? 0;
    const H = canvas?.height ?? engine.height ?? 0;

    let x = Math.max(0, Math.min(rect.x, W));
    let y = Math.max(0, Math.min(rect.y, H));
    let w = Math.max(0, Math.min(rect.w, W - x));
    let h = Math.max(0, Math.min(rect.h, H - y));

    x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
    return { x, y, w, h };
  }

  _clearCanvas(engine) {
    const canvas = engine.canvas || engine.ctx?.canvas;
    const W = canvas?.width ?? engine.width ?? 0;
    const H = canvas?.height ?? engine.height ?? 0;
    engine.ctx.clearRect(0, 0, W, H);
  }

  _drawMarquee(engine) {
    if (!this.drawing || !this.start || !this.curr) return;

    // Ensure any previous overlay is removed even if the engine doesn't clear.
    this._clearCanvas(engine);
    // Baseline: render current scene
    engine.renderAllObjects();

    // Overlay
    const ctx = engine.ctx;
    const rect = this._normRect(this.start, this.curr);

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = this.borderWidth;
    if (ctx.setLineDash) ctx.setLineDash([6,4]);
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(0, rect.w - 1), Math.max(0, rect.h - 1));
    ctx.restore();
  }

  async _copyToClipboard(engine, rect) {
    try {
      const srcCanvas = engine.canvas || engine.ctx.canvas;
      const off = document.createElement("canvas");
      off.width = rect.w; off.height = rect.h;
      const octx = off.getContext("2d");
      octx.drawImage(srcCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

      if (navigator.clipboard && window.ClipboardItem) {
        const blob = await new Promise(res => off.toBlob(res, "image/png"));
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          return true;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(off.toDataURL("image/png"));
        return true;
      }
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
    return false;
  }

  _flashMessage(engine, text, rect) {
    const ctx = engine.ctx;
    const canvas = engine.canvas || ctx.canvas;
    const W = canvas?.width ?? engine.width ?? 0;
    const H = canvas?.height ?? engine.height ?? 0;

    // Clean slate (so the marquee disappears), then baseline scene
    this._clearCanvas(engine);
    engine.renderAllObjects();

    // position toast
    let cx = W / 2, cy = H - 28;
    if (rect) {
      cx = rect.x + Math.min(rect.w, 240) / 2;
      cy = Math.min(rect.y + rect.h + 28, H - 28);
    }

    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const padX = 10, padY = 6;
    const tw = Math.ceil(ctx.measureText(text).width);
    const th = 16;
    const boxW = tw + padX * 2;
    const boxH = th + padY * 2;
    const x = Math.max(8, Math.min(cx - boxW / 2, W - boxW - 8));
    const y = Math.max(8, Math.min(cy - boxH / 2, H - boxH - 8));

    // background (rounded)
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + boxW, y, x + boxW, y + boxH, r);
    ctx.arcTo(x + boxW, y + boxH, x, y + boxH, r);
    ctx.arcTo(x, y + boxH, x, y, r);
    ctx.arcTo(x, y, x + boxW, y, r);
    ctx.closePath();
    ctx.fill();

    // text
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + padX, y + boxH / 2);
    ctx.restore();

    // remove toast after timeout (and any overlay remnants)
    setTimeout(() => {
      this._clearCanvas(engine);
      engine.renderAllObjects();
    }, this.toastMs);
  }

  _switchAway(engine) {
    const storeRef = (engine?.store && typeof engine.store.getState === "function")
      ? engine.store
      : useCanvasStore;

    const state = storeRef.getState ? storeRef.getState() : {};
    const target =
      (this.prevToolName && this.prevToolName !== this.name)
        ? this.prevToolName
        : this.fallbackToolName;

    if (typeof storeRef.setActiveTool === "function") { try { storeRef.setActiveTool(target); return; } catch {} }
    if (typeof engine?.setActiveTool === "function") { try { engine.setActiveTool(target); return; } catch {} }
    if (typeof storeRef.setState === "function" && ("activeTool" in state)) {
      try { storeRef.setState({ activeTool: target }); return; } catch {}
    }
  }

  _commit = async (engine) => {
    if (!this.start || !this.curr) { this._reset(engine); return; }

    const rawRect = this._normRect(this.start, this.curr);
    const rect = this._clampRectToCanvas(rawRect, engine);
    if (rect.w < this.minSize || rect.h < this.minSize) {
      this._reset(engine);
      // ensure any marquee is gone
      this._clearCanvas(engine);
      engine.renderAllObjects();
      return;
    }

    // capture pixels
    const imgData = engine.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);

    // copy to clipboard (await so toast text is accurate)
    const copied = await this._copyToClipboard(engine, rect);

    // add as object
    const store = useCanvasStore.getState();
    const maxLayer = store.objects.length ? Math.max(...store.objects.map(o => o.layer)) : 0;
    store.addObject(new CanvasObject({
      type: "snapshot",
      data: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, imageData: imgData },
      style: {},
      layer: maxLayer + 1,
    }));

    // reset state
    this._reset(engine);

    // toast (also clears marquee) + auto switch tool
    const msg = copied ? "Snapshot captured & copied" : "Snapshot captured";
    this._flashMessage(engine, msg, rect);
    this._switchAway(engine);
  };

  _reset(engine) {
    this.drawing = false;
    this.start = null;
    this.curr  = null;
  }

  // ---------- events ----------
  onMouseDown(event, pos, engine) {
    // remember previous tool to restore later
    try {
      const storeRef = (engine?.store && typeof engine.store.getState === "function")
        ? engine.store
        : useCanvasStore;
      const s = storeRef.getState ? storeRef.getState() : {};
      this.prevToolName = s.activeTool || s.currentTool || engine?.activeTool || null;
    } catch { this.prevToolName = null; }

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
    this.curr = pos;
    this._commit(engine);
  }

  onKeyDown(event, engine) {
    if (!event) return;
    if (event.key === "Escape" && this.drawing) {
      this._reset(engine);
      this._clearCanvas(engine);
      engine.renderAllObjects();
    }
  }

  onDeactivate(engine) {
    if (this.drawing) {
      this._reset(engine);
      this._clearCanvas(engine);
      engine.renderAllObjects();
    }
  }

  onBlur(engine) {
    if (this.drawing) {
      this._reset(engine);
      this._clearCanvas(engine);
      engine.renderAllObjects();
    }
  }
}
