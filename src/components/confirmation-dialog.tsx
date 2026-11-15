"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ConfirmationDialog({ title, description, confirmLabel, cancelLabel = "Keep editing", onConfirm, onCancel }: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  const cancel = () => { if (busy) return; dialog.current?.close(); onCancel(); };
  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { await onConfirm(); dialog.current?.close(); }
    catch { setError("This couldn’t be completed. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <dialog ref={dialog} className="confirmation-dialog" aria-labelledby="confirmation-title" aria-describedby="confirmation-description" onCancel={(event) => { event.preventDefault(); cancel(); }}>
      <h2 id="confirmation-title">{title}</h2>
      <p id="confirmation-description">{description}</p>
      {error && <p className="interaction-error" role="alert">{error}</p>}
      <div className="confirmation-actions">
        <Button type="button" variant="outline" onClick={cancel} autoFocus disabled={busy}>{busy ? "Working…" : cancelLabel}</Button>
        <Button type="button" className="destructive-confirm" onClick={() => void confirm()} disabled={busy}>{busy ? "Removing…" : confirmLabel}</Button>
      </div>
    </dialog>
  );
}
