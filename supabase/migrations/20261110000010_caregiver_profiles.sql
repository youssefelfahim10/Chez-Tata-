-- Profil de l'assistante maternelle : identité, coordonnées, agrément et assurance.
-- Sert à pré-remplir contrats, factures et documents administratifs (aide à la déclaration d'impôts)
-- et à rappeler les échéances (fin d'agrément, assurance).
--
-- Strictement PERSONNEL : une assistante ne lit que son propre profil, y compris dans une MAM
-- (même une responsable ne voit pas celui d'une collègue). Rien n'est inventé : tout est saisi.
-- Pas de numéro de sécurité sociale ni de coordonnées bancaires.

create table public.caregiver_profiles (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  first_name         text check (first_name is null or char_length(first_name) <= 80),
  last_name          text check (last_name is null or char_length(last_name) <= 80),
  phone              text check (phone is null or char_length(phone) <= 30),
  contact_email      text check (contact_email is null or char_length(contact_email) <= 254),
  address_line       text check (address_line is null or char_length(address_line) <= 160),
  postal_code        text check (postal_code is null or char_length(postal_code) <= 10),
  city               text check (city is null or char_length(city) <= 80),
  agreement_number   text check (agreement_number is null or char_length(agreement_number) <= 40),
  agreement_date     date,
  agreement_expiry   date,
  agreement_capacity integer check (agreement_capacity is null or agreement_capacity between 1 and 6),
  insurance_company  text check (insurance_company is null or char_length(insurance_company) <= 80),
  insurance_policy   text check (insurance_policy is null or char_length(insurance_policy) <= 60),
  insurance_expiry   date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index caregiver_profiles_user_idx on public.caregiver_profiles (user_id);

alter table public.caregiver_profiles enable row level security;

create policy caregiver_profiles_select on public.caregiver_profiles for select to authenticated
  using (user_id = (select auth.uid()) and private.is_member(organization_id));
create policy caregiver_profiles_insert on public.caregiver_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(organization_id));
create policy caregiver_profiles_update on public.caregiver_profiles for update to authenticated
  using (user_id = (select auth.uid()) and private.is_member(organization_id))
  with check (user_id = (select auth.uid()) and private.is_member(organization_id));
create policy caregiver_profiles_delete on public.caregiver_profiles for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_member(organization_id));

-- Privilèges explicites : rien pour anon.
grant select, insert, update, delete on public.caregiver_profiles to authenticated;

create trigger touch_updated_at before update on public.caregiver_profiles
  for each row execute function private.touch_updated_at();
create trigger audit after insert or update or delete on public.caregiver_profiles
  for each row execute function private.audit();
create trigger forbid_reparenting before update on public.caregiver_profiles
  for each row execute function private.forbid_reparenting('organization_id', 'user_id');
