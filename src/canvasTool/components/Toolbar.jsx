import React from "react";
import { useCanvasStore } from "../state/canvasStore";
import { toolList } from "../tools";
import HistoryControls from "./HistoryControls";
import { exportToJSON, exportToSVG, downloadFile } from "../utils/exporter";

const Toolbar = () => {
  const {
    currentTool,
    color,
    lineWidth,
    canvasEngine,
    setTool,
    setColor,
    setLineWidth,
    objects, // ✅ include this
  } = useCanvasStore();

  const handleClear = () => {
    canvasEngine?.clear();
  };

  const handleClearAll = () => {
    canvasEngine?.clearAll();
  };

  const handleExportJSON = () => {
    const json = exportToJSON(objects);
    downloadFile(json, "drawing.json", "application/json");
  };

  const handleExportSVG = () => {
    const svg = exportToSVG(objects);
    downloadFile(svg, "drawing.svg", "image/svg+xml");
  };

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 16,
        background: "#f8f9fa",
        borderRadius: 8,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Tools */}
      <div style={{ display: "flex", gap: 4 }}>
        {toolList.map((tool) => (
          <button
            key={tool.name}
            onClick={() => setTool(tool.name)}
            style={{
              padding: "8px 12px",
              border:
                currentTool === tool.name
                  ? "2px solid #007bff"
                  : "1px solid #ccc",
              background: currentTool === tool.name ? "#e7f3ff" : "white",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>{tool.icon}</span>
            {tool.label}
          </button>
        ))}
      </div>

      {/* Options */}
      {/* <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Color:
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 40, height: 30, border: "none", borderRadius: 4 }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Width:
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            style={{ width: 100 }}
          />
          <span style={{ minWidth: 20, textAlign: "center" }}>
            {lineWidth}px
          </span>
        </label>
      </div> */}

      {/* History Controls */}
      <HistoryControls />

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleClear}
          style={{
            padding: "8px 16px",
            background: "#ff9800",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Clear Drawings
        </button>

        <button
          onClick={handleClearAll}
          style={{
            padding: "8px 16px",
            background: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Clear All
        </button>

        <button onClick={handleExportJSON}>Export JSON</button>
        <button onClick={handleExportSVG}>Export SVG</button>
      </div>
    </div>
  );
};

export default Toolbar;
