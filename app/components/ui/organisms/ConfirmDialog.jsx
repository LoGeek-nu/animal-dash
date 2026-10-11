"use client";

import { Button } from "../atoms/Button.jsx";
import { useEffect, useRef } from "react";
import { trapDialogTab } from "./dialog-focus.js";

export function ConfirmDialog({ title, copy, actionLabel, danger = false, onCancel, onConfirm }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previous; if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return (
    <dialog ref={ref} className="confirm-modal" aria-labelledby="dialog-title" onKeyDown={trapDialogTab} onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="confirm-dialog">
        <span className="dialog-icon">{danger ? "!" : "→"}</span>
        <h2 id="dialog-title">{title}</h2>
        <p>{copy}</p>
        <div>
          <Button variant="secondary" onClick={onCancel}>キャンセル</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{actionLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}
