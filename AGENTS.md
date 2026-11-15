# Wall project instructions

- Follow the approved scope and architecture in `docs/architecture.md` and the UI reference in `docs/design.html`.
- Keep the app anonymous and public. Every post uses the fixed shared display name in the interface; it is not proof of who wrote a post.
- Use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the browser. Never add a service-role/secret key or database password.
- Keep post validation, deterministic ordering, cursor pagination and realtime merge behavior in `src/lib/posts.ts` and `src/components/wall-feed.tsx` unless a focused change requires otherwise.
- The database migration in `supabase/migrations` enables RLS and permits anonymous reads and inserts of body plus optional image_path only. Preserve RLS and denial of protected-column inserts, updates and deletes.
- Do not add sample posts, localStorage persistence, authentication. Anonymous likes, comments and post sharing were explicitly approved as extras, with Realtime for interactions/profile changes. Optional post images (JPEG/PNG/WebP, at most 2 MiB) and a shared profile editor were approved. Anyone may edit the single shared profile without login; keep that fact visible. Profile UPDATE permissions must stay limited to the profile fields on its singleton row, with no anonymous INSERT/DELETE/id edits.
- Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` for implementation changes that affect the app. Mocks do not replace live Supabase verification.
- Do not configure remote services, publish, deploy or create a repository without the owner's approval.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
