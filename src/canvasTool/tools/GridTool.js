import { BaseTool } from "./BaseTool";

export class GridTool extends BaseTool {
  constructor() {
    super();
    this.name = "grid";
  }

  // Click = toggle Grid.  Shift/Alt-click = toggle Snap.
  onMouseDown(e, pos, engine) {
    const s = engine.store.getState();
    if (e.shiftKey || e.altKey) s.toggleSnapToGrid();
    else s.toggleGrid();
    engine.renderAllObjects();
  }
  onMouseMove() {}
  onMouseUp() {}
}
