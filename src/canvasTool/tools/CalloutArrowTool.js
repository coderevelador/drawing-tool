// src/canvasTool/tools/CalloutArrowTool.js
import { BaseTool } from "./BaseTool";
import { CanvasObject } from "../models/CanvasObject";
import { useCanvasStore } from "../state/canvasStore";

// tiny helpers
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rectFrom = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return { x, y, width: w, height: h };
};

function sideAttachPoint(rect, anchor) {
  // choose the closest side of the rect to anchor; return a point on that side (center)
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = anchor.x - cx;
  const dy = anchor.y - cy;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (adx > ady) {
    // left or right
    if (dx < 0)
      return { x: rect.x, y: clamp(anchor.y, rect.y, rect.y + rect.height) };
    return {
      x: rect.x + rect.width,
      y: clamp(anchor.y, rect.y, rect.y + rect.height),
    };
  } else {
    // top or bottom
    if (dy < 0)
      return { x: clamp(anchor.x, rect.x, rect.x + rect.width), y: rect.y };
    return {
      x: clamp(anchor.x, rect.x, rect.x + rect.width),
      y: rect.y + rect.height,
    };
  }
}

export class CalloutArrowTool extends BaseTool {
  // Inspector schema
  static inspector = [
    // Rect geometry
    { group: "Position", label: "X", type: "number", path: "data.rect.x" },
    { group: "Position", label: "Y", type: "number", path: "data.rect.y" },
    {
      group: "Size",
      label: "W",
      type: "number",
      path: "data.rect.width",
      min: 1,
    },
    {
      group: "Size",
      label: "H",
      type: "number",
      path: "data.rect.height",
      min: 1,
    },

    // Arrow geometry (editable)
    { group: "Arrow", label: "Tip X", type: "number", path: "data.anchor.x" },
    { group: "Arrow", label: "Tip Y", type: "number", path: "data.anchor.y" },
    { group: "Arrow", label: "Elbow X", type: "number", path: "data.elbow.x" },
    { group: "Arrow", label: "Elbow Y", type: "number", path: "data.elbow.y" },

    // Text + style
    { group: "Text", label: "Content", type: "textarea", path: "data.text" },
    { group: "Text", label: "Font", type: "text", path: "style.fontFamily" },
    {
      group: "Text",
      label: "Size",
      type: "number",
      path: "style.fontSize",
      min: 8,
      max: 72,
      step: 1,
    },
    {
      group: "Text",
      label: "Weight",
      type: "select",
      path: "style.fontWeight",
      options: [
        { label: "400", value: "400" },
        { label: "500", value: "500" },
        { label: "600", value: "600" },
        { label: "700", value: "700" },
      ],
    },
    { group: "Text", label: "Color", type: "color", path: "style.textColor" },
    {
      group: "Text",
      label: "Padding",
      type: "number",
      path: "data.padding",
      min: 0,
      max: 32,
      step: 1,
    },

    // Stroke/fill
    { group: "Style", label: "Stroke", type: "color", path: "style.stroke" },
    {
      group: "Style",
      label: "Width",
      type: "number",
      path: "style.lineWidth",
      min: 1,
      step: 1,
    },
    {
      group: "Style",
      label: "Filled",
      type: "checkbox",
      path: "style.fillEnabled",
    },
    { group: "Style", label: "Fill", type: "color", path: "style.fill" },
    {
      group: "Style",
      label: "Fill α",
      type: "range",
      path: "style.fillOpacity",
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      group: "Style",
      label: "Radius",
      type: "number",
      path: "style.cornerRadius",
      min: 0,
      max: 24,
      step: 1,
    },

    // Arrow head
    {
      group: "Arrow",
      label: "Head size",
      type: "number",
      path: "style.headSize",
      min: 4,
      max: 48,
      step: 1,
    },
    {
      group: "Arrow",
      label: "Closed",
      type: "checkbox",
      path: "style.arrowClosed",
    },
    {
      group: "Arrow",
      label: "Filled",
      type: "checkbox",
      path: "style.arrowFilled",
    },
  ];

