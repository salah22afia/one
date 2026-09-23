-- platform/workflow: in-house engine state (§7.6.1). Steps keep their agent rule and are re-resolved while open (A2).
create schema if not exists workflow;

create table workflow.instance (
  request_id      text primary key,
  service_id      text        not null,
  service_version integer     not null,
  requester_id    text        not null,
  status          text        not null check (status in ('running', 'completed', 'rejected')),
  data            jsonb       not null,
  created_at      timestamptz not null
);

create table workflow.step (
  id           bigserial primary key,
  request_id   text        not null references workflow.instance (request_id),
  seq          integer     not null,
  key          text        not null,
  title_ar     text        not null,
  title_en     text        not null,
  mode         text        not null check (mode in ('approve', 'notify', 'fulfil', 'receipt', 'system')),
  status       text        not null check (status in ('pending', 'current', 'done', 'rejected', 'skipped', 'waiting')),
  agent        jsonb,
  position_ids jsonb       not null default '[]',
  why_ar       text,
  why_en       text,
  operation    text,
  sla_hours    integer,
  started_at   timestamptz,
  due_at       timestamptz,
  completed_at timestamptz,
  actor_id     text,
  action       text,
  note         text,
  ref          text,
  unique (request_id, seq)
);
create index on workflow.step (status) where status = 'current';
