-- platform/config: the version machine shared by every versioned configuration (leave, needs and comms policies,
-- service designer; §7.10). One row per kind holds its governance; versions hold the full content as JSON.
create schema if not exists config;

create table config.config_set (
  kind                 text primary key,           -- leave | need | comms | designer | …
  second_approver      boolean not null default false,
  approver_position_id text,                        -- SAP position whose holder gives the second approval
  owner_position_ids   jsonb   not null default '[]' -- SAP positions allowed to manage this configuration
);

create table config.version (
  id             uuid primary key,
  kind           text    not null references config.config_set (kind),
  number         text    not null,                  -- <year>.<sequence in year>, e.g. 2026.3
  effective_from date    not null,
  scheduled      boolean not null default false,
  cancelled      boolean not null default false,
  created_by     text    not null,                  -- employee number
  created_at     timestamptz not null,
  reason         text    not null default '',
  reference      text    not null default '',
  content        jsonb   not null,
  changes        jsonb   not null default '[]',      -- [{path, object, before, after, at, by, why}]
  base_id        uuid references config.version (id),
  corrects_id    uuid references config.version (id),
  scope          text,                              -- object key the draft is limited to (null = everything)
  approval       jsonb,                             -- {positionId, status, requestedAt, by, at, note}
  revoked        jsonb,                             -- {by, at, reason}
  rebased_from   jsonb,                             -- {id, number, at}
  unique (kind, number)
);
create index version_kind on config.version (kind);

-- Operational changes and version events (take effect at once; no new version).
create table config.ops_log (
  id     bigserial primary key,
  kind   text        not null references config.config_set (kind),
  at     timestamptz not null,
  by     text        not null,
  what   jsonb       not null,                      -- MessageRef, rendered in every language on read
  detail text        not null default ''
);
create index ops_log_kind on config.ops_log (kind, at desc);
