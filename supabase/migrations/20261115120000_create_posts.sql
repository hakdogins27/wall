begin;

create table public.posts (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid,
  body text not null,
  created_at timestamptz not null default now(),
  constraint posts_body_length check (char_length(body) between 1 and 280),
  constraint posts_body_nonblank check (body ~ '[^[:space:]]')
);

create index posts_newest_idx
  on public.posts (created_at desc, id desc);

alter table public.posts enable row level security;

revoke all on table public.posts from public, anon, authenticated;
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
