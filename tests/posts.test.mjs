import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  countCharacters,
  createPost,
  createPostImagePath,
  isPostImagePath,
  loadLatestPosts,
  loadOlderPosts,
  mergePosts,
  PAGE_SIZE,
  validatePostBody,
  validatePostImage,
} from "../src/lib/posts.ts";
import { editPostWithToken } from "../src/lib/post-deletion.ts";
import {
  createProfilePhotoPath,
  DEFAULT_SHARED_PROFILE,
  isProfilePhotoPath,
  loadSharedProfile,
  loadSharedProfileOrDefault,
  profileSkills,
  saveSharedProfile,
  validateProfileDraft,
} from "../src/lib/profile.ts";

function post(id, created_at, body = id) {
  return { id, user_id: null, body, image_path: null, created_at };
}

function mockPublicClient(response, status = 200) {
  const requests = [];
  const client = createClient("https://wall-test.supabase.co", "test-public-key", {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push({
          url: new URL(request.url),
          method: request.method,
          body: await request.text(),
          apiKey: request.headers.get("apikey"),
        });
        return new Response(JSON.stringify(response), {
          status,
          headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
        });
      },
    },
  });
  return { client, requests };
}

async function withBrowserStorage(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, dispatchEvent() {} } });
  try { return await run(values); }
  finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  }
}

test("validation counts Unicode code points and enforces the 280 character limit", () => {
  assert.equal(countCharacters("😀"), 1);
  assert.equal(countCharacters("👨‍👩‍👧‍👦"), 7);
  assert.equal(validatePostBody("  \n\t "), "Write something before sharing.");
  assert.equal(validatePostBody("😀".repeat(280)), null);
  assert.equal(validatePostBody("😀".repeat(281)), "Posts can be up to 280 characters.");
});

test("feed merge uses UTC instants, PostgreSQL microseconds, then UUID descending", () => {
  const earlierMicrosecond = post("00000000-0000-0000-0000-000000000001", "2026-05-01 10:00:00.123456+0000");
  const laterMicrosecond = post("00000000-0000-0000-0000-000000000002", "2026-05-01T12:00:00.123457+02:00");
  const sameInstant = post("00000000-0000-0000-0000-000000000003", "2026-05-01T10:00:00.123457Z");

  assert.deepEqual(
    mergePosts([earlierMicrosecond, laterMicrosecond], [sameInstant]).map(({ id }) => id),
    ["00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000001"],
  );

  const equalTimeLowId = post("00000000-0000-0000-0000-000000000010", "2026-05-01T10:00:00.123456Z");
  const equalTimeHighId = post("00000000-0000-0000-0000-000000000011", "2026-05-01T12:00:00.123456+02:00");
  assert.deepEqual(
    mergePosts([equalTimeLowId], [equalTimeHighId]).map(({ id }) => id),
    [equalTimeHighId.id, equalTimeLowId.id],
  );
});

test("latest feed request selects explicit columns in deterministic pages of 50", async () => {
  const row = post("00000000-0000-0000-0000-000000000001", "2026-05-01T10:00:00.123456+00:00");
  const { client, requests } = mockPublicClient([row]);

  assert.deepEqual(await loadLatestPosts(client), [row]);
  assert.equal(PAGE_SIZE, 50);
  assert.equal(requests[0].url.pathname, "/rest/v1/posts");
  assert.equal(requests[0].url.searchParams.get("select"), "id,user_id,body,image_path,created_at");
  assert.equal(requests[0].url.searchParams.get("order"), "created_at.desc,id.desc");
  assert.equal(requests[0].url.searchParams.get("limit"), "50");
  assert.equal(requests[0].apiKey, "test-public-key");
});

test("older page query uses a stable timestamp and UUID cursor", async () => {
  const { client, requests } = mockPublicClient([]);

  await loadOlderPosts(client, {
    id: "00000000-0000-0000-0000-000000000010",
    created_at: "2026-05-01T10:00:00.123456+00:00",
  });

  const query = requests[0].url.searchParams.get("or");
  assert.match(query, /created_at\.lt\.2026-05-01T10:00:00\.123456\+00:00/);
  assert.match(query, /created_at\.eq\.2026-05-01T10:00:00\.123456\+00:00/);
  assert.match(query, /id\.lt\.00000000-0000-0000-0000-000000000010/);
  assert.equal(requests[0].url.searchParams.get("order"), "created_at.desc,id.desc");
  assert.equal(requests[0].url.searchParams.get("limit"), "50");
});

