# Wall implementation walkthrough

This guide follows the real request path so you can explain it in an interview.

## 1. React collects and validates a draft

`src/components/wall-feed.tsx` is the interactive client component. React state holds the draft, visible posts and loading/feedback states. `countCharacters` in `src/lib/posts.ts` uses `Array.from(value).length`, which counts Unicode code points instead of UTF-16 code units. Whitespace-only text and drafts over 280 code points cannot be submitted.

The UI disables Share while the draft is blank, too long, unconfigured or already submitting. The submit handler has a synchronous in-flight guard against double clicks. It clears the draft only after the database returns a confirmed row; failures keep the text available for retry.

## 2. The browser sends only the post body

`createPost` trims and validates the draft, then uses the Supabase JavaScript client:

```ts
supabase
  .from("posts")
  .insert({ body })
  .select("id,user_id,body,created_at")
  .single();
```

The browser sends no author, UUID or creation time. PostgreSQL supplies `id` and `created_at`; `user_id` stays null because this version has no authentication.

## 3. PostgreSQL enforces the public boundary

The migration enables row-level security. Its `anon` policies permit reads and inserts, while SQL column privileges grant insert access only to `body`; anonymous clients cannot choose the database-generated fields or update/delete rows. Constraints enforce a nonblank body of 1–280 PostgreSQL characters. This is the security boundary; browser checks alone are not sufficient.

The anon/publishable key is public by design. RLS and grants restrict what that key can do. A service-role or secret key bypasses this boundary and must never go into `NEXT_PUBLIC_*` or client code.

## 4. The feed uses stable pages

`loadLatestPosts` selects explicit columns, orders by `created_at DESC, id DESC`, and requests 50 rows. `loadOlderPosts` asks for rows before the oldest visible `(created_at, id)` pair. This cursor remains stable when new posts arrive; offset paging could shift and repeat or skip rows.

The browser merges rows by UUID, compares PostgreSQL timestamps at microsecond precision, and uses UUID descending as the tie-breaker. This keeps a realtime row, an insert response and a feed page from appearing twice.

## 5. Realtime fills the live feed

The component subscribes to `INSERT` changes for `public.posts` before starting the first read. It merges the read with any inserts received while that request is running. When the channel reconnects, it refreshes the first page and resets the older-page cursor. On unmount it removes the subscription. A failed refresh leaves already visible posts on screen.

## Trade-offs to explain

- The fixed display name is shared by every visitor and does not identify the real writer.
- Public anonymous inserts are open to spam; this assessment has no authentication or enforced rate limit.
- Unit tests mock Supabase HTTP requests. A real Supabase project is still needed to demonstrate persistence, RLS and Realtime.

## Optional photo feature handoff

Concepts used: Storage object RLS, public image URLs, column privileges, and failure handling across two writes. Approved decision: visitors remain anonymous; profile details/photo stay in owner-controlled source files because a public client cannot identify the owner. Uploads happen on Share; a confirmed upload path is retained for an explicit post retry. No automatic retries or visitor delete permissions were added. Understanding of these topics is unassessed.

Independent challenge: demonstrate how a public bucket can allow image retrieval while denying overwrite and object listing. Resource: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

Shared-profile follow-up: Anthony chose a no-login editor that anyone can use. The final design has one RLS-protected profile row; anonymous UPDATE applies only to its seven editable fields, not post permissions. A shared display name is not proof of authorship. Profile editing and picture save/removal passed live browser checks, and all eleven automated tests passed.
