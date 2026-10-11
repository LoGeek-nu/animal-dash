"use client";

import { useEffect, useId, useRef } from "react";
import { trapDialogTab } from "../../../components/ui/organisms/dialog-focus.js";

// Native dialog supplies focus trapping, Escape handling and focus restoration.
export function AdminModal({ title, children, onClose, className = "", dismissible = true }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previous; if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return (
    <dialog ref={ref} className={`admin-native-modal ${className}`} aria-labelledby={titleId}
      onKeyDown={trapDialogTab}
      onCancel={(event) => { event.preventDefault(); if (dismissible) onClose(); }}
      onClick={(event) => { if (dismissible && event.target === event.currentTarget) onClose(); }}>
      <div className="admin-native-modal-content">
        <div className="mobile-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" aria-label="ダイアログを閉じる" disabled={!dismissible} onClick={onClose}>×</button></div>
        {children}
      </div>
    </dialog>
  );
}