  // Small defaults panel so users can tweak quickly
  static defaultsPanel = {
    fields: [
      { group: "Stroke", label: "Stroke", type: "color", path: "style.stroke" },
      {
        group: "Stroke",
        label: "Width",
        type: "number",
        path: "style.lineWidth",
        min: 1,
        max: 12,
        step: 1,
      },
      { group: "Text", label: "Color", type: "color", path: "style.textColor" },
      {
        group: "Text",
        label: "Size",
        type: "number",
        path: "style.fontSize",
        min: 8,
        max: 72,
        step: 1,
      },
    ],
  };

  name = "calloutArrow";

  constructor() {
    super();
    this.stage = 0; // 0 = place tip, 1 = drag rect
    this.anchor = null; // arrow tip
    this.rectStart = null; // drag start for rect
    this.snapshot = null;
    this._styleSnapshot = null;
    this.preview = null; // current rect during drag
  }

  onMouseDown(e, pos, engine) {
    if (this.stage === 0) {
      // First click: set arrow tip
      this.anchor = { ...pos };
      this.stage = 1; // next mouse down will start rect
      return;
    }

    // Second click: start drawing rect
    if (this.stage === 1) {
      this.rectStart = { ...pos };
      this.snapshot = engine.ctx.getImageData(
        0,
        0,
        engine.width,
        engine.height
      );
      this._styleSnapshot = { ...this.getToolOptions(engine.store).style };
      this.stage = 2;
      this.preview = null;
    }
  }

  onMouseMove(e, pos, engine) {
    if (this.stage !== 2 || !this.rectStart || !this.anchor || !this.snapshot)
      return;

    // restore
    engine.ctx.putImageData(this.snapshot, 0, 0);
    if (this.stage !== 2 || !this.rectStart || !this.anchor) return;
    const rect = rectFrom(this.rectStart, pos);
    const attach = sideAttachPoint(rect, this.anchor);
    const elbow = { x: this.anchor.x, y: attach.y }; // simple right-angle elbow

    // draw preview
    this._draw(
      engine.ctx,
      rect,
      attach,
      elbow,
      this.anchor,
      this._styleSnapshot,
      {
        text: "",
        padding: 8, // no text yet during preview
      }
    );
    engine.renderAllObjects?.();
    this._draw(
      engine.ctx,
      rect,
      attach,
      elbow,
      this.anchor,
      this._styleSnapshot,
      { text: "", padding: 8 }
    );

    this.preview = { rect, attach, elbow };
  }

