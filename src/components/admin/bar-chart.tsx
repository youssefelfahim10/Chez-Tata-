import { barPercent, shortDay, type DailyPoint } from "@/lib/admin/stats";

type Props = {
  title: string;
  points: DailyPoint[];
  value: (point: DailyPoint) => number;
  unit: string;
  color: "primary" | "leaf";
};

const COLORS = { primary: "bg-primary", leaf: "bg-leaf" } as const;

/**
 * Histogramme simple (une barre par jour). Chaque barre porte son chiffre en infobulle et en texte
 * pour les lecteurs d'écran ; le graphique n'est jamais le seul moyen de lire une valeur.
 */
export function BarChart({ title, points, value, unit, color }: Props) {
  const values = points.map(value);
  const max = Math.max(0, ...values);
  const total = values.reduce((sum, v) => sum + v, 0);
  const first = points[0];
  const last = points.at(-1);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-base font-extrabold">{title}</span>
        <span className="text-sm text-ink-soft">
          {total} {unit} sur {points.length} jours
        </span>
      </figcaption>
      <div className="flex h-32 items-end gap-[3px] border-b border-line" role="img" aria-label={`${title} : ${total} ${unit} sur ${points.length} jours`}>
        {points.map((point, i) => {
          const v = values[i];
          return (
            <div key={point.day} className="flex h-full min-w-0 flex-1 items-end" title={`${shortDay(point.day)} : ${v} ${unit}`}>
              <div
                className={`w-full rounded-t-sm ${v > 0 ? COLORS[color] : "bg-line"}`}
                style={{ height: v > 0 ? `${barPercent(v, max)}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>
      {first && last ? (
        <div className="flex justify-between text-xs text-ink-soft" aria-hidden="true">
          <span>{shortDay(first.day)}</span>
          <span>{max > 0 ? `max. ${max} / jour` : "aucune activité"}</span>
          <span>{shortDay(last.day)}</span>
        </div>
      ) : null}
    </figure>
  );
}
