# Functional QA report

Date: 2026-11-15

## Environment

- Ran Chrome through Playwright 1.65.1 with isolated profiles under `/private/tmp/wall-qa/`.
- Configured UI checks used a temporary project copy and Next.js dev server with Webpack. A fake local Supabase URL/key was used; Playwright intercepted REST and attempted a Realtime WebSocket fixture. No Supabase project was contacted.
- No Git checkout was present. The tested copy used CSS SHA-256 `914c17321f6b055e9cccbcf675bd54093a08c4bb940b3794bd3f0972c7c0745e` and pre-fix `wall-feed.tsx` SHA-256 `b2ef65c792b3b5b544e3155c3feba997e193ed980d93aff481e62e3a23ac2d99`.

## Executed results

- **Pass — ordering/query shape (mock):** Equal-timestamp rows rendered by descending UUID. The initial request selected the explicit post columns, ordered by `created_at.desc,id.desc`, and limited results to 50.
- **Pass — keyboard focus:** Tab reached the Wall home link, then the labeled composer; the textarea referenced its hint and character counter.
- **Pass — validation (mock):** Whitespace-only and 281-emoji drafts were blocked without POSTs. A 280-emoji draft was accepted, sent as `{ body }`, and cleared after the mock returned success.
- **Pass — mock insert:** A valid boundary-length post sent only `{ body }`, returned success, and displayed once. A mock Realtime event was also configured, but the harness did not separately assert that subscription handshake/delivery occurred, so realtime deduplication is unverified.
- **Pass — write recovery (mock):** A mocked 503 preserved the draft, showed an error, and did not retry automatically. An explicit retry succeeded and cleared the draft.
- **Partial — duplicate-submit guard (mock):** While a delayed write was pending, Share was disabled and a second programmatic form submission did not add another POST. The harness then timed out waiting for success feedback, so completion and final rendering are inconclusive.
- **Partial — pagination (mock):** The first 50 rows of a 105-row fixture loaded. The harness stopped after clicking Load older because its non-exact `page-6` locator also matched `page-60` through `page-69`; later pages, deduplication and end-of-feed behavior remain unverified.

## Blocked or unverified

- The provided production-server session was no longer available (`127.0.0.1:3000` returned `ERR_CONNECTION_REFUSED`), so the missing-configuration state was not exercised in Chrome.
- Desktop/mobile layout measurements and screenshots were not captured; both browser harnesses stopped before their screenshot steps.
- Initial-fetch race and reconnect behavior were not completed. Steve reported that Mark moved the disconnect recovery alert outside the nonempty-feed branch (updated component hash prefix `16495398bd3b`); that change was made after this QA copy and has not had a browser regression check.
- Live Supabase persistence, database constraints, RLS, anonymous update/delete denial and real WebSocket delivery were not tested because no project credentials/environment were provided. Mock results do not establish these behaviors.
- No screenshots were produced.

## Next checks

Run the main preview against the current source to verify the updated empty-feed recovery action and missing-configuration behavior. After an approved Supabase project is configured, verify persistence, RLS and cross-browser Realtime with public credentials.

## Coordinator follow-up on final source

After Jetjet released the test processes, Elon ran `npm run lint`,
`npm run typecheck`, `npm test` (6/6) and `npm run build`; all passed on the
final typography and disconnect-recovery source. The parent-owned production
server returned HTTP 200 at `http://127.0.0.1:3000`.

A focused isolated Playwright/Chrome run against that production server passed:

- Genuine missing-configuration message visible; Share disabled.
- Desktop at 1440px: three panels aligned at the same top edge (104px), no
  horizontal overflow, composer prompt 22px, textarea 16px and supporting text 12px.
- Mobile at 390px: no horizontal overflow, composer prompt 20px, textarea 16px,
  supporting text 12px and welcome panel following the composer/feed.
- Desktop and mobile screenshots were captured at `/private/tmp/wall-desktop.png`
  and `/private/tmp/wall-mobile.png` and visually inspected. These show the
  unconfigured local app; they are not employer submission screenshots.

This closes the earlier missing-configuration and responsive typography gaps.
The updated empty-feed disconnect action, full pagination, delayed-write
completion and real Supabase/Realtime/RLS checks remain unverified in-browser.

### Subsequent desktop spacing and profile refinement

