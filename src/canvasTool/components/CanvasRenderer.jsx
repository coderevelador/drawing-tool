import React, { useRef, useEffect } from 'react';
import { CanvasEngine } from '../canvas/canvasEngine';
import { useCanvasStore } from '../state/canvasStore';

const CanvasRenderer = ({ width, height }) => {
  const canvasRef = useRef(null);
  const { setCanvasEngine, currentTool } = useCanvasStore();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const engine = new CanvasEngine(canvas, useCanvasStore);
    setCanvasEngine(engine);
    
    return () => {
      // Cleanup if needed
    };
  }, [setCanvasEngine]);
  
  const getCursor = () => {
    switch (currentTool) {
      case 'callout': return 'pointer';
      case 'eraser': return 'grab';
      default: return 'crosshair';
    }
  };
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        cursor: getCursor(),
        background: 'white'
      }}
    />
  );
};

export default CanvasRenderer
