export function trapDialogTab(event) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const items = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
    .filter((item) => !item.disabled && item.getClientRects().length > 0);
  if (!items.length) return;
  const active = dialog.ownerDocument.activeElement;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
}
