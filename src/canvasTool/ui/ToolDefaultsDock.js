// src/canvasTool/ui/ToolDefaultsDock.js
import { useCanvasStore } from "../state/canvasStore";
import { makeDraggable } from "./draggable";

const dget = (obj, path) =>
  path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
const dset = (obj, path, v) => {
  const ks = path.split(".");
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    const k = ks[i];
    if (o[k] == null || typeof o[k] !== "object") o[k] = {};
    o = o[k];
  }
  o[ks.at(-1)] = v;
};

function mkRow(label, input) {
  const wrap = document.createElement("label");
  Object.assign(wrap.style, {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    margin: "6px 0",
  });
  const lab = document.createElement("div");
  lab.textContent = label;
  lab.style.opacity = 0.9;
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}
const mk = {
  color() {
    const i = document.createElement("input");
    i.type = "color";
    i.style.height = "28px";
    return i;
  },
  num(min, max, step = 1) {
    const i = document.createElement("input");
    i.type = "number";
    if (min != null) i.min = String(min);
    if (max != null) i.max = String(max);
    i.step = String(step);
    Object.assign(i.style, {
      height: "28px",
      background: "#0e142b",
      color: "#eee",
      border: "1px solid rgba(255,255,255,.12)",
      borderRadius: "6px",
      padding: "0 6px",
    });
    return i;
  },
  range(min, max, step = 0.05) {
    const i = document.createElement("input");
    i.type = "range";
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.style.width = "100%";
    return i;
  },
  check() {
    const i = document.createElement("input");
    i.type = "checkbox";
    i.style.transform = "translateY(1px)";
    return i;
  },
  select(options) {
    const s = document.createElement("select");
    Object.assign(s.style, {
      height: "28px",
      background: "#0e142b",
      color: "#eee",
      border: "1px solid rgba(255,255,255,.12)",
      borderRadius: "6px",
      padding: "0 6px",
    });
    (options || []).forEach((o) => {
      const op = document.createElement("option");
      op.value = o.value ?? o;
      op.textContent = o.label ?? o;
      s.appendChild(op);
    });
    return s;
  },
};

function resolveActiveToolName(store, engine) {
  try {
    const s = store.getState ? store.getState() : {};
    return s.currentTool ?? s.activeTool ?? engine?.activeTool ?? null;
  } catch {
    return engine?.activeTool ?? null;
  }
}

function resolveToolClass(engine, toolName) {
  if (!toolName) return null;

  // 1) registry with constructors
  if (engine?.toolRegistry) {
    const c = engine.toolRegistry[toolName];
    if (typeof c === "function") return c;
    if (c?.constructor) return c.constructor;
  }

  // 2) tools map could be instance OR constructor
  const maybe = engine?.tools?.[toolName];
  if (typeof maybe === "function") return maybe; // it's a class/constructor
  if (maybe?.constructor && maybe.constructor !== Object) {
    return maybe.constructor;
  }

  // 3) nothing found
  return null;
}

function buildField(field, defaults, write, title) {
  const { type, label, path, min, max, step, options } = field;
  let input;
  if (type === "color") input = mk.color();
  else if (type === "number") input = mk.num(min, max, step);
  else if (type === "range") input = mk.range(min, max, step);
  else if (type === "checkbox") input = mk.check();
  else if (type === "select") input = mk.select(options || []);
  else return null;

  const current = path ? dget(defaults, path) : undefined;
  if (type === "checkbox") input.checked = !!current;
  else if (current != null) input.value = String(current);
  else if (type === "color") input.value = "#000000";

  const commit = () => {
    const patch = { style: {}, data: {} };
    // keep __enabled if already set
    if ("__enabled" in defaults) patch.__enabled = defaults.__enabled;

    const val =
      type === "checkbox"
        ? !!input.checked
        : type === "number"
        ? parseFloat(input.value)
        : type === "range"
        ? parseFloat(input.value)
        : input.value;

    if (path) dset(patch, path, val);
    write(patch);
  };

  input.addEventListener("input", commit);
  input.addEventListener("change", commit);
  return mkRow(label, input);
}

