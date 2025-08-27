function applyCommon(ctx, style = {}) {
  ctx.save();

  // core stroke/fill
  if (typeof style.opacity === "number") ctx.globalAlpha = style.opacity;
  ctx.lineWidth = style.lineWidth ?? 1;
  ctx.strokeStyle = style.stroke ?? "#000";
  ctx.fillStyle = style.fill ?? "transparent";
  ctx.lineJoin = style.lineJoin ?? "miter";
  ctx.miterLimit = style.miterLimit ?? 10;

  // line type (match RectTool preview)
  const lt = style.lineType || "solid";
  if (lt === "dashed") {
    const dash = Math.max(1, Math.floor(style.dashSize ?? ctx.lineWidth * 3));
    const gap = Math.max(1, Math.floor(style.dashGap ?? ctx.lineWidth * 2));
    ctx.setLineDash([dash, gap]);
    ctx.lineCap = style.lineCap ?? "butt";
  } else if (lt === "dotted") {
    const dot = Math.max(1, Math.floor(style.dotSize ?? 1));
    const gap = Math.max(1, Math.floor(style.dotGap ?? ctx.lineWidth * 1.5));
    ctx.setLineDash([dot, gap]);
    ctx.lineCap = style.lineCap ?? "round";
  } else {
    ctx.setLineDash([]);
    ctx.lineCap = style.lineCap ?? "butt";
  }

  return () => ctx.restore();
}

