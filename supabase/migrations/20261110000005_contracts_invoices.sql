-- Contrat détaillé (document PDF) et factures mensuelles émises à la réception du paiement.
--
-- Confidentialité : `contracts` et `monthly_statements` sont déjà strictement personnels à l'assistante
-- (RLS). Les détails du contrat (adresses, horaires, choix) et les factures en héritent.

alter table public.contracts
  add column details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 20000);

alter table public.monthly_statements
  add column invoice_number text,
  add column lines jsonb not null default '[]'::jsonb
    check (jsonb_typeof(lines) = 'array' and pg_column_size(lines) <= 20000),
  add column total_cents integer not null default 0 check (total_cents >= 0),
  add column paid_at date,
  add column payment_method text check (payment_method in ('virement', 'cheque', 'especes', 'cesu', 'autre')),
  add constraint monthly_statements_invoice_number_key unique (organization_id, invoice_number);

-- Paiement reçu → facture. Une seule opération atomique :
--   * vérifie que le contrat appartient à l'assistante connectée ;
--   * valide les lignes (montants entiers en centimes) et le total ;
--   * attribue un numéro continu, propre à CETTE assistante et à l'année (FAC-2026-0001…) ;
--   * fige le décompte (finalisé) et enregistre le paiement reçu.
create function public.finalize_invoice(
  p_contract uuid,
  p_period   date,
  p_lines    jsonb,
  p_paid_at  date,
  p_method   text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user      uuid := (select auth.uid());
  v_org       uuid;
  v_total     bigint := 0;
  v_line      jsonb;
  v_year      integer;
  v_n         integer;
  v_number    text;
  v_statement uuid;
  v_status    text;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if not private.owns_contract(p_contract) then
    raise exception 'Contrat introuvable' using errcode = '42501';
  end if;
  select c.organization_id into v_org from public.contracts c where c.id = p_contract;

  if p_period is null or extract(day from p_period) <> 1 then
    raise exception 'Période invalide' using errcode = 'check_violation';
  end if;
  if p_method is null or p_method not in ('virement', 'cheque', 'especes', 'cesu', 'autre') then
    raise exception 'Mode de paiement invalide' using errcode = 'check_violation';
  end if;
  if p_paid_at is null or p_paid_at > current_date + 1 then
    raise exception 'Date de paiement invalide' using errcode = 'check_violation';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 30 then
    raise exception 'Lignes de facture invalides' using errcode = 'check_violation';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line) <> 'object'
       or jsonb_typeof(v_line -> 'label') <> 'string'
       or char_length(btrim(v_line ->> 'label')) not between 1 and 120
       or jsonb_typeof(v_line -> 'amount_cents') <> 'number'
       or (v_line ->> 'amount_cents') !~ '^-?[0-9]{1,9}$'
       or (v_line ? 'detail' and (jsonb_typeof(v_line -> 'detail') <> 'string' or char_length(v_line ->> 'detail') > 120)) then
      raise exception 'Ligne de facture invalide' using errcode = 'check_violation';
    end if;
    v_total := v_total + (v_line ->> 'amount_cents')::bigint;
  end loop;
  if v_total <= 0 or v_total > 100000000 then
    raise exception 'Total de facture invalide' using errcode = 'check_violation';
  end if;

  select s.id, s.status into v_statement, v_status
  from public.monthly_statements s
  where s.contract_id = p_contract and s.period = p_period
  for update;
  if found and v_status = 'finalized' then
    raise exception 'Une facture existe déjà pour ce mois' using errcode = '23505';
  end if;

  v_year := extract(year from (now() at time zone 'Europe/Paris'))::integer;
  insert into public.document_counters (organization_id, document_type, year, last_number)
  values (v_org, 'facture-' || v_user::text, v_year, 1)
  on conflict (organization_id, document_type, year)
    do update set last_number = public.document_counters.last_number + 1
  returning last_number into v_n;
  v_number := 'FAC-' || v_year || '-' || lpad(v_n::text, 4, '0');

  if v_statement is null then
    insert into public.monthly_statements
      (organization_id, contract_id, period, status, finalized_at, invoice_number, lines, total_cents, paid_at, payment_method, gross_amount_cents)
    values
      (v_org, p_contract, p_period, 'finalized', now(), v_number, p_lines, v_total::integer, p_paid_at, p_method, v_total::integer)
    returning id into v_statement;
  else
    update public.monthly_statements
    set status = 'finalized', finalized_at = now(), invoice_number = v_number, lines = p_lines,
        total_cents = v_total::integer, paid_at = p_paid_at, payment_method = p_method, gross_amount_cents = v_total::integer
    where id = v_statement;
  end if;

  insert into public.payments (organization_id, statement_id, amount_cents, payment_date, status)
  values (v_org, v_statement, v_total::integer, p_paid_at, 'received');

  return jsonb_build_object('statement_id', v_statement, 'invoice_number', v_number, 'total_cents', v_total);
end;
$$;

revoke all on function public.finalize_invoice(uuid, date, jsonb, date, text) from public, anon;
grant execute on function public.finalize_invoice(uuid, date, jsonb, date, text) to authenticated;
