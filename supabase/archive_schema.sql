-- OPTIONAL staging-only archive schema. Apply only after reviewing access controls.
-- Keeps personal Messenger exports separate from Meta Business Cloud API tables.
create table if not exists public.archive_imports (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_filename text not null check (char_length(source_filename) between 1 and 180),
  entry_count integer not null check (entry_count between 1 and 5000),
  created_at timestamptz not null default now(),
  unique(owner_sub, source_sha256)
);
create index if not exists archive_imports_owner_created_idx
  on public.archive_imports (owner_sub, created_at desc);

create table if not exists public.archive_messages (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.archive_imports(id) on delete cascade,
  entry_index integer not null check (entry_index >= 0),
  timestamp_raw text,
  author text,
  body text not null,
  kind text not null check (kind in ('message', 'system', 'unparsed')),
  source_line_start integer not null check (source_line_start >= 1),
  source_line_end integer not null check (source_line_end >= source_line_start),
  unique(import_id, entry_index)
);
create index if not exists archive_messages_import_index_idx
  on public.archive_messages(import_id, entry_index);
create index if not exists archive_messages_fts_idx
  on public.archive_messages using gin(to_tsvector('simple', body));

alter table public.archive_imports enable row level security;
alter table public.archive_messages enable row level security;
revoke all on public.archive_imports, public.archive_messages from anon, authenticated, public;
revoke all on sequence public.archive_messages_id_seq from anon, authenticated, public;
grant usage on schema public to service_role;
grant select, insert on public.archive_imports, public.archive_messages to service_role;
grant usage, select on sequence public.archive_messages_id_seq to service_role;

-- Atomic, idempotent import; owner_sub is supplied ONLY by the backend after JWT validation.
create or replace function public.ingest_whatsapp_archive(
  p_owner_sub text,
  p_source_sha256 text,
  p_source_filename text,
  p_entries jsonb
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare v_id uuid; v_count integer; v_new boolean := false;
begin
  if length(coalesce(p_owner_sub,'')) < 5
     or p_source_sha256 !~ '^[0-9a-f]{64}$'
     or length(coalesce(p_source_filename,'')) not between 1 and 180
     or jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'invalid_archive_metadata';
  end if;
  v_count := jsonb_array_length(p_entries);
  if v_count not between 1 and 5000 then
    raise exception 'archive_entry_count_out_of_range';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_entries) t(item)
    where jsonb_typeof(item) <> 'object'
       or length(coalesce(item->>'body','')) > 16000
       or length(coalesce(item->>'timestamp_raw','')) > 120
       or length(coalesce(item->>'author','')) > 180
       or coalesce(item->>'kind','') not in ('message','system','unparsed')
       or (item->>'source_line_start') is null
       or (item->>'source_line_end') is null
  ) then
    raise exception 'archive_entry_invalid';
  end if;
  insert into public.archive_imports(owner_sub, source_sha256, source_filename, entry_count)
  values(p_owner_sub, p_source_sha256, p_source_filename, v_count)
  on conflict(owner_sub, source_sha256) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.archive_imports
    where owner_sub = p_owner_sub and source_sha256 = p_source_sha256;
    return jsonb_build_object('import_id', v_id, 'duplicate', true, 'entry_count', v_count);
  end if;
  insert into public.archive_messages(
    import_id, entry_index, timestamp_raw, author, body, kind, source_line_start, source_line_end
  )
  select v_id, (ordinality-1)::int,
     nullif(item->>'timestamp_raw',''), nullif(item->>'author',''),
     coalesce(item->>'body',''), item->>'kind',
     (item->>'source_line_start')::int, (item->>'source_line_end')::int
  from jsonb_array_elements(p_entries) with ordinality as e(item, ordinality);
  return jsonb_build_object('import_id', v_id, 'duplicate', false, 'entry_count', v_count);
end $$;

create or replace function public.list_archived_whatsapp_chats(
  p_owner_sub text, p_limit integer default 50
) returns table(import_id uuid, source_filename text, entry_count integer, imported_at timestamptz)
language sql stable security invoker set search_path=public
as $$
  select i.id, i.source_filename, i.entry_count, i.created_at
  from public.archive_imports i where i.owner_sub=p_owner_sub
  order by i.created_at desc limit least(greatest(p_limit,1),50);
$$;

create or replace function public.search_archived_whatsapp(
  p_owner_sub text, p_query text, p_limit integer default 20
) returns table(import_id uuid, source_filename text, entry_index integer,
                timestamp_raw text, author text, body text, kind text)
language sql stable security invoker set search_path=public
as $$
  select a.id, a.source_filename, m.entry_index, m.timestamp_raw, m.author, m.body, m.kind
  from public.archive_messages m join public.archive_imports a on a.id=m.import_id
  where a.owner_sub = p_owner_sub and char_length(trim(coalesce(p_query,''))) between 1 and 120
    and (
      m.body ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      or coalesce(m.author,'') ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      or to_tsvector('simple',m.body) @@ websearch_to_tsquery('simple',p_query)
    )
  order by a.created_at desc, m.entry_index desc
  limit least(greatest(p_limit,1),50);
$$;

create or replace function public.get_archived_whatsapp_chat(
  p_owner_sub text, p_import_id uuid, p_limit integer default 100, p_offset integer default 0
) returns table(entry_index integer, timestamp_raw text, author text, body text, kind text)
language sql stable security invoker set search_path=public
as $$
  select m.entry_index, m.timestamp_raw, m.author, m.body, m.kind
  from public.archive_messages m
  join public.archive_imports i on i.id=m.import_id
  where i.owner_sub = p_owner_sub and i.id=p_import_id
  order by m.entry_index
  limit least(greatest(p_limit,1),200) offset least(greatest(p_offset,0),100000);
$$;

revoke all on function public.ingest_whatsapp_archive(text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.list_archived_whatsapp_chats(text,integer) from public, anon, authenticated;
revoke all on function public.search_archived_whatsapp(text,text,integer) from public, anon, authenticated;
revoke all on function public.get_archived_whatsapp_chat(text,uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.ingest_whatsapp_archive(text,text,text,jsonb) to service_role;
grant execute on function public.list_archived_whatsapp_chats(text,integer) to service_role;
grant execute on function public.search_archived_whatsapp(text,text,integer) to service_role;
grant execute on function public.get_archived_whatsapp_chat(text,uuid,integer,integer) to service_role;
