import { create } from 'zustand';

export const useCanvasStore = create((set, get) => ({
  // Tool state
  currentTool: 'pencil',
  color: '#000000',
  lineWidth: 2,
  
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
  calloutText: '',
  
  // History state
  history: [],
  historyIndex: -1,
  
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
  
  // Callout actions
  setCallouts: (callouts) => set({ callouts }),
  addCallout: (callout) => set(state => ({ 
    callouts: [...state.callouts, callout] 
  })),
  updateCallout: (id, updates) => set(state => ({
    callouts: state.callouts.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
  deleteCallout: (id) => set(state => ({
    callouts: state.callouts.filter(c => c.id !== id)
  })),
  setEditingCallout: (callout) => set({ editingCallout: callout }),
  setCalloutText: (text) => set({ calloutText: text }),
  
  // History actions
  addToHistory: (snapshot) => set(state => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(snapshot);
    return {
      history: newHistory,
      historyIndex: newHistory.length - 1
    };
  }),
  
  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];
      state.canvasEngine?.restoreFromSnapshot(snapshot);
      set({ historyIndex: newIndex });
    }
  },
  
  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];
      state.canvasEngine?.restoreFromSnapshot(snapshot);
      set({ historyIndex: newIndex });
    }
  }
}));