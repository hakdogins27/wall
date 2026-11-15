"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";
import type { Post } from "@/lib/database.types";
import { countCharacters, validatePostBody } from "@/lib/posts";
import { editPostWithToken } from "@/lib/post-deletion";
import { supabase } from "@/lib/supabase";

export default function PostEditorDialog({ post, token, onSaved, onClose }: { post: Post; token: string; onSaved: (post: Post) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const flight = useRef(false);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const close = () => { if (saving) return; if (draft !== post.body) setDiscard(true); else onClose(); };
  return createPortal(<>
    <dialog ref={dialog} className="confirmation-dialog post-editor-dialog" aria-labelledby="edit-post-title" onCancel={(event) => { event.preventDefault(); close(); }}>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!supabase || flight.current) return;
        const invalid = validatePostBody(draft);
        if (invalid) { setError(invalid); return; }
        flight.current = true; setSaving(true); setError("");
        try { const row = await editPostWithToken(supabase, post.id, token, draft); if (!row) throw new Error("Edit access unavailable."); onSaved(row); }
        catch { setError("Your changes couldn’t be saved. Your draft is still here."); }
        finally { flight.current = false; setSaving(false); }
      }}>
        <h2 id="edit-post-title">Edit post</h2>
        <label htmlFor="edit-post-caption">Caption</label>
        <textarea id="edit-post-caption" autoFocus rows={4} value={draft} disabled={saving} onChange={(event) => setDraft(event.target.value)} aria-describedby="edit-post-counter" aria-invalid={countCharacters(draft) > 280} />
        <p id="edit-post-counter">{countCharacters(draft)} / 280</p>
        {error && <p role="alert" className="interaction-error">{error}</p>}
        <div className="confirmation-actions"><Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || !draft.trim() || countCharacters(draft) > 280 || draft.trim() === post.body}>{saving ? "Saving…" : "Save changes"}</Button></div>
      </form>
    </dialog>
    {discard && <ConfirmationDialog title="Discard changes?" description="Your unsaved caption changes will be lost." confirmLabel="Discard changes" onConfirm={onClose} onCancel={() => setDiscard(false)} />}
  </>, document.body);
}
