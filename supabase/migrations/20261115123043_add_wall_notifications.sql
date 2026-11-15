begin;

-- Old likes have no reliable creation time; only future likes receive one.
alter table public.post_likes add column created_at timestamptz;
alter table public.post_likes alter column created_at set default now();
create index post_likes_recent_idx on public.post_likes (created_at desc, id desc) where created_at is not null;
create index post_comments_recent_idx on public.post_comments (created_at desc, id desc);

create view public.wall_notifications with (security_invoker = true) as
  select 'post:' || p.id::text as id, p.id as post_id, 'post'::text as kind, p.body, p.created_at
  from public.posts p
  union all
  select 'comment:' || c.id::text, c.post_id, 'comment'::text, c.body, c.created_at
  from public.post_comments c
  union all
  select 'like:' || l.id::text, l.post_id, 'like'::text, null::text, l.created_at
  from public.post_likes l where l.created_at is not null;
revoke all on public.wall_notifications from public, anon, authenticated;
grant select on public.wall_notifications to anon;

commit;
