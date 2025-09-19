-- Enable Row Level Security
alter table public.case_records enable row level security;
alter table public.artifacts enable row level security;
alter table public.clinician_links enable row level security;

-- Helper function to resolve clinician owning a case
create or replace function public.clinician_id_from_case(case_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinician_id from public.case_records where case_records.case_id = clinician_id_from_case.case_id;
$$;

grant execute on function public.clinician_id_from_case(uuid) to authenticated;

-- Policy: clinicians access only their cases
create policy if not exists case_records_select on public.case_records
  for select
  using (auth.uid() = clinician_id);

create policy if not exists case_records_insert on public.case_records
  for insert
  with check (auth.uid() = clinician_id);

create policy if not exists case_records_update on public.case_records
  for update
  using (auth.uid() = clinician_id)
  with check (auth.uid() = clinician_id);

-- Policy: artifacts follow parent case access
create policy if not exists artifacts_select on public.artifacts
  for select
  using (auth.uid() = clinician_id_from_case(case_id));

create policy if not exists artifacts_insert on public.artifacts
  for insert
  with check (auth.uid() = clinician_id_from_case(case_id));

create policy if not exists artifacts_delete on public.artifacts
  for delete
  using (auth.uid() = clinician_id_from_case(case_id));

-- Policy: clinicians manage their own rate-limiting row
create policy if not exists clinician_links_select on public.clinician_links
  for select
  using (auth.uid() = clinician_id);

create policy if not exists clinician_links_update on public.clinician_links
  for update
  using (auth.uid() = clinician_id)
  with check (auth.uid() = clinician_id);
