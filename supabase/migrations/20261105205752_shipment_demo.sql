-- Dedicated shipment-demo schema. No objects in other application schemas are changed.
create schema if not exists shipment_demo;
create table shipment_demo.members (user_id uuid primary key, role text not null check (role in ('coordinator','viewer')));
create table shipment_demo.snapshot (id boolean primary key default true check(id), version integer not null, state jsonb not null);
create table shipment_demo.contacts (id text primary key, data jsonb not null);
create table shipment_demo.shipments (
 id text primary key, data jsonb not null,
 reference text generated always as (lower(data->>'reference')) stored unique,
 contact_id text generated always as (data->>'contactId') stored references shipment_demo.contacts(id)
);
create table shipment_demo.checks (
 id text primary key, data jsonb not null,
 shipment_id text generated always as (data->>'shipmentId') stored references shipment_demo.shipments(id),
 request_id text generated always as (data->>'requestId') stored unique,
 status text generated always as (data->>'status') stored,
 check (data->>'status' in ('active','finished')),
 check ((data->>'autoRetriesUsed')::integer between 0 and 1)
);
create unique index one_active_check on shipment_demo.checks(shipment_id) where status='active';
create table shipment_demo.attempts (
 id text primary key, data jsonb not null,
 check_id text generated always as (data->>'checkId') stored references shipment_demo.checks(id),
 shipment_id text generated always as (data->>'shipmentId') stored references shipment_demo.shipments(id),
 request_id text generated always as (data->>'requestId') stored unique,
 status text generated always as (data->>'status') stored,
 check (data->>'mode' = 'simulated'),
 check (data->>'status' in ('in_progress','finished')),
 check (data->>'status' <> 'finished' or data->>'outcome' in ('eta_captured','eta_incomplete','ambiguous','no_answer','voicemail','dropped','wrong_number','refused'))
);
create unique index one_running_attempt on shipment_demo.attempts(shipment_id) where status='in_progress';
create table shipment_demo.reports (
 id text primary key, data jsonb not null,
 shipment_id text generated always as (data->>'shipmentId') stored references shipment_demo.shipments(id),
 attempt_id text generated always as (data->>'attemptId') stored references shipment_demo.attempts(id),
 check (data->>'capture' in ('captured','uncaptured')),
 check (data->>'capture' <> 'captured' or (data->>'instant' is not null and data->>'completeness'='complete')),
 check ((data->>'source'='carrier' and data->>'attemptId' is not null) or
 (data->>'source'='human_correction' and data->>'attemptId' is null and data->>'recordedBy' is not null and length(data->>'reason')>0))
);
create table shipment_demo.escalations (
 id text primary key, data jsonb not null,
 shipment_id text generated always as (data->>'shipmentId') stored references shipment_demo.shipments(id),
 status text generated always as (data->>'status') stored,
 check (data->>'status' in ('open','acknowledged','resolved')),
 check (data->>'status'<>'resolved' or length(data->>'resolutionNote')>0)
);
create unique index one_open_escalation on shipment_demo.escalations(shipment_id) where status in ('open','acknowledged');
create table shipment_demo.events (
 id text primary key, data jsonb not null,
 attempt_id text generated always as (data->>'attemptId') stored references shipment_demo.attempts(id),
 provider_event_id text generated always as (data->>'providerEventId') stored,
 unique(attempt_id,provider_event_id)
);
create table shipment_demo.audit (id text primary key, data jsonb not null);
create table shipment_demo.annotations (id text primary key, data jsonb not null);
create table shipment_demo.suppression_events (id text primary key, data jsonb not null);
create index report_shipment on shipment_demo.reports(shipment_id);
create index attempt_check on shipment_demo.attempts(check_id);
create index checks_shipment on shipment_demo.checks(shipment_id);
create index issues_shipment on shipment_demo.escalations(shipment_id);

-- Browser roles have no access to this schema or the mutation RPCs. The local Node
-- server verifies Supabase Auth and membership before applying the pure domain module.
-- A service key is required by the hosted adapter; never send it to a browser.
create or replace function public.shipment_demo_read() returns jsonb language sql security invoker set search_path='' as $$
 select state from shipment_demo.snapshot where id=true;
