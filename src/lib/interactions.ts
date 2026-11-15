import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PostActivity, PostComment } from "@/lib/database.types";
import { comparePostsNewestFirst, validatePostBody } from "./posts.ts";

export const COMMENT_PAGE_SIZE = 20;
const LIKE_TOKEN_KEY = "wall-like-capability:";
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const POST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let fallbackVisitor: string | undefined;
const fallbackLikeTokens = new Map<string, string>();
const revokedLikeTokens = new Set<string>();

function getLikeToken(postId: string, create: boolean): string | null {
  if (!POST_ID_PATTERN.test(postId)) return null;
  if (!create && revokedLikeTokens.has(postId)) return null;
  const fallback = fallbackLikeTokens.get(postId);
  if (fallback) return fallback;
  if (create) revokedLikeTokens.delete(postId);
  try {
    const key = `${LIKE_TOKEN_KEY}${postId}`;
    const stored = sessionStorage.getItem(key);
    if (stored && TOKEN_PATTERN.test(stored)) return stored;
    if (!create) return null;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(key, token);
    return token;
  } catch {
    const stored = fallbackLikeTokens.get(postId);
    if (stored || !create) return stored ?? null;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    fallbackLikeTokens.set(postId, token);
    return token;
  }
}

export function canUnlikePost(postId: string): boolean {
  return getLikeToken(postId, false) !== null;
}

export function tabVisitorId(): string {
  try {
    const stored = sessionStorage.getItem("wall-reaction-session");
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored)) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem("wall-reaction-session", id);
    return id;
  } catch {
    return fallbackVisitor ??= crypto.randomUUID();
  }
}

export async function loadActivity(client: SupabaseClient<Database>, ids: string[], visitorId: string): Promise<Record<string, PostActivity>> {
  const result: Record<string, PostActivity> = {};
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const [counts, likes] = await Promise.all([
      client.from("post_activity").select("post_id,like_count,comment_count").in("post_id", batch),
      client.from("post_likes").select("post_id").eq("visitor_id", visitorId).in("post_id", batch),
    ]);
    if (counts.error) throw counts.error;
    if (likes.error) throw likes.error;
    const liked = new Set(likes.data.map((row) => row.post_id));
    for (const row of counts.data) result[row.post_id] = { ...row, liked: liked.has(row.post_id) };
  }
  return result;
}

export async function likePost(client: SupabaseClient<Database>, postId: string, visitorId: string): Promise<void> {
  const token = getLikeToken(postId, true);
  if (!token) throw new Error("This browser couldn’t save access to remove the like.");
  const { data, error } = await client.rpc("like_post_with_capability", {
    p_post_id: postId,
    p_visitor_id: visitorId,
    p_like_token: token,
  });
  if (error) throw error;
  if (!data) throw new Error("This like is already present and cannot be claimed by this browser.");
}

export async function unlikePost(client: SupabaseClient<Database>, postId: string, visitorId: string): Promise<boolean> {
  const token = getLikeToken(postId, false);
  if (!token) return false;
  const { data, error } = await client.rpc("unlike_post_with_capability", {
    p_post_id: postId,
    p_visitor_id: visitorId,
    p_like_token: token,
  });
  if (error) throw error;
  if (data) {
    fallbackLikeTokens.delete(postId);
    revokedLikeTokens.add(postId);
    try { sessionStorage.removeItem(`${LIKE_TOKEN_KEY}${postId}`); } catch { /* The unlike completed remotely. */ }
  }
  return data;
}

export async function loadComments(client: SupabaseClient<Database>, postId: string, cursor?: PostComment): Promise<PostComment[]> {
  let query = client.from("post_comments").select("id,post_id,body,created_at").eq("post_id", postId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(COMMENT_PAGE_SIZE);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createComment(client: SupabaseClient<Database>, postId: string, draft: string): Promise<PostComment> {
  const validation = validatePostBody(draft);
  if (validation) throw new Error(validation);
  const { data, error } = await client.from("post_comments").insert({ post_id: postId, body: draft.trim() })
    .select("id,post_id,body,created_at").single();
  if (error) throw error;
  return data;
}

export function mergeComments(current: PostComment[], incoming: PostComment[]): PostComment[] {
  const rows = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) rows.set(row.id, row);
  return [...rows.values()].sort(comparePostsNewestFirst);
}
