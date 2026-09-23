-- Slice 1.1: return / resubmit / withdraw, the decision history ("done by me"), optimistic locking and index tables
-- that keep the inbox and the lists fast as the number of requests grows.

-- A returned step waits for the requester; a withdrawn or returned instance is not running.
alter table workflow.step drop constraint step_status_check;
alter table workflow.step add constraint step_status_check
  check (status in ('pending', 'current', 'done', 'rejected', 'skipped', 'waiting', 'returned'));
alter table workflow.instance drop constraint instance_status_check;
alter table workflow.instance add constraint instance_status_check
  check (status in ('running', 'returned', 'completed', 'rejected', 'withdrawn'));

-- What the step's holder may decide (["approve","return","reject"]…); null = the mode's defaults.
alter table workflow.step add column decisions jsonb;

-- Every human decision, append-only: the step row keeps only its latest state (a returned step is reopened on resubmit).
create table workflow.decision (
  id         bigserial primary key,
  step_id    bigint      not null references workflow.step (id),
  request_id text        not null references workflow.instance (request_id),
  actor_id   text        not null,
  action     text        not null check (action in ('approve', 'return', 'reject', 'done', 'receive')),
  note       text,
  ref        text,
  at         timestamptz not null
);
create index decision_actor_idx on workflow.decision (actor_id, at desc, id desc);
create index decision_request_idx on workflow.decision (request_id);
insert into workflow.decision (step_id, request_id, actor_id, action, note, ref, at)
select id, request_id, actor_id, action, note, ref, completed_at from workflow.step
 where actor_id is not null and completed_at is not null and action in ('approve', 'reject', 'done', 'receive');

-- Who can act on an open step, one row per SAP position or person: the inbox looks tasks up by the viewer's positions
-- through this index instead of scanning every open step. Rewritten whenever a step opens.
create table workflow.step_assignee (
  step_id     bigint not null references workflow.step (id),
  position_id text,
  person_id   text,
  check ((position_id is null) <> (person_id is null))
);
create index step_assignee_position_idx on workflow.step_assignee (position_id) where position_id is not null;
create index step_assignee_person_idx on workflow.step_assignee (person_id) where person_id is not null;
create index step_assignee_step_idx on workflow.step_assignee (step_id);
insert into workflow.step_assignee (step_id, position_id)
select s.id, p from workflow.step s, jsonb_array_elements_text(s.position_ids) p where s.status = 'current';
insert into workflow.step_assignee (step_id, person_id)
select s.id, p from workflow.step s, jsonb_array_elements_text(s.assigned_to) p where s.status = 'current';

-- Optimistic locking: every change bumps the version; a client that acted on an older one gets 409.
alter table requests.request add column version integer not null default 0;
-- My requests, newest change first, paged by (updated_at, id).
create index request_mine_idx on requests.request (requester_id, updated_at desc, id desc);
