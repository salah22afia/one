-- Shared kernel: gap-free yearly counters for request and document numbers.
create schema if not exists shared;
create table shared.sequence (
  key   text    not null,
  year  integer not null,
  value integer not null,
  primary key (key, year)
);
