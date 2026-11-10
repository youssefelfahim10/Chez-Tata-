-- Chez TaTa — Fondations : schéma multi-tenant, RLS, audit.
--
-- Principes :
--   * Chaque ligne métier porte organization_id ; les clés étrangères composites
--     (id, organization_id) empêchent tout lien entre deux organisations.
--   * RLS activée sur toutes les tables de `public`. Aucun accès pour `anon`.
--   * Deux niveaux de visibilité dans une organisation :
--       - partagé  : enfants, familles, journal, présences (tous les membres actifs) ;
--       - personnel : contrats, décomptes, paiements, dépenses, documents
--                     (uniquement l'assistante concernée, y compris dans une MAM).
--   * Les adhésions ne se modifient que par des fonctions contrôlées (RPC).
--   * Montants en centimes (integer) ; taux et heures en numeric exact.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tables d'identité et d'organisation
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is
  'Profil public minimal. Aucun rôle ici : les rôles vivent dans organization_members.';

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  type       text not null check (type in ('independent', 'mam')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('owner', 'admin', 'assmat')),
  status          text not null default 'active' check (status in ('active', 'suspended')),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email = lower(email) and email like '%_@_%'),
  role            text not null check (role in ('admin', 'assmat')),
  token_hash      text not null unique,
  invited_by      uuid references auth.users (id) on delete set null,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index organization_invitations_org_idx on public.organization_invitations (organization_id);

create table public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  settings        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Enfants et familles (partagés dans l'organisation)
-- ---------------------------------------------------------------------------

create table public.children (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name      text not null check (char_length(btrim(first_name)) between 1 and 60),
  birth_date      date,
  status          text not null default 'active' check (status in ('active', 'archived')),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id)
);
create index children_org_idx on public.children (organization_id);

create table public.families (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  contact_details jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id)
);
create index families_org_idx on public.families (organization_id);

create table public.child_family_links (
  organization_id uuid not null,
  child_id        uuid not null,
  family_id       uuid not null,
  relationship    text not null default 'parent' check (char_length(relationship) <= 40),
  primary key (child_id, family_id),
  foreign key (child_id, organization_id)
    references public.children (id, organization_id) on delete cascade,
  foreign key (family_id, organization_id)
    references public.families (id, organization_id) on delete cascade
);
create index child_family_links_org_idx on public.child_family_links (organization_id);
create index child_family_links_family_idx on public.child_family_links (family_id);

