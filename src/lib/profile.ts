import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WallProfileRow } from "@/lib/database.types";
import { POST_IMAGE_BUCKET, validatePostImage } from "./posts.ts";

export type SharedProfile = Omit<WallProfileRow, "id">;

export type ProfileDraft = {
  displayName: string;
  about: string;
  skills: string;
  website: string;
  github: string;
  linkedin: string;
};

export const DEFAULT_SHARED_PROFILE: SharedProfile = {
  display_name: "Anthony Mendoza",
  about: "",
  skills: "",
  website: null,
  github: null,
  linkedin: null,
  photo_path: null,
};

const PROFILE_COLUMNS = "display_name,about,skills,website,github,linkedin,photo_path";
const PROFILE_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const PROFILE_IMAGE_PATH = /^profile\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export function profileToDraft(profile: SharedProfile): ProfileDraft {
  return {
    displayName: profile.display_name,
    about: profile.about,
    skills: profile.skills,
    website: profile.website ?? "",
    github: profile.github ?? "",
    linkedin: profile.linkedin ?? "",
  };
}

export function profileSkills(value: string): string[] {
  return [...new Set(value.split(",").map((skill) => skill.trim()).filter(Boolean))];
}

function normalizeHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function validateProfileDraft(draft: ProfileDraft): string | null {
  const name = draft.displayName.trim();
  if (!name) return "Add a display name.";
  if (Array.from(name).length > 80) return "Display names can be up to 80 characters.";
  if (Array.from(draft.about).length > 1000) return "About can be up to 1,000 characters.";
  if (Array.from(draft.skills).length > 500) return "Skills can be up to 500 characters.";

  for (const [label, value] of [
    ["Website", draft.website],
    ["GitHub", draft.github],
    ["LinkedIn", draft.linkedin],
  ]) {
    const trimmed = value.trim();
    if (Array.from(trimmed).length > 500) return `${label} links can be up to 500 characters.`;
    if (trimmed) {
      const url = normalizeHttpsUrl(trimmed);
      if (!url) return `${label} must be a valid HTTPS URL.`;
      if (Array.from(url).length > 500) return `${label} links can be up to 500 characters.`;
    }
  }
  return null;
}

function profileFromRow(row: WallProfileRow): SharedProfile {
  return {
    display_name: row.display_name,
    about: row.about,
    skills: row.skills,
    website: row.website,
    github: row.github,
    linkedin: row.linkedin,
    photo_path: row.photo_path,
  };
}

export async function loadSharedProfile(client: SupabaseClient<Database>): Promise<SharedProfile> {
  const { data, error } = await client
    .from("wall_profile")
    .select(PROFILE_COLUMNS)
    .eq("id", 1)
    .single();
  if (error) throw error;
  return profileFromRow({ id: 1, ...data });
}

export async function loadSharedProfileOrDefault(
  client: SupabaseClient<Database> | null,
): Promise<{ profile: SharedProfile; error: boolean }> {
  if (!client) return { profile: DEFAULT_SHARED_PROFILE, error: true };
  try {
    return { profile: await loadSharedProfile(client), error: false };
  } catch {
    return { profile: DEFAULT_SHARED_PROFILE, error: true };
  }
}

export async function saveSharedProfile(
  client: SupabaseClient<Database>,
  draft: ProfileDraft,
  photoPath: string | null,
  original?: SharedProfile,
): Promise<SharedProfile> {
  const validationError = validateProfileDraft(draft);
  if (validationError) throw new Error(validationError);
  if (photoPath && !PROFILE_IMAGE_PATH.test(photoPath)) {
    throw new Error("The profile photo path is invalid.");
  }

  const values: SharedProfile = {
      display_name: draft.displayName.trim(),
      about: draft.about.trim(),
      skills: draft.skills.trim(),
      website: normalizeHttpsUrl(draft.website),
      github: normalizeHttpsUrl(draft.github),
      linkedin: normalizeHttpsUrl(draft.linkedin),
      photo_path: photoPath,
    };
  const changes = original
    ? Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== original[key as keyof SharedProfile]))
    : values;
  if (Object.keys(changes).length === 0) return loadSharedProfile(client);
  const { data, error } = await client
    .from("wall_profile")
    .update(changes)
    .eq("id", 1)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return profileFromRow({ id: 1, ...data });
}

export function isProfilePhotoPath(path: string): boolean {
  return PROFILE_IMAGE_PATH.test(path);
}

export function createProfilePhotoPath(file: Pick<File, "type">): string {
  const extension = PROFILE_IMAGE_EXTENSIONS[file.type];
  if (!extension) throw new Error("Choose a JPEG, PNG, or WebP photo.");
  return `profile/${crypto.randomUUID()}.${extension}`;
}

export async function uploadProfilePhoto(
  client: SupabaseClient<Database>,
  path: string,
  file: File,
): Promise<string> {
  const validationError = validatePostImage(file);
  if (validationError) throw new Error(validationError);
  if (!PROFILE_IMAGE_PATH.test(path)) throw new Error("The profile photo path is invalid.");
  const { data, error } = await client.storage
    .from(POST_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return data.path;
}

export function getProfilePhotoUrl(
  client: SupabaseClient<Database> | null,
  path: string | null,
): string | null {
  if (!client || !path || !isProfilePhotoPath(path)) return null;
  return client.storage.from(POST_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
