# Wall — implementation architecture

Status: Anthony approved the current three-column design and authorized
implementation on 2026-11-15. The supplied updated employer guide supersedes
earlier schema and environment names. Read alongside `docs/brief.md` and
`docs/design.html`; their older pending-approval wording does not revoke this
authorization. `PROJECT-WALL.md` remains unavailable, but the supplied briefs
and explicit proceed authorization are sufficient to continue. This document
does not execute SQL, configure accounts, or authorize publishing.

## Recommendation and trade-offs

Use one React 19/Next.js application with Tailwind CSS and shadcn/ui, deployed
to Vercel after publishing approval, and one Supabase `posts` table.
The browser reads and inserts through `@supabase/supabase-js` using a public
anonymous API key. Database constraints, column privileges, and RLS enforce the
write boundary. This avoids an unnecessary API route while meeting anonymous
posting and persistence requirements.

Display the fixed author **Anthony Mendoza** in the UI; do not add an author
column. The database generates the UUID and timestamp; a visitor supplies only
`body` and optionally `image_path`. Keep the nullable `user_id` unused and null. No authentication, likes, or comments are needed.

Fetch 50 messages initially for a small first request. Include **Load older**
to satisfy access to all messages, rather than treating 50 as a permanent cap.
All stored messages are public; the display limit is not an access restriction.

## Initial SQL — applied to Wall on 2026-11-15

Run this once as an authorized migration against the selected Supabase project.
It creates a new table and is not a script for modifying an existing one.

```sql
begin;

create table public.posts (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid,
  body text not null,
  created_at timestamptz not null default now(),
  constraint posts_body_length
    check (char_length(body) between 1 and 280),
  constraint posts_body_nonblank
    check (body ~ '[^[:space:]]')
);

create index posts_newest_idx
  on public.posts (created_at desc, id desc);

alter table public.posts enable row level security;

revoke all on table public.posts
  from public, anon, authenticated;

grant usage on schema public to anon;
grant select on table public.posts to anon;
grant insert (body) on table public.posts to anon;

create policy posts_public_read
  on public.posts for select to anon
  using (true);

create policy posts_public_insert
  on public.posts for insert to anon
  with check (true);

alter publication supabase_realtime add table public.posts;

commit;
```