-- ---------------------------------------------------------------------------
-- Contrats (personnels à l'assistante)
-- ---------------------------------------------------------------------------

create table public.contracts (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references public.organizations (id) on delete cascade,
  child_id                    uuid not null,
  assigned_assmat_id          uuid not null,
  start_date                  date not null,
  end_date                    date check (end_date is null or end_date >= start_date),
  -- Heures d'accueil hebdomadaires prévues et semaines travaillées par an
  -- (52 = année complète ; moins = année incomplète).
  scheduled_hours             numeric(5, 2) not null check (scheduled_hours > 0 and scheduled_hours <= 100),
  weeks_per_year              numeric(4, 1) not null default 52 check (weeks_per_year > 0 and weeks_per_year <= 52),
  hourly_rate                 numeric(8, 4) not null check (hourly_rate >= 0),
  maintenance_allowance_cents integer not null default 0 check (maintenance_allowance_cents >= 0),
  meal_allowance_cents        integer not null default 0 check (meal_allowance_cents >= 0),
  mileage_enabled             boolean not null default false,
  contract_type               text not null default 'annee_complete'
                                check (contract_type in ('annee_complete', 'annee_incomplete', 'occasionnel')),
  status                      text not null default 'draft' check (status in ('draft', 'active', 'ended')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (child_id, organization_id)
    references public.children (id, organization_id),
  foreign key (organization_id, assigned_assmat_id)
    references public.organization_members (organization_id, user_id)
);
create index contracts_org_idx on public.contracts (organization_id);
create index contracts_child_idx on public.contracts (child_id);
create index contracts_assmat_idx on public.contracts (assigned_assmat_id);

-- ---------------------------------------------------------------------------
-- Journal quotidien et présences (partagés dans l'organisation)
-- ---------------------------------------------------------------------------

create table public.daily_events (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  child_id            uuid not null,
  assmat_id           uuid not null references auth.users (id),
  event_type          text not null check (event_type in
                        ('arrival', 'departure', 'meal', 'nap', 'diaper', 'care', 'bottle', 'mood', 'note')),
  started_at          timestamptz not null,
  ended_at            timestamptz check (ended_at is null or ended_at >= started_at),
  event_payload       jsonb not null default '{}'::jsonb,
  source              text not null default 'tap' check (source in ('tap', 'voice', 'manual')),
  -- Identifiant généré sur l'appareil : rend la synchronisation idempotente.
  client_operation_id uuid not null default gen_random_uuid(),
  -- Annulation = suppression logique : l'historique reste consultable.
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, client_operation_id),
  foreign key (child_id, organization_id)
    references public.children (id, organization_id) on delete cascade
);
create index daily_events_child_time_idx on public.daily_events (child_id, started_at desc);
create index daily_events_org_time_idx on public.daily_events (organization_id, started_at desc);

create table public.daily_event_revisions (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_id        uuid not null references public.daily_events (id) on delete cascade,
  changed_by      uuid,
  previous        jsonb not null,
  changed_at      timestamptz not null default now()
);
create index daily_event_revisions_event_idx on public.daily_event_revisions (event_id);
create index daily_event_revisions_org_idx on public.daily_event_revisions (organization_id);

create table public.attendance_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  child_id        uuid not null,
  contract_id     uuid,
  date            date not null,
  planned_start   time,
  planned_end     time,
  actual_start    timestamptz,
  actual_end      timestamptz check (actual_end is null or actual_start is null or actual_end >= actual_start),
  status          text not null default 'planned' check (status in
                    ('planned', 'present', 'absent', 'absent_justified', 'leave', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (child_id, date),
  foreign key (child_id, organization_id)
    references public.children (id, organization_id) on delete cascade,
  foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id) on delete set null (contract_id)
);
create index attendance_records_org_date_idx on public.attendance_records (organization_id, date);

-- ---------------------------------------------------------------------------
-- Finances et documents (personnels à l'assistante)
-- ---------------------------------------------------------------------------

create table public.monthly_statements (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  contract_id      uuid not null,
  period           date not null check (extract(day from period) = 1),
  calculated_hours numeric(7, 2) not null default 0 check (calculated_hours >= 0),
  allowances       jsonb not null default '{}'::jsonb,
  -- Estimation d'aide à la déclaration : jamais une paie officielle.
  gross_amount_cents integer not null default 0 check (gross_amount_cents >= 0),
  status           text not null default 'draft' check (status in ('draft', 'finalized')),
  finalized_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (contract_id, period),
  unique (id, organization_id),
  check ((status = 'finalized') = (finalized_at is not null)),
  foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id)
);
create index monthly_statements_org_idx on public.monthly_statements (organization_id);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  statement_id    uuid not null,
  amount_cents    integer not null check (amount_cents > 0),
  payment_date    date,
  status          text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (statement_id, organization_id)
    references public.monthly_statements (id, organization_id)
);
create index payments_org_idx on public.payments (organization_id);
create index payments_statement_idx on public.payments (statement_id);

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_id        uuid not null references auth.users (id),
  category        text not null check (char_length(btrim(category)) between 1 and 60),
  label           text not null default '' check (char_length(label) <= 200),
  amount_cents    integer not null check (amount_cents > 0),
  date            date not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index expenses_org_idx on public.expenses (organization_id);
create index expenses_owner_idx on public.expenses (owner_id);

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_id        uuid not null references auth.users (id),
  child_id        uuid,
  document_type   text not null check (char_length(btrim(document_type)) between 1 and 60),
  title           text not null default '' check (char_length(title) <= 200),
  period          date,
  document_number text,
  storage_path    text not null,
  created_at      timestamptz not null default now(),
  unique (organization_id, document_type, document_number),
  foreign key (child_id, organization_id)
    references public.children (id, organization_id) on delete set null (child_id)
);
create index documents_org_idx on public.documents (organization_id);
create index documents_owner_idx on public.documents (owner_id);
create index documents_child_idx on public.documents (child_id);

