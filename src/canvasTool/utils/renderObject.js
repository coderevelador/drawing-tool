// src/canvasTool/utils/renderObject.js
// Unified renderer with your legacy object types + enhancements:
//
// - line types: solid / dashed / dotted / cloud (revision cloud for rect & closed polyline)
// - stroke width + opacity, fill + fill opacity
// - supports: rectangle|rect, circle (r or bbox), line, arrow, pencil (points|path),
//             polyline (open/closed), callout, snapshot, watermark, text, highlighter, sticky

// ---------- helpers ----------

function applyCommon(ctx, style = {}) {
  // SAVE first (your old version returned restore without save)
  ctx.save();

  if (typeof style.opacity === "number") ctx.globalAlpha = style.opacity;
  ctx.lineWidth = style.lineWidth ?? 1;
  ctx.strokeStyle = style.stroke ?? "#000";
  ctx.fillStyle = style.fill ?? "transparent";

  // Line type
  const lt = style.lineType || "solid";
  if (lt === "dashed") ctx.setLineDash([8, 6]);
  else if (lt === "dotted") ctx.setLineDash([2, 6]);
  else ctx.setLineDash([]);

  return () => ctx.restore();
}

function fillIfNeeded(ctx, style) {
  if (!style) return;
  const fillEnabled = style.fillEnabled ?? (style.fill && style.fill !== "none");
  if (!fillEnabled) return;
  const prevAlpha = ctx.globalAlpha;
  const fop = typeof style.fillOpacity === "number" ? style.fillOpacity : 1;
  ctx.globalAlpha = prevAlpha * fop;
  try {
    ctx.fill();
  } finally {
    ctx.globalAlpha = prevAlpha;
  }
}

function strokeCloudAroundPath(ctx, points, amplitude = 8, step = 12) {
  // points: [{x,y}, ...] closed path expected
  if (!points || points.length < 2) return;
  const last = points[points.length - 1];
  const closed = points[0].x === last.x && points[0].y === last.y;
  const pts = closed ? points : points.concat([points[0]]);

  ctx.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy) || 1;
    const ux = dx / segLen, uy = dy / segLen;
    // outward normal (clockwise assumed)
    const nx = -uy, ny = ux;

    let t = 0;
    while (t < segLen) {
      const cx = a.x + ux * t + nx * amplitude;
      const cy = a.y + uy * t + ny * amplitude;
      const r = amplitude;
      if (i === 0 && t === 0) ctx.moveTo(a.x, a.y);
      ctx.moveTo(a.x + ux * t, a.y + uy * t);
      ctx.arc(
        cx, cy, r,
        Math.atan2(uy, ux) + Math.PI * 0.5,
        Math.atan2(uy, ux) - Math.PI * 0.5,
        true
      );
      t += step;
    }
  }
  ctx.stroke();
}

// ---------- main ----------

