-- Migration: Initial case management tables
-- Run with `supabase db push`

create table if not exists public.case_records (
  case_id uuid primary key,
  clinician_id uuid not null,
  clinician_pin_hash text not null,
  storage_meta jsonb not null,
  payload jsonb not null,
  encrypted_fields jsonb default '{}'::jsonb,
  consent_granted boolean default false,
  status text default 'draft',
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.case_records(case_id) on delete cascade,
  kind text not null,
  uri text not null,
  metadata jsonb default '{}'::jsonb,
  qa jsonb,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.clinician_links (
  clinician_id uuid primary key,
  pin_retry_count int default 0,
  locked_until timestamptz,
  created_at timestamptz default timezone('utc', now())
);

-- provenance log stored as JSON array inside payload for now; consider separate table later.

create index if not exists idx_case_records_clinician_id on public.case_records(clinician_id);
create index if not exists idx_artifacts_case_id on public.artifacts(case_id);