-- Numérotation continue des documents (par organisation, type et année).
create table public.document_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_type   text not null,
  year            integer not null,
  last_number     integer not null default 0,
  primary key (organization_id, document_type, year)
);

-- ---------------------------------------------------------------------------
-- Traçabilité, synchronisation, sauvegardes
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id        uuid,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  "timestamp"     timestamptz not null default now()
);
create index audit_logs_org_time_idx on public.audit_logs (organization_id, "timestamp" desc);

create table public.sync_operations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  device_operation_id uuid not null,
  operation_type      text not null check (char_length(operation_type) between 1 and 60),
  status              text not null default 'applied' check (status in ('applied', 'rejected', 'conflict')),
  created_at          timestamptz not null default now(),
  unique (organization_id, device_operation_id)
);
create index sync_operations_user_idx on public.sync_operations (user_id);

create table public.backups (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requested_by    uuid not null references auth.users (id),
  storage_path    text,
  status          text not null default 'requested' check (status in ('requested', 'ready', 'failed', 'restored')),
  created_at      timestamptz not null default now()
);
create index backups_org_idx on public.backups (organization_id);

-- ---------------------------------------------------------------------------
-- Fonctions d'autorisation (schéma `private`, non exposé par l'API)
-- ---------------------------------------------------------------------------

create function private.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function private.is_manager(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

create function private.shares_org_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members other using (organization_id)
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and other.user_id = p_user
  );
$$;

create function private.owns_contract(p_contract uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    where c.id = p_contract
      and c.assigned_assmat_id = (select auth.uid())
      and private.is_member(c.organization_id)
  );
$$;

