export function exportToJSON(objects) {
  return JSON.stringify(objects, null, 2);
}

export function exportToSVG(objects, width = 800, height = 600) {
  let svg = `<?xml version="1.0" encoding="UTF-8"?>`;
  svg += `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" `;
  svg += `xmlns="http://www.w3.org/2000/svg" `;
  svg += `xmlns:xlink="http://www.w3.org/1999/xlink">`;
  svg += `<g>`;

  for (const obj of objects) {
    const { stroke = "black", fill = "none", lineWidth = 1 } = obj.style || {};

    switch (obj.type) {
      case "rectangle": {
        const { x, y, width: w, height: h } = obj.data;
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" `;
        svg += `stroke="${stroke}" fill="${fill}" stroke-width="${lineWidth}" />`;
        break;
      }

      case "circle": {
        const { x: cx, y: cy, r } = obj.data;
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" `;
        svg += `stroke="${stroke}" fill="${fill}" stroke-width="${lineWidth}" />`;
        break;
      }

      case "line": {
        const { x1, y1, x2, y2 } = obj.data;
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" `;
        svg += `stroke="${stroke}" stroke-width="${lineWidth}" />`;
        break;
      }

      case "arrow": {
        const { x1, y1, x2, y2 } = obj.data;
     
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" `;
        svg += `stroke="${stroke}" stroke-width="${lineWidth}" />`;
       
        const headLen = 10;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
        const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
        const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
        const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 6);
        svg += `<polygon points="${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}" `;
        svg += `fill="${stroke}" />`;
        break;
      }

      case "pencil":
      case "eraser": {
        const pts = obj.data.path;
        if (pts && pts.length > 0) {
          const d = pts
            .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
            .join(" ");
          svg += `<path d="${d}" stroke="${stroke}" `;
          svg += `stroke-width="${lineWidth}" fill="none" />`;
        }
        break;
      }

      case "callout": {
        const { x, y, width: cw, height: ch, text = "" } = obj.data;
      
        svg += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" `;
        svg += `stroke="${stroke}" fill="${fill}" stroke-width="${lineWidth}" />`;
    
        const lines = text.split("\n");
        const fontSize = obj.style.fontSize || 16;
        const lineHeight = fontSize * 1.2;
        svg += `<g font-family="${obj.style.fontFamily || "sans-serif"}" `;
        svg += `font-size="${fontSize}" fill="${stroke}">`;
        lines.forEach((line, idx) => {
          const ty = y + lineHeight * (idx + 1);
          svg += `<text x="${x + 4}" y="${ty}">${line}</text>`;
        });
        svg += `</g>`;
        break;
      }

    }
  }

  svg += `</g></svg>`;
  return svg;
}

export function downloadFile(content, name, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
