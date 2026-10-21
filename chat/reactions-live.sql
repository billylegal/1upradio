-- Live reactions: lets the page see OTHER people's taps (kind only, no ids of people) so fire/heart float up near the player. Safe to run again.
create or replace function public.reaction_head(st text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(max(id), 0) from public.reactions where station = st
$$;
create or replace function public.recent_reactions(st text, after_id bigint, my_cid text) returns table(id bigint, kind text)
language sql stable security definer set search_path = public as $$
  select id, kind from public.reactions
  where station = st and id > after_id and cid <> my_cid and created_at > now() - interval '2 minutes'
  order by id limit 30
$$;
grant execute on function public.reaction_head(text) to anon;
grant execute on function public.recent_reactions(text, bigint, text) to anon;