test("post creation trims text and binds a random delete capability in one RPC", async () => {
  const row = post("00000000-0000-0000-0000-000000000001", "2026-05-01T10:00:00.123456+00:00", "hello");
  await withBrowserStorage(async (values) => {
    const { client, requests } = mockPublicClient([row]);
    const token = "a".repeat(64);
    assert.deepEqual(await createPost(client, "  hello  ", undefined, token), row);
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].url.pathname, "/rest/v1/rpc/create_post_with_delete_capability");
    assert.deepEqual(JSON.parse(requests[0].body), { p_body: "hello", p_image_path: null, p_delete_token: token });
    assert.equal(values.get(`wall:post-delete:${token}`), row.id);
  });
});

test("post edits validate Unicode length and update only caption through the owner capability RPC", async () => {
  const id = "00000000-0000-0000-0000-000000000001";
  const imagePath = "posts/00000000-0000-0000-0000-000000000002.png";
  const row = { ...post(id, "2026-05-01T10:00:00.123456+00:00", "updated"), image_path: imagePath };
  const { client, requests } = mockPublicClient([row]);

  assert.deepEqual(await editPostWithToken(client, id, "d".repeat(64), "  updated  "), row);
  assert.equal(requests[0].url.pathname, "/rest/v1/rpc/edit_post_with_capability");
  assert.deepEqual(JSON.parse(requests[0].body), { p_post_id: id, p_delete_token: "d".repeat(64), p_body: "updated" });
  await assert.rejects(editPostWithToken(client, id, "d".repeat(64), " \n "), /Write something/);
  await assert.rejects(editPostWithToken(client, id, "d".repeat(64), "😀".repeat(281)), /280 characters/);
  assert.equal(requests.length, 1);
});

test("post images accept only supported types, size, and generated storage paths", () => {
  assert.equal(validatePostImage({ type: "image/jpeg", size: 2 * 1024 * 1024 }), null);
  assert.equal(validatePostImage({ type: "image/png", size: 1 }), null);
  assert.match(validatePostImage({ type: "image/gif", size: 1 }), /JPEG, PNG, or WebP/);
  assert.match(validatePostImage({ type: "image/jpeg", size: 2 * 1024 * 1024 + 1 }), /2 MB or smaller/);

  const path = createPostImagePath({ type: "image/webp" });
  assert.match(path, /^posts\/[0-9a-f-]+\.webp$/);
  assert.equal(isPostImagePath(path), true);
  assert.equal(isPostImagePath("profile/00000000-0000-0000-0000-000000000001.jpg"), false);
  assert.equal(isPostImagePath("posts/../../profile.jpg"), false);
});

test("image posts send only the caption and an approved image path", async () => {
  const imagePath = "posts/00000000-0000-0000-0000-000000000001.png";
  const row = { ...post("00000000-0000-0000-0000-000000000002", "2026-05-01T10:00:00.123456+00:00", "hello"), image_path: imagePath };
  await withBrowserStorage(async () => {
    const { client, requests } = mockPublicClient([row]);
    assert.deepEqual(await createPost(client, "  hello  ", imagePath, "b".repeat(64)), row);
    assert.deepEqual(JSON.parse(requests[0].body), { p_body: "hello", p_image_path: imagePath, p_delete_token: "b".repeat(64) });
  });

  const invalid = mockPublicClient(row);
  await assert.rejects(createPost(invalid.client, "hello", "https://example.com/image.png"), /image path is invalid/);
  assert.equal(invalid.requests.length, 0);
});

test("shared profile validation enforces lengths, HTTPS links, and unique skills", () => {
  const draft = {
    displayName: "Wall visitor",
    about: "A short shared introduction.",
    skills: "React, TypeScript",
    website: "https://example.com",
    github: "",
    linkedin: "https://linkedin.com/in/example",
  };
  assert.equal(validateProfileDraft(draft), null);
  assert.match(validateProfileDraft({ ...draft, displayName: "  " }), /display name/);
  assert.match(validateProfileDraft({ ...draft, displayName: "x".repeat(81) }), /80 characters/);
  assert.match(validateProfileDraft({ ...draft, about: "x".repeat(1001) }), /1,000 characters/);
  assert.match(validateProfileDraft({ ...draft, skills: "x".repeat(501) }), /500 characters/);
  assert.match(validateProfileDraft({ ...draft, website: "http://example.com" }), /HTTPS URL/);
  assert.match(validateProfileDraft({ ...draft, website: "javascript:alert(1)" }), /HTTPS URL/);
  assert.deepEqual(profileSkills(" React, TypeScript, React, , "), ["React", "TypeScript"]);
});

