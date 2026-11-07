-- Readable relational projections of the atomically persisted demo state.
-- These views use invoker privileges; no browser role receives database access.
create or replace view shipment_demo.company with (security_invoker=true) as
select id, state->'company' as data from shipment_demo.snapshot;

create or replace view shipment_demo.escalation_reasons with (security_invoker=true) as
select e.id||':'||r.ordinality::text as id, e.id as escalation_id,
 e.shipment_id, r.value->>'attemptId' as attempt_id,
 r.value->>'reason' as reason, r.value->>'at' as added_at
from shipment_demo.escalations e
cross join lateral jsonb_array_elements(e.data->'reasons') with ordinality as r(value,ordinality);

create or replace view shipment_demo.escalation_events with (security_invoker=true) as
select a.id, coalesce(a.data->'details'->>'escalationId',a.data->>'entityId') as escalation_id,
 a.data->>'action' as action, a.data->>'at' as occurred_at,
 a.data->>'actorId' as actor_id, a.data->>'actorType' as actor_type,
 a.data->'details' as details
from shipment_demo.audit a
where a.data->>'action' in ('escalation_opened','escalation_acknowledge','escalation_resolve','escalation_reopen','reason_added','attempt_linked','retry_result_attached','retry_cancelled');

create index if not exists report_attempt on shipment_demo.reports(attempt_id);
create index if not exists shipment_contact on shipment_demo.shipments(contact_id);
revoke all on shipment_demo.company,shipment_demo.escalation_reasons,shipment_demo.escalation_events from public,anon,authenticated;
grant select on shipment_demo.company,shipment_demo.escalation_reasons,shipment_demo.escalation_events to service_role;
