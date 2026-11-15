begin;

alter table public.posts
  add column image_path text,
  add constraint posts_image_path check (
    image_path is null or image_path ~ '^posts/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );
grant insert (image_path) on table public.posts to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wall-images', 'wall-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp']);

create policy wall_images_public_insert
  on storage.objects for insert to anon
  with check (
    bucket_id = 'wall-images'
    and name ~ '^posts/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

commit;
