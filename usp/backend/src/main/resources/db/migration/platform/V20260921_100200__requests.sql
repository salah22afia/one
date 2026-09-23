-- platform/requests: one request per service instance (P-05); data validated against the pinned service version.
create schema if not exists requests;

create table requests.request (
  id              text primary key,
  service_id      text        not null,
  module          text        not null,
  feature         text        not null,
  service_version integer     not null,
  requester_id    text        not null,
  status          text        not null check (status in ('in_review', 'returned', 'rejected', 'completed', 'withdrawn')),
  channel         text        not null check (channel in ('web', 'app')),
  data            jsonb       not null,
  created_at      timestamptz not null,
  updated_at      timestamptz not null
);
create index on requests.request (requester_id, created_at desc);

-- Append-only: the application only inserts (ponytail: enforce with grants once DB roles are split per environment).
create table requests.audit (
  id         bigserial primary key,
  request_id text        not null references requests.request (id),
  at         timestamptz not null,
  actor_id   text,
  what_ar    text        not null,
  what_en    text        not null
);
create index on requests.audit (request_id, at);
