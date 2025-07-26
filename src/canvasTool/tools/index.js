import { PencilTool } from './PencilTool';
import { EraserTool } from './EraserTool';
import { LineTool } from './LineTool';
import { RectTool } from './RectTool';
import { CircleTool } from './CircleTool';
import { ArrowTool } from './ArrowTool';
import { CalloutTool } from './CalloutTool';

export const toolRegistry = {
  pencil: new PencilTool(),
  eraser: new EraserTool(),
  line: new LineTool(),
  rect: new RectTool(),
  circle: new CircleTool(),
  arrow: new ArrowTool(),
  callout: new CalloutTool()
};

export const toolList = [
  { name: 'pencil', icon: '✏️', label: 'Pencil' },
  { name: 'line', icon: '📏', label: 'Line' },
  { name: 'rect', icon: '⬜', label: 'Rectangle' },
  { name: 'circle', icon: '⭕', label: 'Circle' },
  { name: 'arrow', icon: '➡️', label: 'Arrow' },
  { name: 'callout', icon: '💬', label: 'Callout' },
  { name: 'eraser', icon: '🧽', label: 'Eraser' }
];