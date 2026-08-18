"use client";

import { Button } from "../atoms/Button.jsx";

export function ConfirmDialog({ title, copy, actionLabel, danger = false, onCancel, onConfirm }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <span className="dialog-icon">{danger ? "!" : "→"}</span>
        <h2 id="dialog-title">{title}</h2>
        <p>{copy}</p>
        <div>
          <Button variant="secondary" onClick={onCancel}>キャンセル</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{actionLabel}</Button>
        </div>
      </div>
    </div>
  );
}
