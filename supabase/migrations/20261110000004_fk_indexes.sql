-- Index couvrant les clés étrangères (recommandation du conseiller de performance Supabase).
-- Les jointures et les suppressions en cascade restent rapides quand les tables grossissent.

create index if not exists attendance_records_child_org_idx   on public.attendance_records (child_id, organization_id);
create index if not exists attendance_records_contract_org_idx on public.attendance_records (contract_id, organization_id);
create index if not exists backups_requested_by_idx           on public.backups (requested_by);
create index if not exists child_family_links_child_org_idx   on public.child_family_links (child_id, organization_id);
create index if not exists child_family_links_family_org_idx  on public.child_family_links (family_id, organization_id);
create index if not exists children_created_by_idx            on public.children (created_by);
create index if not exists contracts_child_org_idx            on public.contracts (child_id, organization_id);
create index if not exists contracts_org_assmat_idx           on public.contracts (organization_id, assigned_assmat_id);
create index if not exists daily_events_assmat_idx            on public.daily_events (assmat_id);
create index if not exists daily_events_child_org_idx         on public.daily_events (child_id, organization_id);
create index if not exists documents_child_org_idx            on public.documents (child_id, organization_id);
create index if not exists monthly_statements_contract_org_idx on public.monthly_statements (contract_id, organization_id);
create index if not exists organization_invitations_invited_by_idx on public.organization_invitations (invited_by);
create index if not exists organizations_created_by_idx       on public.organizations (created_by);
create index if not exists payments_statement_org_idx         on public.payments (statement_id, organization_id);
