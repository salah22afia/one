-- platform/documents: issued documents are immutable snapshots (payload); HTML/PDF are rendered from them.
create schema if not exists documents;

create table documents.document (
  id          uuid primary key,
  request_id  text        not null,
  template    text        not null,
  number      text        not null unique,
  verify_code text        not null unique,
  holder_id   text        not null,
  issued_by   text,
  issued_at   timestamptz not null,
  payload     jsonb       not null,
  revoked_at  timestamptz
);
create index on documents.document (request_id);
