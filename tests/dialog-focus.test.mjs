import assert from 'node:assert/strict';
import test from 'node:test';
import { trapDialogTab } from '../app/components/ui/organisms/dialog-focus.js';

function setup() {
  const calls = [];
  const first = { getClientRects: () => [1], focus: () => calls.push('first') };
  const last = { getClientRects: () => [1], focus: () => calls.push('last') };
  const disabled = { disabled: true, getClientRects: () => [1], focus: () => calls.push('disabled') };
  const hidden = { getClientRects: () => [], focus: () => calls.push('hidden') };
  const document = { activeElement: last };
  const currentTarget = { ownerDocument: document, querySelectorAll: () => [first, hidden, disabled, last] };
  const event = { key: 'Tab', shiftKey: false, currentTarget, preventDefault: () => calls.push('prevented') };
  return { calls, first, last, document, event };
}
test('Tab wraps last to first while skipping hidden and disabled controls', () => {
  const s = setup(); trapDialogTab(s.event); assert.deepEqual(s.calls, ['prevented', 'first']);
});
test('Shift+Tab wraps first to last', () => {
  const s = setup(); s.document.activeElement = s.first; s.event.shiftKey = true;
  trapDialogTab(s.event); assert.deepEqual(s.calls, ['prevented', 'last']);
});
test('normal navigation and non-Tab keys are left to the browser', () => {
  const s = setup(); s.document.activeElement = s.first; trapDialogTab(s.event);
  s.event.key = 'Escape'; trapDialogTab(s.event); assert.deepEqual(s.calls, []);
});
