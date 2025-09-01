// src/canvasTool/ui/TextToolbar.js
// Vertical, draggable toolbar. Same API:
//   ensureTextToolbar(container, onChange, initialState)

export function ensureTextToolbar(container, onChange, s) {
  // ---------- root ----------
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute",
    zIndex: 1001,
    background: "#111",
    color: "#fff",
    padding: "8px",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",        // VERTICAL
    gap: "8px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
    font: "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    userSelect: "none",
    pointerEvents: "auto"
  });

  // restore last position (per tab)
  const hostRect = container.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
  const key = "textToolbarPos";
  let pos = null;
  try { pos = JSON.parse(sessionStorage.getItem(key) || "null"); } catch {}
  const startLeft = pos?.left ?? (hostRect.left + 16);
  const startTop  = pos?.top  ?? (hostRect.top + 16);
  el.style.left = startLeft + "px";
  el.style.top  = startTop  + "px";

  // ---------- drag handle ----------
  const handle = document.createElement("div");
  Object.assign(handle.style, {
    height: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    cursor: "grab"
  });
  handle.innerHTML = `<span style="opacity:.7;letter-spacing:2px;">⋮⋮</span>
                      <span style="font-weight:600;opacity:.9;">Text</span>
                      <span style="opacity:.35;">drag</span>`;
  el.appendChild(handle);

  // drag logic (bounds: viewport)
  let dragging = false, offX = 0, offY = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    handle.style.cursor = "grabbing";
    const rect = el.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = el.getBoundingClientRect();
    const w = r.width, h = r.height;
    const nx = clamp(e.clientX - offX, 8, vw - w - 8);
    const ny = clamp(e.clientY - offY, 8, vh - h - 8);
    el.style.left = nx + "px";
    el.style.top  = ny + "px";
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    handle.releasePointerCapture?.(e.pointerId);
    handle.style.cursor = "grab";
    try {
      sessionStorage.setItem(key, JSON.stringify({
        left: parseInt(el.style.left, 10),
        top:  parseInt(el.style.top, 10)
      }));
    } catch {}
  };
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  // ---------- helpers ----------
  const makeRow = () => {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", gap: "8px", alignItems: "center" });
    return row;
  };
  const makeBtn = (label, title) => {
    const b = document.createElement("button");
    b.textContent = label; b.title = title || "";
    Object.assign(b.style, {
      background: "#1f2937", color: "#fff", border: "0",
      borderRadius: "8px", padding: "6px 8px", cursor: "pointer", minWidth: "32px"
    });
    b.onmouseenter = () => (b.style.background = "#374151");
    b.onmouseleave = () => (b.style.background = "#1f2937");
    return b;
  };
  const setToggle = (btn, on) => {
    btn.dataset.on = on ? "1" : "0";
    btn.style.background = on ? "#2563eb" : "#1f2937";
  };

  // ---------- rows & controls ----------
  // Row 1: font family, size
  const r1 = makeRow();
  const fontSel = document.createElement("select");
  [
    "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    "Georgia, serif",
    "'Times New Roman', serif",
    "'Courier New', monospace",
    "Monaco, monospace"
  ].forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; fontSel.appendChild(o); });
  fontSel.value = s.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  fontSel.onchange = () => onChange({ fontFamily: fontSel.value });

  const sizeInp = document.createElement("input");
  Object.assign(sizeInp, { type: "number", min: "8", max: "160", step: "1", value: String(s.fontSize ?? 18) });
  Object.assign(sizeInp.style, { width: "68px", padding: "6px", borderRadius: "6px", border: "0" });
  sizeInp.oninput = () => onChange({ fontSize: Math.max(8, parseInt(sizeInp.value || "12", 10)) });

  r1.append("Font:", fontSel, "Size:", sizeInp);
  el.appendChild(r1);

  // Row 2: color, opacity
  const r2 = makeRow();
  const colorInp = document.createElement("input");
  colorInp.type = "color"; colorInp.value = s.color || "#000000";
  colorInp.oninput = () => onChange({ color: colorInp.value });

  const opInp = document.createElement("input");
  Object.assign(opInp, { type: "range", min: "0", max: "1", step: "0.05", value: String(s.opacity ?? 1) });
  const opLabel = document.createElement("span"); opLabel.textContent = "Opacity";
  opInp.oninput = () => onChange({ opacity: parseFloat(opInp.value) });

  r2.append("Color:", colorInp, opLabel, opInp);
  el.appendChild(r2);

  // Row 3: B I U S
  const r3 = makeRow();
  const bBtn = makeBtn("B","Bold"); bBtn.style.fontWeight="700";
  const iBtn = makeBtn("I","Italic"); iBtn.style.fontStyle="italic";
  const uBtn = makeBtn("U","Underline"); uBtn.style.textDecoration="underline";
  const sBtn = makeBtn("S","Strikethrough"); sBtn.style.textDecoration="line-through";
  setToggle(bBtn, !!s.bold); setToggle(iBtn, !!s.italic); setToggle(uBtn, !!s.underline); setToggle(sBtn, !!s.strike);
  bBtn.onclick = ()=>{ const on=!+bBtn.dataset.on; setToggle(bBtn,on); onChange({ bold:on }); };
  iBtn.onclick = ()=>{ const on=!+iBtn.dataset.on; setToggle(iBtn,on); onChange({ italic:on }); };
  uBtn.onclick = ()=>{ const on=!+uBtn.dataset.on; setToggle(uBtn,on); onChange({ underline:on }); };
  sBtn.onclick = ()=>{ const on=!+sBtn.dataset.on; setToggle(sBtn,on); onChange({ strike:on }); };
  r3.append(bBtn, iBtn, uBtn, sBtn);
  el.appendChild(r3);

  // Row 4: alignment
  const r4 = makeRow();
  const left   = makeBtn("⟸","Align left");
  const center = makeBtn("⇔","Align center");
  const right  = makeBtn("⟹","Align right");
  const justify= makeBtn("≋","Justify");
  const setAlign = v => onChange({ align: v });
  left.onclick=()=>setAlign("left");
  center.onclick=()=>setAlign("center");
  right.onclick=()=>setAlign("right");
  justify.onclick=()=>setAlign("justify");
  r4.append(left, center, right, justify);
  el.appendChild(r4);

  // Row 5: line height & letter spacing
  const r5 = makeRow();
  const lhLabel = document.createElement("span"); lhLabel.textContent = "Line height";
  const lh = document.createElement("input");
  Object.assign(lh, { type:"range", min:"0.8", max:"3", step:"0.05", value: String(s.lineHeight ?? 1.25) });
  lh.oninput = () => onChange({ lineHeight: parseFloat(lh.value) });

  const lsLabel = document.createElement("span"); lsLabel.textContent = "Letter spacing";
  const ls = document.createElement("input");
  Object.assign(ls, { type:"range", min:"-2", max:"10", step:"0.1", value: String(s.letterSpacing ?? 0) });
  ls.oninput = () => onChange({ letterSpacing: parseFloat(ls.value) });

  r5.append(lhLabel, lh, lsLabel, ls);
  el.appendChild(r5);

  // Row 6: case tools + clear
  const r6 = makeRow();
  const makeCase = (label, fn) => {
    const b = makeBtn(label, label);
    b.onclick = () => transformSelection(fn);
    return b;
  };
  const upperBtn = makeCase("UPPER", t => t.toUpperCase());
  const lowerBtn = makeCase("lower", t => t.toLowerCase());
  const capBtn   = makeCase("Aa", t => t.replace(/\b(\p{L})(\p{L}*)/gu, (_,a,b)=>a.toUpperCase()+b.toLowerCase()));
  const clearBtn = makeBtn("⟲","Clear formatting");
  clearBtn.onclick = () => {
    onChange({ bold:false, italic:false, underline:false, strike:false, lineHeight:1.25, letterSpacing:0, align:"left" });
    try { document.execCommand("removeFormat"); } catch {}
  };
  r6.append(upperBtn, lowerBtn, capBtn, clearBtn);
  el.appendChild(r6);

  function transformSelection(transformFn) {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const temp = document.createElement("div");
    temp.appendChild(range.cloneContents());
    const original = temp.textContent || "";
    const transformed = transformFn(original);

    let ok = false;
    try { ok = document.execCommand("insertText", false, transformed); } catch {}
    if (!ok) {
      range.deleteContents();
      range.insertNode(document.createTextNode(transformed));
      sel.removeAllRanges();
      const after = document.createRange();
      after.setStart(range.endContainer, range.endOffset);
      after.collapse(true);
      sel.addRange(after);
    }
  }

  container.appendChild(el);

  // expose a simple remove()
  el.remove = function () { if (el.parentElement) el.parentElement.removeChild(el); };
  return el;
}
