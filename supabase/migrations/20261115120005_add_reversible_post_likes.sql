begin;

create table private.post_like_capabilities (
  like_id uuid primary key references public.post_likes(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32)
);
alter table private.post_like_capabilities enable row level security;
revoke all on private.post_like_capabilities from public, anon, authenticated;

revoke insert on public.post_likes from anon;
revoke insert (post_id, visitor_id) on public.post_likes from anon;
drop policy post_likes_insert on public.post_likes;

create function public.like_post_with_capability(
  p_post_id uuid,
  p_visitor_id uuid,
  p_like_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_like_id uuid;
  v_token_hash bytea;
begin
  if p_post_id is null or p_visitor_id is null or p_like_token is null or p_like_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid like capability' using errcode = '22023';
  end if;
  v_token_hash := extensions.digest(pg_catalog.decode(p_like_token, 'hex'), 'sha256');

  insert into public.post_likes (post_id, visitor_id)
  values (p_post_id, p_visitor_id)
  on conflict (post_id, visitor_id) do nothing
  returning id into v_like_id;

  if v_like_id is null then
    select l.id into v_like_id
    from public.post_likes as l
    where l.post_id = p_post_id and l.visitor_id = p_visitor_id;
    return exists (
      select 1 from private.post_like_capabilities as c
      where c.like_id = v_like_id and c.token_hash = v_token_hash
    );
  end if;

  insert into private.post_like_capabilities (like_id, token_hash)
  values (v_like_id, v_token_hash);
  return true;
end;
$$;

create function public.unlike_post_with_capability(
  p_post_id uuid,
  p_visitor_id uuid,
  p_like_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_post_id is null or p_visitor_id is null or p_like_token is null or p_like_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  delete from public.post_likes as l
  using private.post_like_capabilities as c
  where l.id = c.like_id
    and l.post_id = p_post_id
    and l.visitor_id = p_visitor_id
    and c.token_hash = extensions.digest(pg_catalog.decode(p_like_token, 'hex'), 'sha256');
  return found;
end;
$$;

revoke all on function public.like_post_with_capability(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.unlike_post_with_capability(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.like_post_with_capability(uuid, uuid, text) to anon;
grant execute on function public.unlike_post_with_capability(uuid, uuid, text) to anon;

commit;