Column permissions allow insertion of `body` only. Visitors cannot choose
`user_id`, UUID, or timestamp, or update/delete posts. RLS policies permit
anonymous reads and inserts; constraints also apply to direct API requests.
See [PostgreSQL grants](https://www.postgresql.org/docs/current/sql-grant.html)
and [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).

## Data and interface contract

- Read explicit columns `id, user_id, body, created_at`, ordered by
  `created_at DESC, id DESC`. The UUID provides a deterministic tie-breaker.
- Load older in batches of 50 using the oldest displayed `(created_at, id)`
  cursor: earlier timestamps, or the same timestamp and a smaller UUID. Avoid
  offset pagination because live inserts shift offsets. Deduplicate by UUID.
  An empty or short page ends pagination.
- Trim before insertion and validate 1–280 Unicode code points in the browser,
  matching database character counting. Insert only `{ body }` and request
  the returned row. Render through React text interpolation.
- Disable Share while posting. Clear the draft only after confirmed success;
  preserve it on failure. Do not automatically retry ambiguous write failures,
  because an earlier request may already have committed.
- Provide loading, empty, read-error, write-error, and pagination feedback;
  preserve keyboard access, labels, visible focus, and mobile layout.

## Realtime — required

Use one Postgres Changes subscription for `INSERT` on `public.posts`. Merge
returned and streamed rows by UUID, sort with the same two keys, and retain
loaded older messages. Subscribe before the initial fetch and merge its result
with received inserts, so an intervening event is not overwritten. Remove the
subscription on unmount.

After a disconnect, refetch the first page and reset pagination with visible
refresh feedback; Load older restores access to the rest. Realtime is required;
database retrieval remains the source of truth. Guard feed
requests against stale responses, including an older-page request crossing a
refresh. See [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## Environment and publishing

Use these names in ignored local environment configuration and, after approval,
the appropriate Vercel environment. Commit only placeholders in `.env.example`.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These values are browser-visible by design; RLS and grants protect data access.
No service-role key, secret key, or database password is needed in the app.
See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
Foundation and implementation approval are already recorded above. Anthony
must select/provide the Supabase project configuration before live integration
checks, and confirm publishing destinations and publishing approval before
external publication. Do not block local implementation on the missing file.

## Anonymous posting limitation

Anyone can bypass the interface and repeatedly submit valid messages. Length
constraints and RLS do not prevent spam, offensive content, or usage growth;
a frontend cooldown cannot enforce a security boundary. The fixed author is
a display convention, not evidence that Anthony wrote a message.

For a bounded assessment, document this limitation for Anthony's acceptance.
If public abuse resistance becomes a requirement, replace direct anonymous
inserts with a protected server write endpoint, bot verification, and enforced
rate limits, then revoke anonymous insert access. That is an additional scope
decision, not part of the approved assessment implementation.

## Verification criteria — all unexecuted

1. Insert a real message using the public client; verify persistence after
   refresh, server defaults, and descending timestamp/UUID order.
2. Verify empty, whitespace-only, and 281-character messages fail through both
   UI and direct API requests; verify 280 code points succeeds, including emoji.
3. Verify explicit client user_id/UUID/timestamp values fail, accepted inserts
   retain null user_id, and anonymous update/delete requests fail. Test with
   the public client, not an admin key. Verify the fixed UI author label.
4. With more than 50 rows, load older through every row without duplicates or
   missing equal-timestamp records; repeat while another browser inserts.
5. Verify a second browser receives inserts, own submissions appear once, and
   reconnect/initial-fetch races do not leave a stale feed.
6. Verify network failures preserve drafts, expose retry feedback, and do not
   cause automatic duplicate writes. Verify HTML-like messages display as text.
7. Check keyboard/mobile behavior and run appropriate type, lint, meaningful
   tests, and production build checks after implementation.
8. Inspect tracked files and browser assets for secret credentials. Only after
   publishing approval, verify the production URL and submission evidence.

## Concise learning handoff

Concepts: database defaults, RLS, column privileges, stable ordering,
and cursor pagination. Understanding is unassessed. Independent challenge:
demonstrate with direct public API requests that a visitor cannot supply
user_id or timestamp. This specification is review evidence, not a completed
implementation or a passed security test.

## Approved image/profile extension — 2026-11-15

Anthony approved optional post photos and owner-managed profile sections after confirming no login is needed. This supersedes the owner-sign-in recommendation in the planning document. Keep a 1–280-code-point caption, one optional JPEG/PNG/WebP up to 2 MiB, and the same deterministic feed/pagination/Realtime behavior. Add nullable image_path and its narrow INSERT grant through an additive migration; never rerun the initial migration.

Use public wall-images Storage with bucket-enforced limits and anonymous INSERT only for posts/<uuid>.(jpg|png|webp). No anonymous list/overwrite/delete or profile writes. Keep database/Storage RLS. A public image URL is public data. Anonymous uploads can consume free quotas; no paid upgrades or image transformations are authorized. HAKDOGINS was verified as plan free/tier_free and project Storage was empty before this change.

Upload only on Share; preserve text/file on failures, reuse a confirmed uploaded path for an explicit retry, never automatically retry an ambiguous write. Unreferenced uploads can remain after failed posts: owner cleanup must use the Storage dashboard/API after comparing paths and a 24-hour safety window, never SQL deletion from storage.objects.

The owner edits profile photo/About/Skills/Links in src/lib/profile.ts and local public assets. There is no browser profile editor or profile write policy. Empty profile sections must be honest; do not fabricate personal information. This prevents visitors from changing the profile without introducing login.

## Panel placement correction

Anthony specified profile information on the left, Wall composer/feed in the center, and Notifications on the right. On narrow screens keep the feed first, then the complete profile, then notifications. The notifications panel currently reserves the requested space with an honest empty state; no notification backend or fabricated activity is introduced.

## Shared profile editor — latest approved decision

After requesting a separate Profile page, Anthony explicitly chose anyone-can-edit with no login. This supersedes earlier owner-only/source-config profile decisions. Use one public wall_profile row (id=1) with display_name, about, comma-separated skills, website/github/linkedin HTTPS links and optional profile photo_path. Defaults contain no invented biography. Enable RLS; grant anon SELECT and UPDATE only these seven profile columns on id=1. No anonymous INSERT, DELETE, or id updates. This permission change affects only the shared profile; post protections remain intact.

The /profile page clearly says anyone can edit this shared profile. Saves affect everyone's displayed profile; there is no personal identity or owner authority implied. Profile image uploads use fresh profile/<uuid>.(jpg|png|webp) objects in wall-images with the same 2-MiB and MIME restrictions. Anonymous overwrite/list/delete remain denied. Failed saves preserve input and a confirmed upload path for explicit retry. A refreshed Wall retrieves the saved shared profile. No login, paid services or publication.

Migration 20261115120002_add_shared_profile.sql was applied after the post-image migration. CLI-generated additive files were ordered immediately after the prepared initial migration because its timestamp was later than the current clock.

## Profile navigation refinement

Clicking the shared profile name in the left sidebar opens /profile as a view-first page. It uses the Wall header and three-column shell, showing all profile details before editing. Edit profile opens /profile/edit within the same shell. Everyone may still edit without login; database and Storage permissions are unchanged. Preserve save-error protection, photo handling and refreshed shared-profile reads.

## Avatar photo controls

In /profile/edit, clicking the avatar/camera badge opens Upload photo and Take photo options beside the avatar, replacing the lower-form photo controls. Camera acquisition occurs only after Take photo and browser permission; capture creates a local JPEG at bounded resolution. All selection/removal stays local until Save shared profile. Stop camera tracks on capture, cancel and unmount, including late permission-resolution races. Permission/availability errors preserve the existing photo and offer file upload. No schema, Storage permissions, paid features or publication changes.

## Growing profile fields

All six editor text fields wrap and grow vertically with their content; short fields start compact. Growth is capped near 320px with internal vertical scrolling for long entries and manual vertical resizing. Show Unicode-code-point counters and preserve database-aligned limits (name80, About1000, skills500, each HTTPS link500). Do not silently truncate inputs or use UTF-16 maxlength to reject otherwise valid Unicode. The underlying profile data contract is unchanged.

## Profile reference layout refinement

Anthony supplied a Facebook profile reference and removed the three-column requirement for profile routes. The main Wall retains its existing three panels. Profile routes use a centered wide layout without the left identity/right notifications panels. The profile view has a decorative cover area, large avatar/name/Edit profile header and two columns below: personal details and the existing shared Wall composer/feed. No cover-image upload, social metrics or inactive social features are added. The editor uses paired short fields on wider screens, full-width About/Website fields, and one column on mobile. Textareas resize when their width changes as well as when content changes. Data, RLS and Storage behavior remain unchanged.

## Responsive page height

Use the body viewport-height flex layout to distribute spare height to page columns, with a natural-flow footer and a consistent bottom gutter. Desktop panels and profile detail/feed columns stretch to the same available bottom edge. Form fields and post rows retain natural content height. Narrow layouts stack without fixed screen heights, clipping, or forced nested page scrolling.

## Header hierarchy

Use a brand group, centered Wall/Profile/About navigation, and a separate Notifications action linked to the existing Wall notifications section. The About page explains actual posting, public visibility and shared editing behavior. Mobile puts navigation below the brand/actions row. No unread counts or inactive destinations are fabricated.

## Profile-photo crop consistency

Uploads and camera captures open a native modal crop step before replacing the pending profile photo. Zoom and horizontal/vertical controls position a square source region, displayed through a circular mask matching avatar presentation. Export that exact preview canvas as a 512x512 PNG and use that same file for the pending preview and Storage upload; every avatar displays the resulting square without another crop. PNG preserves alpha and avoids a second lossy encode. Source files keep the existing type/2-MiB checks. Cancelling keeps the previous photo, and saving the profile remains explicit. No schema or Storage-policy changes.

## Direct crop manipulation

Replace position/zoom sliders with direct mouse/touch dragging of the photo and compact minus/plus zoom buttons. Pointer capture keeps a drag active at crop boundaries; clamping prevents blank edges. Keyboard users can focus the preview and use arrows (Shift for larger steps). Crop rendering/export still uses the same canvas/PNG contract.

## Profile editing feedback and confirmations

Paired textareas share the larger content-derived height, with the same compact initial size; mobile fields grow independently. Photo choices use compact menu actions, with a separated destructive Remove photo action. Removal opens a confirmation dialog and remains a pending change until Save. Dirty internal-link navigation opens a discard confirmation; refresh/tab closing use the browser-native unsaved-change prompt. Saves redirect directly to a fresh /profile read and display a dismissible six-second success notification; the temporary URL flag is removed after display. Normal saves and crop adjustments do not require redundant confirmation.

## Approved anonymous post interactions and live profile

Anthony approved anonymous likes and comments beyond Test2, with Realtime throughout. `post_likes` and `post_comments` stay RLS protected; counts use a `security_invoker` view. Post/comment text stays in Supabase, never browser storage. A random per-tab visitor id is not authentication or proof of a unique person.

Likes now toggle with token-checked `like_post_with_capability`/`unlike_post_with_capability` RPCs. An unguessable per-post secret stays in sessionStorage; a private RLS-protected table stores only its SHA-256 hash. Public table INSERT/DELETE is revoked for likes; no capability means no unlike, so likes made before this migration remain visible but cannot be removed. Realtime DELETE events refresh loaded counts.

New UI-created posts receive a separate random delete capability. `create_post_with_delete_capability` atomically inserts a new post and its hash record; it accepts no caller-supplied post ID. `delete_post_with_capability` deletes only the post matching both ID and capability hash. Its private table has RLS and no browser grants; public posts DELETE stays denied. The token stays in browser localStorage without post content. Clearing that storage loses access; posts created before capabilities cannot be claimed. Post deletion cascades its likes/comments; an attached Storage object remains for owner cleanup rather than using unsafe direct SQL deletion.

Comment and long-caption **See more** actions open one native responsive post dialog. Feed captions collapse after 160 code points or four lines; the detail view displays the full text and live comments. A shared feed activity subscription refreshes counts and delivers comments to open panels; reconnects recover counts/comments and verify the selected post. Comments paginate in stable timestamp/UUID order, deduplicate own/streamed returns, preserve drafts on failure and never automatically retry writes. The post-level Share action was removed; the direct `/post/<id>` route remains for existing links. Profile UPDATE events refresh one shared client context without overwriting dirty editor drafts. Realtime includes posts, likes, comments and profile updates.

Replace the post-success green message and connected Live badge with relative post/comment timestamps; preserve visible error/disconnection recovery. Profile Save retains its separately requested success toast. Private messaging is not required by Test2 and is not included. Organization remains Free; no publication or paid changes authorized.

## Capability-protected caption edits — 2026-11-15

Migration `20261115120006_edit_post_with_capability.sql` adds one narrow anonymous edit RPC. It validates the same nonblank 1–280 code-point caption rule and updates only `posts.body` when the post ID matches the SHA-256 hash of the browser-held deletion capability. It leaves the generated ID, `created_at`, `image_path` and all other columns untouched, returns no row on a failed capability check, and grants RPC execution only to anon. RLS stays enabled and direct table UPDATE remains denied. The client never stores the post text in browser storage; successful caption edits are broadcast through the existing posts Realtime stream.

## Approved production hosting — 2026-11-15

Anthony authorized a private GitHub repository `hakdogins27/wall`, production Vercel hosting on the existing Hobby team, and the free `wall-anthony.vercel.app` domain. Git pushes to main deploy automatically. Vercel receives only the public Supabase URL/publishable key; local environment files, Vercel linkage and credentials stay ignored. Pin Node to >=22.20.0 <23: an unbounded >= range caused Vercel to override the22.x project setting with26.x in the first production build. Localhost capability storage does not automatically migrate across origins.
