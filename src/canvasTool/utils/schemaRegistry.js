// Minimal schema system for Inspector Dock
// Tools declare:   static inspector = [ { group, label, type, path, ... } ]
// Supported field types: 'number' | 'text' | 'textarea' | 'color' | 'range' | 'select' | 'checkbox'

export const SchemaRegistry = {
  _map: new Map(),

  register(type, schema) {
    if (!type || !schema) return;
    const normalizeField = (f) => ({
      type: "text",
      label: "",
      path: "",
      min: undefined,
      max: undefined,
      step: undefined,
      options: undefined,
      group: "General",
      parse: undefined,
      format: undefined,
      showIf: undefined,
      ...f,
    });
    const normalized = (schema.fields || schema).map(normalizeField);
    this._map.set(type, { fields: normalized });
  },

  registerFromTools(toolRegistry) {
    if (!toolRegistry) return;
    for (const tool of Object.values(toolRegistry)) {
      if (!tool) continue;
      const cls = tool.constructor;
      const toolType = tool.name || cls?.name;
      if (cls?.inspector && toolType) {
        // register by toolType
        this.register(toolType, cls.inspector);
      }
      // If a tool creates objects with a different store type, let the tool expose objectType
      if (cls?.objectType && cls?.inspector) {
        this.register(cls.objectType, cls.inspector);
      }
    }
  },

  get(type) {
    return this._map.get(type) || null;
  },
};

// --------- safe path helpers ----------
export function dget(obj, path, fallback) {
  if (!obj || !path) return fallback;
  const v = path
    .split(".")
    .reduce(
      (acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined),
      obj
    );
  return v === undefined ? fallback : v;
}

export function dset(obj, path, value) {
  if (!obj || !path) return obj;
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}