test("shared profile reads and updates only singleton profile fields", async () => {
  const row = {
    id: 1,
    display_name: "Wall visitor",
    about: "A short shared introduction.",
    skills: "React, TypeScript",
    website: "https://example.com/",
    github: null,
    linkedin: null,
    photo_path: null,
  };
  const reader = mockPublicClient(row);
  assert.deepEqual(await loadSharedProfile(reader.client), {
    display_name: row.display_name,
    about: row.about,
    skills: row.skills,
    website: row.website,
    github: row.github,
    linkedin: row.linkedin,
    photo_path: row.photo_path,
  });
  assert.equal(reader.requests[0].url.pathname, "/rest/v1/wall_profile");
  assert.equal(reader.requests[0].url.searchParams.get("select"), "display_name,about,skills,website,github,linkedin,photo_path");
  assert.equal(reader.requests[0].url.searchParams.get("id"), "eq.1");

  const writer = mockPublicClient(row);
  await saveSharedProfile(writer.client, {
    displayName: "Wall visitor",
    about: "A short shared introduction.",
    skills: "React, TypeScript",
    website: "https://example.com",
    github: "",
    linkedin: "",
  }, null);
  assert.equal(writer.requests[0].method, "PATCH");
  assert.equal(writer.requests[0].url.pathname, "/rest/v1/wall_profile");
  assert.equal(writer.requests[0].url.searchParams.get("id"), "eq.1");
  assert.deepEqual(JSON.parse(writer.requests[0].body), {
    display_name: "Wall visitor",
    about: "A short shared introduction.",
    skills: "React, TypeScript",
    website: "https://example.com/",
    github: null,
    linkedin: null,
    photo_path: null,
  });

  const invalid = mockPublicClient(row);
  await assert.rejects(saveSharedProfile(invalid.client, {
    displayName: "Wall visitor",
    about: "",
    skills: "",
    website: "http://example.com",
    github: "",
    linkedin: "",
  }, null), /HTTPS URL/);
  assert.equal(invalid.requests.length, 0);
});

test("shared profile page loader falls back visibly on read failures", async () => {
  const fallback = mockPublicClient({ message: "not available" }, 503);
  assert.deepEqual(await loadSharedProfileOrDefault(fallback.client), {
    profile: DEFAULT_SHARED_PROFILE,
    error: true,
  });

  const loaded = {
    display_name: "Shared Wall",
    about: "",
    skills: "",
    website: null,
    github: null,
    linkedin: null,
    photo_path: null,
  };
  const success = mockPublicClient({ id: 1, ...loaded });
  assert.deepEqual(await loadSharedProfileOrDefault(success.client), {
    profile: loaded,
    error: false,
  });
});

test("profile photos use only random paths in the profile namespace", () => {
  const path = createProfilePhotoPath({ type: "image/png" });
  assert.match(path, /^profile\/[0-9a-f-]+\.png$/);
  assert.equal(isProfilePhotoPath(path), true);
  assert.equal(isProfilePhotoPath("posts/00000000-0000-0000-0000-000000000001.png"), false);
});

test("invalid posts never reach Supabase and failed writes stay rejected", async () => {
  const rejected = mockPublicClient({ message: "write denied" }, 403);
  await assert.rejects(createPost(rejected.client, " \n "), /Write something/);
  await assert.rejects(createPost(rejected.client, "x".repeat(281)), /280 characters/);
  assert.equal(rejected.requests.length, 0);

  await withBrowserStorage(async () => {
    const denied = mockPublicClient({ message: "write denied" }, 403);
    await assert.rejects(createPost(denied.client, "valid text", undefined, "c".repeat(64)));
    assert.deepEqual(JSON.parse(denied.requests[0].body), { p_body: "valid text", p_image_path: null, p_delete_token: "c".repeat(64) });
  });
});
