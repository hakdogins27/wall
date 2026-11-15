# Wall — assessment foundation

Status: Anthony approved the current design and proceeding with implementation
on 2026-11-15. PROJECT-WALL.md was not found; the supplied assessment texts and
these records are the working requirements. Publishing is not approved.

## Confirmed requirements

- Build the SUpost Test 2 assessment using React, Next.js and Supabase.
- Updated step-by-step guide specifies React 19, Tailwind CSS and shadcn/ui.
- Realtime and the 280-character limit are required by the updated guide.
- A visitor can share a message without signing in; a fixed author is acceptable.
- Store messages in Supabase and show newest messages first after refresh.
- Deliver a responsive, accessible, polished 2008 Facebook-inspired interface.
- Keep RLS enabled and never expose secret credentials.
- Prepare GitHub and Vercel submission; Anthony approves publishing first.
- Explain React, inserts, retrieval, SQL ordering and Realtime for interview preparation.

## Design direction — confirmed 2026-11-15

Anthony requested a more distinctive, professionally polished interpretation
rather than a close copy of old Facebook. Retain a muted blue nostalgic header,
simple composer and Wall feed; remove the Facebook-like profile sidebar, center
the content, and improve typography and spacing. Dario is revising the prototype;
the resulting design remains subject to review before application implementation.

Latest approved revision direction: redesign the original Wall as a modern
social product. Use crisp sans-serif typography instead of the editorial serif
headline, a quiet blue header with an original Wall wordmark, one centered
column, an avatar-led composer immediately above compact readable posts, and
restrained interaction feedback. Keep mobile comfort, accessible states and
reduced-motion support; do not expand into a full Facebook feature set.

Subsequent layout revision requested by Anthony: use desktop space more fully
with three sections. Proposed arrangement is identity/context on the left,
the widest composer/feed column in the middle, and welcome/about context on
the right. Avoid inactive navigation and fabricated social metrics. Collapse
supporting panels for smaller screens and prioritize the composer on mobile.

Latest visual refinements requested by Anthony: strengthen font hierarchy so
the composer leads attention, use more available desktop width with consistent
outer gutters, and show the profile avatar as a circle with the name beside it.

## Updated guide alignment

The supplied guide uses `posts(id, user_id, body, created_at)` and environment
names `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Align the
implementation proposal with these names while retaining RLS, database length
and nonblank validation, and restricted insert privileges. The earlier
`docs/architecture.md` has been updated by Alexandr to reflect these names.

## Proposed scope

One Next.js application, one posts table, Supabase browser client with a public
publishable key. Enforce a 280-character limit in both UI and database. Include
Realtime after reliable insert, fetch and persistence work. Initially fetch 50
posts; preserve access to older messages if the requirement to show all is
interpreted literally. Fixed author: Anthony Mendoza, pending confirmation.

Optional post photo uploads and a public shared profile editor were subsequently approved. Anonymous likes/comments and capability-based edit/removal of posts created in the same browser were also approved. Login, private messaging and unrelated social features remain deferred; the post-level Share action was removed in the latest UI revision.
No paid infrastructure or remote changes are authorized by this document.

## Acceptance evidence

1. Share a valid message; verify a real Supabase row and visible post.
2. Refresh; verify the message persists and ordering is newest first.
3. Verify empty/whitespace and over-limit messages are rejected, including by
   the database; verify direct anonymous update/delete are denied and deletion
   requires the matching private capability.
4. Check double submission, network failure, initial loading and empty feed.
5. Verify Realtime from a second browser context, including reconnect behavior.
6. Check keyboard use, narrow mobile layout and visible feedback.
7. Run appropriate type, lint, test and production build checks.
8. After publishing approval, verify the production URL and capture a posted
   message screenshot for submission.

## Workforce sequence

Alexandr: schema/architecture proposal → Dario: design prototype → Anthony:
foundation/design confirmation → Mark: application and setup documentation →
Jetjet: functional/edge-case evidence → Mark: necessary fixes → Steve: submission
readiness review → Anthony: publishing approval.

Alexandr and Dario may prepare independent proposals together. Implementation
and local build/browser/test processes run sequentially to fit the laptop.

## Open dependencies

- If Anthony supplies PROJECT-WALL.md, reconcile any additional requirements.
- Anthony creates/selects a Supabase project; use only its project URL and
  publishable key in local environment configuration, never database passwords
  or service-role/secret keys in browser code.
- Confirm the GitHub destination and Vercel project before approved publishing.
- Live Supabase, browser and production checks remain unexecuted.

Latest panel direction: profile photo/About/Skills/Links on the left, composer/feed in the center, Notifications on the right. Preserve all content on mobile with the feed first. Notifications currently have an empty state; no notification service is requested.

Anthony then requested a separate Profile editing page and explicitly chose anyone-can-edit with no login. This supersedes owner-configured profile details. The single shared profile is publicly editable, clearly labeled, with RLS restricted to its editable singleton fields. Wall posting remains anonymous.

Latest profile navigation: left-side name opens a view-first /profile page matching the main Wall shell; Edit profile opens /profile/edit in the same shell. Keep public shared editing with no login.

Latest visual direction supersedes the profile three-column shell: wide profile header with large avatar/name, then personal details beside the shared Wall feed. Use a two-column edit form on wide screens, one column on mobile. Columns fill available height above the footer. Header hierarchy includes branding, Wall/Profile/About navigation and a separate Notifications action.

Anthony approved mobile-only hamburger navigation and a feed-only Wall at1180px and below, with details accessible through the profile About section. He removed the Shared profile hero label and approved professional wording grounded in his existing skills. Live notifications cover actual posts, comments and likes with relative timestamps. Mobile uses a separate right-side drawer and per-browser persistent unread badge, cleared by checking the drawer and increased by later activity.
