export class BaseTool {
  constructor() {
    this.name = '';
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
    const { color, lineWidth } = store.getState();
    return { color, lineWidth };
  }
}