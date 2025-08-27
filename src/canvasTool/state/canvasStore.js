import { create } from "zustand";
import { CanvasObject } from "../models/CanvasObject";

export const useCanvasStore = create((set, get) => ({
  objects: [],
  history: [],
  redoStack: [],

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
