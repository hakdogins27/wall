"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { Post, PostActivity, PostComment } from "@/lib/database.types";
import { loadActivity, tabVisitorId } from "@/lib/interactions";
import { supabase } from "@/lib/supabase";

const subscribeSession = () => () => {};

type CommentListener = (row: PostComment | null, reconnect?: boolean) => void;
const ActivityContext = createContext<{
  activity: Record<string, PostActivity>;
  visitor: string | null;
  drafts: Record<string, string>;
  setDraft: (postId: string, value: string) => void;
  now: number;
  refresh: (ids: string[]) => Promise<void>;
  subscribe: (listener: CommentListener) => () => void;
} | null>(null);

export function usePostActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error("Post actions need an activity provider.");
  return context;
}

export default function PostActivityProvider({ posts, children }: { posts: Post[]; children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const setDraft = useCallback((postId: string, value: string) => setDrafts((current) => ({ ...current, [postId]: value })), []);
  const [activity, setActivity] = useState<Record<string, PostActivity>>({});
  const visitor = useSyncExternalStore(subscribeSession, tabVisitorId, () => null);
  const [now, setNow] = useState(Date.now);
  const [failed, setFailed] = useState(false);
  const versions = useRef(new Map<string, number>());
  const ids = useRef<string[]>([]);
  const listeners = useRef(new Set<CommentListener>());
  const active = useRef(true);
  const channelId = useId();
  const idsKey = posts.map((post) => post.id).join(",");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const subscribe = useCallback((listener: CommentListener) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  const refresh = useCallback(async (requested: string[]) => {
    if (!supabase || !visitor || requested.length === 0) return;
    const requests = requested.map((id) => {
      const version = (versions.current.get(id) ?? 0) + 1;
      versions.current.set(id, version);
      return { id, version };
    });
    try {
      const data = await loadActivity(supabase, requested, visitor);
      if (!active.current) return;
      setActivity((current) => {
        const next = { ...current };
        for (const { id, version } of requests) if (versions.current.get(id) === version && data[id]) next[id] = data[id];
        return next;
      });
      setFailed(false);
    } catch {
      if (active.current) setFailed(true);
    }
  }, [visitor]);

  useEffect(() => {
    ids.current = idsKey ? idsKey.split(",") : [];
    void refresh(ids.current);
  }, [idsKey, refresh]);

  useEffect(() => {
    if (!supabase || !visitor) return;
    active.current = true;
    const update = (postId: string) => { if (ids.current.includes(postId)) void refresh([postId]); };
    let subscribed = false;
    const channel = supabase.channel(`post-activity-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_likes" }, (event) => update(event.new.post_id as string))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "post_likes" }, () => { void refresh(ids.current); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_comments" }, (event) => {
        for (const listener of listeners.current) listener(event.new as PostComment);
        update(event.new.post_id as string);
      })
      .subscribe((status) => {
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && active.current) setFailed(true);
        if (status !== "SUBSCRIBED") return;
        void refresh(ids.current);
        for (const listener of listeners.current) listener(null, subscribed);
        subscribed = true;
      });
    return () => { active.current = false; void supabase?.removeChannel(channel); };
  }, [visitor, refresh, channelId]);

  return (
    <ActivityContext value={{ activity, visitor, now, refresh, subscribe, drafts, setDraft }}>
      {failed && <p className="interaction-error" role="status">Reactions couldn’t refresh. <button type="button" onClick={() => void refresh(ids.current)}>Retry</button></p>}
      {children}
    </ActivityContext>
  );
}
