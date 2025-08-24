import React, { useRef, useEffect } from "react";
import { CanvasEngine } from "../canvas/canvasEngine";
import { useCanvasStore } from "../state/canvasStore";
import { mountInspectorDock } from "../ui/InspectorDock";
import { ensureToolDefaultsDock } from "../ui/ToolDefaultsDock";

const CanvasRenderer = ({ width, height }) => {
  const canvasRef = useRef(null);
  const dockRef = useRef(null);
  const defaultsRef = useRef(null);
  const { setCanvasEngine, currentTool } = useCanvasStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new CanvasEngine(canvas, useCanvasStore);
    setCanvasEngine(engine);

    dockRef.current = mountInspectorDock(engine);
    defaultsRef.current = ensureToolDefaultsDock(engine);

    return () => {
      defaultsRef.current?.destroy?.();
      dockRef.current?.destroy?.();
    };
  }, [setCanvasEngine]);

  const getCursor = () => {
    switch (currentTool) {
      case "callout":
        return "pointer";
      case "eraser":
        return "grab";
      default:
        return "crosshair";
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: "block",
        cursor: getCursor(),
        background: "white",
      }}
    />
  );
};

export default CanvasRenderer;