Anthony requested wider desktop use and a circular avatar beside the name.
After Dario changed the CSS, identity markup and prototype, the coordinator
reran lint, typecheck, all six tests and the production build; all passed.
The isolated Chrome smoke check passed again at 1440px and 390px: no horizontal
overflow, unchanged typography, aligned desktop panels, 24px desktop outer
gutters, 50% profile-avatar border radius and the name positioned beside it.
The screenshots at the paths above were refreshed and the desktop capture
visually inspected. Live-backend and other outstanding functional gaps remain.

### Footer placement follow-up

After Anthony requested bottom placement, Dario added a viewport-height flex
page with an automatic footer top margin. Coordinator lint, typecheck, six
tests and production build passed again. Isolated Chrome checks confirmed the
footer is static (not fixed), follows content at both 1440px and 390px, and
sits at 974px in a 1000px-high short desktop viewport (26px bottom spacing).
On the longer mobile page it follows the content without overlay. Earlier
backend verification limits remain unchanged.

## Live Supabase setup verification — 2026-11-15

Owner approved a new Wall project in HAKDOGINS, Singapore, conditional on no spending. Supabase quoted $0/month. Created project `cykohtqakrzndsmnokxi`; no paid features or upgrades enabled. Applied the prepared `create_posts` migration to the initially empty public schema. Local configuration uses only the project URL and public publishable key, in ignored `.env.local`. No publication or deployment occurred.

Executed against the real Supabase service:

- Public client inserted 280 emoji code points; generated UUID/timestamp and null user_id confirmed. A fresh independent client retrieved the persisted row.
- Empty, whitespace-only and 281-character inserts were rejected. Supplying id, user_id or created_at was rejected. Anonymous update and delete returned errors.
- A separate subscribed client received the real INSERT event over Realtime.
- SQL inspection confirmed RLS enabled, anonymous SELECT/INSERT policies, and posts membership in supabase_realtime. Security advisors returned no findings.
- Two isolated Chrome contexts loaded the local production build at 127.0.0.1:3010. Sharing cleared the draft after success and rendered exactly once. The other context received the post without refresh; reloading the submitting page retained the post exactly once. No REST or WebSocket mocks were used.
- Lint, typecheck, all six automated tests, and production build passed with the live public configuration.

The two temporary verification rows were removed using administrative SQL restricted to their recorded identifiers/content; no sample posts remain. Browser harness: `/private/tmp/wall-qa/live.mjs`. Full live pagination above 50 rows, equal-time pagination, network-failure recovery and reconnect races were not reverified in this run. No future billing guarantee is implied by the current $0 quote; no paid plan change is authorized.

## Photo uploads and owner-managed profile — 2026-11-15

Owner approved optional visitor post photos and a static owner-controlled profile, without login. Supabase organization inspection returned `plan: free`, `tier: tier_free`; this project's Storage held zero objects/bytes before setup. Monthly organization egress was not available through the connector. No paid plan, add-on or publication was enabled.

Applied additive migration `20261115120001_add_post_images.sql`. Live SQL inspection confirmed posts and storage.objects RLS enabled, anon INSERT columns exactly body/image_path, and wall-images public bucket limited to 2,097,152 bytes and JPEG/PNG/WebP. The sole object policy grants anonymous INSERT only under posts/<uuid>.(jpg|png|webp). Security advisors returned no findings.

Live public-client checks passed: valid image upload and public GET, image_path persisted on a new post, invalid image URL rejected, oversized/SVG/profile-path uploads rejected, listing hidden, overwrite denied, attempted anonymous deletion left the image retrievable, protected-column inserts and post UPDATE/DELETE denied. Harness: `/private/tmp/wall-qa/storage-live.mjs`.

The recorded API test row was removed. A 68-byte verification PNG remains at `wall-images/posts/589fc3b2-ea81-43d7-b366-a24ae4a32bad.png`: the connector offers no administrative Storage deletion, and local CLI has no access token. Owner can remove it through the Storage dashboard; no Storage table rows were deleted via SQL and no cleanup permissions were granted to visitors.

