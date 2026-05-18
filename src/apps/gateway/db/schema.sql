create extension if not exists postgis;

create table if not exists contractors (
  id uuid primary key,
  name text not null,
  tenant_key_hash text not null unique,
  base_price_dkk integer not null default 900,
  price_per_meter_dkk numeric(10,2) not null default 32,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key,
  contractor_id uuid null references contractors(id),
  status text not null,
  address_label text not null,
  dawa_address_id text null,
  municipality_code text null,
  property_number text null,
  location geography(point, 4326) null,
  instant_estimate jsonb not null,
  verified_quote jsonb null,
  customer jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_quotes_status_updated_at on quotes(status, updated_at desc);
create index if not exists ix_quotes_location on quotes using gist(location);
