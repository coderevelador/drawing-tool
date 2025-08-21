export function renderObject(ctx, object) {
  ctx.strokeStyle = object.style.stroke || "#000";
  ctx.fillStyle = object.style.fill || "none";
  ctx.lineWidth = object.style.lineWidth || 1;

  switch (object.type) {
    case "rectangle": {
      const { x, y, width, height } = object.data;
      ctx.strokeRect(x, y, width, height);
      break;
    }

    case "circle": {
      const { x, y, r } = object.data;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      if (object.style.fill && object.style.fill !== "none") {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }

    case "arrow": {
      const { x1, y1, x2, y2 } = object.data;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const headLen = 10;
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

      if (object.style.fill && object.style.fill !== "none") {
        ctx.fill();
      }
      ctx.stroke();
      break;
    }
    case "line": {
      const { x1, y1, x2, y2 } = object.data;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    }
    case "pencil": {
      const pts = object.data.path;
      if (!pts || pts.length === 0) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      break;
    }
    case "callout": {
      const { x, y, width, height, text } = object.data;

      // Draw speech bubble background
      const cornerRadius = 15;
      const tailWidth = 20;
      const tailHeight = 15;

      ctx.beginPath();

      // Start from top-left corner
      ctx.moveTo(x + cornerRadius, y);

      // Top edge
      ctx.lineTo(x + width - cornerRadius, y);
      ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);

      // Right edge
      ctx.lineTo(x + width, y + height - cornerRadius);
      ctx.arcTo(
        x + width,
        y + height,
        x + width - cornerRadius,
        y + height,
        cornerRadius
      );

      // Bottom edge with tail
      const tailStartX = x + width * 0.7;
      ctx.lineTo(tailStartX + tailWidth, y + height);
      ctx.lineTo(tailStartX + tailWidth / 2, y + height + tailHeight); // tail point
      ctx.lineTo(tailStartX, y + height);

      // Continue bottom edge
      ctx.lineTo(x + cornerRadius, y + height);
      ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);

      // Left edge
      ctx.lineTo(x, y + cornerRadius);
      ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);

      ctx.closePath();

      // Fill and stroke the bubble
      ctx.fill();
      ctx.stroke();

      // Draw text inside the bubble
      const fontSize = object.style.fontSize || 16;
      const fontFamily = object.style.fontFamily || "sans-serif";
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = object.style.stroke;

      const padding = 10;
      const words = text.split(" ");
      let line = "";
      const lineHeight = fontSize * 1.2;
      let textY = y + padding + fontSize;

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
    case "polyline": {
      const { points, closed } = object.data || {};
      if (!points || points.length < 2) break;
      const { stroke, lineWidth } = object.style || {};
      ctx.save();
      if (stroke) ctx.strokeStyle = stroke;
      if (lineWidth) ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++)
        ctx.lineTo(points[i].x, points[i].y);
      if (closed) ctx.closePath();
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "snapshot": {
      const d = object.data || {};
      const { x = 0, y = 0, width, height, imageData } = d;
      if (!imageData || !width || !height) break;
      try {
        ctx.putImageData(imageData, Math.floor(x), Math.floor(y));
      } catch (e) {
        const ix = Math.max(0, Math.floor(x));
        const iy = Math.max(0, Math.floor(y));
        ctx.putImageData(imageData, ix, iy);
      }
      break;
    }
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
        s.fontFamily ||
        "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
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
    case "highlighter": {
      const d = object.data || {};
      const s = object.style || {};
      const pts = d.points || [];
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
        s.fontFamily ||
        "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
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
  }
}
