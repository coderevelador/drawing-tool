// src/canvasTool/components/PDFUploader.jsx

import React, { useRef } from "react";
import { useCanvasStore } from "../state/canvasStore";
//  ← add this import
import { usePDFHandler } from "../hooks/usePDFHandler";

const PDFUploader = () => {
  const fileInputRef = useRef(null);

  // pull state from your canvas store
  const { pdfDoc, currentPage, totalPages, pdfLoading } = useCanvasStore();
  // call the hook inside the component
  const { handleFileUpload, changePage } = usePDFHandler();

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 16,
        background: "#e3f2fd",
        borderRadius: 8,
        border: "2px dashed #2196f3",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={pdfLoading}
          style={{
            padding: "10px 20px",
            background: "#2196f3",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: pdfLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          📄 {pdfLoading ? "Loading..." : "Upload PDF"}
        </button>

        {/* you don’t need this duplicate file input */}
        {/* <input type="file" accept=".pdf" onChange={handleFileUpload} hidden /> */}

        {pdfDoc && (
          <>
            <button onClick={() => changePage("prev")}>Prev ←</button>
            <span>
              {currentPage}/{totalPages}
            </span>
            <button onClick={() => changePage("next")}>Next →</button>
          </>
        )}
      </div>
    </div>
  );
};

export default PDFUploader;