export function renderObject(ctx, object) {
  if (!object) return;

  const style = object.style || {};
  const cleanup = applyCommon(ctx, style);

  switch (object.type) {
    // --- Rectangles ---
    case "rect":
    case "rectangle": {
      const d = object.data || {};
      const { x = 0, y = 0, width = 0, height = 0 } = d;

      if ((style.lineType || "solid") === "cloud") {
        const pts = [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
          { x, y }
        ];
        strokeCloudAroundPath(ctx, pts, style.cloudAmplitude ?? 8, style.cloudStep ?? 12);
      } else {
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        fillIfNeeded(ctx, style);
        ctx.stroke();
      }
      break;
    }

    // --- Circle / Ellipse ---
    case "circle": {
      // Support both circle (x,y,r) and bbox (x,y,width,height)
      const d = object.data || {};
      if (typeof d.r === "number") {
        const { x = 0, y = 0, r = 0 } = d;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        fillIfNeeded(ctx, style);
        ctx.stroke();
      } else {
        const x = d.x ?? 0, y = d.y ?? 0;
        const w = Math.abs(d.width ?? 0), h = Math.abs(d.height ?? 0);
        const rx = w / 2, ry = h / 2;
        const cx = x + rx, cy = y + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        fillIfNeeded(ctx, style);
        ctx.stroke();
      }
      break;
    }

    // --- Arrow ---
    case "arrow": {
      const d = object.data || {};
      const x1 = d.x1 ?? 0, y1 = d.y1 ?? 0, x2 = d.x2 ?? 0, y2 = d.y2 ?? 0;

      // Shaft
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Head
      const headLen = typeof style.headSize === "number" ? style.headSize : 10;
      const angle = Math.atan2(y2 - y1, x2 - x1);

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();

      fillIfNeeded(ctx, style);
      ctx.stroke();
      break;
    }

    // --- Line ---
    case "line": {
      const d = object.data || {};
      const x1 = d.x1 ?? d.x ?? 0;
      const y1 = d.y1 ?? d.y ?? 0;
      const x2 = d.x2 ?? ((d.x ?? 0) + (d.width ?? 0));
      const y2 = d.y2 ?? ((d.y ?? 0) + (d.height ?? 0));

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    }

    // --- Pencil / Freehand ---
    case "pencil": {
      const d = object.data || {};
      const pts = d.points || d.path || [];
      if (!pts || pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      break;
    }

    // --- Callout bubble with text ---
    case "callout": {
      const d = object.data || {};
      const { x = 0, y = 0, width = 120, height = 80, text = "" } = d;

      const cornerRadius = Math.max(0, Number(style.cornerRadius ?? 15));
      const tailWidth = Math.max(0, Number(style.tailWidth ?? 20));
      const tailHeight = Math.max(0, Number(style.tailHeight ?? 15));

      ctx.beginPath();

      // Rounded rect path with tail on bottom
      ctx.moveTo(x + cornerRadius, y);
      ctx.lineTo(x + width - cornerRadius, y);
      ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);

      ctx.lineTo(x + width, y + height - cornerRadius);
      ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);

      const tailStartX = x + width * 0.7;
      ctx.lineTo(tailStartX + tailWidth, y + height);
      ctx.lineTo(tailStartX + tailWidth / 2, y + height + tailHeight);
      ctx.lineTo(tailStartX, y + height);

      ctx.lineTo(x + cornerRadius, y + height);
      ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);

      ctx.lineTo(x, y + cornerRadius);
      ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
      ctx.closePath();

      // Fill & stroke bubble
      fillIfNeeded(ctx, style);
      ctx.stroke();

      // Draw text
      const fontSize = Math.max(8, Number(style.fontSize || 16));
      const fontFamily = style.fontFamily || "sans-serif";
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = style.textColor || style.stroke || "#000";

      const padding = Math.max(4, Number(style.padding ?? 10));
      const words = String(text).split(" ");
      let line = "";
      const lineHeight = Math.round(fontSize * 1.2);
      let textY = y + padding + 2;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > width - padding * 2 && n > 0) {
          ctx.fillText(line, x + padding, textY);
          line = words[n] + " ";
          textY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x + padding, textY);
      break;
    }

    // --- Polyline (open/closed, supports cloud when closed) ---
    case "polyline": {
      const d = object.data || {};
      const points = d.points || [];
      if (!points || points.length < 2) break;

      const closed = !!d.closed;
      const lt = style.lineType || "solid";

      if (lt === "cloud" && closed) {
        const pathPts =
          points[0].x === points[points.length - 1].x &&
          points[0].y === points[points.length - 1].y
            ? points
            : points.concat([points[0]]);
        strokeCloudAroundPath(ctx, pathPts, style.cloudAmplitude ?? 8, style.cloudStep ?? 12);
      } else {
        ctx.save();
        if (style.stroke) ctx.strokeStyle = style.stroke;
        if (style.lineWidth) ctx.lineWidth = style.lineWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        if (closed) {
          ctx.closePath();
          fillIfNeeded(ctx, style);
        }
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    // --- Snapshot (putImageData) ---
    case "snapshot": {
      const d = object.data || {};
      const { x = 0, y = 0, width, height, imageData } = d;
      if (!imageData || !width || !height) break;
      try {
        ctx.putImageData(imageData, Math.floor(x), Math.floor(y));
      } catch {
        const ix = Math.max(0, Math.floor(x));
        const iy = Math.max(0, Math.floor(y));
        ctx.putImageData(imageData, ix, iy);
      }
      break;
    }

    // --- Watermark ---
    case "watermark": {
      const d = object.data || {};
      const s = object.style || {};
      const text = d.text || "WATERMARK";
      const fs = Math.max(12, Number(s.fontSize || 16));
      const color = s.stroke || s.fill || "#000000";
      const opacity = typeof d.opacity === "number" ? d.opacity : 0.18;

      const W = ctx.canvas?.width || 0;
      const H = ctx.canvas?.height || 0;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${fs}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;

      if (d.tiled) {
        const rot = ((d.rotationDeg || -30) * Math.PI) / 180;
        const spacing = fs * (d.spacingFactor || 6);
        ctx.translate(W / 2, H / 2);
        ctx.rotate(rot);
        const cols = Math.ceil((W * 1.5) / spacing) + 1;
        const rows = Math.ceil((H * 1.5) / spacing) + 1;
        const startX = -(cols >> 1) * spacing;
        const startY = -(rows >> 1) * spacing;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            ctx.fillText(text, startX + c * spacing, startY + r * spacing);
          }
        }
      } else {
        ctx.fillText(text, Number(d.x || 0), Number(d.y || 0));
      }

      ctx.restore();
      break;
    }

    // --- Text (wrapping, underline, rotation) ---
    case "text": {
      const d = object.data || {};
      const s = object.style || {};
      let {
        x = 0,
        y = 0,
        width = null,
        height = null,
        text = "",
        align = "left",
        opacity = 1.0,
        rotationDeg = 0,
        underline = false,
      } = d;

      const color = s.stroke || s.fill || "#000000";
      const fontSize = Math.max(10, Number(s.fontSize || 16));
      const fontFamily =
        s.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const italic = !!s.italic;
      const bold = !!s.bold;

      const parts = [];
      if (italic) parts.push("italic");
      if (bold) parts.push("bold");
      parts.push(`${fontSize}px`, fontFamily);
      const fontCSS = parts.join(" ");

      ctx.save();
      ctx.globalAlpha = typeof opacity === "number" ? opacity : 1;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.font = fontCSS;
      ctx.translate(x, y);
      if (rotationDeg) ctx.rotate((rotationDeg * Math.PI) / 180);

      ctx.textAlign =
        align === "center" ? "center" : align === "right" ? "right" : "left";
      const anchorX = align === "center" ? 0.5 : align === "right" ? 1 : 0;

      const lineHeight = Math.round(fontSize * 1.25);
      const lines = [];
      const rawLines = String(text).split(/\r?\n/);

      if (width) {
        for (const raw of rawLines) {
          const words = raw.split(/(\s+)/);
          let line = "";
          for (const w of words) {
            const test = line + w;
            const m = ctx.measureText(test);
            if (m.width <= width || line === "") line = test;
            else {
              lines.push(line);
              line = w.trimStart();
            }
          }
          lines.push(line);
        }
      } else {
        lines.push(...rawLines);
      }

      let offY = 0;
      for (const ln of lines) {
        ctx.fillText(ln, 0, offY);
        if (underline) {
          const w = ctx.measureText(ln).width;
          const uy = offY + fontSize + Math.max(1, Math.floor(fontSize * 0.07));
          const sx = anchorX === 0.5 ? -w / 2 : anchorX === 1 ? -w : 0;
          ctx.beginPath();
          ctx.moveTo(sx, uy);
          ctx.lineTo(sx + w, uy);
          ctx.lineWidth = Math.max(1, Math.floor(fontSize * 0.07));
          ctx.strokeStyle = color;
          ctx.stroke();
        }
        offY += lineHeight;
        if (height && offY + lineHeight > height) break;
      }
      ctx.restore();
      break;
    }

    // --- Highlighter (smooth curve, multiply) ---
    case "highlighter": {
      const d = object.data || {};
      const s = object.style || {};
      const pts = d.points || d.path || [];
      if (!pts || pts.length < 2) break;

      const stroke = s.stroke || "#ffeb3b";
      const lineWidth = Math.max(2, Number(s.lineWidth || 12));
      const opacity = typeof s.opacity === "number" ? s.opacity : 0.25;
      const composite = s.composite || "multiply";

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = composite;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
      break;
    }

    // --- Sticky note ---
    case "sticky": {
      const d = object.data || {};
      const s = object.style || {};
      const x = Math.floor(d.x || 0);
      const y = Math.floor(d.y || 0);
      const w = Math.floor(d.width || 160);
      const h = Math.floor(d.height || 120);

      const bg = s.fill || "#FFF9B1";
      const color = s.color || "#111111";
      const fontSize = Math.max(10, Number(s.fontSize || 16));
      const fontFamily =
        s.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const opacity = typeof d.opacity === "number" ? d.opacity : 1;
      const radius = Math.max(0, Number(d.radius ?? 10));
      const pad = Math.max(4, Number(d.padding ?? 10));
      const shadow = !!d.shadow;

      // rounded rect helper
      const rr = (ctx, x, y, w, h, r) => {
        const rr2 = Math.min(r, Math.min(w, h) / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr2, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr2);
        ctx.arcTo(x + w, y + h, x, y + h, rr2);
        ctx.arcTo(x, y + h, x, y, rr2);
        ctx.arcTo(x, y, x + w, y, rr2);
        ctx.closePath();
      };

      ctx.save();
      ctx.globalAlpha = opacity;

      // shadow
      if (shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.18)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;
      }

      // background
      ctx.fillStyle = bg;
      rr(ctx, x, y, w, h, radius);
      ctx.fill();

      // reset shadow for text
      if (shadow) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      // text
      ctx.fillStyle = color;
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";

      const lineHeight = Math.round(fontSize * 1.25);
      const maxW = Math.max(10, w - pad * 2);
      const maxH = Math.max(10, h - pad * 2);
      const lines = [];
      const rawLines = String(d.text || "").split(/\r?\n/);

      for (const raw of rawLines) {
        const words = raw.split(/(\s+)/); // keep spaces
        let line = "";
        for (const w2 of words) {
          const test = line + w2;
          const m = ctx.measureText(test);
          if (m.width <= maxW || line === "") {
            line = test;
          } else {
            lines.push(line);
            line = w2.trimStart();
          }
        }
        lines.push(line);
      }

      let offY = 0;
      for (const ln of lines) {
        if (offY + lineHeight > maxH) break; // clip
        ctx.fillText(ln, x + pad, y + pad + offY);
        offY += lineHeight;
      }

      ctx.restore();
      break;
    }

    default: {
      // Fallback: draw a rect if bbox exists
      const d = object.data || {};
      if (
        typeof d.x === "number" && typeof d.y === "number" &&
        typeof d.width === "number" && typeof d.height === "number"
      ) {
        ctx.beginPath();
        ctx.rect(d.x, d.y, d.width, d.height);
        fillIfNeeded(ctx, style);
        ctx.stroke();
      }
    }
  }

  cleanup();
}

export function renderObjects(ctx, objects = []) {
  for (const obj of objects) renderObject(ctx, obj);
}

export default renderObject;
