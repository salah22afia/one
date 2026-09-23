-- platform/settings: each person's own display preferences (Me › Settings), the same on web and phone.
-- Portal data, not a copy of SAP. A missing row or column means "the default" (the administrator's default language,
-- the device's light/dark setting, normal text).
create table settings.person_preference (
  person_id  text primary key,                              -- employee number, or u:<username> for a platform account
  language   text check (language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  theme      text check (theme in ('auto', 'light', 'dark')),
  text_size  text check (text_size in ('normal', 'large', 'xl')),
  updated_at timestamptz not null
);
