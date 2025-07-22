import React from "react";
import PDFCanvasDrawingTool from "./PDFCanvasDrawingTool";

// Path to your image in public folder
const IMAGE_URL = "/floorplan.png";

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>PDF Canvas Drawing Tool</h1>
      <PDFCanvasDrawingTool width={900} height={700} />
    </div>
  );
}
