# Wall submission review

Coordinator follow-up after review: Anthony requested wider desktop spacing
and a circular avatar/name row. Dario changed only the CSS, identity markup
and prototype. Coordinator lint, typecheck, six tests, production build and
focused desktop/mobile browser checks passed afterward; see `qa-report.md`.
This is coordinator evidence after Steve's review, not a second specialist
review. Live-backend and publishing blockers remain unchanged.

Review date: 2026-11-15. Reviewer: Steve (QA Lead).

## Recommendation

**Not ready for employer submission.** The local implementation and preparation
are reviewable, but live Supabase verification and the required published
artifacts are absent. Final local checks pass, and selected mocked browser
journeys and actual responsive layout checks pass; pagination, delayed-write
completion and live-update recovery coverage remain incomplete. See the
[consolidated functional evidence](qa-report.md). This recommendation does not
authorize publication or deployment; Anthony retains final acceptance and approval.

## Evidence and coverage

| Area | Evidence | Status / limit |
| --- | --- | --- |
| Approved scope | Inspected `brief.md`, `architecture.md`, `design.html` and app source | React 19, Next.js, Tailwind and shadcn/ui; shared author; three-column responsive structure; no extra social features |
| Automated checks | Coordinator reports final lint, typecheck, 6/6 tests and Next.js production build passed after typography and recovery changes | Reused final handoff evidence; Steve did not rerun processes |
| Final local preview | Coordinator reports `http://127.0.0.1:3000` returned HTTP 200 and was opened for the owner | Actual local no-credentials app; not live database or production-deployment evidence |
| Data helpers | Inspected `src/lib/posts.ts` and `tests/posts.test.mjs` | Tests assert Unicode limits, timestamp/UUID order, page size/cursor, body-only insert, rejection and errors; HTTP transport is mocked |
| Browser behavior | Jetjet's isolated temporary-copy report: ordering, keyboard focus, Unicode validation, body-only insert/display and failed-write/manual-retry checks passed | Mock REST evidence on pre-recovery component; Realtime fixture delivery was not independently asserted; no live persistence/RLS proof |
| Final visual/availability checks | Coordinator's isolated Chrome/Playwright run on final production server | Missing-config notice/disabled Share passed; 1440px three-panel alignment and 390px composer-first layout had no overflow; final 22/20px prompt, 16px input and 12px supporting text confirmed |
| Local screenshots | Coordinator captured and visually inspected `/private/tmp/wall-desktop.png` and `/private/tmp/wall-mobile.png` | Unconfigured local app only; these do not satisfy employer evidence of persisted messages |
| Database security | Inspected migration and browser configuration | RLS, anonymous SELECT, body-only INSERT, generated fields, constraints and publication are present; migration has not run |
| Packaging | Inspected README, setup, learning and submission guides, `.gitignore`, `.env.example` | Setup instructions and placeholders present; no local `.env.local` or Git directory observed |
| Dependencies | Coordinator relays Mark's final audit: 0 runtime, 8 moderate development findings | ESLint/config dependency chain; proposed major downgrade was not applied; not independently rerun |

No source, migration or test files were changed by this review. There is no
commit identity because the workspace has not been initialized as a repository.
Reviewed SHA-256 prefixes: `posts.ts` `1a36dc19bd22`, updated `wall-feed.tsx`
`16495398bd3b`, migration `ff2feecf9769`, tests `2dad52c13999`, final
`globals.css` `914c17321f6b`.

## Consolidated findings

| Priority | Finding and evidence | Status / next owner |
| --- | --- | --- |
| P1 | Live persistence, two-browser Realtime, reconnect recovery and public-key database permissions have no executed evidence; project configuration is absent | Blocked — Anthony selects/provides the project and authorizes setup; Mark/Jetjet then execute live checks |
| P1 | Public GitHub repository, Vercel production URL and screenshots of real persisted posts do not exist | Blocked — Anthony approves destinations/publication; implementation owner publishes and verifies after approval |
| P2 | Empty-feed disconnection originally lacked a manual refresh action | Fixed by Mark; Steve inspected `wall-feed.tsx:274–305`: recovery now renders independently of post count, with existing Retry used after read failure. Browser confirmation pending |
| P2 | Submission guide originally omitted public visibility, production URL, Test 2 Wall form selection and full screenshot/demo instructions | Closed — Mark/coordinator corrected the guide; Steve inspected explicit required multiple-post/mobile evidence and pending-publication status |
| Verification gap | Full pagination, delayed-write completion, initial-load/reconnect races and fixed empty-feed recovery lack completed browser evidence | Open — Jetjet/implementation owner to complete focused checks before submission; pagination stopped on an ambiguous test locator and delayed write timed out, so these are inconclusive harness results rather than confirmed app failures |

The delayed-write check confirmed Share was disabled and a second programmatic
submission did not send another POST while pending; eventual success/rendering
was not established. Pagination proved only the first 50 of a mocked 105-row
fixture. Neither the mock Realtime setup nor the passing SDK merge test proves
browser subscription delivery or live deduplication. Reduced-motion behavior
was inspected in CSS but was not exercised in the reported browser checks.

The anonymous design permits repeated valid writes and abusive content. This is
an explicitly documented assessment trade-off, not proof of abuse resistance.
The fixed display name does not identify the writer. No full security audit,
independent dependency audit or live credential/bundle inspection was performed.

## Remaining test strategy

1. Reuse the final passing lint/typecheck/tests/build and visual checks while
   the snapshot remains unchanged. Complete the identified browser gaps with
   exact pagination selectors and a bounded delayed-write fixture; verify the
   fixed empty-feed refresh action. Avoid treating harness failures as app bugs.
2. On the owner-selected Supabase project, run the migration once. With the
   public client, verify accepted body-only inserts generate ID/time and null
   user ID; confirm refresh persistence and descending timestamp/UUID order.
3. Test empty, whitespace-only (including Unicode spaces), 280- and
   281-code-point bodies directly against the API as well as through the UI.
   Verify extra-column inserts and anonymous update/delete are denied.
4. With more than 50 real rows, load all pages without missing or duplicate
   equal-time rows. Insert concurrently in another context, test initial-read
   overlap, disconnect/reconnect and refresh crossing an older-page request.
5. Confirm failed reads/writes preserve visible posts/drafts, a second browser
   receives real Realtime changes, and own submissions appear once. Recheck
   keyboard, phone layout and reduced motion on the deployed app.
6. After publication approval, inspect the staged repository for credentials,
   verify public repository access and the Vercel production URL, then capture
   required screenshots with genuine persisted posts and complete the form.

## Interview preparation

`learning-guide.md` follows the implementation's React state, body-only insert,
database defaults/RLS/grants, ordered retrieval, cursor pagination and Realtime
merge path. Read it alongside the SQL in `architecture.md` and the runnable
setup guide. It is adequate as an implementation walkthrough; Anthony's
understanding and interview performance remain unassessed.

Sanitized learning handoff: the central decisions are direct anonymous browser
writes protected by database privileges, and deterministic cursor pages merged
with live inserts. Independent challenge: devise a two-browser experiment that
would expose a lost or duplicated post during initial loading and reconnection.
No material has been transferred to the Learning Academy.