Final implementation checks: lint, typecheck, all eight unit tests, and production build passed. Two isolated Chrome sessions against the local production build and real Supabase passed image upload/retrieval, cross-browser Realtime image delivery, reload persistence, single rendering, text-only regression, newest-first ordering, and mobile profile visibility/no overflow. A deliberately intercepted failed INSERT preserved caption/photo; an explicit retry reused the one already-uploaded file, with no automatic duplicate writes. Mobile screenshot `/private/tmp/wall-qa/images-mobile.png` was visually inspected. Harness: `/private/tmp/wall-qa/images-browser.mjs`.

Both recorded browser verification posts were removed with exact content/path predicates. Its 68-byte PNG also remains at `wall-images/posts/07ad2cd2-f37c-426e-a7a0-c80f10de1581.png`, pending owner Storage-dashboard removal. Total known retained verification data: two tiny PNG objects, no sample posts. Live pagination beyond 50 mixed rows and reconnect races were not reverified; existing deterministic pagination/merge unit tests passed. Actual owner photo/details have not been supplied, so the profile uses initials and honest empty sections.

Focused Chrome failure/validation checks also passed: SVG and oversized-file UI rejection, preview removal, mobile preview without overflow, keyboard-visible focus, and a simulated upload failure preserving caption/photo without creating a post or retrying automatically. Harness: `/private/tmp/wall-qa/image-failure.mjs`. Failure responses in these two browser cases were intercepted deliberately; successful upload/post/persistence/Realtime checks used the real service.

## Shared profile editor — 2026-11-15

Anthony explicitly chose anyone-can-edit and no login for the separate Profile page. Added migration `20261115120002_add_shared_profile.sql`: RLS enabled on wall_profile, one id=1 row, public SELECT and UPDATE only display_name/about/skills/website/github/linkedin/photo_path. No public insert/delete/id update. Profile photo uploads have a separate profile/<uuid> prefix INSERT policy in the existing restricted image bucket. Post permissions are unchanged. Security advisors returned no findings.

Public-client API checks passed: singleton read/update persistence, display-name/About/skills length constraints, HTTPS/photo-path checks, and rejected INSERT/DELETE/id changes. The original singleton was restored after verification. Harness: `/private/tmp/wall-qa/profile-api.mjs`.

Final profile implementation checks passed: lint, typecheck, all eleven tests and production build. Both / and /profile render dynamically to retrieve current shared details. Browser checks against real Supabase passed separate no-login editor navigation; saving display name, About, skills and HTTPS website; profile photo upload/save; reload persistence; updated name/details/photo on Wall and in a separate session; and photo removal. A deliberately intercepted failed profile PATCH preserved edits and reused the one uploaded file on explicit retry, with no automatic repeated writes. Harness: `/private/tmp/wall-qa/profile-browser.mjs`. The original profile values were restored after verification.

The 68-byte profile verification image remains at wall-images/profile/d57f03ad-bbcd-4cc3-af9f-c438a21e5960.png for administrative dashboard cleanup. Together with the two recorded post-verification images, known remaining test objects total 204 bytes; no test post rows remain from the photo checks. Anonymous deletion remains denied.

Panel placement browser checks passed at 1440px (profile left, feed center, notifications right) and 1000/390px (feed, profile, notifications stacked, all visible, no horizontal overflow). Desktop screenshot `/private/tmp/wall-qa/panels-desktop.png` was visually inspected. The final-source real-browser Wall smoke check also passed public text posting, draft clearing, single rendering, cross-context Realtime delivery and reload persistence; its one recorded post was removed afterward. No publication occurred; local preview remains on 127.0.0.1:3010. Notifications currently provide an honest empty panel, without a notification backend.

## View-first profile navigation — 2026-11-15

The left-sidebar name now opens /profile as a read-only view; Edit profile opens /profile/edit. Wall, view and editor share the same header/navigation, left profile information, right Notifications placeholder and footer. Database/Storage permissions and anonymous posting were not changed.

Lint (without warnings), typecheck, twelve unit tests and production build passed. A real-Supabase Chrome flow passed sidebar-name navigation, absence of editable fields on the view, Edit profile navigation, consistent shell on both pages, saving an About change, View saved profile navigation, and reload persistence. It also verified desktop column order and no horizontal overflow at 390, 450, 600 and 1000px. Desktop/mobile screenshots were visually inspected. The original profile was restored; no new Storage objects were created by this check. Harness and screenshots: `/private/tmp/wall-qa/profile-navigation.mjs`, `profile-view-desktop.png`, `profile-view-mobile.png`. Earlier upload/posting evidence remains applicable; upload and posting logic was not refactored.

