-- Administration de la plateforme : tableau de bord et gestion des comptes pour l'éditeur de l'application.
--
-- Principes :
--  * Les administrateurs sont listés dans private.platform_admins (schéma non exposé par l'API), par IDENTIFIANT de compte
--    et non par e-mail : changer ou usurper une adresse ne donne aucun droit. Aucun rôle dans `profiles`.
--  * L'administrateur ne voit JAMAIS le contenu des espaces : pas de nom d'enfant, de fiche santé, de journal, de contrat
--    ni de facture. Il ne voit que des comptes (e-mail, prénom, méthode de connexion, dates) et des comptages.
--  * Toutes les lectures et actions passent par des fonctions SECURITY DEFINER qui revérifient le droit à chaque appel.
--  * Les connexions sont journalisées dans private.login_events (le journal d'audit de Supabase Auth est vide sur ce projet) ;
--    les lignes partent avec le compte (effacement RGPD en cascade).
--  * Chaque action de l'administrateur sur un compte est tracée dans private.admin_actions.

create table private.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table private.platform_admins is
  'Comptes autorisés à ouvrir /admin. Alimentée à la main par l''éditeur ; jamais exposée par l''API.';

create table private.login_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  provider   text not null default 'email' check (provider in ('email', 'google')),
  created_at timestamptz not null default now()
);
create index login_events_created_idx on private.login_events (created_at);
create index login_events_user_idx on private.login_events (user_id, created_at desc);

create table private.admin_actions (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null check (action in ('suspend_user', 'reactivate_user')),
  target_user uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

revoke all on private.platform_admins, private.login_events, private.admin_actions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Droit d'administration
-- ---------------------------------------------------------------------------

create function private.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.platform_admins a where a.user_id = (select auth.uid())
  );
$$;

create function private.require_platform_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if not private.is_platform_admin() then
    raise exception 'Accès réservé' using errcode = '42501';
  end if;
end;
$$;

-- Fonctions internes : appelées uniquement par les fonctions publiques ci-dessous (qui s'exécutent avec les droits de leur propriétaire).
revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.require_platform_admin() from public, anon, authenticated;

-- Permet à l'application de savoir s'il faut afficher /admin (jamais un moyen d'obtenir un droit).
create function public.am_i_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin();
$$;

-- ---------------------------------------------------------------------------
-- Journal des connexions
-- ---------------------------------------------------------------------------

-- Appelée par l'application après une connexion réussie. Une seule ligne par minute et par compte.
create function public.record_login(p_provider text default 'email')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_provider text := case when p_provider = 'google' then 'google' else 'email' end;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if exists (
    select 1 from private.login_events e
    where e.user_id = v_user and e.created_at > now() - interval '1 minute'
  ) then
    return;
  end if;
  insert into private.login_events (user_id, provider) values (v_user, v_provider);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tableau de bord
-- ---------------------------------------------------------------------------

create function public.admin_overview(p_exclude_email text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_ex     text := lower(coalesce(btrim(p_exclude_email), ''));
  v_today  date := (now() at time zone 'Europe/Paris')::date;
  v_result jsonb;
begin
  perform private.require_platform_admin();

  with u as (
    select id, created_at, last_sign_in_at,
           coalesce(raw_app_meta_data ->> 'provider', 'email') as provider
    from auth.users
    where v_ex = '' or lower(coalesce(email, '')) <> v_ex
  ),
  days as (
    select d::date as day
    from generate_series(v_today - 29, v_today, interval '1 day') d
  ),
  signups as (
    select (created_at at time zone 'Europe/Paris')::date as day, count(*) as n
    from u group by 1
  ),
  logins as (
    select (e.created_at at time zone 'Europe/Paris')::date as day,
           count(*) as n, count(distinct e.user_id) as people
    from private.login_events e
    join u on u.id = e.user_id
    group by 1
  )
  select jsonb_build_object(
    'users_total',   (select count(*) from u),
    'users_google',  (select count(*) from u where provider = 'google'),
    'users_email',   (select count(*) from u where provider <> 'google'),
    'signups_7d',    (select count(*) from u where created_at > now() - interval '7 days'),
    'signups_30d',   (select count(*) from u where created_at > now() - interval '30 days'),
    'active_7d',     (select count(*) from u where last_sign_in_at > now() - interval '7 days'),
    'active_30d',    (select count(*) from u where last_sign_in_at > now() - interval '30 days'),
    'logins_7d',     (select count(*) from private.login_events e join u on u.id = e.user_id
                      where e.created_at > now() - interval '7 days'),
    'logins_30d',    (select count(*) from private.login_events e join u on u.id = e.user_id
                      where e.created_at > now() - interval '30 days'),
    'organizations', (select count(*) from public.organizations o
                      where exists (select 1 from public.organization_members m join u on u.id = m.user_id
                                    where m.organization_id = o.id)),
    'children',      (select count(*) from public.children c
                      where c.status = 'active'
                        and exists (select 1 from public.organization_members m join u on u.id = m.user_id
                                    where m.organization_id = c.organization_id)),
    'daily', (
      select jsonb_agg(
        jsonb_build_object(
          'day', to_char(days.day, 'YYYY-MM-DD'),
          'signups', coalesce(s.n, 0),
          'logins', coalesce(l.n, 0),
          'people', coalesce(l.people, 0)
        ) order by days.day
      )
      from days
      left join signups s on s.day = days.day
      left join logins l on l.day = days.day
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------------------

create function public.admin_list_users(
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_exclude_email text default null
)
returns table (
  user_id         uuid,
  email           text,
  display_name    text,
  provider        text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  suspended       boolean,
  is_admin        boolean,
  space_name      text,
  space_count     integer,
  children_count  integer,
  total_count     bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_ex     text := lower(coalesce(btrim(p_exclude_email), ''));
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_limit  integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  perform private.require_platform_admin();

  return query
  with filtered as (
    select u.id, u.email::text as email, u.created_at, u.last_sign_in_at, u.banned_until,
           coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
           coalesce(p.display_name, '') as display_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where (v_ex = '' or lower(coalesce(u.email, '')) <> v_ex)
      and (
        v_search = ''
        or position(v_search in lower(coalesce(u.email, ''))) > 0
        or position(v_search in lower(coalesce(p.display_name, ''))) > 0
      )
  )
  select f.id, f.email, f.display_name, f.provider, f.created_at, f.last_sign_in_at,
         (f.banned_until is not null and f.banned_until > now()),
         exists (select 1 from private.platform_admins a where a.user_id = f.id),
         (select o.name from public.organization_members m
            join public.organizations o on o.id = m.organization_id
          where m.user_id = f.id
          order by m.created_at limit 1),
         (select count(*)::integer from public.organization_members m where m.user_id = f.id),
         (select count(*)::integer from public.children c
          where c.status = 'active'
            and c.organization_id in (select m.organization_id from public.organization_members m where m.user_id = f.id)),
         count(*) over ()
  from filtered f
  order by f.created_at desc
  limit v_limit offset v_offset;
end;
$$;

create function public.admin_set_user_suspended(p_user uuid, p_suspended boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
begin
  perform private.require_platform_admin();

  if p_user is null or p_suspended is null then
    raise exception 'Paramètres invalides' using errcode = '22023';
  end if;
  if p_user = v_admin then
    raise exception 'Vous ne pouvez pas suspendre votre propre compte' using errcode = '22023';
  end if;
  if exists (select 1 from private.platform_admins a where a.user_id = p_user) then
    raise exception 'Un administrateur ne peut pas être suspendu ici' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'Compte introuvable' using errcode = 'no_data_found';
  end if;

  update auth.users
  set banned_until = case when p_suspended then now() + interval '100 years' else null end
  where id = p_user;

  -- Coupe les sessions ouvertes : plus de renouvellement du jeton (l'accès actuel expire avec lui, au plus une heure).
  if p_suspended then
    delete from auth.sessions where user_id = p_user;
  end if;

  insert into private.admin_actions (admin_id, action, target_user)
  values (v_admin, case when p_suspended then 'suspend_user' else 'reactivate_user' end, p_user);
end;
$$;

revoke all on function public.am_i_platform_admin() from public, anon;
revoke all on function public.record_login(text) from public, anon;
revoke all on function public.admin_overview(text) from public, anon;
revoke all on function public.admin_list_users(text, integer, integer, text) from public, anon;
revoke all on function public.admin_set_user_suspended(uuid, boolean) from public, anon;
grant execute on function public.am_i_platform_admin() to authenticated;
grant execute on function public.record_login(text) to authenticated;
grant execute on function public.admin_overview(text) to authenticated;
grant execute on function public.admin_list_users(text, integer, integer, text) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean) to authenticated;