$$;
create or replace function public.shipment_demo_role(p_user_id uuid) returns text language sql security invoker set search_path='' as $$
 select role from shipment_demo.members where user_id=p_user_id;
$$;
create or replace function public.shipment_demo_save(p_expected integer,p_state jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare current_version integer; mapping record; item jsonb; old_item jsonb; arr jsonb;
begin
 -- Serializes initialization as well as all subsequent snapshot/row transactions.
 perform pg_advisory_xact_lock(17462026);
 select version into current_version from shipment_demo.snapshot where id=true for update;
 if coalesce(current_version,-1) <> p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if (p_state->>'version')::integer <> p_expected+1 then raise exception 'INVALID_VERSION'; end if;
 for mapping in select * from (values
 ('contacts','contacts',false),('shipments','shipments',false),('checks','checks',false),('attempts','attempts',false),
 ('reports','reports',true),('escalations','escalations',false),('events','events',true),('audit','audit',true),
 ('annotations','annotations',true),('suppression_events','suppressionEvents',true)
 ) as m(tab,key,immutable)
 loop
  arr:=p_state->mapping.key;
  if jsonb_typeof(arr) is distinct from 'array' then raise exception 'INVALID_STATE_ARRAY'; end if;
  -- No record can disappear during a normal command, including retired shipments.
  if exists (select 1 from jsonb_array_elements(coalesce((select state->mapping.key from shipment_demo.snapshot where id=true),'[]'::jsonb)) old
    where not exists(select 1 from jsonb_array_elements(arr) fresh where fresh->>'id'=old->>'id')) then raise exception 'HISTORY_REMOVAL'; end if;
  for item in select value from jsonb_array_elements(arr) loop
   if nullif(item->>'id','') is null then raise exception 'MISSING_ID'; end if;
   if mapping.immutable then
    execute format('select data from shipment_demo.%I where id=$1',mapping.tab) into old_item using item->>'id';
    if old_item is not null and old_item<>item then raise exception 'IMMUTABLE_HISTORY'; end if;
    execute format('insert into shipment_demo.%I(id,data) values($1,$2) on conflict(id) do nothing',mapping.tab) using item->>'id',item;
   else
    execute format('insert into shipment_demo.%I(id,data) values($1,$2) on conflict(id) do update set data=excluded.data',mapping.tab) using item->>'id',item;
   end if;
  end loop;
 end loop;
 -- Cross-table guard: only successfully completed calls can have captured reports.
 if exists(select 1 from shipment_demo.reports r join shipment_demo.attempts a on a.id=r.attempt_id
   where r.data->>'capture'='captured' and a.data->>'outcome'<>'eta_captured') then raise exception 'FALSE_CAPTURE'; end if;
 insert into shipment_demo.snapshot(id,version,state) values(true,(p_state->>'version')::integer,p_state)
 on conflict(id) do update set version=excluded.version,state=excluded.state;
 return (p_state->>'version')::integer;
end;
$$;

-- Local reset is intentionally not exposed as a hosted RPC. Hosted history remains.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='shipment_demo' loop
  execute format('alter table shipment_demo.%I enable row level security',t.tablename);
 end loop;
end $$;
revoke all on schema shipment_demo from public;
revoke all on all tables in schema shipment_demo from public;
revoke all on function public.shipment_demo_read() from public;
revoke all on function public.shipment_demo_save(integer,jsonb) from public;
revoke all on function public.shipment_demo_role(uuid) from public;
-- These roles exist on Supabase. Local Postgres test runner creates equivalent roles.
grant usage on schema shipment_demo to service_role;
grant all on all tables in schema shipment_demo to service_role;
grant execute on function public.shipment_demo_read() to service_role;
grant execute on function public.shipment_demo_save(integer,jsonb) to service_role;
grant execute on function public.shipment_demo_role(uuid) to service_role;
revoke all on schema shipment_demo from anon, authenticated;
revoke all on function public.shipment_demo_read() from anon, authenticated;
revoke all on function public.shipment_demo_save(integer,jsonb) from anon, authenticated;
revoke all on function public.shipment_demo_role(uuid) from anon, authenticated;
