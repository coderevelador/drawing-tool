export function makeDraggable(
  el,
  { handle = el, key = "", bounds = "viewport" } = {}
) {
  if (!el) return () => {};
  el.style.position = el.style.position || "fixed";
  el.style.touchAction = "none"; // smoother pointer drags
  handle.style.cursor = handle.style.cursor || "move";
  handle.style.userSelect = "none";

  // restore last position
  const load = () => {
    if (!key) return null;
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  const save = (pos) => {
    if (key) localStorage.setItem(key, JSON.stringify(pos));
  };

  const clamp = (x, y) => {
    if (bounds !== "viewport") return { x, y };
    const w = el.offsetWidth || 240;
    const h = el.offsetHeight || 80;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nx = Math.max(0, Math.min(vw - w, x));
    const ny = Math.max(0, Math.min(vh - h, y));
    return { x: nx, y: ny };
  };

  let start = null;

  const setPos = (x, y) => {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.right = ""; // ensure left/top take precedence
    el.style.bottom = "";
  };

  const saved = load();
  if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
    setPos(saved.x, saved.y);
  }

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const rect = el.getBoundingClientRect();
    start = {
      ox: rect.left,
      oy: rect.top,
      px: e.clientX,
      py: e.clientY,
    };
    handle.setPointerCapture?.(e.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const onPointerMove = (e) => {
    if (!start) return;
    const nx = start.ox + (e.clientX - start.px);
    const ny = start.oy + (e.clientY - start.py);
    const { x, y } = clamp(nx, ny);
    setPos(x, y);
  };

  const onPointerUp = () => {
    window.removeEventListener("pointermove", onPointerMove);
    if (!start) return;
    const rect = el.getBoundingClientRect();
    const pos = clamp(rect.left, rect.top);
    save(pos);
    start = null;
  };

  handle.addEventListener("pointerdown", onPointerDown);

  // return an unmount function
  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
  };
}
