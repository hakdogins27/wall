import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Post } from "@/lib/database.types";

const STORAGE_PREFIX = "wall:post-delete:";
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const POST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const volatileCapabilities = new Map<string, string>();
const deletedCapabilities = new Set<string>();

function notifyCapabilityChange(postId: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wall:post-delete-capability", { detail: postId }));
  }
}

export function createPostDeleteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function reservePostDeleteToken(token: string): void {
  if (!TOKEN_PATTERN.test(token) || typeof window === "undefined") {
    throw new Error("Post removal needs browser storage enabled.");
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${token}`, "pending");
  } catch {
    throw new Error("This browser can’t save post removal access, so the post wasn’t shared.");
  }
}

export function savePostDeleteToken(token: string, postId: string): void {
  if (!TOKEN_PATTERN.test(token) || !POST_ID_PATTERN.test(postId) || typeof window === "undefined") {
    throw new Error("The post removal access couldn’t be saved.");
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${token}`, postId);
    volatileCapabilities.delete(postId);
  } catch {
    volatileCapabilities.set(postId, token);
  }
  deletedCapabilities.delete(postId);
  notifyCapabilityChange(postId);
}

export function postDeleteToken(postId: string): string | null {
  if (!POST_ID_PATTERN.test(postId) || typeof window === "undefined") return null;
  if (deletedCapabilities.has(postId)) return null;
  const volatile = volatileCapabilities.get(postId);
  if (volatile) return volatile;
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const token = key.slice(STORAGE_PREFIX.length);
      if (TOKEN_PATTERN.test(token) && window.localStorage.getItem(key) === postId) return token;
    }
  } catch {
    return null;
  }
  return null;
}

export async function deletePostWithToken(
  client: SupabaseClient<Database>,
  postId: string,
  token: string,
): Promise<boolean> {
  if (!POST_ID_PATTERN.test(postId) || !TOKEN_PATTERN.test(token)) return false;
  const { data, error } = await client.rpc("delete_post_with_capability", {
    p_post_id: postId,
    p_delete_token: token,
  });
  if (error) throw error;
  if (data) {
    deletedCapabilities.add(postId);
    volatileCapabilities.delete(postId);
    try { window.localStorage.removeItem(`${STORAGE_PREFIX}${token}`); } catch { /* The post is already removed remotely. */ }
    notifyCapabilityChange(postId);
  }
  return data;
}

export async function editPostWithToken(
  client: SupabaseClient<Database>,
  postId: string,
  token: string,
  draft: string,
): Promise<Post> {
  if (!POST_ID_PATTERN.test(postId) || !TOKEN_PATTERN.test(token)) {
    throw new Error("This post cannot be edited from this browser.");
  }
  const body = draft.trim();
  if (!body) throw new Error("Write something before saving.");
  if (Array.from(body).length > 280) throw new Error("Posts can be up to 280 characters.");
  const { data, error } = await client.rpc("edit_post_with_capability", {
    p_post_id: postId,
    p_delete_token: token,
    p_body: body,
  });
  if (error) throw error;
  const edited = data?.[0];
  if (!edited) throw new Error("The post could not be edited. It may be unavailable in this browser.");
  return edited;
}
