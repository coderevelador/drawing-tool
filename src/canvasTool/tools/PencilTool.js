import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

export class PencilTool extends BaseTool {
  // PencilTool.js (add inside the class)
  static inspector = [
    // --- Meta ---
    {
      group: "Meta",
      label: "Name",
      type: "text",
      path: "name",
      showIf: (o) => o?.name != null,
    },
    {
      group: "Meta",
      label: "Locked",
      type: "checkbox",
      path: "locked",
      showIf: (o) => o?.locked != null,
    },

    // --- Position / Size (if you store a bbox alongside points) ---
    {
      group: "Position",
      label: "X",
      type: "number",
      path: "data.x",
      showIf: (o) => o?.data?.x != null,
    },
    {
      group: "Position",
      label: "Y",
      type: "number",
      path: "data.y",
      showIf: (o) => o?.data?.y != null,
    },
    {
      group: "Size",
      label: "W",
      type: "number",
      path: "data.width",
      showIf: (o) => o?.data?.width != null,
    },
    {
      group: "Size",
      label: "H",
      type: "number",
      path: "data.height",
      showIf: (o) => o?.data?.height != null,
    },

    // --- Path data ---
    {
      group: "Path",
      label: "Points (JSON)",
      type: "textarea",
      path: "data.points",
      showIf: (o) => Array.isArray(o?.data?.points),
      parse: (v) => {
        try {
          return JSON.parse(v);
        } catch {
          return [];
        }
      },
      format: (v) => JSON.stringify(v ?? [], null, 0),
    },

    // --- Core style ---
    {
      group: "Style",
      label: "Stroke",
      type: "color",
      path: "style.stroke",
      showIf: (o) => o?.style?.stroke != null,
    },
    {
      group: "Style",
      label: "Width",
      type: "number",
      path: "style.lineWidth",
      min: 1,
      step: 1,
      showIf: (o) => o?.style?.lineWidth != null,
    },
    {
      group: "FX",
      label: "Opacity",
      type: "range",
      path: "style.opacity",
      min: 0,
      max: 1,
      step: 0.05,
      showIf: (o) => o?.style?.opacity != null,
    },

    // --- Compositing (only if you support it) ---
    {
      group: "FX",
      label: "Composite",
      type: "select",
      path: "style.composite",
      options: [
        "source-over",
        "multiply",
        "screen",
        "overlay",
        "darken",
        "lighten",
        "color-burn",
        "color-dodge",
        "hard-light",
        "soft-light",
        "difference",
        "exclusion",
        "hue",
        "saturation",
        "color",
        "luminosity",
      ],
      showIf: (o) => o?.style?.composite != null,
    },

    // --- Brush behavior (optional; shown only if your object/style has them) ---
    {
      group: "Brush",
      label: "Smoothing",
      type: "range",
      path: "style.smoothing",
      min: 0,
      max: 1,
      step: 0.05,
      showIf: (o) => o?.style?.smoothing != null,
    },
    {
      group: "Brush",
      label: "Streamline",
      type: "range",
      path: "style.streamline",
      min: 0,
      max: 1,
      step: 0.05,
      showIf: (o) => o?.style?.streamline != null,
    },
    {
      group: "Brush",
      label: "Taper Start",
      type: "number",
      path: "style.taperStart",
      min: 0,
      step: 1,
      showIf: (o) => o?.style?.taperStart != null,
    },
    {
      group: "Brush",
      label: "Taper End",
      type: "number",
      path: "style.taperEnd",
      min: 0,
      step: 1,
      showIf: (o) => o?.style?.taperEnd != null,
    },
    {
      group: "Brush",
      label: "Pressure",
      type: "checkbox",
      path: "style.pressure",
      showIf: (o) => o?.style?.pressure != null,
    },
    {
      group: "Brush",
      label: "Stabilizer",
      type: "number",
      path: "style.stabilizer",
      min: 0,
      step: 1,
      showIf: (o) => o?.style?.stabilizer != null,
    },

    // --- Stroke caps/joins ---
    {
      group: "Stroke",
      label: "Cap",
      type: "select",
      path: "style.lineCap",
      options: ["round", "butt", "square"],
      showIf: (o) => o?.style?.lineCap != null,
    },
    {
      group: "Stroke",
      label: "Join",
      type: "select",
      path: "style.lineJoin",
      options: ["round", "bevel", "miter"],
      showIf: (o) => o?.style?.lineJoin != null,
    },
    {
      group: "Stroke",
      label: "Miter Limit",
      type: "number",
      path: "style.miterLimit",
      min: 1,
      step: 1,
      showIf: (o) => o?.style?.miterLimit != null,
    },

    // --- Shadow (if you store shadow style) ---
    {
      group: "Shadow",
      label: "Color",
      type: "color",
      path: "style.shadowColor",
      showIf: (o) => o?.style?.shadowColor != null,
    },
    {
      group: "Shadow",
      label: "Blur",
      type: "number",
      path: "style.shadowBlur",
      min: 0,
      step: 1,
      showIf: (o) => o?.style?.shadowBlur != null,
    },
    {
      group: "Shadow",
      label: "Offset X",
      type: "number",
      path: "style.shadowOffsetX",
      step: 1,
      showIf: (o) => o?.style?.shadowOffsetX != null,
    },
    {
      group: "Shadow",
      label: "Offset Y",
      type: "number",
      path: "style.shadowOffsetY",
      step: 1,
      showIf: (o) => o?.style?.shadowOffsetY != null,
    },
  ];

  constructor() {
    super();
    this.name = "pencil";
    this.points = [];
  }

  onMouseDown(event, pos, engine) {
    const { color, lineWidth } = this.getToolOptions(engine.store);

    engine.ctx.strokeStyle = color;
    engine.ctx.lineWidth = lineWidth;
    engine.ctx.beginPath();
    engine.ctx.moveTo(pos.x, pos.y);

    this.points = [pos];
  }

  onMouseMove(event, pos, engine) {
    this.points.push(pos);
    engine.ctx.lineTo(pos.x, pos.y);
    engine.ctx.stroke();
  }

  onMouseUp(event, pos, engine) {
    const store = useCanvasStore.getState();
    const maxLayer =
      store.objects.length > 0
        ? Math.max(...store.objects.map((o) => o.layer))
        : 0;

    store.addObject(
      new CanvasObject({
        type: "pencil",
        data: { path: this.points.slice() },
        style: {
          stroke: store.color,
          lineWidth: store.lineWidth,
        },
        layer: maxLayer + 1,
      })
    );

    engine.ctx.closePath();
    this.points = [];
  }
}
