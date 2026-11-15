# Local and Supabase setup

## Requirements

- Node.js 22.20.0 and npm 10.9 or newer.
- A Supabase project selected by the owner.

## Prepare the database

1. Open the selected Supabase project's SQL Editor.
2. On a new project, review and run all seven SQL files in `supabase/migrations` in filename order. They create posts, restricted image Storage, the shared profile, interactions and capability-protected post edit/removal. All exposed tables keep RLS enabled.
3. Confirm the SQL completed before starting the app. Do not rerun it on a project where `public.posts` already exists without first reviewing that database.

The prepared migration was applied on 2026-11-15 to the owner-approved Wall project (`cykohtqakrzndsmnokxi`), under HAKDOGINS in Singapore. Supabase quoted $0/month; no paid upgrades or features were enabled. RLS remains enabled. Anonymous post inserts allow only body and optional image_path; profile updates allow only its seven editable fields. The table is included in `supabase_realtime`. Do not rerun the migration on this project.

## Configure the app

1. In the Supabase dashboard, copy the project's URL and its public anon or publishable key.
2. From the project root, run `cp .env.example .env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
4. Start the app with `npm ci` and `npm run dev`, then open <http://localhost:3000>.

The variable name retains `ANON_KEY` for the supplied guide; a current publishable key is accepted there too. These values are visible to the browser. Never use a service-role/secret key or database password in this app. The environment file is ignored by Git; only placeholders belong in `.env.example`.

## Check the connection

- The feed should load from Supabase, with newest posts first.
- Share a short post, refresh the page, and confirm it persists.
- Open Wall in a second browser context and confirm a new post appears without refreshing.
- With more than 50 rows, use **Load older posts** and check for duplicates or missing equal-time rows.
- Confirm whitespace-only and 281-code-point posts fail, while 280 code points succeed.
- Use the public key to confirm direct table update/delete are denied and inserts cannot supply `id`, `user_id` or `created_at`. Post removal works only through the matching unguessable capability.

Automated tests mock the Supabase client's HTTP transport. Live posting, reload persistence, cross-browser Realtime and public-client permission checks also passed on 2026-11-15; see `docs/qa-report.md`. `.env.local` contains only the project URL and public publishable key. The app has not been published.

## Optional photos

The owner approved photo attachments without login. Migration `20261115120001_add_post_images.sql` was applied after the initial posts migration. On a new project apply all seven migrations in order. It adds only nullable image_path, its INSERT column grant, and the wall-images public bucket with a restricted anonymous INSERT policy. Never rerun an applied migration on an existing database without inspecting it.

A post still requires 1–280 text code points. Attach one JPEG, PNG or WebP up to 2 MiB; files upload only when Share is pressed. Photos are public. Visitors cannot list, replace or delete stored objects. Profile photos use a separately permitted profile/ folder.

HAKDOGINS was verified on plan free/tier_free before enabling uploads, with 0 stored bytes in this project. No paid upgrades, add-ons or image transformations were enabled. Anonymous uploads may exhaust free quotas; upload errors preserve the draft rather than upgrading the plan. Monthly organization egress totals are not exposed by the available connector; review Usage in the Supabase dashboard before publishing.

A failed post or profile save, or deleting a post with a photo, may leave an unreferenced uploaded file. Compare exact Storage paths with posts.image_path and wall_profile.photo_path, wait at least 24 hours, then remove confirmed orphans using Storage dashboard/API. Do not delete storage.objects rows via SQL. Browser anonymous permissions intentionally do not allow cleanup.

Current official Free quotas: [1 GB Storage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size) and [5 GB uncached / 5 GB cached egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), shared at organization level. Free quota excess can restrict service; no paid overage upgrade is configured.

## Shared Profile editor

Anthony subsequently chose a public shared editor without login. Apply all seven migrations in filename order for a new project. `20261115120002_add_shared_profile.sql` adds the RLS-protected singleton profile row and profile-image INSERT permission.

Click the profile name on the left to open `/profile` and view all details. Select Edit profile to open `/profile/edit`. Anyone may save the shared name, photo, About, comma-separated skills and HTTPS links; changes affect every visitor. All edits are public; there is no owner-only editor, private profile, or visitor account. The main Wall shows profile information on the left and a Notifications placeholder on the right. Profile pages use a wide profile header and personal-details/feed layout. The editor uses two columns on wider screens and one on phones.

To change the profile picture in the editor, click the avatar/camera badge. Choose Upload photo or Take photo, then Save shared profile. Camera capture requires browser permission and a secure context (HTTPS, or localhost during development). Upload remains available if camera access is unavailable.

Editor text fields wrap and expand vertically as you type, with visible character counts; long entries scroll inside the field after the height cap. Save validates the same existing limits.

The header links to Wall, Profile and About, with a separate Notifications action. Short pages fill the available viewport above the natural-flow footer; long pages scroll normally.

After uploading or taking a profile photo, drag the image to position it and use the minus/plus buttons to zoom, then choose Use photo. Save shared profile uploads the same cropped PNG shown in the preview. Cancel crop keeps the previous photo.

Paired editor fields stay equal in height as their contents grow. Photo removal is a compact menu action with confirmation and remains pending until Save. Saving opens the profile automatically with a temporary success message. Leaving through app links with unsaved edits asks for confirmation; browser Back/refresh/tab close use the native leave-page warning.

## Post interactions and editing

Comment and long-caption **See more** open the full post in a responsive modal. Long feed captions show a preview; the modal contains the full text and live comments. Comments remain public and limited to 280 characters. Like toggles to **Unlike** for posts liked with a token saved in this browser tab. Older likes without a token remain visible but cannot be removed. The post-level Share action is removed; the composer’s **Share** button still publishes a post.

**Edit post** and **Delete post** are available only for posts created with this browser capability. Edit validates 1–280 code points and changes only the caption through `edit_post_with_capability`; the post ID, timestamp and image stay unchanged. Both edit and delete require the same unguessable per-post token stored in this browser’s localStorage. The database stores only its hash in a private RLS-protected table; direct table UPDATE/DELETE remain denied, and edits sync to connected feeds in Realtime. Existing posts without capabilities cannot be edited or deleted. Clearing browser storage loses those capabilities. Deleting a post cascades comments and likes but leaves its public image object for owner cleanup.
