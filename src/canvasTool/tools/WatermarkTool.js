import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class WatermarkTool extends BaseTool {
  constructor() {
    super();
    this.name = "watermark";

    // live state
    this.drawing = false;
    this.currPos = null;

    // settings
    this.opacity = 0.18;        // 0..1
    this.rotationDeg = -30;     // tiled mode
    this.spacingFactor = 6;     // tiled spacing = fontSize * factor

    // text handling
    this.text = null;           // ask per placement
    this.lastText = "WATERMARK";
  }

  // font size from your Width slider (consistent with other tools)
  _fontSizeFrom(state) {
    const lw = Number(state.lineWidth ?? 2);
    return Math.max(12, Math.round(lw * 8)); // e.g., 2->16px, 5->40px
  }

  _composePreview(engine) {
    if (!this.drawing || !this.currPos || !this.text) {
      console.log("Preview skipped:", { drawing: this.drawing, currPos: this.currPos, text: this.text });
      return;
    }

    // baseline
    engine.renderAllObjects();

    // pull style from zustand store (same path as others)
    const storeRef = (engine?.store && typeof engine.store.getState === "function")
      ? engine.store
      : useCanvasStore;
    const s = storeRef.getState();
    const color = s.color ?? "#000000";
    const fs = this._fontSizeFrom(s);

    console.log("Preview watermark:", { 
      text: this.text, 
      pos: this.currPos, 
      color, 
      fontSize: fs, 
      opacity: this.opacity 
    });

    const ctx = engine.ctx;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${fs}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    
    // Debug: Draw a visible rectangle to see if we're drawing at all
    ctx.strokeStyle = color;
    ctx.strokeRect(this.currPos.x - 5, this.currPos.y - 5, 10, 10);
    
    ctx.fillText(this.text, this.currPos.x, this.currPos.y);
    ctx.restore();
  }

  _commit(engine, targetPos, tiled) {
    if (!this.text || !targetPos) { // nothing to place
      console.log("Commit aborted:", { text: this.text, targetPos });
      this.drawing = false;
      this.currPos = null;
      engine.renderAllObjects();
      return;
    }

    const storeRef = (engine?.store && typeof engine.store.getState === "function")
      ? engine.store
      : useCanvasStore;
    const s = storeRef.getState();
    const maxLayer = s.objects.length ? Math.max(...s.objects.map(o => o.layer)) : 0;

    const watermarkObject = new CanvasObject({
      type: "watermark",
      data: {
        x: Number(targetPos.x),
        y: Number(targetPos.y),
        text: this.text,
        tiled: !!tiled,
        opacity: this.opacity,
        rotationDeg: this.rotationDeg,
        spacingFactor: this.spacingFactor
      },
      style: {
        stroke: s.color ?? "#000000",        // use current color
        fontSize: this._fontSizeFrom(s)      // derived from width slider
      },
      layer: maxLayer + 1
    });

    console.log("Adding watermark object:", watermarkObject);

    s.addObject(watermarkObject);

    // reset per-placement state
    this.drawing = false;
    this.currPos = null;
    this.text = null; // ask again next time

    engine.renderAllObjects();
  }

  // ---------------- Events ----------------
  onMouseDown(event, pos, engine) {
    console.log("Watermark mousedown:", { pos, hasEngine: !!engine });
    
    // Ask text if not set for this placement
    if (!this.text) {
      const v = window.prompt("Enter watermark text:", this.lastText);
      if (v === null || v.trim() === "") {
        // canceled or empty => abort
        console.log("Text input canceled or empty");
        engine.renderAllObjects();
        return;
      }
      this.text = v;
      this.lastText = v;
      console.log("Set watermark text:", this.text);
    }

    this.drawing = true;
    this.currPos = pos;            // remember cursor even if onMouseUp has no pos
    this._composePreview(engine);
  }

  onMouseMove(event, pos, engine) {
    if (!this.drawing) return;
    this.currPos = pos;
    this._composePreview(engine);
  }

  onMouseUp(event, pos, engine) {
    if (!this.drawing) return;
    console.log("Watermark mouseup:", { pos, currPos: this.currPos, shiftKey: event?.shiftKey });
    
    // FIXED: Always use currPos (from mousedown/mousemove) instead of mouseup pos
    // The mouseup pos seems to have coordinate transformation issues
    const target = this.currPos; // Use the position we tracked during preview
    const tiled = !!(event && event.shiftKey); // Shift+Click => tiled
    this._commit(engine, target, tiled);
  }

  onKeyDown(event, engine) {
    if (!event) return;
    // Optional quick changes:
    if (event.key.toLowerCase() === "o") {
      const v = parseFloat(window.prompt("Opacity (0..1):", String(this.opacity)));
      if (!Number.isNaN(v) && v >= 0 && v <= 1) {
        this.opacity = v;
        console.log("Changed opacity to:", this.opacity);
      }
      if (this.drawing) this._composePreview(engine);
    }
    if (event.key.toLowerCase() === "r") {
      const v = parseFloat(window.prompt("Rotation (deg) for tiled:", String(this.rotationDeg)));
      if (!Number.isNaN(v)) {
        this.rotationDeg = v;
        console.log("Changed rotation to:", this.rotationDeg);
      }
    }
  }

  onDeactivate(engine) {
    if (!this.drawing) return;
    console.log("Watermark tool deactivated");
    this.drawing = false;
    this.currPos = null;
    engine.renderAllObjects();
  }

  onBlur(engine) {
    this.onDeactivate(engine);
  }
}