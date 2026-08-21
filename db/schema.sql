create table if not exists stores (
  id serial primary key,
  slug text unique not null,
  name text not null
);

create table if not exists movements (
  id serial primary key,
  store_id integer not null references stores(id),
  date date not null,
  concept text not null,
  type text not null check (type in ('ingreso', 'gasto')),
  amount_usd numeric(12,2) not null default 0,
  amount_ves numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists movements_store_date_idx on movements (store_id, date);

alter table stores add column if not exists telegram_chat_id text;
alter table stores add column if not exists telegram_thread_id integer;
alter table stores add column if not exists pin text;
alter table stores add column if not exists pin_failed_attempts integer not null default 0;
alter table stores add column if not exists pin_locked_until text;

insert into stores (slug, name) values
  ('san-cristobal', 'San Cristóbal'),
  ('merida', 'Mérida'),
  ('barinas', 'Barinas'),
  ('caracas', 'Caracas'),
  ('concordia', 'Concordia'),
  ('valencia', 'Valencia'),
  ('maracaibo', 'Maracaibo')
on conflict (slug) do nothing;