export function ensureToolDefaultsDock(engine) {
  const store = engine?.store || useCanvasStore;

  const el = document.createElement("div");
  el.dataset.role = "tool-defaults-dock";
  Object.assign(el.style, {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 10050,
    background: "#0b1020",
    color: "#eee",
    padding: "10px 12px",
    borderRadius: "12px",
    boxShadow: "0 6px 24px rgba(0,0,0,.35)",
    font: "12px system-ui",
    minWidth: "260px",
    pointerEvents: "auto",
    border: "1px solid rgba(255,255,255,.08)",
  });

  const title = document.createElement("div");
  Object.assign(title.style, {
    fontWeight: 700,
    marginBottom: "8px",
    opacity: 0.9,
  });
  el.appendChild(title);

  const controls = document.createElement("div");
  controls.dataset.role = "controls";
  el.appendChild(controls);

  const write = (patch) => {
    try {
      const s = store.getState ? store.getState() : {};
      const toolName = resolveActiveToolName(store, engine);
      if (typeof s.setToolDefaults === "function") {
        s.setToolDefaults(toolName, patch);
      } else if (typeof store.setState === "function") {
        // fallback merge
        const td = { ...(s.toolDefaults || {}) };
        td[toolName] = { ...(td[toolName] || {}), ...patch };
        store.setState({ toolDefaults: td });
      }
    } catch (e) {
      console.warn("[ToolDefaultsDock] write failed:", e);
    }
  };

  const rebuild = () => {
    controls.innerHTML = "";

    const s = store.getState ? store.getState() : {};
    const toolName = resolveActiveToolName(store, engine);
    title.textContent = `Tool Defaults — ${toolName ?? "—"}`;

    const defaults =
      (s.toolDefaults && toolName && s.toolDefaults[toolName]) || {};
    const ToolClass = resolveToolClass(engine, toolName);
    const panel = ToolClass?.defaultsPanel;

    // Hide dock for tools that request it
    if (panel?.hideDock) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";

    if (!panel || !Array.isArray(panel.fields)) {
      // Nothing to render; don’t crash
      const msg = document.createElement("div");
      msg.textContent = panel
        ? "This tool has no defaults panel."
        : "No defaultsPanel found on the tool class.";
      msg.style.opacity = 0.75;
      controls.appendChild(msg);
      console.warn(
        "[ToolDefaultsDock] No defaultsPanel for tool:",
        toolName,
        " ToolClass:",
        ToolClass
      );
      return;
    }

    // Optional per-tool enable switch
    if (panel.hasEnableToggle) {
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = !!defaults.__enabled;
      const wrap = mkRow("Enable for this tool", toggle);
      controls.appendChild(wrap);

      const setDisabled = (off) => {
        controls.querySelectorAll("label").forEach((lab) => {
          if (lab === wrap) return;
          lab.style.opacity = off ? "0.5" : "1";
          lab.querySelectorAll("input,select,textarea").forEach((i) => {
            i.disabled = off;
            i.style.pointerEvents = off ? "none" : "auto";
          });
        });
      };
      setDisabled(!toggle.checked);

      toggle.addEventListener("change", () => {
        write({ __enabled: !!toggle.checked });
        setDisabled(!toggle.checked);
      });
    }

    // Build grouped fields
    const groups = new Map(); // groupName -> container
    const ensureGroup = (name) => {
      if (!name) return controls;
      if (groups.has(name)) return groups.get(name);
      const hdr = document.createElement("div");
      hdr.textContent = name;
      Object.assign(hdr.style, {
        marginTop: "6px",
        fontWeight: 700,
        opacity: 0.8,
      });
      const box = document.createElement("div");
      controls.appendChild(hdr);
      controls.appendChild(box);
      groups.set(name, box);
      return box;
    };

    // Snapshot of defaults for showIf evaluation
    const snapshot = JSON.parse(JSON.stringify(defaults));

    panel.fields.forEach((f) => {
      if (typeof f.showIf === "function" && !f.showIf(snapshot)) return;
      const node = buildField(f, defaults, write, title);
      if (node) ensureGroup(f.group).appendChild(node);
    });
  };

  document.body.appendChild(el);
  const stopDrag = makeDraggable(el, {
    handle: title,
    key: "toolDefaultsDockPos",
  });
  rebuild();

  // Rebuild when tool changes OR toolDefaults map changes
  const unsub = useCanvasStore.subscribe((state, prev) => {
    const toolNow =
      state.currentTool ?? state.activeTool ?? engine?.activeTool ?? null;
    const toolPrev =
      prev.currentTool ?? prev.activeTool ?? engine?.activeTool ?? null;

    if (toolNow !== toolPrev || state.toolDefaults !== prev.toolDefaults) {
      rebuild();
    }
  });

  return {
    destroy() {
      unsub?.();
      try {
        stopDrag && stopDrag();
      } catch {}
      el.remove();
    },
  };
}

export default ensureToolDefaultsDock;
