// src/canvasTool/tools/BlurTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export class BlurTool extends BaseTool {
  static inspector = [
    // Geometry
    { group: "Position", label: "X", type: "number", path: "data.x" },
    { group: "Position", label: "Y", type: "number", path: "data.y" },
    { group: "Size", label: "W", type: "number", path: "data.width", min: 1 },
    { group: "Size", label: "H", type: "number", path: "data.height", min: 1 },

    // Mode
    {
      group: "Effect",
      label: "Mode",
      type: "select",
      path: "style.mode",
      options: [
        { label: "Pixelate", value: "pixelate" },
        { label: "Blur", value: "blur" },
        { label: "Redact (solid)", value: "redact" },
      ],
      default: "pixelate",
    },
    // Intensity controls
    {
      group: "Effect",
      label: "Pixel size",
      type: "number",
      path: "style.pixelSize",
      min: 2,
      max: 64,
      step: 1,
      default: 16,
    },
    {
      group: "Effect",
      label: "Blur radius",
      type: "number",
      path: "style.blurRadius",
      min: 1,
      max: 40,
      step: 1,
      default: 10,
    },

    // Box styling
    {
      group: "Box",
      label: "Corner",
      type: "number",
      path: "style.cornerRadius",
      min: 0,
      max: 22,
      step: 1,
      default: 6,
    },
    {
      group: "Box",
      label: "Border",
      type: "color",
      path: "style.stroke",
      default: "rgba(20,20,20,0.85)",
    },
    {
      group: "Box",
      label: "Border width",
      type: "number",
      path: "style.lineWidth",
      min: 0,
      max: 8,
      step: 1,
      default: 0,
    },
    {
      group: "Box",
      label: "Opacity",
      type: "number",
      path: "style.opacity",
      min: 0.1,
      max: 1,
      step: 0.05,
      default: 1,
    },
    {
      group: "Box",
      label: "Redact fill",
      type: "color",
      path: "style.fill",
      default: "#000000",
    },
  ];

  static defaultsPanel = {
    fields: [
      {
        group: "Effect",
        label: "Mode",
        type: "select",
        path: "style.mode",
        default: "pixelate",
        options: [
          { label: "Blur", value: "blur" },
        ],
      },
      {
        group: "Effect",
        label: "Pixel size",
        type: "number",
        path: "style.pixelSize",
        default: 16,
        min: 2,
        max: 64,
      },
      {
        group: "Effect",
        label: "Blur radius",
        type: "number",
        path: "style.blurRadius",
        default: 10,
        min: 1,
        max: 40,
      },
      {
        group: "Box",
        label: "Corner",
        type: "number",
        path: "style.cornerRadius",
        default: 6,
        min: 0,
        max: 22,
      },
      {
        group: "Box",
        label: "Opacity",
        type: "number",
        path: "style.opacity",
        default: 1,
        min: 0.1,
        max: 1,
        step: 0.05,
      },
    ],
  };

  name = "blur";

  constructor() {
    super();
    this.dragging = false;
    this.start = null; // {x,y}
    this.previewRect = null;
  }

  onPointerDown(e, pos, engine) {
    this.dragging = true;
    this.start = { x: pos.x, y: pos.y };
    this.previewRect = { x: pos.x, y: pos.y, width: 0, height: 0 };

    // Store canvas state when starting drag for better preview
    this.originalCanvasState = engine.ctx.getImageData(
      0,
      0,
      engine.ctx.canvas.width,
      engine.ctx.canvas.height
    );
  }

  onPointerMove(e, pos, engine) {
    if (!this.dragging || !this.start) return;

    const x = Math.min(this.start.x, pos.x);
    const y = Math.min(this.start.y, pos.y);
    const w = Math.abs(this.start.x - pos.x);
    const h = Math.abs(this.start.y - pos.y);
    this.previewRect = { x, y, width: w, height: h };

    // Restore original canvas state first
    if (this.originalCanvasState) {
      engine.ctx.putImageData(this.originalCanvasState, 0, 0);
    }

    // Re-render all objects
    engine.renderAllObjects?.();

    // Draw preview rectangle
    const ctx = engine.ctx;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(60, 60, 60, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(0,0,0,0.08)";

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  onPointerUp(e, pos, engine) {
    if (!this.dragging || !this.start) return;
    this.dragging = false;

    let { x, y, width, height } = this.previewRect || {
      x: this.start.x,
      y: this.start.y,
      width: Math.abs(pos.x - this.start.x),
      height: Math.abs(pos.y - this.start.y),
    };

    // tiny click => default size
    if (width < 4 && height < 4) {
      width = 220;
      height = 80;
    }

    // Get defaults from the store or use fallback values
    const store = useCanvasStore.getState();
    const toolDefaults = store.toolDefaults?.blur || {};

    const style = {
      mode: toolDefaults.mode || "pixelate",
      pixelSize: toolDefaults.pixelSize || 16,
      blurRadius: toolDefaults.blurRadius || 10,
      cornerRadius: toolDefaults.cornerRadius || 6,
      stroke: toolDefaults.stroke || "rgba(20,20,20,0.85)",
      lineWidth: toolDefaults.lineWidth || 0,
      opacity: toolDefaults.opacity || 1,
      fill: toolDefaults.fill || "#000000",
    };

    const topLayer =
      (store.objects || []).reduce((m, o) => Math.max(m, o.layer || 0), 0) + 1;

    const obj = new CanvasObject({
      type: "blur",
      name: "Blur",
      data: { x, y, width, height },
      style,
      layer: topLayer,
    });

    store.addObject(obj);

    // Force a complete re-render
    setTimeout(() => {
      engine.renderAllObjects?.();
    }, 0);

    // cleanup
    this.start = null;
    this.previewRect = null;
    this.originalCanvasState = null;
  }

  onMouseDown(e, pos, engine) {
    return this.onPointerDown?.(e, pos, engine);
  }
  onMouseMove(e, pos, engine) {
    return this.onPointerMove?.(e, pos, engine);
  }
  onMouseUp(e, pos, engine) {
    return this.onPointerUp?.(e, pos, engine);
  }
}

export default BlurTool;
