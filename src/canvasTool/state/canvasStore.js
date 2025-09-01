import { create } from "zustand";
import { CanvasObject } from "../models/CanvasObject";

export const useCanvasStore = create((set, get) => ({
  objects: [],
  history: [],
  redoStack: [],

  selectedIds: [],

  setSelectedIds: (ids) =>
    set({ selectedIds: Array.isArray(ids) ? ids : ids != null ? [ids] : [] }),

  // Tool state
  currentTool: "pencil",
  color: "#000000",
  lineWidth: 2,

  toolDefaults: {
    rect: {
      style: {
        stroke: "#000000",
        lineType: "solid",
        lineWidth: 2,
        opacity: 1,
        fill: "#ffffff",
        fillEnabled: false,
        fillOpacity: 1,
      },
    },
    circle: {
      style: {
        stroke: "#000000",
        lineType: "solid",
        lineWidth: 2,
        opacity: 1,
        fill: "#ffffff",
        fillEnabled: false,
        fillOpacity: 1,
      },
    },
    line: {
      style: { stroke: "#000000", lineType: "solid", lineWidth: 2, opacity: 1 },
    },
    polyline: {
      style: { stroke: "#000000", lineType: "solid", lineWidth: 2, opacity: 1 },
      closed: false,
    },
    pencil: {
      style: { stroke: "#000000", lineType: "solid", lineWidth: 2, opacity: 1 },
    },
    arrow: {
      style: { stroke: "#000000", lineType: "solid", lineWidth: 2, opacity: 1 },
    },
    highlighter: {
      style: {
        stroke: "#ffff00",
        lineType: "solid",
        lineWidth: 8,
        opacity: 0.4,
      },
    },
    calloutArrow: {
      style: {
        stroke: "#ff0000",
        lineType: "solid",
        lineWidth: 2,
        opacity: 1,
        fillEnabled: false,
        fill: "#ffffff",
        fillOpacity: 1,
        cornerRadius: 4,
        // text
        textColor: "#ff0000",
        fontFamily: "Arial",
        fontSize: 14,
        fontWeight: "500",
        // arrow head
        headSize: 12,
        arrowClosed: true,
        arrowFilled: false,
      },
    },
  },
  grid: {
    show: false, // grid visible
    snap: false, // snap-to-grid
    size: 16, // grid spacing (px)
    thickEvery: 5, // bold line every N cells
    color: "#e0e0e0", // thin line color
    boldColor: "#c0c0c0", // bold line color
    alpha: 0.6, // grid opacity
  },

  _selectedIdSet() {
    const s = get();
    // prefer explicit selectedIds; fallback to objects[].selected
    const list =
      s.selectedIds && s.selectedIds.length
        ? s.selectedIds
        : s.objects.filter((o) => o.selected).map((o) => o.id);
    return new Set(list);
  },

  /** Utility: split into draw groups & sort by current layer */
  _groupsSorted() {
    const { objects } = get();
    const base = objects
      .filter((o) => o.type !== "blur")
      .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
    const blurs = objects
      .filter((o) => o.type === "blur")
      .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
    return { base, blurs };
  },

  /** Utility: reassign compact, monotonic layers within group */
  _reindexLayers(arr) {
    arr.forEach((o, i) => {
      o.layer = i;
    });
  },

  /** Core reorder: op = "front" | "back" | "forward" | "backward" */
  _reorder(op) {
    const s = get();
    const sel = s._selectedIdSet();
    if (!sel.size) return;

    const stepMove = (arr, dir) => {
      // dir = +1 (forward) or -1 (backward)
      if (dir > 0) {
        for (let i = arr.length - 2; i >= 0; i--) {
          if (sel.has(arr[i].id) && !sel.has(arr[i + 1].id)) {
            const t = arr[i];
            arr[i] = arr[i + 1];
            arr[i + 1] = t;
          }
        }
      } else {
        for (let i = 1; i < arr.length; i++) {
          if (sel.has(arr[i].id) && !sel.has(arr[i - 1].id)) {
            const t = arr[i];
            arr[i] = arr[i - 1];
            arr[i - 1] = t;
          }
        }
      }
    };

    const blockMove = (arr, toFront) => {
      const selected = arr.filter((o) => sel.has(o.id));
      const others = arr.filter((o) => !sel.has(o.id));
      return toFront ? [...others, ...selected] : [...selected, ...others];
    };

    const { base, blurs } = s._groupsSorted();

    switch (op) {
      case "forward":
        stepMove(base, +1);
        stepMove(blurs, +1);
        break;
      case "backward":
        stepMove(base, -1);
        stepMove(blurs, -1);
        break;
      case "front":
        const nb = blockMove(base, true);
        const nb2 = blockMove(blurs, true);
        base.splice(0, base.length, ...nb);
        blurs.splice(0, blurs.length, ...nb2);
        break;
      case "back":
        const pb = blockMove(base, false);
        const pb2 = blockMove(blurs, false);
        base.splice(0, base.length, ...pb);
        blurs.splice(0, blurs.length, ...pb2);
        break;
    }

    s._reindexLayers(base);
    s._reindexLayers(blurs);

    set({ objects: [...base, ...blurs] });
  },

  bringForward() {
    get()._reorder("forward");
  },
  sendBackward() {
    get()._reorder("backward");
  },
  bringToFront() {
    get()._reorder("front");
  },
  sendToBack() {
    get()._reorder("back");
  },

  toggleGrid: () => set((s) => ({ grid: { ...s.grid, show: !s.grid.show } })),
  toggleSnapToGrid: () =>
    set((s) => ({ grid: { ...s.grid, snap: !s.grid.snap } })),
  setGridSize: (n) =>
    set((s) => ({
      grid: { ...s.grid, size: Math.max(2, Number(n) || s.grid.size) },
    })),

  setToolDefaults: (tool, patch) =>
    set((state) => {
      const cur = state.toolDefaults?.[tool] ?? {};
      const next = deepMerge(cur, patch);
      return { toolDefaults: { ...state.toolDefaults, [tool]: next } };
    }),

  // Canvas state
  canvasEngine: null,
  isDrawing: false,

  // PDF state
  pdfDoc: null,
  currentPage: 1,
  totalPages: 0,
  pdfLoading: false,

  // Callouts state
  callouts: [],
  editingCallout: null,
  calloutText: "",

  // History state
  history: [],
  historyIndex: -1,

  pdfImage: null,

  // Actions
  setTool: (tool) => set({ currentTool: tool }),
  setColor: (color) => set({ color }),
  setLineWidth: (lineWidth) => set({ lineWidth }),
  setCanvasEngine: (engine) => set({ canvasEngine: engine }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),

  // PDF actions
  setPdfDoc: (doc) => set({ pdfDoc: doc }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setPdfLoading: (loading) => set({ pdfLoading: loading }),
  setPdfImage: (image) => set({ pdfImage: image }),

  // Callout actions
  setCallouts: (callouts) => set({ callouts }),
  addCallout: (callout) =>
    set((state) => ({
      callouts: [...state.callouts, callout],
    })),
  updateCallout: (id, updates) =>
    set((state) => ({
      callouts: state.callouts.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  deleteCallout: (id) =>
    set((state) => ({
      callouts: state.callouts.filter((c) => c.id !== id),
    })),
  setEditingCallout: (callout) => set({ editingCallout: callout }),
  setCalloutText: (text) => set({ calloutText: text }),

  // History actions
  addToHistory: (snapshot) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),
  addObject: (object) => {
    const updated = [...get().objects, object];
    set({ objects: updated, history: [...get().history, get().objects] });
  },

  undo: () => {
    const history = [...get().history];
    if (history.length === 0) return;
    const lastState = history.pop();
    set({ objects: lastState, history });
  },

  redo: () => {
    const redoStack = [...get().redoStack];
    if (redoStack.length === 0) return;
    const nextState = redoStack.pop();
    set({ objects: nextState, redoStack });
  },

  clearObjects: () => set({ objects: [] }),
}));

function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return b;
  if (typeof a !== "object" || a === null) return b;
  const out = { ...a };
  for (const k of Object.keys(b || {})) {
    const v = b[k];
    out[k] =
      typeof v === "object" && v !== null && typeof a[k] === "object"
        ? deepMerge(a[k], v)
        : v;
  }
  return out;
}
