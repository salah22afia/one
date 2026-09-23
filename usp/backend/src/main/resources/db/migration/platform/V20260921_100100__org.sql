-- platform/org: org structure as read from SAP OM (units, positions, holders) and people (PA).
-- FKs are deferred because units, positions and people reference each other.
create schema if not exists org;

create table org.unit (
  id                text primary key,
  name_ar           text not null,
  name_en           text not null,
  level             text not null check (level in ('section', 'department', 'ga', 'sector', 'sg')),
  parent_id         text references org.unit (id) deferrable initially deferred,
  chief_position_id text
);

create table org.position (
  id                 text primary key,
  title_ar           text not null,
  title_en           text not null,
  unit_id            text not null references org.unit (id) deferrable initially deferred,
  holder_id          text,
  deputy_position_id text references org.position (id) deferrable initially deferred
);

create table org.person (
  id                text primary key,
  emp_no            text not null unique,
  sap_user          text unique,
  name_ar           text not null,
  name_en           text not null,
  gender            char(1) check (gender in ('m', 'f')),
  nationality       text,
  location          text,
  employee_group    text,
  employee_subgroup text,
  hired_at          date,
  position_id       text references org.position (id) deferrable initially deferred,
  monthly_salary    numeric(12, 2)
);

alter table org.unit add foreign key (chief_position_id) references org.position (id) deferrable initially deferred;
alter table org.position add foreign key (holder_id) references org.person (id) deferrable initially deferred;
create index on org.position (unit_id);