## Avatar upload/camera controls and growing text fields — 2026-11-15

Photo controls now open from the editor avatar/camera badge; the lower-form picker was removed. Upload chooses a local file; Take a photo requests video-only camera permission, previews the camera, and captures a bounded JPEG locally. Capture/cancel/unmount and late permission/encoding results stop or discard the camera work. Nothing uploads before Save. All six text fields now wrap and auto-grow with code-point counters, bounded at roughly 320px with vertical scrolling and resizing; validation limits remain unchanged.

Lint, typecheck, twelve tests and production build passed. Isolated Chrome using its simulated media device passed avatar options, actual file chooser selection, camera capture/decoded local preview, zero premature Storage uploads, track cleanup on capture/cancel/unmount, late-permission cleanup, cancelled-encoding rejection, and denied-permission feedback. No physical camera was accessed or verified. Harness: `/private/tmp/wall-qa/avatar-camera.mjs`.

Mobile Chrome passed textarea growth/wrapping for About/skills/URLs, bounded height, counters, no horizontal overflow, and over-limit feedback. Screenshot `/private/tmp/wall-qa/growing-fields-mobile.png` was visually inspected. Harness: `/private/tmp/wall-qa/profile-growing-fields.mjs`. The existing live profile-navigation/save/reload flow was rerun successfully against Supabase, restoring its original profile afterward. Camera/field checks created no Storage objects and no test posts. Nothing was published.

## Profile reference layout, form structure, viewport fill and header — 2026-11-15

The profile routes now omit the main Wall's identity/notification sidebars. Profile view uses a decorative cover band, large avatar/name/Edit profile header, then personal details beside the actual shared Wall composer/feed. The editor pairs name/skills and GitHub/LinkedIn, with full-width About/Website; phones stack all fields. Growing fields also remeasure after width changes. The main Wall retains its three panels.

Page columns now consume spare viewport height above the normal-flow footer, while fields/posts keep natural sizes and long pages scroll. Header groups branding, Wall/Profile/About navigation and a Notifications link to the actual Wall section. About explains real posting/shared-profile behavior. Notifications remain an empty placeholder; no backend or unread counts were added.

Lint, typecheck, twelve tests and production build passed on final source. Chrome passed the profile structure, paired/wide form fields, responsive stacking, main Wall panel preservation, footer non-overlap/bottom placement, and equal column bottoms. Tested routes /, /profile and /profile/edit at 1920x1400, 1440x1000, 1024x768, 390x844 and 320x568. Header tests confirmed visible navigation from 320 to 1920px, About navigation and Notifications hash navigation. No horizontal overflow occurred. Desktop profile/editor screenshots were visually inspected. Harnesses: `/private/tmp/wall-qa/profile-reference.mjs`, `viewport-height.mjs`, `header-navigation.mjs`. These layout checks used real backend reads and made no data writes. No publication or paid changes occurred.

## Profile-photo crop and exact saved output — 2026-11-15

Profile uploads and camera captures now open a native modal crop step. Keyboard-accessible Zoom and horizontal/vertical sliders position the crop through a circular preview. Use photo exports that exact 512px square canvas as PNG; the pending avatar and actual Storage upload receive the same file. Cancelling retains the previous photo and restores focus to the avatar trigger. All existing source type/size limits and explicit Save behavior remain.

Lint, typecheck, twelve tests and build passed. Chrome with real Supabase passed a synthetic landscape-image test: cancel preserved the old avatar, keyboard position/zoom changed the expected preview pixels, the approved canvas PNG matched the pending blob and actual public Storage bytes by SHA-256, and the saved hero avatar loaded after refresh. The original profile was restored afterward. Harness: `/private/tmp/wall-qa/profile-crop.mjs`; mobile modal screenshot `profile-crop-mobile.png` was visually inspected. The PNG test object remains at wall-images/profile/a16ca399-c99c-4dea-94f6-a35f56b11b44.png for administrative Storage cleanup; no sample posts were added.

The camera regression harness also passed with the new crop confirmation step: simulated capture, upload chooser, no premature upload, permission failure, and stream cleanup/race cancellation. Physical camera hardware was not tested. No schema, permissions, paid services or publication changes occurred.

