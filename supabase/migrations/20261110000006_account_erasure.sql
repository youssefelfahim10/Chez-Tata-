-- Droit à l'effacement (RGPD) et exigence des stores : l'utilisatrice peut supprimer son compte depuis l'application.
--
-- Règles :
--  * un espace dont elle est la SEULE membre active est supprimé en entier (enfants, journal, contrats, factures…) ;
--  * dans une MAM partagée, ses données PERSONNELLES (contrats, décomptes, paiements, dépenses, documents) sont supprimées ;
--    les enfants et le journal restent pour les collègues, ses saisies deviennent anonymes (auteur effacé) ;
--  * le compte d'authentification est supprimé ; les sauvegardes expirent selon la politique de conservation.

-- L'auteur d'une saisie peut devenir anonyme.
alter table public.daily_events alter column assmat_id drop not null;
alter table public.daily_events drop constraint daily_events_assmat_id_fkey;
alter table public.daily_events
  add constraint daily_events_assmat_id_fkey foreign key (assmat_id) references auth.users (id) on delete set null;

-- Les protections « auteur inchangé » et « décompte figé » s'effacent uniquement pendant un effacement de compte
-- (drapeau local à la transaction, posé par delete_my_account : un client ne peut pas le poser).
create or replace function private.forbid_reparenting()
returns trigger language plpgsql set search_path = ''
as $$
declare
  col text;
begin
  if current_setting('app.erasure', true) = 'on' then
    return new;
  end if;
  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception 'La colonne % ne peut pas être modifiée', col
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function private.freeze_finalized_statement()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_setting('app.erasure', true) = 'on' then
    return coalesce(new, old);
  end if;
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

create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org  uuid;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  perform set_config('app.erasure', 'on', true);

  -- 1. Espaces dont elle est la seule membre active : suppression complète (cascade).
  for v_org in
    select m.organization_id
    from public.organization_members m
    where m.user_id = v_user
      and not exists (
        select 1 from public.organization_members o
        where o.organization_id = m.organization_id and o.user_id <> v_user and o.status = 'active'
      )
  loop
    delete from public.organizations where id = v_org;
  end loop;

  -- 2. Données personnelles restantes dans les espaces partagés.
  delete from public.payments
  where statement_id in (
    select s.id from public.monthly_statements s
    join public.contracts c on c.id = s.contract_id
    where c.assigned_assmat_id = v_user
  );
  delete from public.monthly_statements
  where contract_id in (select c.id from public.contracts c where c.assigned_assmat_id = v_user);
  delete from public.contracts where assigned_assmat_id = v_user;
  delete from public.expenses where owner_id = v_user;
  delete from public.documents where owner_id = v_user;
  delete from public.backups where requested_by = v_user;

  -- 3. Le compte : le profil, les adhésions et les opérations de synchronisation partent en cascade.
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
