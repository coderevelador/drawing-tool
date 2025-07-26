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
  }
}
