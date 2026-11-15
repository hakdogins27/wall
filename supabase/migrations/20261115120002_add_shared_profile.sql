begin;

create table public.wall_profile (
  id smallint primary key default 1 check (id = 1),
  display_name text not null default 'Anthony Mendoza'
    check (char_length(display_name) between 1 and 80 and display_name ~ '[^[:space:]]'),
  about text not null default '' check (char_length(about) <= 1000),
  skills text not null default '' check (char_length(skills) <= 500),
  website text check (website is null or (char_length(website) <= 500 and website ~ '^https://[^[:space:]]+$')),
  github text check (github is null or (char_length(github) <= 500 and github ~ '^https://[^[:space:]]+$')),
  linkedin text check (linkedin is null or (char_length(linkedin) <= 500 and linkedin ~ '^https://[^[:space:]]+$')),
  photo_path text check (
    photo_path is null or photo_path ~ '^profile/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  )
);

alter table public.wall_profile enable row level security;
revoke all on public.wall_profile from public, anon, authenticated;
grant select on public.wall_profile to anon;
grant update (display_name, about, skills, website, github, linkedin, photo_path)
  on public.wall_profile to anon;

create policy wall_profile_public_read
  on public.wall_profile for select to anon using (true);
create policy wall_profile_shared_edit
  on public.wall_profile for update to anon
  using (id = 1) with check (id = 1);

insert into public.wall_profile (id) values (1);

create policy wall_images_shared_profile_insert
  on storage.objects for insert to anon
  with check (
    bucket_id = 'wall-images'
    and name ~ '^profile/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

commit;
