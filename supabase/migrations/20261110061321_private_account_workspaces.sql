create table shipment_demo.account_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version integer not null,
 state jsonb not null check (jsonb_typeof(state)='object')
);
alter table shipment_demo.account_workspaces enable row level security;
revoke all on shipment_demo.account_workspaces from public,anon,authenticated;
grant all on shipment_demo.account_workspaces to service_role;
-- Preserve the original shared history for its owner; never clone it to new accounts.
insert into shipment_demo.account_workspaces(user_id,version,state)
select u.id,s.version,s.state from auth.users u cross join shipment_demo.snapshot s
where lower(u.email)='aakankshagyan3010@gmail.com' and s.id=true;
create function public.shipment_account_read(p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select state from shipment_demo.account_workspaces where user_id=p_user_id;
$$;
create function public.shipment_account_save(p_user_id uuid,p_expected integer,p_state jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare previous jsonb; v integer; k text;
begin
 if not exists(select 1 from shipment_demo.members where user_id=p_user_id and role='coordinator') then raise exception 'Workspace access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select version,state into v,previous from shipment_demo.account_workspaces where user_id=p_user_id;
 if coalesce(v,-1)<>p_expected then raise exception 'VERSION_CONFLICT'; end if;
 if (p_state->>'version')::integer is distinct from p_expected+1 then raise exception 'INVALID_VERSION'; end if;
 foreach k in array array['contacts','shipments','checks','attempts','reports','escalations','events','audit','annotations','suppressionEvents','requests'] loop
  if jsonb_typeof(p_state->k) is distinct from 'array' then raise exception 'INVALID_STATE_ARRAY'; end if;
 end loop;
 foreach k in array array['reports','events','audit','annotations','suppressionEvents'] loop
  if exists(select 1 from jsonb_array_elements(coalesce(previous->k,'[]')) old where not exists(select 1 from jsonb_array_elements(p_state->k) fresh where fresh=old)) then raise exception 'IMMUTABLE_HISTORY'; end if;
 end loop;
 insert into shipment_demo.account_workspaces values(p_user_id,p_expected+1,p_state)
 on conflict(user_id) do update set version=excluded.version,state=excluded.state;
end;
$$;
create function public.shipment_account_audio_audit() returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(a.value),'[]'::jsonb) from shipment_demo.account_workspaces w cross join lateral jsonb_array_elements(w.state->'audit') a where a.value->>'action'='conversation_audio_saved';
$$;
revoke all on function public.shipment_account_read(uuid),public.shipment_account_save(uuid,integer,jsonb),public.shipment_account_audio_audit() from public,anon,authenticated;
grant execute on function public.shipment_account_read(uuid),public.shipment_account_save(uuid,integer,jsonb),public.shipment_account_audio_audit() to service_role;
-- The old global snapshot remains archived, but the hosted API cannot read/write it.
revoke execute on function public.shipment_demo_read(),public.shipment_demo_save(integer,jsonb) from service_role;
