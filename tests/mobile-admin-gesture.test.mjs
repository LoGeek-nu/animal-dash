import assert from "node:assert/strict";
import test from "node:test";
import { createLongPressGesture } from "../app/features/admin/model/long-press.js";

function setup() {
  const calls = [];
  let callback;
  const gesture = createLongPressGesture({
    onLongPress: () => calls.push("info"), onClick: () => calls.push("select"),
    setTimer: (fn, delay) => { assert.equal(delay, 550); callback = fn; return 1; },
    clearTimer: () => { callback = null; },
  });
  const down = () => gesture.onPointerDown({ button: 0, clientX: 20, clientY: 20 });
  const fire = () => callback?.();
  const click = () => gesture.onClick({ preventDefault() { calls.push("prevented"); } });
  return { gesture, calls, down, fire, click };
}

test("a normal tap selects without opening details", () => {
  const s = setup(); s.down(); s.gesture.onPointerUp(); s.fire(); s.click();
  assert.deepEqual(s.calls, ["select"]);
});
test("long press opens details and suppresses the following selection click", () => {
  const s = setup(); s.down(); s.fire(); s.gesture.onPointerUp(); s.click();
  assert.deepEqual(s.calls, ["info", "prevented"]);
  s.down(); s.gesture.onPointerUp(); s.click();
  assert.deepEqual(s.calls, ["info", "prevented", "select"]);
});
test("scrolling or cancelled touch never opens details", () => {
  const s = setup(); s.down(); s.gesture.onPointerMove({ clientX: 20, clientY: 40 }); s.fire();
  assert.deepEqual(s.calls, []);
  s.down(); s.gesture.onPointerCancel(); s.fire();
  assert.deepEqual(s.calls, []);
});
test("unmount cleanup cancels the pending long press", () => {
  const s = setup(); s.down(); s.gesture.cancel(); s.fire(); assert.deepEqual(s.calls, []);
});
test("right-click does not start a long press", () => {
  const s = setup(); s.gesture.onPointerDown({ button: 2, clientX: 20, clientY: 20 }); s.fire();
  assert.deepEqual(s.calls, []);
});
