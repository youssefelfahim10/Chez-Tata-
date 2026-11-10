/**
 * Colonnes demandées par la page Planning. Centralisées pour qu'un test les
 * exécute contre le schéma réel (une colonne inexistante casserait la page).
 */
export const CHILD_COLUMNS = "id, first_name, last_name";
export const ATTENDANCE_COLUMNS =
  "date, actual_start, actual_end, absence_minutes, extra_minutes, maintenance_due, meal_due, leave_kind, note";
export const CONTRACT_COLUMNS =
  "start_date, scheduled_hours, weeks_per_year, hourly_rate, maintenance_allowance_cents, meal_allowance_cents";
