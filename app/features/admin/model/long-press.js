// Separate gesture recognition from rendering so scrolling/cancellation can be tested.
export function createLongPressGesture({ onLongPress, onClick, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  let origin = null;
  let pressed = false;
  const cancel = () => { clearTimer(timer); timer = null; origin = null; };
  return {
    cancel,
    onPointerDown(event) {
      cancel();
      pressed = false;
      if (event.button !== 0) return;
      origin = { x: event.clientX, y: event.clientY };
      timer = setTimer(() => { timer = null; pressed = true; onLongPress(); }, 550);
    },
    onPointerMove(event) {
      if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel() { cancel(); pressed = false; },
    onClick(event) {
      if (pressed) { pressed = false; event.preventDefault(); return; }
      onClick();
    },
    onContextMenu(event) { event.preventDefault(); },
  };
}
