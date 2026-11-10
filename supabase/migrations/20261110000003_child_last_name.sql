-- La fiche de présence A4 demande « Nom et prénom » de l'enfant.
alter table public.children
  add column last_name text check (last_name is null or char_length(btrim(last_name)) between 1 and 60);

-- Un seul contrat actif par enfant et par assistante (garanti par la base, pas seulement par l'application).
create unique index contracts_one_active_per_child_assmat
  on public.contracts (child_id, assigned_assmat_id) where status = 'active';
