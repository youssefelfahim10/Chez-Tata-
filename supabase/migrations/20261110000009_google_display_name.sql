-- Connexion avec Google : reprend le prénom fourni par Google quand le compte est créé sans
-- « display_name » (inscription par e-mail : inchangé). L'écran d'accueil dit « Bonjour {prénom} ! ».
-- Ordre : prénom saisi, prénom Google (given_name), premier mot du nom complet. Jamais de valeur inventée.

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen text := coalesce(
    nullif(btrim(meta ->> 'display_name'), ''),
    nullif(btrim(meta ->> 'given_name'), ''),
    nullif(split_part(btrim(coalesce(meta ->> 'full_name', '')), ' ', 1), ''),
    nullif(split_part(btrim(coalesce(meta ->> 'name', '')), ' ', 1), ''),
    ''
  );
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(chosen, 80))
  on conflict (id) do nothing;
  return new;
end;
$$;
