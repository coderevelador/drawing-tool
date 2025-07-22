import React, { useRef, useState, useEffect } from "react";

const PDFCanvasDrawingTool = ({ width = 800, height = 600 }) => {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [ctx, setCtx] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [snapshot, setSnapshot] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [backgroundSnapshot, setBackgroundSnapshot] = useState(null);
  const [drawingSnapshot, setDrawingSnapshot] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [editingCallout, setEditingCallout] = useState(null);
  const [calloutText, setCalloutText] = useState("");

  // Load context and PDF.js
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.lineJoin = "round";
    setCtx(context);
    loadPDFJS();
  }, []);

  const loadPDFJS = async () => {
    if (window.pdfjsLib) return;
    try {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error("Failed to load PDF.js:", error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }
    setPdfLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      await renderPDFPage(pdf, 1);
      setDrawingSnapshot(null);
      setCallouts([]); // Clear callouts when loading a new PDF
    } catch (error) {
      console.error("Error loading PDF:", error);
      alert("Error loading PDF file");
    } finally {
      setPdfLoading(false);
    }
  };

  const renderPDFPage = async (pdf, pageNum) => {
    if (!pdf || !ctx) return;
    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      // Scale PDF to fit canvas
      const viewport = page.getViewport({ scale: 1 });
      const scaleX = width / viewport.width;
      const scaleY = height / viewport.height;
      const scale = Math.min(scaleX, scaleY);
      const scaledViewport = page.getViewport({ scale });
      ctx.clearRect(0, 0, width, height);
      // Center the PDF
      const offsetX = (width - scaledViewport.width) / 2;
      const offsetY = (height - scaledViewport.height) / 2;
      // Render PDF page
      const renderContext = {
        canvasContext: ctx,
        viewport: scaledViewport,
        transform: [1, 0, 0, 1, offsetX, offsetY],
      };
      await page.render(renderContext).promise;
      // Save background
      setBackgroundSnapshot(ctx.getImageData(0, 0, width, height));
      setDrawingSnapshot(ctx.getImageData(0, 0, width, height));
      setCallouts([]);
      redrawCallouts();
    } catch (error) {
      console.error("Error rendering PDF page:", error);
    }
  };

  const changePage = async (direction) => {
    if (!pdfDoc) return;
    const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    await renderPDFPage(pdfDoc, newPage);
  };

  const clearCanvas = () => {
    if (!ctx) return;
    if (backgroundSnapshot) {
      ctx.putImageData(backgroundSnapshot, 0, 0);
      setDrawingSnapshot(ctx.getImageData(0, 0, width, height));
    } else {
      ctx.clearRect(0, 0, width, height);
      setDrawingSnapshot(null);
    }
    setCallouts([]);
  };

  const clearAll = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    setCallouts([]);
    setDrawingSnapshot(null);
    if (pdfDoc && currentPage) {
      renderPDFPage(pdfDoc, currentPage);
    }
  };

  // -- The above code is unchanged up to here --

  // Get mouse position
  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e) => {
    if (!ctx) return;
    const pos = getMousePos(e);

    // Clicking on a callout? Edit it.
    if (handleCalloutClick(pos.x, pos.y)) {
      return;
    }
    // Callout tool: add callout at click location
    if (tool === "callout") {
      const newCallout = addCallout(pos.x, pos.y);
      redrawCanvas();
      setEditingCallout(newCallout);
      setCalloutText("");
      return;
    }

    setDrawing(true);
    ctx.strokeStyle = tool === "eraser" ? "white" : color;
    ctx.lineWidth = tool === "eraser" ? lineWidth * 2 : lineWidth;

    if (tool === "pencil" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    } else {
      setStartPos(pos);
      setSnapshot(ctx.getImageData(0, 0, width, height));
    }
  };

  const handleMouseMove = (e) => {
    if (!drawing || !ctx) return;
    const pos = getMousePos(e);

    if (tool === "pencil" || tool === "eraser") {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      restoreSnapshot();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      const { x: startX, y: startY } = startPos;
      switch (tool) {
        case "line":
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
          break;
        case "rect": {
          const rectWidth = pos.x - startX;
          const rectHeight = pos.y - startY;
          ctx.strokeRect(startX, startY, rectWidth, rectHeight);
          break;
        }
        case "circle": {
          const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
          ctx.beginPath();
          ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }
        case "arrow":
          drawArrow(ctx, startX, startY, pos.x, pos.y);
          break;
        default:
          break;
      }
    }
  };

  const restoreSnapshot = () => {
    if (!ctx || !snapshot) return;
    ctx.putImageData(snapshot, 0, 0);
  };

  // -- Save the drawingSnapshot when done drawing any shape --
  const handleMouseUp = () => {
    if (!drawing) return;
    setDrawing(false);
    if (
      tool === "pencil" ||
      tool === "eraser" ||
      tool === "line" ||
      tool === "rect" ||
      tool === "circle" ||
      tool === "arrow"
    ) {
      // Save "drawings" layer including shapes
      setDrawingSnapshot(ctx.getImageData(0, 0, width, height));
    }
  };

  // -- Drawing shapes and callouts --

  const drawArrow = (ctx, startX, startY, endX, endY) => {
    const headLength = 10;
    const angle = Math.atan2(endY - startY, endX - startX);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle - Math.PI / 6),
      endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle + Math.PI / 6),
      endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const drawCallout = (ctx, callout) => {
    const { x, y, text, color: calloutColor, lineWidth: calloutLineWidth } = callout;
    const boxWidth = 140;
    const boxHeight = 60;
    const cornerRadius = 8;
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, cornerRadius);
    ctx.fillStyle = calloutColor + "30";
    ctx.fill();
    ctx.strokeStyle = calloutColor;
    ctx.lineWidth = calloutLineWidth;
    ctx.stroke();
    // Draw callout pointer (triangle)
    const pointerSize = 12;
    const pointerX = x + 20;
    const pointerY = y + boxHeight;
    ctx.beginPath();
    ctx.moveTo(pointerX, pointerY);
    ctx.lineTo(pointerX - pointerSize, pointerY + pointerSize);
    ctx.lineTo(pointerX + pointerSize / 2, pointerY + pointerSize / 2);
    ctx.closePath();
    ctx.fillStyle = calloutColor + "30";
    ctx.fill();
    ctx.strokeStyle = calloutColor;
    ctx.stroke();
    // Draw text
    ctx.fillStyle = calloutColor;
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const padding = 10;
    const words = text.split(" ");
    const maxWidth = boxWidth - padding * 2;
    let lines = [];
    let currentLine = "";
    for (let word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    const lineHeight = 14;
    lines.forEach((line, index) => {
      ctx.fillText(line, x + padding, y + padding + index * lineHeight);
    });
  };

  // -- LAYERS: always restore from drawingSnapshot (drawings+pdf), then draw callouts on top --
  const redrawCanvas = () => {
    if (!ctx) return;
    if (drawingSnapshot) {
      ctx.putImageData(drawingSnapshot, 0, 0);
    } else if (backgroundSnapshot) {
      ctx.putImageData(backgroundSnapshot, 0, 0);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    redrawCallouts();
  };

  const redrawCallouts = () => {
    if (!ctx) return;
    callouts.forEach((callout) => {
      drawCallout(ctx, callout);
    });
  };

  // -- Callout state & selection logic --

  const addCallout = (x, y) => {
    const newCallout = {
      id: Date.now() + Math.random(),
      x: x,
      y: y - 70,
      text: "Click to edit",
      color: color,
      lineWidth: lineWidth,
    };
    setCallouts((prev) => [...prev, newCallout]);
    return newCallout;
  };

  const updateCalloutText = (calloutId, newText) => {
    setCallouts((prev) =>
      prev.map((callout) =>
        callout.id === calloutId
          ? { ...callout, text: newText || "Click to edit" }
          : callout
      )
    );
    setTimeout(() => {
      redrawCanvas();
    }, 0);
  };

  const deleteCallout = (calloutId) => {
    setCallouts((prev) => prev.filter((callout) => callout.id !== calloutId));
    setTimeout(() => {
      redrawCanvas();
    }, 0);
  };

  const isPointInCallout = (x, y, callout) => {
    const boxWidth = 140;
    const boxHeight = 60;
    return (
      x >= callout.x &&
      x <= callout.x + boxWidth &&
      y >= callout.y &&
      y <= callout.y + boxHeight
    );
  };

  // Edit callout: detect click on callout boxes
  const handleCalloutClick = (x, y) => {
    const clickedCallout = callouts.find((callout) =>
      isPointInCallout(x, y, callout)
    );
    if (clickedCallout) {
      setEditingCallout(clickedCallout);
      setCalloutText(clickedCallout.text === "Click to edit" ? "" : clickedCallout.text);
      return true;
    }
    return false;
  };

  // Save canvas as PNG
  const saveCanvas = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `annotated-pdf-page-${currentPage}.png`;
    link.href = dataURL;
    link.click();
  };

  const tools = [
    { name: "pencil", icon: "✏️" },
    { name: "line", icon: "📏" },
    { name: "rect", icon: "⬜" },
    { name: "circle", icon: "⭕" },
    { name: "arrow", icon: "➡️" },
    { name: "callout", icon: "💬" },
    { name: "eraser", icon: "🧽" },
  ];

  // If callouts change, redraw on canvas (esp. after delete/edit)
  useEffect(() => {
    redrawCanvas();
    // eslint-disable-next-line
  }, [callouts, drawingSnapshot]);

  return (
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Callout Text Editor */}
      {editingCallout && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            border: "2px solid #007bff",
            zIndex: 1000,
            minWidth: "350px",
          }}
          onClick={e => e.stopPropagation()}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#333" }}>
            Edit Callout Comment
          </h3>
          <textarea
            value={calloutText}
            onChange={(e) => setCalloutText(e.target.value)}
            placeholder="Enter your comment here..."
            style={{
              width: "100%",
              height: "100px",
              padding: "10px",
              border: "2px solid #ddd",
              borderRadius: "6px",
              fontSize: "14px",
              fontFamily: "Arial, sans-serif",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#007bff")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            autoFocus
          />
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "15px",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={() => {
                deleteCallout(editingCallout.id);
                setEditingCallout(null);
                setCalloutText("");
              }}
              style={{
                padding: "8px 16px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              🗑️ Delete
            </button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setEditingCallout(null);
                  setCalloutText("");
                }}
                style={{
                  padding: "8px 16px",
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateCalloutText(editingCallout.id, calloutText);
                  setEditingCallout(null);
                  setCalloutText("");
                }}
                style={{
                  padding: "8px 16px",
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                💾 Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Callout overlay */}
      {editingCallout && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 999,
          }}
          onClick={() => {
            setEditingCallout(null);
            setCalloutText("");
          }}
        />
      )}

      {/* PDF Upload Section */}
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
          {pdfDoc && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => changePage("prev")}
                disabled={currentPage <= 1}
                style={{
                  padding: "8px 12px",
                  background: currentPage <= 1 ? "#ccc" : "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Previous
              </button>
              <span style={{ padding: "0 12px", fontWeight: "bold" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => changePage("next")}
                disabled={currentPage >= totalPages}
                style={{
                  padding: "8px 12px",
                  background: currentPage >= totalPages ? "#ccc" : "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drawing Tools */}
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
        <div style={{ display: "flex", gap: 4 }}>
          {tools.map((t) => (
            <button
              key={t.name}
              onClick={() => setTool(t.name)}
              style={{
                padding: "8px 12px",
                border:
                  tool === t.name ? "2px solid #007bff" : "1px solid #ccc",
                background: tool === t.name ? "#e7f3ff" : "white",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>{t.icon}</span>
              {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={clearCanvas}
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
            onClick={clearAll}
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
          <button
            onClick={saveCanvas}
            disabled={!ctx}
            style={{
              padding: "8px 16px",
              background: !ctx ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: !ctx ? "not-allowed" : "pointer",
            }}
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        style={{
          border: "2px solid #ddd",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            display: "block",
            cursor: tool === "callout" ? "pointer" : tool === "eraser" ? "grab" : "crosshair",
            background: "white",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Status */}
      <div style={{ marginTop: 12, fontSize: 14, color: "#666" }}>
        <p>
          Current tool: <strong>{tool}</strong> | Color:{" "}
          <strong>{color}</strong> | Width: <strong>{lineWidth}px</strong>
          {pdfDoc && ` | PDF: Page ${currentPage}/${totalPages}`}
          {callouts.length > 0 && ` | Callouts: ${callouts.length}`}
        </p>
        <p>
          💡{" "}
          {tool === "callout"
            ? "Click anywhere to add a callout comment"
            : "Upload a PDF file to start annotating, or use the canvas for free drawing. Click on callouts to edit them."}
        </p>
      </div>
    </div>
  );
};

export default PDFCanvasDrawingTool;