## Direct photo dragging — 2026-11-15

Removed all crop sliders. The preview now supports mouse/touch dragging with pointer capture and clamped source bounds. Minus/plus buttons control zoom; a focusable preview supports arrow-key movement with Shift for larger steps. The same canvas still produces the approved/uploaded PNG.

Lint, typecheck, twelve tests and build passed. Real-browser checks passed mouse dragging, injected touch dragging, keyboard panning, zoom buttons, zero slider controls, cancellation preserving the old image, and matching SHA-256 bytes for approved canvas/pending preview/live Supabase output. The persisted hero avatar loaded after refresh. The original profile was restored. Mobile modal screenshot was visually inspected. Harness: `/private/tmp/wall-qa/profile-drag-crop.mjs`. A PNG verification object remains at wall-images/profile/d62c3858-40cf-4d87-80fb-8aff6fba751f.png for administrative cleanup. No posts, schema/policy changes, paid features or publication were introduced.

## Consistent fields, removal/discard confirmations and save redirect — 2026-11-15

Paired fields now share the larger content-derived height, starting at the same compact height. Photo choices use compact menu rows; Remove photo is separated and styled as a quiet destructive text action rather than a raised pill. It requires confirmation and only stages removal until Save. Leaving through app links with dirty edits opens a discard dialog; entry to the editor uses document navigation so browser Back also invokes the native unsaved-page warning. Cached editor history is refreshed on restoration to avoid retaining an old saving state.

Successful Save now redirects to a fresh /profile read and shows a dismissible six-second success toast. Its temporary query flag is removed, so reload does not repeat the toast. Failed saves retain the previous error/draft behavior.

Lint (no warnings), typecheck, twelve tests and production build passed. Chrome verified equal initial and grown paired heights, native browser-Back protection, cancelled/confirmed dirty navigation, confirmed/cancelled photo removal, automatic live save redirect, one-time dismissible toast and mobile no overflow. Harness: `/private/tmp/wall-qa/profile-feedback.mjs`. Photo-removal checks remained local; the live save submitted the unchanged current profile, with no test content or Storage objects added. No schema/permission, paid-service or publication changes.

## Live interactions, full-post modal and capability removal — 2026-11-15

Final implementation: Comment and See more open a native full-post dialog; captions collapse only in the feed. Post Share removed, composer Share retained. Like/Unlike uses private per-tab capabilities; Delete post uses a private browser capability with explicit confirmation. Header W moved to /icon.svg. Existing anonymous posts/likes without credentials cannot be claimed. Uploaded Storage files are retained after post deletion.

Mark ran lint, typecheck, all 19 tests and production build successfully. Elon independently ran live Chrome/Supabase checks: two-browser posts/comments/counts/profile synchronization; timestamp display; comment pagination/deduplication and failed-write draft retention; modal full caption, Escape/focus restoration,320px bounds; real Like/Unlike counts; Share/header badge absent and favicon200; deletion cancel/confirm, owner-only control, visitor feed/modal updates without reload, database persistence and comment cascade. Production reconnect test passed: deleting during a real WebSocket/offline gap automatically removes the feed row and changes the open modal to removed after reconnect, without reloading. Prior comment/count/profile offline recovery also passed. Harnesses: /private/tmp/wall-qa/modal-delete.mjs, delete-reconnect.mjs, interactions-live.mjs and interactions-reconnect.mjs. Mobile screenshot modal-mobile.png visually inspected. Test posts removed; generated fixture count verified zero.

Live anonymous API probes passed correct-token create/delete, idempotent creation, invalid-input rejection, wrong-token denial, private-table denial, direct DELETE denial, like/unlike authorization, own unlike count zero/re-like, and cascades. Andrie independently reviewed applied migrations and live ACL/RLS metadata: private tables inaccessible and excluded from Realtime, public tables retain RLS, fixed function search paths and restricted RPC execution. Advisors intentionally report four anonymous SECURITY DEFINER RPC warnings and two private-table RLS/no-policy informational notices; these reflect the reviewed capability boundary, not an empty advisor report. See https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable.

No paid service or publication. Physical camera hardware and full assistive-technology conformance were not tested. Clearing storage loses post deletion credentials; tab/session loss loses unlike credentials. No authenticated ownership is claimed.

