begin;

create function public.edit_post_with_capability(
  p_post_id uuid,
  p_delete_token text,
  p_body text
)
returns setof public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts%rowtype;
begin
  if p_post_id is null or p_delete_token is null or p_delete_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  if p_body is null or p_body !~ '[^[:space:]]' or pg_catalog.char_length(p_body) > 280 then
    raise exception 'Invalid post body' using errcode = '22023';
  end if;

  update public.posts as p
  set body = p_body
  from private.post_delete_capabilities as c
  where p.id = p_post_id
    and c.post_id = p.id
    and c.token_hash = extensions.digest(pg_catalog.decode(p_delete_token, 'hex'), 'sha256')
  returning p.* into v_post;

  if found then return next v_post; end if;
end;
$$;

revoke all on function public.edit_post_with_capability(uuid, text, text) from public, anon, authenticated;
grant execute on function public.edit_post_with_capability(uuid, text, text) to anon;

commit;
