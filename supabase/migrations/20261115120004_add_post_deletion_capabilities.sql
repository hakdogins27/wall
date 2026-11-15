begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.post_delete_capabilities (
  post_id uuid primary key references public.posts(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32)
);
alter table private.post_delete_capabilities enable row level security;
revoke all on private.post_delete_capabilities from public, anon, authenticated;

create function public.create_post_with_delete_capability(
  p_body text,
  p_image_path text,
  p_delete_token text
)
returns setof public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash bytea;
  v_post_id uuid;
  v_post public.posts%rowtype;
begin
  if p_delete_token is null or p_delete_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid delete capability' using errcode = '22023';
  end if;
  if p_body is null or p_body !~ '[^[:space:]]' or pg_catalog.char_length(p_body) > 280 then
    raise exception 'Invalid post body' using errcode = '22023';
  end if;
  if p_image_path is not null and p_image_path !~ '^posts/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then
    raise exception 'Invalid post image path' using errcode = '22023';
  end if;

  v_token_hash := extensions.digest(pg_catalog.decode(p_delete_token, 'hex'), 'sha256');
  select c.post_id into v_post_id
  from private.post_delete_capabilities as c
  where c.token_hash = v_token_hash;

  if found then
    select p.* into v_post from public.posts as p where p.id = v_post_id;
    if v_post.body is distinct from p_body or v_post.image_path is distinct from p_image_path then
      raise exception 'Delete capability already used' using errcode = '23505';
    end if;
    return next v_post;
    return;
  end if;

  insert into public.posts (body, image_path)
  values (p_body, p_image_path)
  returning * into v_post;
  insert into private.post_delete_capabilities (post_id, token_hash)
  values (v_post.id, v_token_hash);
  return next v_post;
end;
$$;

create function public.delete_post_with_capability(
  p_post_id uuid,
  p_delete_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted boolean := false;
begin
  if p_post_id is null or p_delete_token is null or p_delete_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  delete from public.posts as p
  using private.post_delete_capabilities as c
  where p.id = p_post_id
    and c.post_id = p.id
    and c.token_hash = extensions.digest(pg_catalog.decode(p_delete_token, 'hex'), 'sha256');
  v_deleted := found;
  return v_deleted;
end;
$$;

revoke all on function public.create_post_with_delete_capability(text, text, text) from public, anon, authenticated;
revoke all on function public.delete_post_with_capability(uuid, text) from public, anon, authenticated;
grant execute on function public.create_post_with_delete_capability(text, text, text) to anon;
grant execute on function public.delete_post_with_capability(uuid, text) to anon;

commit;