## Centered post details and post options — 2026-11-15

Added explicit fixed inset/margin centering (the CSS reset had removed native dialog margins),640px maximum width,82dvh/760px maximum height, and bounded uncropped photos with a scrolling content area. Like/Comment now have equal columns and labeled icons. Owner-only three-dot controls expose Edit/Delete. Caption editing uses migration20006 and the existing private deletion capability; direct anonymous UPDATE remains denied. Edited posts merge into visible feeds and open dialogs through Realtime UPDATE.

Elon ran lint, typecheck,20/20 tests and production build successfully. Live production Chrome/Supabase harness `/private/tmp/wall-qa/post-ui-refine.mjs` passed exact modal centering at1440x1000,390x844 and2560x1378, bounded image/modal sizes, no horizontal overflow, equal icon actions, owner-only options, menu Escape (including inside a modal without closing the modal), dirty-edit cancellation preserving the draft, actual saved caption appearing in a second visitor's open dialog without reload, protected id/timestamp/image/user fields unchanged, wrong-token/direct/invalid edit rejection, and delete cancel/confirm. Screenshot `post-modal-centered.png` visually inspected. Generated test posts were deleted; no new Storage objects were uploaded. Live metadata confirms RLS=true, anonymous body UPDATE=false, hardened edit RPC search_path, anon-only execution. Advisors now show five intentional capability RPC warnings and the same two private-table informational notices. Editing changes captions only; legacy/cleared-key ownership limits remain. No deployment or paid changes.

## Compact comments and backdrop dismissal — 2026-11-15

Mark updated comment rendering to show a separate engagement summary, equal icon actions, avatar/content-sized bubbles with timestamps beneath, and a bottom composer with a single-line growing input, conditional counter and accessible send icon. Enter remains multiline. Post details close only when a primary pointer starts and ends outside the bounds; inside drags and nested confirmation dialogs are excluded. Drafts stay in the existing provider. Elon moved the latest-close callback ref assignment into an effect after lint identified a render-time ref write.

Elon ran lint, typecheck,20 tests and production build successfully. Live two-browser harness `/private/tmp/wall-qa/comments-polish.mjs` passed backdrop dismissal, inside-click/inside-drag protection, Escape, retained drafts on reopening, real comment delivery to another browser, comment avatars/list before the compact composer, and centered320px/390px layouts without horizontal overflow. Desktop/mobile screenshots were visually inspected. Fixture creation and comments were cleaned through the correct deletion capability.

At Anthony's explicit request, the exact earliest Test post (d4d15f98-6a57-4413-99af-e83ab71d49e2) was replaced in place with a professional welcome caption; its one test comment and one test reaction were removed. Its original timestamp was preserved and the graduation post was untouched. Verified welcome text with zero old comments/reactions. No schema/RLS, deployment or paid-service changes.

## Hide empty engagement counts — 2026-11-15

Zero likes/comments are omitted individually; when both are zero the summary row is absent. Positive comment-only counts keep right alignment. Lint, typecheck,20 tests and build passed. Rendered Chrome checks `/private/tmp/wall-qa/zero-counts.mjs` covered zero/zero, like-only, comment-only and both-positive states using intercepted read responses; no database writes were made. Existing Realtime state feeds the same conditional rendering. Nothing published.

## GitHub and Vercel production setup — 2026-11-15

Owner explicitly approved creating/pushing the private repository https://github.com/hakdogins27/wall and publishing on https://wall-anthony.vercel.app. Andrie scanned all62 initially staged files: no credential-pattern matches, local.env ignored, only placeholder.env.example tracked. CLI upload dry-run likewise excluded local.env, Git metadata, dependencies and build output. Vercel Hobby team/project and verified production domain are configured, with only the two public Supabase variables. GitHub integration automatically deploys main. Initial production deployment reached READY with the requested alias; its logs exposed automatic Node26 selection, so package/lockfile now constrain the tested22.x range. Lint, typecheck,20 tests and local production build passed after this pin. Cloud deployment status and aliases are checked through Vercel metadata; no deployed-page HTTP/browser smoke test was performed, following the deployment skill. No paid features or domain purchases were enabled. Browser edit/delete capabilities remain specific to their original origin.
