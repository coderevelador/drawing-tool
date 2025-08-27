import React from "react";
import CanvasTool from './canvasTool';

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Canvas Drawing Tool</h1>
      <CanvasTool width={900} height={700} />;
    </div>
  );
}
