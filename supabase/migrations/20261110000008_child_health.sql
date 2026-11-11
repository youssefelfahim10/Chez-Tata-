-- Fiche santé et urgences d'un enfant : allergies, traitement, médecin, contacts d'urgence
-- et personnes autorisées à récupérer l'enfant.
--
-- Données sensibles (santé) : rien n'est inventé ni déduit, tout est saisi par l'assistante.
-- Visibles des membres actifs de l'espace (utile en MAM : une collègue doit pouvoir réagir en
-- cas d'urgence). Le journal d'audit ne garde que « qui / quoi / quand », jamais les valeurs.

create table public.child_health (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  child_id           uuid not null,
  allergies          text check (allergies is null or char_length(allergies) <= 500),
  diet               text check (diet is null or char_length(diet) <= 300),
  medication         text check (medication is null or char_length(medication) <= 500),
  medical_notes      text check (medical_notes is null or char_length(medical_notes) <= 500),
  doctor_name        text check (doctor_name is null or char_length(doctor_name) <= 120),
  doctor_phone       text check (doctor_phone is null or char_length(doctor_phone) <= 30),
  -- [{ "name": "...", "relation": "...", "phone": "..." }], 6 entrées au plus.
  emergency_contacts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(emergency_contacts) = 'array' and jsonb_array_length(emergency_contacts) <= 6
           and pg_column_size(emergency_contacts) <= 4000),
  authorized_pickups jsonb not null default '[]'::jsonb
    check (jsonb_typeof(authorized_pickups) = 'array' and jsonb_array_length(authorized_pickups) <= 6
           and pg_column_size(authorized_pickups) <= 4000),
  updated_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, child_id),
  foreign key (child_id, organization_id)
    references public.children (id, organization_id) on delete cascade
);
create index child_health_org_idx on public.child_health (organization_id);

alter table public.child_health enable row level security;

create policy child_health_select on public.child_health for select to authenticated
  using (private.is_member(organization_id));
create policy child_health_insert on public.child_health for insert to authenticated
  with check (private.is_member(organization_id));
create policy child_health_update on public.child_health for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy child_health_delete on public.child_health for delete to authenticated
  using (private.is_manager(organization_id));

-- Privilèges explicites : rien pour anon.
grant select, insert, update, delete on public.child_health to authenticated;

create trigger touch_updated_at before update on public.child_health
  for each row execute function private.touch_updated_at();
create trigger audit after insert or update or delete on public.child_health
  for each row execute function private.audit();
create trigger forbid_reparenting before update on public.child_health
  for each row execute function private.forbid_reparenting('organization_id', 'child_id');
