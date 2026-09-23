-- platform/catalog: the service catalogue employees browse and search (CAT-01), and the Home services dock.
-- Operational configuration: administrators change it in the admin portal, it takes effect at once, and every change is
-- written to catalog.change_log. Texts are language maps ({"ar": …, "en": …}); a missing language falls back on read.
create schema if not exists catalog;

-- Domains: the 16 catalogue domains (one per business module).
create table catalog.domain (
  code        text primary key check (code ~ '^[A-Z]{2,4}$'),
  name        jsonb       not null,
  description jsonb       not null default '{}',
  icon        text        not null default 'grid' check (icon ~ '^[a-zA-Z]{1,24}$'),
  tone        text        check (tone in ('g-green', 'g-gold', 'g-sage', 'g-bronze', 'g-teal')),
  sort        integer     not null,
  version     integer     not null default 0,
  updated_at  timestamptz not null,
  updated_by  text        not null
);

-- Services. status: available (can be requested now), wave2, wave3, later (listed as coming), hidden (not listed),
-- merged (folded into another service, not listed). Services are never deleted (A5): they are hidden.
create table catalog.service (
  id          text primary key check (id ~ '^[A-Z]{2,4}-[0-9]{2}[A-Z]?$'),
  domain_code text        not null references catalog.domain (code),
  name        jsonb       not null,
  scope       jsonb       not null default '{}',
  requesters  jsonb       not null default '{}',
  target      jsonb       not null default '{}',
  keywords    jsonb       not null default '{}',
  frequency   text        check (frequency in ('high', 'seasonal', 'medium', 'low')),
  status      text        not null check (status in ('available', 'wave2', 'wave3', 'later', 'hidden', 'merged')),
  merged_into text        references catalog.service (id),
  sort        integer     not null,
  version     integer     not null default 0,
  updated_at  timestamptz not null,
  updated_by  text        not null,
  check ((status = 'merged') = (merged_into is not null)),
  check (merged_into is null or merged_into <> id)
);
create index service_domain_idx on catalog.service (domain_code, sort);

-- The Home services dock: an ordered list of available services with a short label, icon and tone.
create table catalog.dock (
  id         integer primary key check (id = 1),
  version    integer     not null default 0,
  updated_at timestamptz not null,
  updated_by text        not null
);
create table catalog.dock_item (
  position   integer primary key,
  service_id text  not null unique references catalog.service (id),
  label      jsonb not null,
  icon       text  not null check (icon ~ '^[a-zA-Z]{1,24}$'),
  tone       text  check (tone in ('g-green', 'g-gold', 'g-sage', 'g-bronze', 'g-teal'))
);

-- "Notify me when available": who asked, per coming service (read by the notifications slice; counts shown to admins).
create table catalog.interest (
  service_id text        not null references catalog.service (id),
  person_id  text        not null,
  at         timestamptz not null,
  primary key (service_id, person_id)
);

-- Append-only change log of the catalogue and the dock.
create table catalog.change_log (
  id     bigserial primary key,
  at     timestamptz not null,
  by     text        not null,
  what   jsonb       not null,                    -- MessageRef, rendered in every language on read
  detail text        not null default ''
);
create index change_log_at_idx on catalog.change_log (at desc, id desc);
