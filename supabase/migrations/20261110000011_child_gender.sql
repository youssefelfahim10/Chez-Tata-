-- Fille / garçon : uniquement pour choisir l'icône de l'enfant à l'écran (facultatif, jamais déduit).
alter table public.children
  add column gender text check (gender is null or gender in ('girl', 'boy'));

comment on column public.children.gender is
  'Facultatif. Sert uniquement à afficher une icône fille ou garçon ; la RLS de children s''applique.';
