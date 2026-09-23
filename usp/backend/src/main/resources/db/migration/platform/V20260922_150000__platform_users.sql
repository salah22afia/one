-- platform/identity: platform accounts — people who sign in to the portal without an SAP user (administrators,
-- operators). They are not employees and never call SAP. Passwords are stored only as salted hashes (bcrypt).
create schema if not exists identity;

create table identity.platform_user (
  id                   uuid primary key,
  username             text    not null,               -- stored lower-case; sign-in is case-insensitive
  display_name         jsonb   not null,               -- LocalizedText
  email                text,
  password_hash        text    not null,
  is_admin             boolean not null default false, -- manages platform users and every configuration
  enabled              boolean not null default true,
  must_change_password boolean not null default true,  -- set when an administrator sets or resets the password
  created_by           text    not null,
  created_at           timestamptz not null,
  password_changed_at  timestamptz,
  last_login_at        timestamptz
);
create unique index platform_user_username on identity.platform_user (username);
