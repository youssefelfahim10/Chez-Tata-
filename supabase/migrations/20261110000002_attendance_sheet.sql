-- Fiche de présence mensuelle : champs saisis jour par jour qui n'existaient pas
-- dans attendance_records (absences, heures complémentaires, indemnités dues,
-- congés, observations).
--
-- Choix de confidentialité : attendance_records est visible de toute la MAM.
-- On n'y met donc AUCUN montant en euros : l'indemnité d'entretien / de repas
-- n'est qu'un indicateur « due ce jour-là ». Le montant vient du contrat, qui
-- reste privé à l'assistante (calcul fait côté application, pour elle seule).

alter table public.attendance_records
  add column absence_minutes integer not null default 0
    check (absence_minutes between 0 and 1440),
  add column extra_minutes   integer not null default 0
    check (extra_minutes between 0 and 1440),
  add column maintenance_due boolean not null default false,
  add column meal_due        boolean not null default false,
  add column leave_kind      text check (leave_kind in ('CP', 'CSS')),
  add column note            text check (note is null or char_length(note) <= 300);

comment on column public.attendance_records.leave_kind is
  'CP = congé payé, CSS = congé sans solde. Colonne « Congés » de la fiche A4.';
comment on column public.attendance_records.maintenance_due is
  'Indemnité d''entretien (IE) due ce jour-là. Montant : voir le contrat (privé).';