create function private.owns_statement(p_statement uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.monthly_statements s
    where s.id = p_statement
      and private.owns_contract(s.contract_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Colonnes qui ne doivent jamais changer après création (rattachement, auteur).
create function private.forbid_reparenting()
returns trigger language plpgsql set search_path = ''
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'La colonne % ne peut pas être modifiée', col
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  -- Suppression en cascade d'une organisation entière : plus rien à tracer ici.
  if not exists (select 1 from public.organizations o where o.id = (r ->> 'organization_id')::uuid) then
    return null;
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (
    (r ->> 'organization_id')::uuid,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    (r ->> 'id')::uuid
  );
  return null;
end;
$$;

-- Historique des corrections du journal : on garde l'état précédent.
create function private.record_event_revision()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.daily_event_revisions (organization_id, event_id, changed_by, previous)
  values (old.organization_id, old.id, (select auth.uid()), to_jsonb(old));
  return new;
end;
$$;

-- Un décompte finalisé est figé.
create function private.freeze_finalized_statement()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- Effacement complet de l'organisation (droit à l'effacement) : autorisé.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  if old.status = 'finalized' then
    raise exception 'Un décompte finalisé ne peut plus être modifié'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'organizations', 'children', 'families', 'contracts', 'daily_events',
    'attendance_records', 'monthly_statements', 'payments', 'expenses'
  ] loop
    execute format(
      'create trigger touch_updated_at before update on public.%I
         for each row execute function private.touch_updated_at()', t);
  end loop;

  foreach t in array array[
    'children', 'families', 'contracts', 'attendance_records', 'monthly_statements',
    'payments', 'expenses', 'documents', 'backups'
  ] loop
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function private.audit()', t);
  end loop;

  foreach t in array array[
    'children', 'families', 'contracts', 'daily_events', 'attendance_records',
    'monthly_statements', 'payments', 'expenses', 'documents'
  ] loop
    execute format(
      'create trigger forbid_reparenting before update on public.%I
         for each row execute function private.forbid_reparenting(''organization_id'')', t);
  end loop;
end;
$$;

create trigger forbid_author_change before update on public.daily_events
  for each row execute function private.forbid_reparenting('assmat_id', 'child_id', 'client_operation_id');
create trigger forbid_owner_change before update on public.expenses
  for each row execute function private.forbid_reparenting('owner_id');
create trigger forbid_owner_change before update on public.contracts
  for each row execute function private.forbid_reparenting('assigned_assmat_id', 'child_id');

create trigger record_revision before update on public.daily_events
  for each row execute function private.record_event_revision();

create trigger freeze_finalized before update or delete on public.monthly_statements
  for each row execute function private.freeze_finalized_statement();

-- ---------------------------------------------------------------------------
-- RPC : opérations sensibles sur les organisations et les membres
-- ---------------------------------------------------------------------------

create function public.create_organization(p_name text, p_type text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org  uuid;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if (select count(*) from public.organization_members m
      where m.user_id = v_user and m.role = 'owner') >= 5 then
    raise exception 'Nombre maximal d''espaces atteint' using errcode = 'check_violation';
  end if;

  insert into public.organizations (name, type, created_by)
  values (btrim(p_name), p_type, v_user)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  insert into public.organization_settings (organization_id) values (v_org);

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (v_org, v_user, 'insert', 'organizations', v_org);

  return v_org;
end;
$$;

-- Crée une invitation et renvoie le jeton en clair (une seule fois).
-- Seule son empreinte SHA-256 est stockée.
create function public.create_invitation(p_org uuid, p_email text, p_role text default 'assmat')
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_email text := lower(btrim(p_email));
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not private.is_manager(p_org) then
    raise exception 'Action réservée aux responsables de l''espace' using errcode = '42501';
  end if;
  if (select o.type from public.organizations o where o.id = p_org) <> 'mam' then
    raise exception 'Les invitations sont réservées aux MAM' using errcode = 'check_violation';
  end if;
  if p_role = 'admin' and not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = v_user and m.role = 'owner'
  ) then
    raise exception 'Seule la propriétaire peut inviter une responsable' using errcode = '42501';
  end if;

  delete from public.organization_invitations i
  where i.organization_id = p_org and i.email = v_email and i.accepted_at is null;

  insert into public.organization_invitations
    (organization_id, email, role, token_hash, invited_by, expires_at)
  values
    (p_org, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
     v_user, now() + interval '7 days');

  insert into public.audit_logs (organization_id, actor_id, action, entity_type)
  values (p_org, v_user, 'invite', 'organization_members');

  return v_token;
end;
$$;

-- Accepte une invitation : le jeton doit être valide ET l'adresse e-mail du
-- compte connecté doit être celle qui a été invitée.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_inv   public.organization_invitations;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select * into v_inv
  from public.organization_invitations i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    and i.accepted_at is null
    and i.expires_at > now()
  for update;

  if not found or v_inv.email <> v_email then
    raise exception 'Invitation invalide ou expirée' using errcode = '42501';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_inv.organization_id, v_user, v_inv.role)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invitations set accepted_at = now() where id = v_inv.id;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (v_inv.organization_id, v_user, 'join', 'organization_members', v_user);

  return v_inv.organization_id;
end;
$$;

-- Suspend ou réactive un membre. La propriétaire ne peut pas être suspendue ;
-- une responsable (admin) ne peut agir que sur les assistantes.
create function public.set_member_status(p_org uuid, p_user uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor       uuid := (select auth.uid());
  v_actor_role  text;
  v_target_role text;
begin
  select m.role into v_actor_role from public.organization_members m
  where m.organization_id = p_org and m.user_id = v_actor and m.status = 'active';
  select m.role into v_target_role from public.organization_members m
  where m.organization_id = p_org and m.user_id = p_user;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') or v_target_role is null then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if v_target_role = 'owner' or (v_actor_role = 'admin' and v_target_role <> 'assmat') then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Statut inconnu' using errcode = 'check_violation';
  end if;

  update public.organization_members set status = p_status
  where organization_id = p_org and user_id = p_user;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (p_org, v_actor, p_status, 'organization_members', p_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilèges : rien pour `anon`, le strict nécessaire pour `authenticated`
-- ---------------------------------------------------------------------------

alter default privileges in schema public revoke all on tables from anon, authenticated, public;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
alter default privileges in schema private revoke all on functions from anon, authenticated, public;

revoke all on all tables in schema public from anon, authenticated, public;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all functions in schema private from anon, authenticated, public;
revoke all on schema private from anon, public;

-- Nécessaire pour que les politiques RLS puissent appeler les fonctions
-- d'autorisation ; le schéma `private` n'est pas exposé par l'API.
grant usage on schema private to authenticated;
grant execute on function
  private.is_member(uuid), private.is_manager(uuid), private.shares_org_with(uuid),
  private.owns_contract(uuid), private.owns_statement(uuid)
  to authenticated;

grant execute on function
  public.create_organization(text, text),
  public.create_invitation(uuid, text, text),
  public.accept_invitation(text),
  public.set_member_status(uuid, uuid, text)
  to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;

grant select on public.organization_members to authenticated;
grant select (id, organization_id, email, role, invited_by, expires_at, accepted_at, created_at),
      delete on public.organization_invitations to authenticated;

grant select on public.organization_settings to authenticated;
grant update (settings) on public.organization_settings to authenticated;

grant select, insert, update, delete on
  public.children, public.families, public.child_family_links,
  public.contracts, public.attendance_records,
  public.monthly_statements, public.payments, public.expenses
  to authenticated;

-- Journal : pas de DELETE (annulation = deleted_at).
grant select, insert, update on public.daily_events to authenticated;
grant select on public.daily_event_revisions to authenticated;

grant select, insert, delete on public.documents to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert on public.sync_operations to authenticated;
grant select, insert on public.backups to authenticated;
-- document_counters : aucun accès direct (fonctions serveur uniquement).

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles                 enable row level security;
alter table public.organizations            enable row level security;
alter table public.organization_members     enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_settings    enable row level security;
alter table public.children                 enable row level security;
alter table public.families                 enable row level security;
alter table public.child_family_links       enable row level security;
alter table public.contracts                enable row level security;
alter table public.daily_events             enable row level security;
alter table public.daily_event_revisions    enable row level security;
alter table public.attendance_records       enable row level security;
alter table public.monthly_statements       enable row level security;
alter table public.payments                 enable row level security;
alter table public.expenses                 enable row level security;
alter table public.documents                enable row level security;
alter table public.document_counters        enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.sync_operations          enable row level security;
alter table public.backups                  enable row level security;

-- Profils : le sien et ceux des collègues d'un même espace.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Organisations et membres : lecture par les membres ; écriture par RPC.
create policy organizations_select on public.organizations for select to authenticated
  using (private.is_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (private.is_manager(id)) with check (private.is_manager(id));

create policy members_select on public.organization_members for select to authenticated
  using (private.is_member(organization_id));

create policy invitations_select on public.organization_invitations for select to authenticated
  using (private.is_manager(organization_id));
create policy invitations_delete on public.organization_invitations for delete to authenticated
  using (private.is_manager(organization_id));

create policy settings_select on public.organization_settings for select to authenticated
  using (private.is_member(organization_id));
create policy settings_update on public.organization_settings for update to authenticated
  using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));

-- Enfants, familles, liens : partagés entre membres actifs.
-- La suppression définitive est réservée aux responsables (sinon : archivage).
create policy children_select on public.children for select to authenticated
  using (private.is_member(organization_id));
create policy children_insert on public.children for insert to authenticated
  with check (private.is_member(organization_id));
create policy children_update on public.children for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy children_delete on public.children for delete to authenticated
  using (private.is_manager(organization_id));

create policy families_select on public.families for select to authenticated
  using (private.is_member(organization_id));
create policy families_insert on public.families for insert to authenticated
  with check (private.is_member(organization_id));
create policy families_update on public.families for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy families_delete on public.families for delete to authenticated
  using (private.is_manager(organization_id));

create policy links_select on public.child_family_links for select to authenticated
  using (private.is_member(organization_id));
create policy links_insert on public.child_family_links for insert to authenticated
  with check (private.is_member(organization_id));
create policy links_update on public.child_family_links for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy links_delete on public.child_family_links for delete to authenticated
  using (private.is_member(organization_id));

-- Contrats : strictement personnels à l'assistante désignée.
create policy contracts_select on public.contracts for select to authenticated
  using (assigned_assmat_id = (select auth.uid()) and private.is_member(organization_id));
create policy contracts_insert on public.contracts for insert to authenticated
  with check (assigned_assmat_id = (select auth.uid()) and private.is_member(organization_id));
create policy contracts_update on public.contracts for update to authenticated
  using (assigned_assmat_id = (select auth.uid()) and private.is_member(organization_id))
  with check (assigned_assmat_id = (select auth.uid()) and private.is_member(organization_id));
create policy contracts_delete on public.contracts for delete to authenticated
  using (assigned_assmat_id = (select auth.uid()) and private.is_member(organization_id)
         and status = 'draft');

-- Journal : lecture par les membres ; chacune écrit et corrige ses propres saisies.
create policy events_select on public.daily_events for select to authenticated
  using (private.is_member(organization_id));
create policy events_insert on public.daily_events for insert to authenticated
  with check (assmat_id = (select auth.uid()) and private.is_member(organization_id));
create policy events_update on public.daily_events for update to authenticated
  using (private.is_member(organization_id)
         and (assmat_id = (select auth.uid()) or private.is_manager(organization_id)))
  with check (private.is_member(organization_id));

create policy event_revisions_select on public.daily_event_revisions for select to authenticated
  using (private.is_member(organization_id));

create policy attendance_select on public.attendance_records for select to authenticated
  using (private.is_member(organization_id));
create policy attendance_insert on public.attendance_records for insert to authenticated
  with check (private.is_member(organization_id));
create policy attendance_update on public.attendance_records for update to authenticated
  using (private.is_member(organization_id)) with check (private.is_member(organization_id));
create policy attendance_delete on public.attendance_records for delete to authenticated
  using (private.is_member(organization_id));

-- Décomptes et paiements : visibles par la seule titulaire du contrat.
create policy statements_select on public.monthly_statements for select to authenticated
  using (private.owns_contract(contract_id));
create policy statements_insert on public.monthly_statements for insert to authenticated
  with check (private.owns_contract(contract_id));
create policy statements_update on public.monthly_statements for update to authenticated
  using (private.owns_contract(contract_id)) with check (private.owns_contract(contract_id));
create policy statements_delete on public.monthly_statements for delete to authenticated
  using (private.owns_contract(contract_id));

create policy payments_select on public.payments for select to authenticated
  using (private.owns_statement(statement_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (private.owns_statement(statement_id));
create policy payments_update on public.payments for update to authenticated
  using (private.owns_statement(statement_id)) with check (private.owns_statement(statement_id));
create policy payments_delete on public.payments for delete to authenticated
  using (private.owns_statement(statement_id));

create policy expenses_select on public.expenses for select to authenticated
  using (owner_id = (select auth.uid()) and private.is_member(organization_id));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_member(organization_id));
create policy expenses_update on public.expenses for update to authenticated
  using (owner_id = (select auth.uid()) and private.is_member(organization_id))
  with check (owner_id = (select auth.uid()) and private.is_member(organization_id));
create policy expenses_delete on public.expenses for delete to authenticated
  using (owner_id = (select auth.uid()) and private.is_member(organization_id));

create policy documents_select on public.documents for select to authenticated
  using (owner_id = (select auth.uid()) and private.is_member(organization_id));
create policy documents_insert on public.documents for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_member(organization_id));
create policy documents_delete on public.documents for delete to authenticated
  using (owner_id = (select auth.uid()) and private.is_member(organization_id));

-- Journal d'audit : ses propres actions ; les responsables voient aussi les
-- actions non financières de l'espace. Jamais modifiable par un client.
create policy audit_select on public.audit_logs for select to authenticated
  using (
    private.is_member(organization_id)
    and (
      actor_id = (select auth.uid())
      or (private.is_manager(organization_id)
          and entity_type not in ('contracts', 'monthly_statements', 'payments', 'expenses', 'documents'))
    )
  );

create policy sync_select on public.sync_operations for select to authenticated
  using (user_id = (select auth.uid()) and private.is_member(organization_id));
create policy sync_insert on public.sync_operations for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(organization_id));

create policy backups_select on public.backups for select to authenticated
  using (private.is_manager(organization_id));
create policy backups_insert on public.backups for insert to authenticated
  with check (requested_by = (select auth.uid()) and private.is_manager(organization_id));
