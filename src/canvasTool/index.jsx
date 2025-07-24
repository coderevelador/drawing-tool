import React from 'react';
import CanvasRenderer from './components/CanvasRenderer';
import Toolbar from './components/Toolbar';
import PDFUploader from './components/PDFUploader';
import { useCanvasStore } from './state/canvasStore';

const CanvasTool = ({ width = 900, height = 700 }) => {
  const { editingCallout } = useCanvasStore();

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <h1>PDF Canvas Drawing Tool</h1>
      
      <PDFUploader />
      <Toolbar />
      
      <div style={{ 
        border: '2px solid #ddd', 
        borderRadius: 8, 
        overflow: 'hidden',
        position: 'relative'
      }}>
        <CanvasRenderer width={width} height={height} />
      </div>
      
      {editingCallout && <div>Callout Editor Modal</div>}
    </div>
  );
};

export default CanvasTool;