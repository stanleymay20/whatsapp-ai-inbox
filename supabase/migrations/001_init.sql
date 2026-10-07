create extension if not exists pgcrypto;

create table if not exists contacts (
  whatsapp_id text primary key,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id text primary key,
  contact_whatsapp_id text not null references contacts(whatsapp_id) on delete cascade,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_last_message_idx on conversations(last_message_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  meta_message_id text not null unique,
  conversation_id text not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  source text not null default 'cloud_api',
  message_type text not null default 'text',
  body text not null default '',
  sent_at timestamptz not null,
  delivery_status text,
  status_updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_sent_idx on messages(conversation_id, sent_at desc);
create index if not exists messages_body_fts_idx on messages using gin (to_tsvector('simple', coalesce(body,'')));

create table if not exists message_priority (
  message_id uuid primary key references messages(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  priority text not null check (priority in ('critical','high','medium','low')),
  category text not null,
  opportunity boolean not null default false,
  action_required boolean not null default false,
  rationale text not null,
  suggested_action text not null,
  deadline_iso text,
  deadline_at timestamptz,
  short_summary text not null,
  created_at timestamptz not null default now()
);
create index if not exists message_priority_score_idx on message_priority(score desc, created_at desc);

create table if not exists conversation_summaries (
  conversation_id text primary key references conversations(id) on delete cascade,
  summary text not null,
  updated_at timestamptz not null default now()
);

create table if not exists reply_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references conversations(id) on delete cascade,
  body text not null,
  status text not null default 'pending' check (status in ('pending','approved','sent','rejected')),
  confirmation_code text,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  rejected_at timestamptz,
  sent_at timestamptz,
  meta_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log(created_at desc);

create table if not exists mcp_event_subscriptions (
  id text primary key,
  owner_sub text not null,
  event_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  callback_url text not null,
  signing_secret text not null,
  refresh_before timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mcp_event_subscriptions_active_idx on mcp_event_subscriptions(active, event_name, refresh_before);

-- Server-only design: no browser policies. service_role bypasses RLS.
alter table contacts enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table message_priority enable row level security;
alter table conversation_summaries enable row level security;
alter table reply_drafts enable row level security;
alter table audit_log enable row level security;
alter table mcp_event_subscriptions enable row level security;

create or replace function search_whatsapp_messages(q text, p_since timestamptz default null, p_until timestamptz default null, p_limit int default 20)
returns table(message_id uuid, conversation_id text, contact_phone text, contact_name text, direction text, body text, sent_at timestamptz, priority text, score int, category text)
language sql stable security invoker set search_path=public as $$
  select m.id, m.conversation_id, c.whatsapp_id, c.display_name, m.direction, m.body, m.sent_at, p.priority, p.score, p.category
  from messages m
  join conversations cv on cv.id=m.conversation_id
  join contacts c on c.whatsapp_id=cv.contact_whatsapp_id
  left join message_priority p on p.message_id=m.id
  where (q is null or q='' or to_tsvector('simple', coalesce(m.body,'')) @@ websearch_to_tsquery('simple', q) or c.display_name ilike '%'||q||'%' or c.whatsapp_id ilike '%'||q||'%')
    and (p_since is null or m.sent_at >= p_since)
    and (p_until is null or m.sent_at <= p_until)
  order by m.sent_at desc limit least(greatest(p_limit,1),50);
$$;

create or replace function list_priority_messages(p_min_score int default 60, p_days int default 30, p_unresolved_only boolean default true, p_limit int default 50)
returns table(message_id uuid, conversation_id text, contact_phone text, contact_name text, body text, sent_at timestamptz, score int, priority text, category text, opportunity boolean, action_required boolean, short_summary text, suggested_action text, deadline_at timestamptz)
language sql stable security invoker set search_path=public as $$
  select m.id, m.conversation_id, c.whatsapp_id, c.display_name, m.body, m.sent_at, p.score, p.priority, p.category, p.opportunity, p.action_required, p.short_summary, p.suggested_action, p.deadline_at
  from message_priority p join messages m on m.id=p.message_id join conversations cv on cv.id=m.conversation_id join contacts c on c.whatsapp_id=cv.contact_whatsapp_id
  where p.score >= p_min_score and m.sent_at >= now() - make_interval(days=>least(greatest(p_days,1),365)) and (not p_unresolved_only or cv.resolved_at is null)
  order by p.score desc, m.sent_at desc limit least(greatest(p_limit,1),50);
$$;

create or replace function list_unanswered_messages(p_older_than_hours int default 4, p_limit int default 30)
returns table(conversation_id text, contact_phone text, contact_name text, inbound_message_id uuid, inbound_body text, inbound_at timestamptz, priority text, score int, suggested_action text)
language sql stable security invoker set search_path=public as $$
  with last_in as (
    select distinct on (conversation_id) id, conversation_id, body, sent_at from messages where direction='inbound' order by conversation_id, sent_at desc
  ), last_out as (
    select conversation_id, max(sent_at) sent_at from messages where direction='outbound' group by conversation_id
  )
  select li.conversation_id, c.whatsapp_id, c.display_name, li.id, li.body, li.sent_at, p.priority, p.score, p.suggested_action
  from last_in li join conversations cv on cv.id=li.conversation_id join contacts c on c.whatsapp_id=cv.contact_whatsapp_id
  left join last_out lo on lo.conversation_id=li.conversation_id left join message_priority p on p.message_id=li.id
  where li.sent_at <= now() - make_interval(hours=>greatest(p_older_than_hours,0)) and (lo.sent_at is null or lo.sent_at < li.sent_at) and cv.resolved_at is null
  order by coalesce(p.score,0) desc, li.sent_at asc limit least(greatest(p_limit,1),50);
$$;

-- Explicit Data API privileges: this project is server-only.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on contacts, conversations, messages, message_priority, conversation_summaries, reply_drafts, audit_log, mcp_event_subscriptions to service_role;
grant usage, select, update on sequence audit_log_id_seq to service_role;

revoke all on function search_whatsapp_messages(text,timestamptz,timestamptz,int) from public, anon, authenticated;
revoke all on function list_priority_messages(int,int,boolean,int) from public, anon, authenticated;
revoke all on function list_unanswered_messages(int,int) from public, anon, authenticated;
grant execute on function search_whatsapp_messages(text,timestamptz,timestamptz,int) to service_role;
grant execute on function list_priority_messages(int,int,boolean,int) to service_role;
grant execute on function list_unanswered_messages(int,int) to service_role;
