import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WallNotification } from "./database.types.ts";
import { comparePostsNewestFirst } from "./posts.ts";

export type NotificationCursor = Pick<WallNotification, "id" | "created_at">;
export const NOTIFICATION_READ_KEY = "wall-notifications-read";
export const NOTIFICATION_LIMIT = 20;

export function parseNotificationCursor(raw: string | null): NotificationCursor | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (typeof value?.id !== "string" || !/^(post|comment|like):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)) return null;
    if (typeof value.created_at !== "string" || !/^[0-9TZ:.+-]{20,40}$/.test(value.created_at) || !Number.isFinite(Date.parse(value.created_at))) return null;
    return { id: value.id, created_at: value.created_at };
  } catch { return null; }
}

export function isUnreadNotification(row: NotificationCursor, read: NotificationCursor | null): boolean {
  return !read || comparePostsNewestFirst(row, read) < 0;
}

export async function loadNotifications(client: SupabaseClient<Database>, read: NotificationCursor | null) {
  let countQuery = client.from("wall_notifications").select("id", { count: "exact", head: true });
  if (read) countQuery = countQuery.or(`created_at.gt.${read.created_at},and(created_at.eq.${read.created_at},id.gt.${read.id})`);
  const [items, unread] = await Promise.all([
    client.from("wall_notifications").select("id,post_id,kind,body,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(NOTIFICATION_LIMIT),
    countQuery,
  ]);
  if (items.error) throw items.error;
  if (unread.error) throw unread.error;
  return { items: items.data ?? [], unread: unread.count ?? 0 };
}
