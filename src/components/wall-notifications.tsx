"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { WallNotification } from "@/lib/database.types";
import { isUnreadNotification, loadNotifications, NOTIFICATION_READ_KEY, parseNotificationCursor } from "@/lib/notifications";
import { relativePostTime } from "@/lib/posts";
import { supabase } from "@/lib/supabase";

let memoryRead: string | null = null;
function readSnapshot() {
  if (memoryRead) return memoryRead;
  try { return window.localStorage.getItem(NOTIFICATION_READ_KEY); }
  catch { return memoryRead; }
}
function subscribeRead(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === NOTIFICATION_READ_KEY || event.key === null) { memoryRead = null; listener(); } };
  window.addEventListener("storage", storage);
  window.addEventListener("wall-notifications-read", listener);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener("wall-notifications-read", listener); };
}
const NotificationsContext = createContext<{
  items: WallNotification[]; unreadCount: number; markRead: () => void; refresh: () => Promise<void>;
  isUnread: (item: WallNotification) => boolean; loading: boolean; failed: boolean; reconnecting: boolean; now: number;
} | null>(null);
export function useWallNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("Notifications need their provider.");
  return value;
}

export function WallNotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WallNotification[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [failed, setFailed] = useState(!supabase);
  const [reconnecting, setReconnecting] = useState(false);
  const [now, setNow] = useState(Date.now);
  const raw = useSyncExternalStore(subscribeRead, readSnapshot, () => null);
  const read = useMemo(() => parseNotificationCursor(raw), [raw]);
  const request = useRef(0);
  const active = useRef(false);
  const channelId = useId();
  const invalidate = useCallback(() => { active.current = false; request.current++; }, []);
  const refresh = useCallback(async () => {
    if (!supabase || !active.current) return;
    const version = ++request.current;
    setLoading(true);
    try {
      const result = await loadNotifications(supabase, parseNotificationCursor(readSnapshot()));
      if (!active.current || version !== request.current) return;
      setItems(result.items); setCount(result.unread); setFailed(false);
    } catch { if (active.current && version === request.current) setFailed(true); }
    finally { if (active.current && version === request.current) setLoading(false); }
  }, []);
  const markRead = useCallback(() => {
    const newest = items[0];
    if (!newest || !isUnreadNotification(newest, parseNotificationCursor(readSnapshot()))) return;
    const value = JSON.stringify({ id: newest.id, created_at: newest.created_at });
    memoryRead = value;
    try { window.localStorage.setItem(NOTIFICATION_READ_KEY, value); memoryRead = null; } catch { /* Read state remains available for this page session. */ }
    window.dispatchEvent(new Event("wall-notifications-read"));
  }, [items]);
  useEffect(() => {
    active.current = true;
    let pending: number | undefined;
    const changed = () => {
      if (pending !== undefined) window.clearTimeout(pending);
      pending = window.setTimeout(() => { void refresh(); }, 80);
    };
    const channel = supabase?.channel(`wall-notifications-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, changed)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, changed)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, changed)
      .subscribe((status) => {
        if (!active.current) return;
        if (status === "SUBSCRIBED") { setReconnecting(false); void refresh(); }
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) setReconnecting(true);
      });
    const clock = window.setInterval(() => setNow(Date.now()), 60000);
    return () => { invalidate(); window.clearInterval(clock); if (pending !== undefined) window.clearTimeout(pending); if (channel) void supabase?.removeChannel(channel); };
  }, [refresh, channelId, invalidate]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [raw, refresh]);
  const unreadCount = read && items[0] && !isUnreadNotification(items[0], read) ? 0 : count;
  return <NotificationsContext value={{ items, unreadCount, markRead, refresh, isUnread: (item) => isUnreadNotification(item, read), loading, failed, reconnecting, now }}>{children}</NotificationsContext>;
}

export default function WallNotifications() {
  const { items, isUnread, loading, failed, reconnecting, refresh, now } = useWallNotifications();
  const labels = { post: "New Wall post", comment: "New comment", like: "Someone liked a post" };
  return <div className="wall-notifications">
    {failed && <p className="notification-state" role="status">Notifications couldn’t load. <button type="button" onClick={() => void refresh()}>Retry</button></p>}
    {reconnecting && <p className="notification-state" role="status">Reconnecting live updates…</p>}
    {loading && items.length === 0 && <p className="notification-state" role="status">Loading notifications…</p>}
    {!loading && !failed && items.length === 0 && <p className="notification-state">No notifications yet.</p>}
    {items.length > 0 && <ul aria-label="Recent notifications">{items.map((item) => <li key={item.id}><a className="wall-notification" data-unread={isUnread(item)} data-kind={item.kind} href={`/post/${item.post_id}`}><span className="notification-title">{labels[item.kind]}</span>{item.body && <span className="notification-preview">{item.body}</span>}<time className="notification-time" dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()}>{relativePostTime(item.created_at, now)}</time></a></li>)}</ul>}
  </div>;
}
