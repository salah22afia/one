-- platform/settings: portal languages, managed by the administrator. A language can be enabled only when the web and
-- mobile apps ship its UI catalog (packages/i18n/locales/<code>.json) and the backend its messages_<code>.properties.
create schema if not exists settings;

create table settings.language (
  code        text primary key,               -- BCP 47 code: ar, en, fr…
  native_name text    not null,               -- shown in the language picker, in the language itself
  direction   text    not null check (direction in ('rtl', 'ltr')),
  enabled     boolean not null default true,
  is_default  boolean not null default false,
  position    integer not null default 0
);
create unique index language_one_default on settings.language (is_default) where is_default;

-- Initial configuration (not sample data): the two languages the portal ships with.
insert into settings.language (code, native_name, direction, enabled, is_default, position) values
  ('ar', 'العربية', 'rtl', true, true, 1),
  ('en', 'English', 'ltr', true, false, 2);
