-- Chia bill nhóm – Supabase schema
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Security model:
--   * Tables have RLS enabled and NO policies → the anon key cannot read or
--     write them directly (no listing other people's parties).
--   * Everything goes through SECURITY DEFINER functions below.
--   * Anyone with the party id (random, unguessable) can view it and mark a
--     transfer as paid. Editing requires the organiser key (stored hashed).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.parties (
  id            text primary key check (char_length(id) between 6 and 32),
  data          jsonb not null,
  edit_key_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.payments (
  party_id   text not null references public.parties(id) on delete cascade,
  tx_key     text not null check (char_length(tx_key) <= 80),
  paid       boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (party_id, tx_key)
);

alter table public.parties  enable row level security;
alter table public.payments enable row level security;
revoke all on public.parties  from anon, authenticated;
revoke all on public.payments from anon, authenticated;

-- Max stored party size (images are compressed client-side, but cap anyway)
create or replace function public._check_size(p_data jsonb) returns void
language plpgsql immutable as $$
begin
  if octet_length(p_data::text) > 4000000 then
    raise exception 'Dữ liệu quá lớn (tối đa ~4MB). Hãy xóa bớt ảnh.';
  end if;
end $$;

create or replace function public.get_party(p_id text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'data', p.data,
    'updated_at', p.updated_at,
    'paid', coalesce((select json_object_agg(tx_key, paid) from public.payments where party_id = p.id), '{}'::json)
  )
  from public.parties p where p.id = p_id;
$$;

create or replace function public.create_party(p_id text, p_key text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._check_size(p_data);
  if char_length(p_key) < 12 then raise exception 'invalid key'; end if;
  insert into public.parties (id, data, edit_key_hash)
  values (p_id, p_data, encode(digest(p_key, 'sha256'), 'hex'));
end $$;

create or replace function public.update_party(p_id text, p_key text, p_data jsonb) returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare ts timestamptz;
begin
  perform public._check_size(p_data);
  update public.parties
     set data = p_data, updated_at = now()
   where id = p_id and edit_key_hash = encode(digest(p_key, 'sha256'), 'hex')
  returning updated_at into ts;
  if ts is null then raise exception 'Không có quyền sửa buổi tiệc này'; end if;
  return ts;
end $$;

create or replace function public.set_paid(p_id text, p_tx text, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.parties where id = p_id) then
    raise exception 'Không tìm thấy buổi tiệc';
  end if;
  insert into public.payments (party_id, tx_key, paid, updated_at)
  values (p_id, p_tx, p_paid, now())
  on conflict (party_id, tx_key) do update set paid = excluded.paid, updated_at = now();
end $$;

create or replace function public.delete_party(p_id text, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.parties
   where id = p_id and edit_key_hash = encode(digest(p_key, 'sha256'), 'hex');
  if not found then raise exception 'Không có quyền xóa buổi tiệc này'; end if;
end $$;

revoke all on function public.get_party(text)                  from public;
revoke all on function public.create_party(text, text, jsonb)  from public;
revoke all on function public.update_party(text, text, jsonb)  from public;
revoke all on function public.set_paid(text, text, boolean)    from public;
revoke all on function public.delete_party(text, text)         from public;
revoke all on function public._check_size(jsonb)               from public;

grant execute on function public.get_party(text)                 to anon, authenticated;
grant execute on function public.create_party(text, text, jsonb) to anon, authenticated;
grant execute on function public.update_party(text, text, jsonb) to anon, authenticated;
grant execute on function public.set_paid(text, text, boolean)   to anon, authenticated;
grant execute on function public.delete_party(text, text)        to anon, authenticated;
grant execute on function public._check_size(jsonb)              to anon, authenticated;
