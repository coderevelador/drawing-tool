import { BaseTool } from './BaseTool';

export class CalloutTool extends BaseTool {
  constructor() {
    super();
    this.name = 'callout';
  }
  
  onMouseDown(event, pos, engine) {
    const { color, lineWidth, addCallout, setEditingCallout, setCalloutText } = engine.store.getState();
    
    const newCallout = {
      id: Date.now() + Math.random(),
      x: pos.x,
      y: pos.y - 70,
      text: 'Click to edit',
      color: color,
      lineWidth: lineWidth
    };
    
    addCallout(newCallout);
    engine.redrawCanvas();
    setEditingCallout(newCallout);
    setCalloutText('');
  }
  
  onMouseMove(event, pos, engine) {
    // No dragging for callouts
  }
  
  onMouseUp(event, pos, engine) {
    // Callout creation complete
  }
}