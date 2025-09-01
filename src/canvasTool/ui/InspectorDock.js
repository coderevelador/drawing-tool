// src/canvasTool/ui/InspectorDock.js
// Movable side panel + click-to-select + drag-to-move + clone.
// Supports rect, circle, line (x1,y1,x2,y2), polyline, highlighter, pencil (points[]).

import { useCanvasStore } from "../state/canvasStore";
import { SchemaRegistry, dget, dset } from "../utils/schemaRegistry";

export function mountInspectorDock(engine, opts = {}) {
  const startPinnedRight = opts.startPinnedRight ?? true;

  // ---------- selection (index local to this dock) ----------
  let selectedIdx = -1;

  // ---------- store helpers ----------
  const getState = () => useCanvasStore.getState();
  const getObjects = () => getState().objects || [];

  const setObjects = (next) => {
    // prefer Zustand's setState via store instance
    if (typeof useCanvasStore.setState === "function") {
      useCanvasStore.setState({ objects: next });
    } else if (typeof getState().setState === "function") {
      getState().setState({ objects: next });
    }
  };

  /** Push the current UI selection (by index) into the global store */
  const setSelectedFromIndex = (i) => {
    const objs = getObjects();
    const id = i >= 0 && objs[i] ? objs[i].id : null;
    const api = getState();
    if (typeof api.setSelectedIds === "function") {
      api.setSelectedIds(id ? [id] : []);
    } else if (typeof useCanvasStore.setState === "function") {
      useCanvasStore.setState({ selectedIds: id ? [id] : [] });
    }
  };

  // ---------- helpers: cloning ----------
  const nextCopyName = (name, fallbackType) => {
    const base = (name && name.trim()) || fallbackType || "object";
    const m = base.match(/^(.*?)(?:\s\((?:copy)(?:\s(\d+))?\))?$/i);
    if (!m) return `${base} (copy)`;
    const stem = (m[1] || base).trim();
    const n = m[2] ? parseInt(m[2], 10) + 1 : 2;
    return m[2] || /copy\)$/i.test(base) ? `${stem} (copy ${n})` : `${stem} (copy)`;
  };

  const cloneWithOffset = (src, dx = 12, dy = 12) => {
    const c = JSON.parse(JSON.stringify(src));
    if (c.id != null) c.id = `${c.id}_copy_${Date.now()}`;
    c.name = nextCopyName(src.name, src.type);

    if (c.data) {
      const d = c.data;
      if (typeof d.x === "number") d.x += dx;
      if (typeof d.y === "number") d.y += dy;

      if (typeof d.x1 === "number") d.x1 += dx;
      if (typeof d.y1 === "number") d.y1 += dy;
      if (typeof d.x2 === "number") d.x2 += dx;
      if (typeof d.y2 === "number") d.y2 += dy;

      if (Array.isArray(d.points)) {
        d.points = d.points.map((p) => ({ x: (p.x || 0) + dx, y: (p.y || 0) + dy }));
      }
    }
    return c;
  };

  const cloneAtIndex = (idx) => {
    const arr = getObjects().slice();
    const orig = arr[idx];
    if (!orig) return;
    const dup = cloneWithOffset(orig);
    // insert right after original
    arr.splice(idx + 1, 0, dup);
    setObjects(arr);
    selectedIdx = idx + 1;
    setSelectedFromIndex(selectedIdx);
    engine.renderAllObjects?.();
    renderList();
    renderInspector();
  };

  // ---------- selection glow ----------
  function drawSelectionGlow(ctx, obj) {
    if (!obj) return;
    const d = obj.data || {};
    const s = obj.style || {};
    const lw = Number(s.lineWidth || 2);

    const glow = (pathFn, w = lw) => {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(37,99,235,.9)"; // blue-600
      ctx.lineWidth = w + 2;
      ctx.shadowColor = "rgba(59,130,246,.35)";
      ctx.shadowBlur = 6;
      pathFn();
      ctx.stroke();
      ctx.restore();
    };

    const pathRect = () => {
      ctx.beginPath();
      ctx.rect(+d.x || 0, +d.y || 0, +d.width || 0, +d.height || 0);
    };
    const pathCircle = () => {
      const x = +d.x || 0,
        y = +d.y || 0,
        w = +d.width || 0,
        h = +d.height || 0;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    };
    const pathLine = () => {
      const x1 = d.x1 ?? d.x ?? 0,
        y1 = d.y1 ?? d.y ?? 0;
      const x2 = d.x2 ?? (d.x ?? 0) + (d.width ?? 0);
      const y2 = d.y2 ?? (d.y ?? 0) + (d.height ?? 0);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    };
    const pathPolyline = () => {
      const pts = d.points || [];
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (d.closed) ctx.closePath();
    };

    switch (obj.type) {
      case "rect":
        glow(pathRect);
        break;
      case "circle":
        glow(pathCircle);
        break;
      case "line":
        glow(pathLine);
        break;
      case "polyline":
      case "highlighter":
      case "pencil":
        glow(pathPolyline, Math.max(lw, 4));
        break;
      default:
        return;
    }
  }

  // ---------- re-render + selection outline ----------
  const drawSelectionOutline = () => {
    const objs = getObjects();
    const cnv = engine.canvas;
    if (!cnv) return;
    const ctx = cnv.getContext("2d");
    const obj = objs[selectedIdx];
    if (obj) drawSelectionGlow(ctx, obj);
  };

  const repaintWithSelection = () => {
    engine.renderAllObjects?.();
    drawSelectionOutline();
  };

  const iconFor = (type) => {
    switch (type) {
      case "rect":
        return "▭";
      case "circle":
        return "◯";
      case "line":
        return "／";
      case "text":
        return "𝒯";
      case "polyline":
        return "〰";
      case "highlighter":
        return "🖍";
      case "pencil":
        return "✏️";
      default:
        return "⬚";
    }
  };

  // -------- geometry / hits ----------
  const getBounds = (obj) => {
    if (!obj) return { x: 0, y: 0, w: 0, h: 0 };
    const d = obj.data || {};

    switch (obj.type) {
      case "polyline":
      case "highlighter":
      case "pencil": {
        const pts = d.points || [];
        if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
        let minX = pts[0].x,
          minY = pts[0].y,
          maxX = pts[0].x,
          maxY = pts[0].y;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }

      case "line": {
        const x1 = d.x1 ?? d.x ?? 0;
        const y1 = d.y1 ?? d.y ?? 0;
        const x2 = d.x2 ?? (d.x ?? 0) + (d.width ?? 0);
        const y2 = d.y2 ?? (d.y ?? 0) + (d.height ?? 0);
        const minX = Math.min(x1, x2),
          minY = Math.min(y1, y2);
        const maxX = Math.max(x1, x2),
          maxY = Math.max(y1, y2);
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }

      default: {
        const x = Number(d.x || 0),
          y = Number(d.y || 0);
        const w = Number(d.width || d.w || 0) || 200;
        const h = Number(d.height || d.h || 0) || 60;
        return { x, y, w, h };
      }
    }
  };

  const distToSeg = (p, a, b) => {
    const vx = b.x - a.x,
      vy = b.y - a.y;
    const wx = p.x - a.x,
      wy = p.y - a.y;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
    const t = c1 / c2;
    const proj = { x: a.x + t * vx, y: a.y + t * vy };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
  };

  const isHit = (obj, pos) => {
    const d = obj?.data || {};
    switch (obj.type) {
      case "polyline":
      case "highlighter":
      case "pencil": {
        const pts = d.points || [];
        if (pts.length < 2) return false;
        const tol = Math.max(obj.style?.lineWidth ?? 6, 6) + 4;
        for (let i = 0; i < pts.length - 1; i++) {
          if (distToSeg(pos, pts[i], pts[i + 1]) <= tol) return true;
        }
        return false;
      }

      case "line": {
        const a = { x: d.x1 ?? d.x ?? 0, y: d.y1 ?? d.y ?? 0 };
        const b = {
          x: d.x2 ?? (d.x ?? 0) + (d.width ?? 0),
          y: d.y2 ?? (d.y ?? 0) + (d.height ?? 0),
        };
        const tol = Math.max(obj.style?.lineWidth ?? 2, 2) + 4;
        return distToSeg(pos, a, b) <= tol;
      }

      default: {
        const b = getBounds(obj);
        return pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h;
      }
    }
  };

  // pick topmost object at a point
  const pickTopIndexAt = (pos) => {
    const objs = getObjects();
    for (let i = objs.length - 1; i >= 0; i--) {
      if (isHit(objs[i], pos)) return i;
    }
    return -1;
  };

  // -------- panel DOM ----------
  const panel = document.createElement("div");
  panel.className = "inspector-dark";
  Object.assign(panel.style, {
    position: "fixed",
    top: "80px",
    right: startPinnedRight ? "16px" : "auto",
    left: startPinnedRight ? "auto" : "16px",
    width: "320px",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    background: "#0f172a",
    color: "#e5e7eb",
    borderRadius: "12px",
    boxShadow: "0 12px 32px rgba(0,0,0,.35)",
    font: "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    overflow: "hidden",
    zIndex: 3000,
    userSelect: "none",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "10px",
    background: "#111827",
    cursor: "grab",
  });
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="opacity:.7;letter-spacing:2px;">⋮⋮</span>
      <strong>Navigator</strong>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
        <input type="checkbox" id="moveToggle" checked>
        <span>Drag to move</span>
      </label>
    </div>`;
  panel.appendChild(header);

  // attach to DOM (fixed, floats above everything)
  const host = document.body; // or: engine.canvas?.parentElement || document.body
  host.appendChild(panel);

  // dark input styles (scoped)
  const styleTag = document.createElement("style");
  styleTag.textContent = `
    .inspector-dark input, .inspector-dark select, .inspector-dark textarea {
      background:#0b1220; color:#e5e7eb; border:1px solid rgba(255,255,255,.15);
      border-radius:8px; padding:6px 8px; outline:none;
    }
    .inspector-dark input[type="color"] { padding:0; height:32px; }
    .inspector-dark button { font:inherit; }
    .inspector-dark label { color:#cbd5e1; }
  `;
  panel.appendChild(styleTag);

  // drag panel itself
  let draggingPanel = false,
    offX = 0,
    offY = 0;
  header.addEventListener("pointerdown", (e) => {
    draggingPanel = true;
    header.setPointerCapture(e.pointerId);
    header.style.cursor = "grabbing";
    const r = panel.getBoundingClientRect();
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    panel.style.right = "auto";
  });
  const endPanelDrag = (e) => {
    if (!draggingPanel) return;
    draggingPanel = false;
    header.releasePointerCapture?.(e.pointerId);
    header.style.cursor = "grab";
  };
  header.addEventListener("pointermove", (e) => {
    if (!draggingPanel) return;
    const x = e.clientX - offX;
    const y = e.clientY - offY;
    panel.style.left = `${Math.max(8, x)}px`;
    panel.style.top = `${Math.max(8, y)}px`;
  });
  header.addEventListener("pointerup", endPanelDrag);
  header.addEventListener("pointercancel", endPanelDrag);
  header.addEventListener("lostpointercapture", endPanelDrag);

  // body
  const body = document.createElement("div");
  Object.assign(body.style, {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
    padding: "10px",
    overflow: "auto",
  });
  panel.appendChild(body);

  const list = document.createElement("div");
  Object.assign(list.style, {
    background: "rgba(255,255,255,.03)",
    borderRadius: "10px",
    padding: "8px",
  });

  const insp = document.createElement("div");
  Object.assign(insp.style, {
    background: "rgba(255,255,255,.03)",
    borderRadius: "10px",
    padding: "8px",
  });

  body.appendChild(list);
  body.appendChild(insp);

  // ---- render object rows (add CLONE button per row) ----
  const renderList = () => {
    const objs = getObjects();
    list.innerHTML = "";

    objs.forEach((o, idx) => {
      const row = document.createElement("div");
      Object.assign(row.style, {
        width: "100%",
        display: "grid",
        gridTemplateColumns: "20px 1fr auto", // extra column for clone button
        gap: "8px",
        alignItems: "center",
        padding: "6px 8px",
        marginBottom: "4px",
        borderRadius: "8px",
        background: idx === selectedIdx ? "#1f2937" : "transparent",
        color: "inherit",
      });

      // selection click area
      const selBtn = document.createElement("button");
      Object.assign(selBtn.style, {
        gridColumn: "1 / span 2",
        display: "grid",
        gridTemplateColumns: "20px 1fr",
        alignItems: "center",
        gap: "8px",
        border: "0",
        background: "transparent",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        padding: 0,
      });
      selBtn.onclick = () => {
        selectedIdx = idx;
        setSelectedFromIndex(selectedIdx);
        repaintWithSelection();
        renderList();
        renderInspector();
      };

      const swatch = document.createElement("div");
      Object.assign(swatch.style, {
        width: "14px",
        height: "14px",
        borderRadius: "3px",
        background: o?.style?.stroke || o?.style?.fill || "#64748b",
      });

      const label = document.createElement("div");
      const name = o.name || `${o.type}`;
      label.textContent = `${iconFor(o.type)}  ${name}`;
      Object.assign(label.style, {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      });

      selBtn.appendChild(swatch);
      selBtn.appendChild(label);

      // clone button
      const cloneBtn = document.createElement("button");
      cloneBtn.textContent = "⧉";
      cloneBtn.title = "Clone";
      Object.assign(cloneBtn.style, {
        border: "0",
        borderRadius: "6px",
        padding: "2px 8px",
        background: "#0b1220",
        color: "#e5e7eb",
        cursor: "pointer",
      });
      cloneBtn.onclick = (e) => {
        e.stopPropagation();
        cloneAtIndex(idx);
      };

      row.appendChild(selBtn);
      row.appendChild(cloneBtn);
      list.appendChild(row);
    });
  };

  // ---- schema-driven inspector (with fallback) ----
  function renderInspectorFromSchema(container, object, commit) {
    container.innerHTML = "";
    if (!object) {
      const t = document.createElement("div");
      t.textContent = "Select an item to edit.";
      t.style.opacity = ".7";
      container.appendChild(t);
      return;
    }

    // schema or fallback
    let schema = SchemaRegistry.get(object.type);
    if (!schema) {
      schema = {
        fields: [
          // Position/Size
          { group: "Position", label: "x", type: "number", path: "data.x" },
          { group: "Position", label: "y", type: "number", path: "data.y" },
          { group: "Size", label: "width", type: "number", path: "data.width" },
          { group: "Size", label: "height", type: "number", path: "data.height" },

          // Line-like endpoints if present
          { group: "Position", label: "x1", type: "number", path: "data.x1", showIf: (o) => o?.data?.x1 != null },
          { group: "Position", label: "y1", type: "number", path: "data.y1", showIf: (o) => o?.data?.y1 != null },
          { group: "Position", label: "x2", type: "number", path: "data.x2", showIf: (o) => o?.data?.x2 != null },
          { group: "Position", label: "y2", type: "number", path: "data.y2", showIf: (o) => o?.data?.y2 != null },

          // Poly-like
          {
            group: "Points",
            label: "Points (JSON)",
            type: "textarea",
            path: "data.points",
            showIf: (o) => Array.isArray(o?.data?.points),
            parse: (v) => {
              try { return JSON.parse(v); } catch { return []; }
            },
            format: (v) => JSON.stringify(v ?? [], null, 0),
          },

          // Style
          { group: "Style", label: "Stroke", type: "color", path: "style.stroke", showIf: (o) => o?.style?.stroke != null },
          { group: "Style", label: "Fill", type: "color", path: "style.fill", showIf: (o) => o?.style?.fill != null },
          { group: "Style", label: "Width", type: "number", path: "style.lineWidth", min: 1, step: 1, showIf: (o) => o?.style?.lineWidth != null },
          { group: "FX", label: "Opacity", type: "range", path: "style.opacity", min: 0, max: 1, step: 0.05, showIf: (o) => o?.style?.opacity != null },

          // Arrow extras if present
          { group: "Options", label: "Head size", type: "number", path: "style.headSize", min: 2, step: 1, showIf: (o) => o?.style?.headSize != null },
          { group: "Options", label: "Head type", type: "select", path: "style.headType", options: ["triangle", "barb", "open"], showIf: (o) => o?.style?.headType != null },

          // Text-like
          { group: "Text", label: "Content", type: "textarea", path: "data.text", showIf: (o) => o?.data?.text != null },
          { group: "Text", label: "Font", type: "text", path: "style.font", showIf: (o) => o?.style?.font != null },
          { group: "Text", label: "Align", type: "select", path: "style.align", options: ["left", "center", "right"], showIf: (o) => o?.style?.align != null },
        ],
      };
    }

    const groups = new Map();
    for (const f of schema.fields || []) {
      if (typeof f.showIf === "function" && !f.showIf(object)) continue;
      const g = f.group || "General";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(f);
    }

    const mkRow = (label, input) => {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px",
        alignItems: "center",
      });
      const l = document.createElement("label");
      l.textContent = label;
      wrap.appendChild(l);
      wrap.appendChild(input);
      return wrap;
    };

    for (const [groupName, fields] of groups.entries()) {
      const title = document.createElement("div");
      title.textContent = groupName;
      Object.assign(title.style, { marginTop: "6px", fontWeight: "700", opacity: ".85" });
      container.appendChild(title);

      for (const f of fields) {
        const current = f.format ? f.format(dget(object, f.path)) : dget(object, f.path, "");
        let input;

        switch (f.type) {
          case "number": {
            input = document.createElement("input");
            input.type = "number";
            if (f.min !== undefined) input.min = String(f.min);
            if (f.max !== undefined) input.max = String(f.max);
            if (f.step !== undefined) input.step = String(f.step);
            input.value = current === "" ? "" : String(current);
            input.oninput = () => {
              const v = input.value;
              const num = v === "" ? "" : Number(v);
              dset(object, f.path, v === "" ? "" : Number.isFinite(num) ? num : current);
              commit();
            };
            container.appendChild(mkRow(f.label, input));
            break;
          }
          case "text": {
            input = document.createElement("input");
            input.type = "text";
            input.value = current ?? "";
            input.oninput = () => { dset(object, f.path, input.value); commit(); };
            container.appendChild(mkRow(f.label, input));
            break;
          }
          case "textarea": {
            input = document.createElement("textarea");
            Object.assign(input.style, { minHeight: "64px" });
            input.value = (f.format ? f.format(current) : current) ?? "";
            input.oninput = () => {
              const raw = input.value;
              const parsed = f.parse ? f.parse(raw) : raw;
              dset(object, f.path, parsed);
              commit();
            };
            container.appendChild(mkRow(f.label, input));
            break;
          }
          case "range": {
            input = document.createElement("input");
            input.type = "range";
            input.min = String(f.min ?? 0);
            input.max = String(f.max ?? 1);
            input.step = String(f.step ?? 0.05);
            input.value = String(current ?? 1);
            input.oninput = () => { dset(object, f.path, Number(input.value)); commit(); };
            container.appendChild(mkRow(f.label, input));
            break;
          }
          case "color": {
            input = document.createElement("input");
            input.type = "color";
            input.value = current || "#000000";
            input.oninput = () => { dset(object, f.path, input.value); commit(); };
            break;
          }
          case "select": {
            input = document.createElement("select");
            (f.options || []).forEach((opt) => {
              const o = document.createElement("option");
              o.value = opt;
              o.textContent = opt;
              input.appendChild(o);
            });
            input.value = current || (f.options?.[0] ?? "");
            input.onchange = () => { dset(object, f.path, input.value); commit(); };
            break;
          }
          case "checkbox": {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!current;
            input.onchange = () => { dset(object, f.path, !!input.checked); commit(); };
            break;
          }
          default:
            continue;
        }

        container.appendChild(mkRow(f.label, input));
      }
    }

    // actions: Clone + Delete
    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", gap: "8px", marginTop: "8px" });

    const cloneSel = document.createElement("button");
    cloneSel.textContent = "Clone selected";
    Object.assign(cloneSel.style, {
      background: "#2563eb",
      color: "#fff",
      border: "0",
      borderRadius: "8px",
      padding: "6px 10px",
      cursor: "pointer",
    });
    cloneSel.onclick = () => { if (selectedIdx >= 0) cloneAtIndex(selectedIdx); };

    const del = document.createElement("button");
    del.textContent = "Delete selected";
    Object.assign(del.style, {
      background: "#ef4444",
      color: "#fff",
      border: "0",
      borderRadius: "8px",
      padding: "6px 10px",
      cursor: "pointer",
    });
    del.onclick = () => {
      const arr = getObjects().slice();
      if (selectedIdx >= 0 && selectedIdx < arr.length) {
        arr.splice(selectedIdx, 1);
        setObjects(arr);
        selectedIdx = -1;
        setSelectedFromIndex(selectedIdx);
        engine.renderAllObjects?.();
        renderList();
        renderInspector();
      }
    };

    actions.appendChild(cloneSel);
    actions.appendChild(del);
    container.appendChild(actions);
  }

  const renderInspector = () => {
    const objs = getObjects();
    const obj = objs[selectedIdx];
    const commit = () => {
      setObjects(objs.slice());
      repaintWithSelection();
      renderInspector();
    };
    renderInspectorFromSchema(insp, obj, commit);
  };

  // -------- store sync --------
  const unsub = useCanvasStore.subscribe(() => {
    repaintWithSelection();
    renderList();
    renderInspector();
  });

  // FIRST PAINT + initial empty selection sync
  setSelectedFromIndex(selectedIdx);
  renderList();
  renderInspector();

  // ---- canvas drag-to-move for selected object (hand cursor) ----
  const canvas = engine.canvas;
  const moveToggle = header.querySelector("#moveToggle");

  let draggingObj = false;
  let dragStart = null;
  let objStart = null;

  const toCanvasPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  function updateHoverCursor(pos) {
    if (selectedIdx < 0) {
      canvas.style.cursor = pickTopIndexAt(pos) !== -1 ? "grab" : "default";
      return;
    }
    const obj = getObjects()[selectedIdx];
    if (!obj) {
      canvas.style.cursor = "default";
      return;
    }
    canvas.style.cursor = isHit(obj, pos) ? "grab" : "default";
  }

  const onPointerDown = (e) => {
    if (!moveToggle.checked) return;
    if (e.button !== 0) return;

    const pos = toCanvasPos(e);

    // select topmost object under pointer (if any)
    const hitIdx = pickTopIndexAt(pos);
    if (hitIdx !== -1 && hitIdx !== selectedIdx) {
      selectedIdx = hitIdx;
      setSelectedFromIndex(selectedIdx);
      renderList();
      renderInspector();
      repaintWithSelection();
    }

    if (selectedIdx < 0) return; // nothing to drag

    const objs = getObjects();
    const obj = objs[selectedIdx];
    if (!obj || !isHit(obj, pos)) return;

    draggingObj = true;
    dragStart = pos;
    objStart = { ...obj.data };
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
    e.preventDefault();
    e.stopPropagation();
  };

  const onPointerMove = (e) => {
    const pos = toCanvasPos(e);
    if (!draggingObj) {
      updateHoverCursor(pos);
      return;
    }

    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    const objs = getObjects();
    const obj = objs[selectedIdx];
    if (!obj) return;

    // update based on available geometry
    const d = obj.data || {};
    if (d.x != null) d.x = (objStart.x ?? d.x ?? 0) + dx;
    if (d.y != null) d.y = (objStart.y ?? d.y ?? 0) + dy;

    if (d.x1 != null) d.x1 = (objStart.x1 ?? d.x1 ?? 0) + dx;
    if (d.y1 != null) d.y1 = (objStart.y1 ?? d.y1 ?? 0) + dy;
    if (d.x2 != null) d.x2 = (objStart.x2 ?? d.x2 ?? 0) + dx;
    if (d.y2 != null) d.y2 = (objStart.y2 ?? d.y2 ?? 0) + dy;

    if (Array.isArray(d.points)) {
      d.points = d.points.map((p, i) => {
        const s = (objStart.points || [])[i] || p;
        return { x: (s.x ?? p.x) + dx, y: (s.y ?? p.y) + dy };
      });
    }

    setObjects(objs.slice());
    repaintWithSelection();
    e.preventDefault();
    e.stopPropagation();
  };

  const endObjDrag = (e) => {
    if (!draggingObj) return;
    draggingObj = false;
    dragStart = null;
    objStart = null;
    canvas.style.cursor = "grab";
    canvas.releasePointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  canvas.addEventListener("pointerdown", onPointerDown, true);
  canvas.addEventListener("pointermove", onPointerMove, true);
  canvas.addEventListener("pointerup", endObjDrag, true);
  canvas.addEventListener("pointercancel", endObjDrag, true);
  canvas.addEventListener("lostpointercapture", endObjDrag, true);

  // teardown
  panel.destroy = function () {
    unsub && unsub();
    canvas.removeEventListener("pointerdown", onPointerDown, true);
    canvas.removeEventListener("pointermove", onPointerMove, true);
    canvas.removeEventListener("pointerup", endObjDrag, true);
    canvas.removeEventListener("pointercancel", endObjDrag, true);
    canvas.removeEventListener("lostpointercapture", endObjDrag, true);
    if (panel.parentElement) panel.parentElement.removeChild(panel);
  };

  return panel;
}

// support both named and default imports
export default mountInspectorDock;