function wrapLines(ctx, text, maxWidth, fontSize) {
  const out = [];
  const lh = Math.round((fontSize ?? 14) * 1.25);

  for (const raw of (text || "").split("\n")) {
    let line = "";
    for (const word of raw.split(" ")) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return { lines: out, lineHeight: lh };
}
function drawArrowHeadAtTip(ctx, tip, toward, style) {
  const head = Number(
    style.headSize ?? Math.max(10, (style.lineWidth ?? 2) * 3)
  );
  const vx = toward.x - tip.x,
    vy = toward.y - tip.y;
  const len = Math.hypot(vx, vy) || 1;
  const ux = vx / len,
    uy = vy / len;
  const left = {
    x: tip.x + ux * head - uy * (head * 0.5),
    y: tip.y + uy * head + ux * (head * 0.5),
  };
  const right = {
    x: tip.x + ux * head + uy * (head * 0.5),
    y: tip.y + uy * head - ux * (head * 0.5),
  };
  ctx.beginPath();
  if (style.arrowClosed) {
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    if (style.arrowFilled) ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left.x, left.y);
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }
}
function fillIfNeeded(ctx, style) {
  if (!style) return;
  const fillEnabled =
    style.fillEnabled ?? (style.fill && style.fill !== "none");
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

export function strokeCloudAroundPath(ctx, points, radius = 8, opts = {}) {
  if (!points || points.length < 2) return;

  // Back-compat: if `opts` was a number, treat as spacing
  if (typeof opts === "number") opts = { spacing: opts };

  const r = Math.max(1, radius);
  const overlap = Math.max(0, Math.min(0.9, opts.overlap ?? 0.35));
  const sweepDeg = Math.max(60, Math.min(175, opts.sweepDeg ?? 150));
  const sweep = (sweepDeg * Math.PI) / 180;

  // spacing smaller than diameter -> overlap gives 'C' look
  const spacing = Math.max(
    2,
    Math.floor(opts.spacing ?? 2 * r * (1 - overlap))
  );

  // Ensure closed loop
  const last = points[points.length - 1];
  const closed = points[0].x === last.x && points[0].y === last.y;
  const pts = closed ? points : points.concat([points[0]]);

  // Cloud should be round & undashed
  ctx.save();
  ctx.setLineDash([]);
  const prevCap = ctx.lineCap,
    prevJoin = ctx.lineJoin;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let started = false;
  let carry = 0; // keep phase continuous across segments

  const moveArc = (cx, cy, a0, a1, ccw = true) => {
    const sx = cx + r * Math.cos(a0);
    const sy = cy + r * Math.sin(a0);
    if (!started) {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      started = true;
    }
    ctx.arc(cx, cy, r, a0, a1, ccw);
  };

  const drawEdge = (a, b, nextB) => {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len,
      uy = dy / len; // tangent
    const nx = -uy,
      ny = ux; // outward normal (clockwise path)
    const theta = Math.atan2(uy, ux);

    // leave a half-spacing margin from corners so edge scallops don't crowd
    const margin = Math.min(spacing / 2, Math.max(spacing / 2, r));
    let t = (spacing - (carry % spacing)) % spacing;
    if (t < margin) t = margin;

    // arc start/end for a 'C' (shorter than semicircle)
    const a0off = theta + sweep / 2; // start angle (outer)
    const a1off = theta - sweep / 2; // end angle (inner)

    for (; t <= len - margin + 1e-6; t += spacing) {
      const cx = a.x + ux * t + nx * r;
      const cy = a.y + uy * t + ny * r;
      moveArc(cx, cy, a0off, a1off, true);
    }
    carry = (len - (t - spacing)) % spacing;

    // Corner scallop at vertex b (on outward bisector)
    if (nextB) {
      const dx2 = nextB.x - b.x,
        dy2 = nextB.y - b.y;
      const len2 = Math.hypot(dx2, dy2) || 1;
      const ux2 = dx2 / len2,
        uy2 = dy2 / len2;
      const nx2 = -uy2,
        ny2 = ux2;

      let bx = nx + nx2,
        by = ny + ny2;
      const bl = Math.hypot(bx, by);
      if (bl > 1e-6) {
        bx /= bl;
        by /= bl;
        const ccx = b.x + bx * r;
        const ccy = b.y + by * r;

        const theta1 = theta;
        const theta2 = Math.atan2(uy2, ux2);

        // join edges with a short corner arc (also < 180°)
        const start = theta1 - sweep / 2;
        const end = theta2 + sweep / 2;

        // pick shortest sweep direction
        const norm = (ang) =>
          ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const d = norm(end - start);
        if (d > Math.PI) {
          moveArc(ccx, ccy, end, start, false);
        } else {
          moveArc(ccx, ccy, start, end, true);
        }
      }
    }
  };

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1];
    const nextB = pts[(i + 2) % pts.length];
    drawEdge(a, b, nextB);
  }

  ctx.stroke();
  ctx.lineCap = prevCap;
  ctx.lineJoin = prevJoin;
  ctx.restore();
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
          { x, y },
        ];
        strokeCloudAroundPath(ctx, pts, style.cloudAmplitude ?? 8, {
          spacing:
            typeof style.cloudStep === "number" ? style.cloudStep : undefined,
          overlap: style.cloudOverlap ?? 0.35,
          sweepDeg: style.cloudSweepDeg ?? 150,
        });
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
        const x = d.x ?? 0,
          y = d.y ?? 0;
        const w = Math.abs(d.width ?? 0),
          h = Math.abs(d.height ?? 0);
        const rx = w / 2,
          ry = h / 2;
        const cx = x + rx,
          cy = y + ry;
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
      const x1 = d.x1 ?? 0,
        y1 = d.y1 ?? 0,
        x2 = d.x2 ?? 0,
        y2 = d.y2 ?? 0;

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
      const x2 = d.x2 ?? (d.x ?? 0) + (d.width ?? 0);
      const y2 = d.y2 ?? (d.y ?? 0) + (d.height ?? 0);

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
      ctx.arcTo(
        x + width,
        y + height,
        x + width - cornerRadius,
        y + height,
        cornerRadius
      );

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
        strokeCloudAroundPath(
          ctx,
          pathPts,
          style.cloudAmplitude ?? 8,
          style.cloudStep ?? 12
        );
      } else {
        ctx.save();
        if (style.stroke) ctx.strokeStyle = style.stroke;
        if (style.lineWidth) ctx.lineWidth = style.lineWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++)
          ctx.lineTo(points[i].x, points[i].y);
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

    case "calloutArrow": {
      // local aliases — avoid bare `data` or `style`
      const d = object.data || {};
      const s = object.style || {};

      const rect = d.rect || { x: 0, y: 0, width: 0, height: 0 };
      const anchor = d.anchor || { x: 0, y: 0 }; // arrow tip
      const elbow = d.elbow || anchor; // elbow point
      const attach = d.attach || elbow; // where leader touches box
      const text = d.text || "";
      const padding = d.padding ?? 8;
      const radius = Math.max(0, s.cornerRadius ?? 4);

      // 1) Box (rounded; no external rr() dependency)
      const x = rect.x,
        y = rect.y,
        w = rect.width,
        h = rect.height;
      const r = Math.min(radius, Math.min(w, h) / 2);

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
      fillIfNeeded(ctx, s);
      ctx.stroke();

      // 2) Leader: tip -> elbow -> attach
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(elbow.x, elbow.y);
      ctx.lineTo(attach.x, attach.y);
      ctx.stroke();

      // arrow head at the tip
      drawArrowHeadAtTip(ctx, anchor, elbow, s);

      // 3) Text inside the box (simple wrap)
      const fontSize = Number(s.fontSize ?? 14);
      const fontFamily = s.fontFamily || "Arial";
      const fontWeight = s.fontWeight || "500";
      ctx.fillStyle = s.textColor || s.stroke || "#000";
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";

      const maxW = Math.max(0, w - padding * 2);
      const { lines, lineHeight } = wrapLines(ctx, text, maxW, fontSize);

      let yy = y + padding;
      for (const ln of lines) {
        ctx.fillText(ln, x + padding, yy);
        yy += lineHeight;
        if (yy > y + h - padding) break;
      }

      break;
    }

    default: {
      // Fallback: draw a rect if bbox exists
      const d = object.data || {};
      if (
        typeof d.x === "number" &&
        typeof d.y === "number" &&
        typeof d.width === "number" &&
        typeof d.height === "number"
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
