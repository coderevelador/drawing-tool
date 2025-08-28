import { PencilTool } from "./PencilTool";
import { LineTool } from "./LineTool";
import { RectTool } from "./RectTool";
import { CircleTool } from "./CircleTool";
import { ArrowTool } from "./ArrowTool";
import { CalloutTool } from "./CalloutTool";
import { PolylineTool } from "./PolylineTool";
import { SnapshotTool } from "./SnapshotTool";
import { WatermarkTool } from "./WatermarkTool";
import { TextTool } from "./TextTool";
import { HighlighterTool } from "./HighlighterTool";
import { StickyNoteTool } from "./StickyNoteTool";
import { SchemaRegistry } from "../utils/schemaRegistry";
import { CalloutArrowTool } from "./CalloutArrowTool";
import { BlurTool } from "./BlurTool";

export const toolRegistry = {
  pencil: new PencilTool(),
  line: new LineTool(),
  rect: new RectTool(),
  circle: new CircleTool(),
  arrow: new ArrowTool(),
  callout: new CalloutTool(),
  polyline: new PolylineTool(),
  snapshot: new SnapshotTool(),
  watermark: new WatermarkTool(),
  text: new TextTool(),
  highlighter: new HighlighterTool(),
  stickynote: new StickyNoteTool(),
  calloutArrow: new CalloutArrowTool(),
  blur: new BlurTool(),
};

SchemaRegistry.registerFromTools(toolRegistry);

export const toolList = [
  { name: "pencil", icon: "✏️", label: "Pencil" },
  { name: "line", icon: "📏", label: "Line" },
  { name: "rect", icon: "⬜", label: "Rectangle" },
  { name: "circle", icon: "⭕", label: "Circle" },
  { name: "arrow", icon: "➡️", label: "Arrow" },
  { name: "callout", icon: "💬", label: "Callout" },
  { name: "polyline", icon: "〰️", label: "Polyline" },
  { name: "snapshot", icon: "📸", label: "Snapshot" },
  { name: "watermark", icon: "🏷️", label: "Watermark" },
  { name: "text", icon: "🅣", label: "Text" },
  { name: "highlighter", icon: "🖍️", label: "Highlighter" },
  { name: "stickynote", icon: "🗒️", label: "Sticky" },
  { name: "calloutArrow", icon: "🗨️", label: "Callout Arrow" },
  { name: "blur", icon: "🫧", label: "Blur" },
];
