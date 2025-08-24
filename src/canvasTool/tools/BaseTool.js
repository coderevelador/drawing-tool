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
    const defs = (s.toolDefaults && s.toolDefaults[this.name]) || {};
    // Normalize style object
    const style = {
      stroke: defs.style?.stroke ?? base.color ?? "#000",
      lineWidth: defs.style?.lineWidth ?? base.lineWidth ?? 2,
      lineType: defs.style?.lineType ?? "solid",
      opacity: defs.style?.opacity ?? 1,
      fill: defs.style?.fill ?? "none",
      fillOpacity: defs.style?.fillOpacity ?? 1,
      fillEnabled: defs.style?.fillEnabled ?? false,
      cloudAmplitude: defs.style?.cloudAmplitude ?? 8,
      cloudStep: defs.style?.cloudStep ?? 12,
    };
    return { style, closed: defs.closed ?? false };
  }

  makeStyledObject(type, data, engine) {
    const { style, closed } = this.getToolOptions(engine.store);
    const obj = { type, data, style, layer: 0 };
    if (type === "polyline") obj.data.closed = obj.data.closed ?? closed;
    return obj;
  }
}
