-- 1UP Radio chat room + reactions: paste this whole file into Supabase > SQL Editor > Run. Safe to run again.
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  station text not null,
  nick text not null,
  body text not null,
  cid text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint msg_len check (char_length(body) between 1 and 200 and char_length(nick) between 1 and 20),
  constraint msg_station check (station in ('1up','cultureshock','vault','movement'))
);
create index if not exists messages_station_id on public.messages (station, id desc);
create table if not exists public.reactions (
  id bigint generated always as identity primary key,
  station text not null,
  song text not null,
  kind text not null,
  cid text not null,
  created_at timestamptz not null default now(),
  constraint react_kind check (kind in ('fire','heart','hands','music','clap')),
  constraint react_station check (station in ('1up','cultureshock','vault','movement')),
  constraint react_song check (char_length(song) between 1 and 40)
);
create index if not exists reactions_song on public.reactions (song, kind);

alter table public.messages enable row level security;
alter table public.reactions enable row level security;
drop policy if exists "read messages" on public.messages;
create policy "read messages" on public.messages for select to anon using (hidden = false);
drop policy if exists "post messages" on public.messages;
create policy "post messages" on public.messages for insert to anon with check (hidden = false);
drop policy if exists "post reactions" on public.reactions;
create policy "post reactions" on public.reactions for insert to anon with check (true);
-- nobody can update or delete from the site; you hide a message in Supabase > Table editor > messages > set hidden = true

-- slow-down + word filter (the page filters too; this is the backstop)
create or replace function public.guard_message() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.messages where cid = new.cid and created_at > now() - interval '3 seconds') then
    raise exception 'slow down';
  end if;
  if (select count(*) from public.messages where cid = new.cid and created_at > now() - interval '1 minute') >= 12 then
    raise exception 'too many messages';
  end if;
  if lower(new.body || ' ' || new.nick) ~ '(fuck|shit|bitch|cunt|nigg|fagg|rape|retard)' then
    raise exception 'language';
  end if;
  new.body := regexp_replace(new.body, '(https?://|www\.)\S+', '[link removed]', 'gi');
  return new;
end $$;
drop trigger if exists guard_message on public.messages;
create trigger guard_message before insert on public.messages for each row execute function public.guard_message();

create or replace function public.guard_reaction() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.reactions where cid = new.cid and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many taps';
  end if;
  return new;
end $$;
drop trigger if exists guard_reaction on public.reactions;
create trigger guard_reaction before insert on public.reactions for each row execute function public.guard_reaction();

-- live counts for one song: select * from reaction_counts('VIDEOID')
create or replace function public.reaction_counts(song_id text) returns table(kind text, n bigint)
language sql stable security definer set search_path = public as $$
  select kind, count(*) from public.reactions where song = song_id group by kind
$$;
grant execute on function public.reaction_counts(text) to anon;

-- make sure the public (anon) key can do exactly this and nothing more
grant select, insert on public.messages to anon;
grant insert on public.reactions to anon;
