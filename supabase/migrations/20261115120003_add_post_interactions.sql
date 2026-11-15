begin;

create table public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  visitor_id uuid not null,
  unique (post_id, visitor_id)
);
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now()
);
create index post_comments_newest_idx on public.post_comments (post_id, created_at desc, id desc);
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
revoke all on public.post_likes, public.post_comments from public, anon, authenticated;
grant select on public.post_likes, public.post_comments to anon;
grant insert (post_id, visitor_id) on public.post_likes to anon;
grant insert (post_id, body) on public.post_comments to anon;
create policy post_likes_read on public.post_likes for select to anon using (true);
create policy post_likes_insert on public.post_likes for insert to anon with check (true);
create policy post_comments_read on public.post_comments for select to anon using (true);
create policy post_comments_insert on public.post_comments for insert to anon with check (true);

create view public.post_activity with (security_invoker = true) as
select p.id as post_id,
  (select count(*) from public.post_likes l where l.post_id = p.id) as like_count,
  (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count
from public.posts p;
revoke all on public.post_activity from public, anon, authenticated;
grant select on public.post_activity to anon;

alter publication supabase_realtime add table public.post_likes, public.post_comments, public.wall_profile;
commit;
