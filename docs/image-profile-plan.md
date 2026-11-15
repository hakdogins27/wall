# Images and profile sections — proposal

Status: superseded by approval on 2026-11-15 of the no-sign-in, owner-configured profile option; no app, schema, Storage, or Auth changes made. Anthony requested post images, a profile picture, and additional profile sections. Anthony selected owner-only profile editing; adding owner sign-in is recommended and still needs approval. Publishing and paid services remain unauthorized.

## Recommended scope

Keep anonymous public Wall posting and the fixed shared display name. Add one optional image per post, a profile photo, and About, Skills, and Links sections. Retain the required 1–280-code-point text caption so existing text-only posts and validation continue to work. Do not invent Anthony's biography, skills, links, or photograph; show an honest empty state until provided.

Only Anthony should change a profile presented as his. A public browser key cannot distinguish Anthony from another visitor. Recommend the owner editor below. The alternatives explain its trade-off:

- **Owner editor:** Add Supabase sign-in for Anthony only, with profile writes restricted by his provisioned auth UUID. Disable open signup; there is no user-account/profile system for visitors. This fulfills an in-app profile-photo upload control, but adds Auth and owner provisioning.
- **No sign-in:** Anthony supplies the photo/details through the developer or Supabase dashboard; the app only displays them. This is smaller but does not provide an owner-only upload button in the app.
- **Shared demo:** Anyone may change the photo/details. Only acceptable if Anthony explicitly chooses this and the interface clearly calls it a shared demo profile, rather than implying Anthony controls it.

## Post image contract

Add nullable `image_path text` to `posts` using a new additive migration; do not rerun the initial migration. Allow only `posts/<random-uuid>.(jpg|png|webp)` paths, never arbitrary external URLs. Derive the public URL from the configured Supabase project and fixed bucket. Existing rows stay null.

Keep existing anonymous SELECT/INSERT RLS, body constraints, generated UUID/timestamp, unused null user_id, and denied anonymous UPDATE/DELETE. Extend the insert column grant narrowly from `body` to `body, image_path`; this is a reviewed permission expansion for attachments, not permission to supply protected columns. Keep the original migration unchanged. Do not use a separate anonymously writable attachment table: visitors could attach images to somebody else's existing post.

Extend explicit post columns and types in `src/lib/posts.ts` and `src/lib/database.types.ts`; retain timestamp/UUID ordering, cursor pagination, and UUID merging in `src/components/wall-feed.tsx`. Realtime INSERT payloads include the new column; no new subscription is needed.

## Storage and upload flow

Use one public `wall-images` Storage bucket. Proposed per-file limit: 2 MiB; allowed MIME types: JPEG, PNG, WebP. No SVG, GIF, video, transformations, or extra upload dependency. Bucket-enforced MIME/size restrictions are required, alongside client checks and a preview. MIME declarations alone do not prove file content is safe; public anonymous media retains abuse risk.

Storage object RLS permits anonymous INSERT only in the `posts/` namespace with the expected random filename. No anonymous SELECT/list, UPDATE, DELETE, copy/move, or upsert permissions. Public asset retrieval remains possible by URL regardless of object SELECT policy. Do not treat a random path as proof of user ownership. Owner profile images use a separate `profile/` namespace; anonymous writes there are denied. In the owner-editor option, only Anthony's auth UUID may insert there. Use fresh object names rather than overwriting cached photos.

Choose a file locally and preview it with an object URL; upload only on Share. Use a fresh UUID filename and `upsert: false`, then insert `{ body, image_path }`. Disable repeat submits through upload plus database insertion. Clear draft/selection only after a confirmed post; revoke preview URLs when replaced or unmounted. Preserve draft and report failures. Text-only posting bypasses upload entirely.

Upload and database insertion are separate operations. A failed or ambiguous insert can leave an orphan; do not automatically retry a write or delete an object after an ambiguous result. Keep its path for explicit retry in that page session. No new anonymous delete privilege should be added merely for cleanup. Anthony can periodically list objects and remove unreferenced objects older than 24 hours using the Storage API/dashboard after comparing exact paths against posts/profile. Do not delete storage.objects rows using SQL; that would not safely remove the underlying file. Cleanup automation is deferred until actual usage justifies it.

## Profile data and permissions

For owner editing, add a single shared-profile row with bounded About text, a short skills list, bounded HTTPS links, and nullable profile image path. Enable RLS; anonymous visitors may SELECT, only Anthony's provisioned UUID may UPDATE. No visitor INSERT or DELETE. Validate links in both UI and database and render text through React. New owner state must not turn Wall requests into authenticated-role requests accidentally: the existing posts policies grant only anon access. Keep the Wall public client anonymous and use a separate Auth client for the owner editor. Do not solve this by granting all authenticated users profile writes or weakening posts policies.

Profile Auth configuration, owner provisioning, session storage behavior, and the exact migration/RLS must be reviewed after the ownership choice. Do not put an admin secret or password in browser code. For dashboard-managed profile details, no Auth client or browser write policies are needed.

## Free-only and approval boundary

The project was created with a $0/month quote. That quote is not proof of current organization billing settings or a lifetime cost guarantee. Before Storage changes, verify the project is on Free, inspect current storage/egress usage and current limits, and enable no paid upgrade/add-on. If billing state cannot be verified, report that dependency before enabling uploads. On quota exhaustion, stop accepting uploads and show an error; do not propose automatic upgrades. Anonymous upload policies cannot enforce a reliable per-person quota and can consume available storage/egress. A frontend cooldown is not an abuse control.

Anthony selected owner-only profile editing. Approval is still needed for the Auth addition and the concrete Storage/schema permission expansion above. His image request supersedes the old no-upload product scope, but does not approve public profile edits, spending, or publication. Update `AGENTS.md`, `docs/architecture.md`, setup records, and the UI reference after acceptance so those contracts agree.

## Implementation and verification handoff

Mark should change only the additive migration, post types/helpers/feed, focused image controls, profile components, and existing CSS/docs/tests needed for this scope. Add no unrelated social features. Reuse installed Supabase and UI code.

Required checks: text-only post regression; valid image posting and reload persistence; second-browser Realtime with image appearing once; rejected oversized/disallowed uploads; direct API denial of protected columns, overwrite/delete and profile edits by anon/non-owner; draft preservation on upload and post failures; no automatic duplicate writes; accessible file label, Remove image control and meaningful image alternative text; mobile layout; existing pagination with mixed image/text rows. Run lint, typecheck, tests and build. Inspect live RLS/Storage policies and security advisors. Remove only recorded test objects/rows. No live checks or app tests were executed for this planning-only task.

References checked: [public bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control), [bucket limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [billing model](https://supabase.com/docs/guides/platform/billing-on-supabase).

Final owner decision: no login. Implement the no-sign-in profile option and optional visitor post uploads. Auth and public profile editing are excluded. See docs/architecture.md for the approved extension.

Subsequent explicit decision: separate /profile editor, no login, anyone can edit the shared profile. This supersedes both owner-only alternatives. Implementation contract and permission limits are recorded in docs/architecture.md.
