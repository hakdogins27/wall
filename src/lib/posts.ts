import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Post } from "@/lib/database.types";
import { createPostDeleteToken, reservePostDeleteToken, savePostDeleteToken } from "./post-deletion.ts";

export const PAGE_SIZE = 50;
export const POST_IMAGE_BUCKET = "wall-images";
export const MAX_POST_IMAGE_BYTES = 2 * 1024 * 1024;
const POST_COLUMNS = "id,user_id,body,image_path,created_at";
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const POST_IMAGE_PATH = /^posts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export function isPostImagePath(path: string): boolean {
  return POST_IMAGE_PATH.test(path);
}

export function countCharacters(value: string): number {
  return Array.from(value).length;
}

export function validatePostBody(value: string): string | null {
  const body = value.trim();
  if (!body) return "Write something before sharing.";
  if (countCharacters(body) > 280) return "Posts can be up to 280 characters.";
  return null;
}

export function validatePostImage(file: Pick<File, "size" | "type">): string | null {
  if (!IMAGE_EXTENSIONS[file.type]) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > MAX_POST_IMAGE_BYTES) return "Images must be 2 MB or smaller.";
  return null;
}

export function createPostImagePath(file: Pick<File, "type">): string {
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) throw new Error("Choose a JPEG, PNG, or WebP image.");
  return `posts/${crypto.randomUUID()}.${extension}`;
}

export async function uploadPostImage(
  client: SupabaseClient<Database>,
  path: string,
  file: File,
): Promise<string> {
  const validationError = validatePostImage(file);
  if (validationError) throw new Error(validationError);
  if (!isPostImagePath(path)) throw new Error("The image path is invalid.");
  const { data, error } = await client.storage
    .from(POST_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return data.path;
}

function compareDescending(left: string, right: string): number {
  return left === right ? 0 : left > right ? -1 : 1;
}

function parseTimestamp(value: string): { second: number; microsecond: number } | null {
  const match = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/i.exec(value);
  if (!match) return null;

  const zone = match[3].toUpperCase();
  const offsetDigits = zone.slice(1).replace(":", "").padEnd(4, "0");
  const offset = zone === "Z"
    ? "Z"
    : `${zone[0]}${offsetDigits.slice(0, 2)}:${offsetDigits.slice(2)}`;
  const second = Date.parse(`${match[1].replace(" ", "T")}${offset}`) / 1000;
  if (!Number.isFinite(second)) return null;

  return {
    second,
    microsecond: Number((match[2] ?? "").slice(0, 6).padEnd(6, "0")),
  };
}

export function comparePostsNewestFirst(left: Pick<Post, "id" | "created_at">, right: Pick<Post, "id" | "created_at">): number {
  const leftTime = parseTimestamp(left.created_at);
  const rightTime = parseTimestamp(right.created_at);

  if (leftTime && rightTime) {
    if (leftTime.second !== rightTime.second) {
      return leftTime.second > rightTime.second ? -1 : 1;
    }
    if (leftTime.microsecond !== rightTime.microsecond) {
      return leftTime.microsecond > rightTime.microsecond ? -1 : 1;
    }
  } else {
    const timestampOrder = compareDescending(left.created_at, right.created_at);
    if (timestampOrder) return timestampOrder;
  }

  return compareDescending(left.id, right.id);
}

export function mergePosts(current: Post[], incoming: Post[]): Post[] {
  const postsById = new Map(current.map((post) => [post.id, post]));
  for (const post of incoming) postsById.set(post.id, post);
  return [...postsById.values()].sort(comparePostsNewestFirst);
}

export async function loadLatestPosts(
  client: SupabaseClient<Database>,
): Promise<Post[]> {
  const { data, error } = await client
    .from("posts")
    .select(POST_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) throw error;
  return data ?? [];
}

export async function loadOlderPosts(
  client: SupabaseClient<Database>,
  cursor: Pick<Post, "created_at" | "id">,
): Promise<Post[]> {
  const { data, error } = await client
    .from("posts")
    .select(POST_COLUMNS)
    .or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) throw error;
  return data ?? [];
}

export async function createPost(
  client: SupabaseClient<Database>,
  draft: string,
  imagePath?: string,
  deleteToken = createPostDeleteToken(),
): Promise<Post> {
  const body = draft.trim();
  const validationError = validatePostBody(body);
  if (validationError) throw new Error(validationError);
  if (imagePath && !isPostImagePath(imagePath)) {
    throw new Error("The image path is invalid.");
  }

  reservePostDeleteToken(deleteToken);
  const { data, error } = await client.rpc("create_post_with_delete_capability", {
    p_body: body,
    p_image_path: imagePath ?? null,
    p_delete_token: deleteToken,
  });

  if (error) throw error;
  const post = data?.[0];
  if (!post) throw new Error("The post could not be confirmed.");
  savePostDeleteToken(deleteToken, post.id);
  return post;
}

export function relativePostTime(value: string, now = Date.now()): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Time unavailable";
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(time));
}

export async function loadPostById(client: SupabaseClient<Database>, id: string): Promise<Post | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const { data, error } = await client.from("posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
