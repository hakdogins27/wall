"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useId } from "react";
import { createPortal } from "react-dom";
import ProfileAvatar from "@/components/profile-avatar";
import PostActions from "@/components/post-actions";
import PostEditorDialog from "@/components/post-editor-dialog";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { usePostActivity } from "@/components/post-activity-provider";
import { useLiveProfile } from "@/components/live-profile-provider";
import type { Post } from "@/lib/database.types";
import type { SharedProfile } from "@/lib/profile";
import { isPostImagePath, loadPostById, POST_IMAGE_BUCKET, relativePostTime } from "@/lib/posts";
import { deletePostWithToken, postDeleteToken } from "@/lib/post-deletion";
import { supabase } from "@/lib/supabase";

const subscribeCapabilities = (listener: () => void) => {
  window.addEventListener("storage", listener);
  window.addEventListener("wall:post-delete-capability", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("wall:post-delete-capability", listener); };
};
type Props = { post: Post; profile: SharedProfile; arriving?: boolean; expanded?: boolean; onOpenDetails?: (post: Post) => void; onDeleted?: (id: string) => void; onEdited?: (post: Post) => void };

export function PostDetailDialog({ post, profile, deleted = false, onClose, onDeleted, onEdited }: { post: Post; profile: SharedProfile; deleted?: boolean; onClose: () => void; onDeleted?: (id: string) => void; onEdited?: (post: Post) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const outsidePointer = useRef<{ id: number; startOutside: boolean } | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const element = dialog.current;
    if (!element) return;
    document.body.style.overflow = "hidden";
    element?.showModal();
    const isOutside = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.target !== element || !event.isPrimary || event.button !== 0) {
        outsidePointer.current = null;
        return;
      }
      outsidePointer.current = { id: event.pointerId, startOutside: isOutside(event) };
    };
    const pointerUp = (event: PointerEvent) => {
      const start = outsidePointer.current;
      outsidePointer.current = null;
      if (start?.id === event.pointerId && start.startOutside && isOutside(event)) onCloseRef.current();
    };
    const pointerCancel = () => { outsidePointer.current = null; };
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerup", pointerUp, true);
    document.addEventListener("pointercancel", pointerCancel, true);
    return () => {
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointerup", pointerUp, true);
      document.removeEventListener("pointercancel", pointerCancel, true);
      element.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="post-detail-dialog" aria-labelledby="post-detail-title" onCancel={(event) => { event.preventDefault(); onCloseRef.current(); }}>
    <header className="post-detail-header"><h2 id="post-detail-title">Post details</h2><button type="button" aria-label="Close post" onClick={onClose} autoFocus>×</button></header>
    <div className="post-detail-content">{deleted ? <p role="status">This post has been removed.</p> : <PostCard post={post} profile={profile} expanded onDeleted={onDeleted} onEdited={onEdited} />}</div>
  </dialog>, document.body);
}

export default function PostCard({ post: initialPost, profile: initialProfile, arriving = false, expanded = false, onOpenDetails, onDeleted, onEdited }: Props) {
  const { profile } = useLiveProfile(initialProfile);
  const { now } = usePostActivity();
  const [livePost, setLivePost] = useState<Post | null>(null);
  const post = onEdited ? initialPost : livePost ?? initialPost;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const edited = (row: Post) => { if (onEdited) onEdited(row); else setLivePost(row); setEditing(false); };
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [menuOpen]);
  const [details, setDetails] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removed, setRemoved] = useState(false);
  const token = useSyncExternalStore(subscribeCapabilities, useCallback(() => postDeleteToken(post.id), [post.id]), () => null);
  const markDeleted = useCallback((id: string) => { setRemoved(true); setConfirmDelete(false); onDeleted?.(id); }, [onDeleted]);
  useEffect(() => {
    if (onOpenDetails || expanded || !supabase) return;
    const client = supabase;
    let active = true;
    const channel = client.channel(`post-detail-${post.id}`).on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (event) => { if (event.old.id === post.id) markDeleted(post.id); }).on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${post.id}` }, (event) => setLivePost(event.new as Post)).subscribe((status) => {
      if (status === "SUBSCRIBED") void loadPostById(client, post.id).then((row) => { if (active) { if (!row) markDeleted(post.id); else setLivePost(row); } }).catch(() => {});
    });
    return () => { active = false; void client.removeChannel(channel); };
  }, [post.id, onOpenDetails, expanded, markDeleted]);
  const open = () => { if (onOpenDetails) onOpenDetails(post); else setDetails(true); };
  const characters = Array.from(post.body);
  const truncated = !expanded && (characters.length > 160 || post.body.split("\n").length > 4);
  const caption = truncated ? characters.slice(0, 160).join("").split("\n").slice(0, 4).join("\n") + "…" : post.body;
  if (removed) return <p className="interaction-note" role="status">This post has been removed.</p>;
  return <>
    <article className={`post${arriving ? " arriving" : ""}`} id={expanded ? undefined : `post-${post.id}`}>
      <ProfileAvatar profile={profile} />
      <div className="post-body">
        <div className="post-author-row"><p className="author">{profile.display_name}</p>{token && <div className="post-options" ref={menu}>
          <button type="button" className="post-options-trigger" ref={menuButton} aria-label="Post options" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} onClick={() => setMenuOpen(!menuOpen)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>
          {menuOpen && <div className="post-options-list" id={menuId} role="group" aria-label="Post actions"><button type="button" onClick={() => { menuButton.current?.focus(); setMenuOpen(false); setEditing(true); }}>Edit post</button><button type="button" className="post-option-delete" onClick={() => { menuButton.current?.focus(); setMenuOpen(false); setConfirmDelete(true); }}>Delete post</button></div>}
        </div>}</div>
        <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()} suppressHydrationWarning>{relativePostTime(post.created_at, now)}</time>
        <p className="post-text">{caption}</p>
        {truncated && <button className="post-see-more" type="button" onClick={open}>See more</button>}
        {supabase && post.image_path && isPostImagePath(post.image_path) && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="post-image" src={supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(post.image_path).data.publicUrl} alt="Photo attached to this post" width={1200} height={900} loading="lazy" />
        )}
        <PostActions post={post} profile={profile} expanded={expanded} onOpenDetails={open} />
      </div>
    </article>
    {details && <PostDetailDialog post={post} profile={profile} onClose={() => setDetails(false)} onDeleted={markDeleted} onEdited={edited} />}
    {editing && token && <PostEditorDialog post={post} token={token} onSaved={edited} onClose={() => setEditing(false)} />}
    {confirmDelete && <ConfirmationDialog title="Delete this post?" description="This removes the post, its comments, and likes. This cannot be undone." confirmLabel="Delete post" cancelLabel="Cancel" onCancel={() => setConfirmDelete(false)} onConfirm={async () => {
      if (!supabase || !token) throw new Error("Removal access unavailable.");
      const deleted = await deletePostWithToken(supabase, post.id, token);
      if (!deleted && await loadPostById(supabase, post.id)) throw new Error("Removal could not be confirmed.");
      markDeleted(post.id);
    }} />}
  </>;
}
