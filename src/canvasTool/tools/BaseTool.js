export class BaseTool {
  constructor() {
    this.name = "";
  }

  onMouseDown(event, pos, engine) {
    // Override in subclasses
  }

  onMouseMove(event, pos, engine) {
    // Override in subclasses
  }

  onMouseUp(event, pos, engine) {
    // Override in subclasses
  }

  getToolOptions(store) {
    const s = store.getState();
    const base = { color: s.color, lineWidth: s.lineWidth };
    // Normalize style object
    const defs = (s.toolDefaults && s.toolDefaults[this.name]) || {};
    // Pass-through ALL custom keys (gradient/pattern, etc.)
    const raw = defs.style || {};
    const style = {
      ...raw,
      stroke: raw.stroke ?? base.color ?? "#000",
      lineWidth: raw.lineWidth ?? base.lineWidth ?? 2,
      lineType: raw.lineType ?? "solid",
      opacity: raw.opacity ?? 1,
      fill: raw.fill ?? "none",
      fillOpacity: raw.fillOpacity ?? 1,
      fillEnabled: raw.fillEnabled ?? false,
      cloudAmplitude: raw.cloudAmplitude ?? 8,
      cloudStep: raw.cloudStep ?? 12,
    };
    return { style, closed: defs.closed ?? false };
  }

  _fillPreview(ctx, style = {}) {
    const on =
      style.fillEnabled ??
      (!!style.fill && style.fill !== "none" && style.fill !== "transparent");
    if (!on) return;
    const prev = ctx.globalAlpha;
    const a = typeof style.fillOpacity === "number" ? style.fillOpacity : 1;
    ctx.globalAlpha = prev * a;
    ctx.fill();
    ctx.globalAlpha = prev;
  }

  makeStyledObject(type, data, engine) {
    const { style, closed } = this.getToolOptions(engine.store);
    const obj = { type, data, style, layer: 0 };
    if (type === "polyline") obj.data.closed = obj.data.closed ?? closed;
    return obj;
  }
}
