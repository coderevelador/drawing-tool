import { useCanvasStore } from "../state/canvasStore";
import { makeDraggable } from "./draggable";

export function ensureToolDefaultsDock(engine) {
  const store = engine.store;
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
    minWidth: "240px",
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

  const row = (label, input) => {
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
  };
  const mkColor = () => {
    const i = document.createElement("input");
    i.type = "color";
    i.style.height = "28px";
    return i;
  };
  const mkNum = (min, max, step = 1) => {
    const i = document.createElement("input");
    i.type = "number";
    if (min != null) i.min = min;
    if (max != null) i.max = max;
    i.step = step;
    i.style.height = "28px";
    i.style.background = "#0e142b";
    i.style.color = "#eee";
    i.style.border = "1px solid rgba(255,255,255,.12)";
    i.style.borderRadius = "6px";
    i.style.padding = "0 6px";
    return i;
  };
  const mkRange = (min, max, step = 0.05) => {
    const i = document.createElement("input");
    i.type = "range";
    i.min = min;
    i.max = max;
    i.step = step;
    i.style.width = "100%";
    return i;
  };
  const mkSelect = (opts) => {
    const s = document.createElement("select");
    s.style.height = "28px";
    s.style.background = "#0e142b";
    s.style.color = "#eee";
    s.style.border = "1px solid rgba(255,255,255,.12)";
    s.style.borderRadius = "6px";
    s.style.padding = "0 6px";
    opts.forEach((o) => {
      const op = document.createElement("option");
      op.value = o.value ?? o;
      op.textContent = o.label ?? o;
      s.appendChild(op);
    });
    return s;
  };
  const mkCheck = () => {
    const i = document.createElement("input");
    i.type = "checkbox";
    i.style.transform = "translateY(1px)";
    return i;
  };

  const read = () => {
    const s = store.getState();
    const t = s.currentTool;
    return {
      tool: t,
      defaults: (s.toolDefaults && s.toolDefaults[t]) || { style: {} },
    };
  };
  const write = (patch) =>
    store.getState().setToolDefaults?.(store.getState().currentTool, patch);

  let ui = {};
  const rebuild = () => {
    // wipe and rebuild
    const old = el.querySelector("[data-role='controls']");
    if (old) old.remove();
    const controls = document.createElement("div");
    controls.dataset.role = "controls";
    el.appendChild(controls);

    const { tool, defaults } = read();
    const style = defaults.style || {};
    title.textContent = `Tool Defaults — ${tool}`;

    // Common stroke controls
    ui.stroke = mkColor();
    ui.stroke.value = style.stroke ?? "#000000";
    ui.lineWidth = mkNum(1, 64, 1);
    ui.lineWidth.value = style.lineWidth ?? 2;
    const toolLineTypeOptions = (() => {
      if (tool === "polyline" || tool === "rect" || tool === "rectangle") {
        return [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
          { value: "cloud", label: "Revision Cloud" },
        ];
      }
      // pencil and all others: no cloud
      return [
        { value: "solid", label: "Solid" },
        { value: "dashed", label: "Dashed" },
        { value: "dotted", label: "Dotted" },
      ];
    })();
    ui.lineType = mkSelect(toolLineTypeOptions);
    ui.lineType.value = style.lineType ?? "solid";

    controls.appendChild(row("Stroke", ui.stroke));
    controls.appendChild(row("Width", ui.lineWidth));
    controls.appendChild(row("Line type", ui.lineType));

    // Fill controls (Rect/Circle)
    const fillable = ["rect", "rectangle", "circle", "ellipse"].includes(tool);
    if (fillable) {
      ui.fillEnabled = mkCheck();
      ui.fillEnabled.checked = style.fillEnabled ?? false;
      ui.fill = mkColor();
      ui.fill.value = style.fill ?? "#ffffff";
      ui.fillOpacity = mkRange(0, 1, 0.05);
      ui.fillOpacity.value = style.fillOpacity ?? 1;
      controls.appendChild(row("Filled", ui.fillEnabled));
      controls.appendChild(row("Fill color", ui.fill));
      controls.appendChild(row("Fill opacity", ui.fillOpacity));
    }

    // Stroke opacity
    ui.opacity = mkRange(0, 1, 0.05);
    ui.opacity.value = style.opacity ?? 1;
    controls.appendChild(row("Stroke opacity", ui.opacity));

    // Cloud params when chosen and supported
    const showCloud = () => {
      const lt = ui.lineType.value;
      const supportsCloud = ["rect", "rectangle", "polyline"].includes(tool);
      let cloudWrap = controls.querySelector("[data-role='cloud']");
      if (lt === "cloud" && supportsCloud) {
        if (!cloudWrap) {
          cloudWrap = document.createElement("div");
          cloudWrap.dataset.role = "cloud";
          cloudWrap.style.marginTop = "6px";
          cloudWrap.style.paddingTop = "6px";
          cloudWrap.style.borderTop = "1px dashed rgba(255,255,255,.15)";
          ui.cloudAmplitude = mkNum(2, 64, 1);
          ui.cloudAmplitude.value = style.cloudAmplitude ?? 8;
          ui.cloudStep = mkNum(2, 64, 1);
          ui.cloudStep.value = style.cloudStep ?? 12;
          cloudWrap.appendChild(row("Cloud amplitude", ui.cloudAmplitude));
          cloudWrap.appendChild(row("Cloud step", ui.cloudStep));
          controls.appendChild(cloudWrap);
        }
      } else if (cloudWrap) {
        cloudWrap.remove();
        delete ui.cloudAmplitude;
        delete ui.cloudStep;
      }
    };
    ui.lineType.onchange = showCloud;
    showCloud();

    // Polyline closed toggle
    if (tool === "polyline") {
      ui.closed = mkCheck();
      ui.closed.checked = defaults.closed ?? false;
      controls.appendChild(row("Closed path", ui.closed));
    }

    const commit = () => {
      const patch = {
        style: {
          stroke: ui.stroke.value,
          lineWidth: parseFloat(ui.lineWidth.value || "2"),
          lineType: ui.lineType.value,
          opacity: parseFloat(ui.opacity.value || "1"),
        },
      };
      if (ui.fill) {
        patch.style.fill = ui.fill.value;
        patch.style.fillEnabled = !!ui.fillEnabled.checked;
        patch.style.fillOpacity = parseFloat(ui.fillOpacity.value || "1");
      }
      if (ui.cloudAmplitude) {
        patch.style.cloudAmplitude = parseFloat(ui.cloudAmplitude.value || "8");
        patch.style.cloudStep = parseFloat(ui.cloudStep.value || "12");
      }
      if (ui.closed) patch.closed = !!ui.closed.checked;
      write(patch);
    };
    Object.values(ui).forEach((elm) => {
      if (elm && elm.addEventListener) {
        elm.addEventListener("input", commit);
        elm.addEventListener("change", commit);
      }
    });
  };

  document.body.appendChild(el); // attach
  const stopDrag = makeDraggable(el, {
    handle: title,
    key: "toolDefaultsDockPos",
  });
  rebuild();

  const unsub = useCanvasStore.subscribe((state, prev) => {
    if (state.currentTool !== prev.currentTool) rebuild();
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