  onMouseUp(e, pos, engine) {
    this._handleUp(pos, engine);
  }
  onPointerUp(e, pos, engine) {
    this._handleUp(pos, engine);
  }
  _handleUp(pos, engine) {
    if (this.stage !== 2) return;

    const rect = this.preview?.rect || rectFrom(this.rectStart, pos);
    const attach = this.preview?.attach || sideAttachPoint(rect, this.anchor);
    const elbow = this.preview?.elbow || { x: this.anchor.x, y: attach.y };

    // tiny cancel guard: ignore clicks with no area
    if (rect.width < 2 && rect.height < 2) {
      this._reset(engine);
      return;
    }
    const maxLayer = Math.max(
      0,
      ...(useCanvasStore.getState().objects || []).map((o) => o.layer || 0)
    );
    const style = { ...this._styleSnapshot };
    const obj = new CanvasObject({
      type: "calloutArrow",
      data: {
        rect,
        anchor: { ...this.anchor },
        elbow,
        attach,
        text: "",
        padding: 8,
      },
      style,
      layer: maxLayer + 1,
    });

    useCanvasStore.getState().addObject(obj);
    engine.renderAllObjects?.();

    // spawn inline editor (like text/callout tools)
    this.spawnEditor(engine, obj);

    // reset tool
    this.stage = 0;
    this.anchor = null;
    this.rectStart = null;
    this.snapshot = null;
    this.preview = null;
    this._styleSnapshot = null;
    this._reset(engine);
  }
  _reset(engine) {
    this.stage = 0;
    this.anchor = null;
    this.rectStart = null;
    this.preview = null;
    this._styleSnapshot = null;
  }
  // Minimal inline textarea editor that writes back into obj.data.text
  spawnEditor(engine, obj) {
    const { rect } = obj.data;
    const style = obj.style || {};
    const pad = obj.data.padding ?? 8;

    const ta = document.createElement("textarea");
    Object.assign(ta.style, {
      position: "absolute",
      left: `${engine.canvas.getBoundingClientRect().left + rect.x + pad}px`,
      top: `${
        engine.canvas.getBoundingClientRect().top +
        rect.y +
        pad +
        window.scrollY
      }px`,
      width: `${Math.max(8, rect.width - pad * 2)}px`,
      height: `${Math.max(8, rect.height - pad * 2)}px`,
      border: "none",
      outline: "none",
      background: "transparent",
      color: style.textColor || style.stroke || "#000",
      font: `${style.fontSize || 14}px ${style.fontFamily || "Arial"}`,
      lineHeight: "1.25",
      resize: "none",
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      zIndex: 10060,
    });

    document.body.appendChild(ta);
    ta.focus();

    const finish = (commit) => {
      const value = ta.value || "";
      ta.remove();
      if (commit) {
        const s = useCanvasStore.getState();
        const cur = (s.objects || []).map((o) =>
          o.id === obj.id ? { ...o, data: { ...o.data, text: value } } : o
        );
        s.setState
          ? s.setState({ objects: cur })
          : useCanvasStore.setState({ objects: cur });
        engine.renderAllObjects?.();
      }
    };

    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        finish(false);
      } else if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        finish(true);
      }
    });
    ta.addEventListener("blur", () => finish(true));
  }

  // preview/renderer for the tool (uses same helpers renderObject will)
  _draw(ctx, rect, attach, elbow, anchor, style, data) {
    const s = style || {};
    ctx.save();

    // setup stroke/fill basics
    ctx.lineWidth = s.lineWidth ?? 2;
    ctx.strokeStyle = s.stroke ?? "#f00";
    ctx.fillStyle = s.fill ?? "transparent";
    ctx.globalAlpha = s.opacity ?? 1;

    // rect (rounded)
    const r = Math.max(0, s.cornerRadius ?? 4);
    ctx.beginPath();
    if (ctx.roundRect)
      ctx.roundRect(rect.x, rect.y, rect.width, rect.height, r);
    else {
      // simple poly rounded
      const rr = (x, y, w, h, rad) => {
        const rx = Math.min(rad, w / 2),
          ry = Math.min(rad, h / 2);
        ctx.moveTo(x + rx, y);
        ctx.arcTo(x + w, y, x + w, y + h, rx);
        ctx.arcTo(x + w, y + h, x, y + h, ry);
        ctx.arcTo(x, y + h, x, y, rx);
        ctx.arcTo(x, y, x + w, y, ry);
        ctx.closePath();
      };
      rr(rect.x, rect.y, rect.width, rect.height, r);
    }
    if (s.fillEnabled) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = (s.fillOpacity ?? 1) * (s.opacity ?? 1);
      ctx.fill();
      ctx.globalAlpha = prev;
    }
    ctx.stroke();

    // leader: tip -> elbow -> attach
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(attach.x, attach.y);
    ctx.stroke();

    // arrow head at tip
    const head = Number(s.headSize ?? Math.max(10, (s.lineWidth ?? 2) * 3));
    const v = { x: elbow.x - anchor.x, y: elbow.y - anchor.y };
    const len = Math.hypot(v.x, v.y) || 1;
    const ux = v.x / len,
      uy = v.y / len;
    const left = {
      x: anchor.x + ux * head - uy * (head * 0.5),
      y: anchor.y + uy * head + ux * (head * 0.5),
    };
    const right = {
      x: anchor.x + ux * head + uy * (head * 0.5),
      y: anchor.y + uy * head - ux * (head * 0.5),
    };
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(left.x, left.y);
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(right.x, right.y);
    if (s.arrowClosed) {
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(anchor.x, anchor.y);
      ctx.lineTo(right.x, right.y);
      ctx.closePath();
      if (s.arrowFilled) ctx.fill();
      ctx.stroke();
    } else {
      ctx.stroke();
    }

    // text (preview shows nothing, final render handles it)
    ctx.restore();
  }
}

export default CalloutArrowTool;
