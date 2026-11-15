"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePostActivity } from "@/components/post-activity-provider";
import ProfileAvatar from "@/components/profile-avatar";
import type { Post, PostComment } from "@/lib/database.types";
import { COMMENT_PAGE_SIZE, canUnlikePost, createComment, likePost, unlikePost, loadComments, mergeComments } from "@/lib/interactions";
import { countCharacters, relativePostTime } from "@/lib/posts";
import { supabase } from "@/lib/supabase";
import type { SharedProfile } from "@/lib/profile";

export default function PostActions({ post, profile, expanded = false, onOpenDetails }: { post: Post; profile: SharedProfile; expanded?: boolean; onOpenDetails: () => void }) {
  const { activity, visitor, now, refresh, subscribe, drafts, setDraft: updateDraft } = usePostActivity();
  const counts = activity[post.id];
  const [liking, setLiking] = useState(false);
  const open = expanded;
  const [comments, setComments] = useState<PostComment[]>([]);
  const draft = drafts[post.id] ?? "";
  const setDraft = (value: string) => updateDraft(post.id, value);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const latestRows = useRef<PostComment[]>([]);
  const arrivals = useRef(new Map<string, { version: number; row: PostComment }>());
  const arrivalVersion = useRef(0);
  const generation = useRef(0);
  const likeFlight = useRef(false);
  const commentFlight = useRef(false);
  const loadingFlight = useRef(false);
  const readsInFlight = useRef(0);
  const commentDraftRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  const invalidate = useCallback(() => { generation.current++; loadingFlight.current = false; readsInFlight.current = 0; }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; invalidate(); }; }, [invalidate]);
  const resizeCommentDraft = useCallback(() => {
    const textarea = commentDraftRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 120 ? "auto" : "hidden";
  }, []);
  useEffect(() => resizeCommentDraft(), [draft, resizeCommentDraft]);
  useEffect(() => {
    window.addEventListener("resize", resizeCommentDraft);
    return () => window.removeEventListener("resize", resizeCommentDraft);
  }, [resizeCommentDraft]);

  const receive = useCallback((row: PostComment) => {
    arrivalVersion.current++;
    arrivals.current.set(row.id, { version: arrivalVersion.current, row });
    latestRows.current = mergeComments(latestRows.current, [row]);
    setComments(latestRows.current);
  }, []);

  const fetchComments = useCallback(async (reset: boolean, preserveLoaded = false) => {
    if (!supabase || (!reset && loadingFlight.current)) return;
    if (reset && !preserveLoaded) { generation.current++; readsInFlight.current = 0; }
    const request = generation.current;
    const version = arrivalVersion.current;
    readsInFlight.current++;
    loadingFlight.current = true;
    setLoading(true);
    setCommentError("");
    try {
      const rows = await loadComments(supabase, post.id, reset ? undefined : latestRows.current.at(-1));
      if (!mounted.current || request !== generation.current) return;
      const recent = [...arrivals.current.values()].filter((item) => item.version > version).map((item) => item.row);
      latestRows.current = reset && !preserveLoaded ? mergeComments(rows, recent) : mergeComments(latestRows.current, rows);
      setComments(latestRows.current);
      if (!preserveLoaded || latestRows.current.length <= COMMENT_PAGE_SIZE) setHasOlder(rows.length === COMMENT_PAGE_SIZE);
      if (reset && !preserveLoaded) arrivals.current.clear();
    } catch {
      if (mounted.current && request === generation.current) setCommentError("Comments couldn’t load. Try again.");
    } finally {
      if (mounted.current && request === generation.current) { readsInFlight.current--; loadingFlight.current = readsInFlight.current > 0; setLoading(loadingFlight.current); }
    }
  }, [post.id]);

  useEffect(() => {
    if (!open) return;
    const remove = subscribe((row, reconnect) => { if (!row) void fetchComments(true, !reconnect); else if (row.post_id === post.id) receive(row); });
    void fetchComments(true);
    return () => { remove(); invalidate(); };
  }, [open, subscribe, fetchComments, post.id, receive, invalidate]);

  const handleLike = async () => {
    if (!supabase || !visitor || likeFlight.current) return;
    likeFlight.current = true; setLiking(true); setError("");
    try {
      if (counts?.liked) {
        if (!await unlikePost(supabase, post.id, visitor)) throw new Error("Unlike access unavailable");
      } else {
        await likePost(supabase, post.id, visitor);
      }
      await refresh([post.id]);
    }
    catch { if (mounted.current) setError("Your like couldn’t be confirmed. Try again."); }
    finally { likeFlight.current = false; if (mounted.current) setLiking(false); }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || commentFlight.current || !draft.trim() || countCharacters(draft) > 280) return;
    commentFlight.current = true; setPosting(true); setError("");
    try {
      const row = await createComment(supabase, post.id, draft);
      if (mounted.current) { receive(row); setDraft(""); void refresh([post.id]); }
    } catch { if (mounted.current) setError("Your comment couldn’t be confirmed. Your draft is still here; retry only when you’re ready."); }
    finally { commentFlight.current = false; if (mounted.current) setPosting(false); }
  };

  const isLiked = Boolean(counts?.liked);
  const removable = canUnlikePost(post.id);
  return (
    <div className="post-interactions">
      {counts && (counts.like_count > 0 || counts.comment_count > 0) && <div className="post-engagement-summary" role="group" aria-label="Post engagement">{counts.like_count > 0 && <span>{counts.like_count} {counts.like_count === 1 ? "like" : "likes"}</span>}{counts.comment_count > 0 && <span className="post-comment-count">{counts.comment_count} {counts.comment_count === 1 ? "comment" : "comments"}</span>}</div>}
      <div className="post-action-row">
        <button type="button" title={isLiked && !removable ? "This older like has no removal key in this tab." : undefined} aria-pressed={isLiked} disabled={!visitor || liking || (isLiked && !removable)} onClick={() => void handleLike()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 0 5-8c2 0 3 1 2 4l-1 4h6c2 0 2 2 2 3l-2 7c0 1-1 1-2 1H7"/></svg><span>{isLiked ? (removable ? "Unlike" : "Liked") : "Like"}</span></button>
        <button type="button" aria-expanded={open} aria-controls={expanded ? `comments-${post.id}` : undefined} onClick={() => { if (expanded) document.getElementById(`comment-draft-${post.id}`)?.focus(); else onOpenDetails(); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M21 11a9 9 0 0 1-9 9 11 11 0 0 1-4-1l-5 2 1-5a9 9 0 1 1 17-5Z"/></svg><span>Comment</span></button>
      </div>
      {error && <p className="interaction-error" role="alert">{error}</p>}
      {open && (
        <section className="post-comments" id={`comments-${post.id}`} aria-label="Comments">
          {commentError && <p className="interaction-error" role="status">{commentError} <button type="button" onClick={() => void fetchComments(true)}>Retry comments</button></p>}
          {loading && <p className="interaction-note" role="status">Loading comments…</p>}
          {!loading && !commentError && comments.length === 0 && <p className="interaction-note">No comments yet.</p>}
          {comments.map((comment) => <article className="post-comment" key={comment.id}><ProfileAvatar profile={profile} className="comment-avatar" /><div className="post-comment-body"><div className="post-comment-bubble"><strong>{profile.display_name}</strong><p>{comment.body}</p></div><time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString()}>{relativePostTime(comment.created_at, now)}</time></div></article>)}
          {hasOlder && <button className="comments-older" type="button" disabled={loading} onClick={() => void fetchComments(false)}>Load older comments</button>}
          <form onSubmit={submitComment} className="comment-form">
            <ProfileAvatar profile={profile} className="comment-avatar" />
            <div className="comment-composer-field">
              <label className="sr-only" htmlFor={`comment-draft-${post.id}`}>Write a comment</label>
              <textarea ref={commentDraftRef} id={`comment-draft-${post.id}`} rows={1} placeholder="Write a comment…" disabled={posting} value={draft} onChange={(event) => { setDraft(event.currentTarget.value); resizeCommentDraft(); }} aria-describedby={draft ? `comment-count-${post.id}` : undefined} aria-invalid={countCharacters(draft) > 280} />
              {draft && <span className="comment-character-count" id={`comment-count-${post.id}`} aria-live="polite">{countCharacters(draft)} / 280</span>}
            </div>
            <button className="comment-send-button" type="submit" aria-label="Send comment" title="Send comment" disabled={posting || !draft.trim() || countCharacters(draft) > 280}>{posting ? <span aria-hidden="true">…</span> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>}</button>
          </form>
        </section>
      )}
    </div>
  );
}
