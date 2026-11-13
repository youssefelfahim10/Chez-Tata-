import { formatDateFR } from "@/lib/sheet/compute";

/**
 * Modèles de messages de l'assistante aux parents. Le texte n'est qu'une base : il est relu,
 * modifié puis envoyé par l'utilisatrice elle-même (jamais d'envoi automatique).
 * Aucune information sur l'enfant n'est inventée : tout ce qui n'est pas saisi reste vide ou omis.
 */

export type FieldKind = "date" | "month" | "text" | "multiline";
export type TemplateField = { key: string; label: string; kind: FieldKind; required: boolean; placeholder?: string };

export type TemplateId = "absence" | "holidays" | "late" | "pickup" | "bring" | "invoice";

export type Template = {
  id: TemplateId;
  title: string;
  hint: string;
  fields: TemplateField[];
};

export const TEMPLATES: readonly Template[] = [
  {
    id: "absence",
    title: "Confirmer une absence",
    hint: "Vous accusez réception de l'absence annoncée.",
    fields: [
      { key: "date", label: "Date de l'absence", kind: "date", required: true },
      { key: "until", label: "Jusqu'au (facultatif)", kind: "date", required: false },
    ],
  },
  {
    id: "holidays",
    title: "Prévenir de mes congés",
    hint: "Vous annoncez vos dates de fermeture.",
    fields: [
      { key: "from", label: "Du", kind: "date", required: true },
      { key: "to", label: "Au", kind: "date", required: true },
    ],
  },
  {
    id: "late",
    title: "Heure d'arrivée ou de départ",
    hint: "Vous demandez à quelle heure le parent arrive.",
    fields: [{ key: "note", label: "Précision (facultatif)", kind: "text", required: false, placeholder: "ex. la crèche ferme à 18 h" }],
  },
  {
    id: "pickup",
    title: "Demander de venir chercher l'enfant",
    hint: "Vous décrivez ce que vous observez, avec vos mots.",
    fields: [{ key: "reason", label: "Ce que vous observez", kind: "multiline", required: true, placeholder: "ex. il est chaud et pleure beaucoup" }],
  },
  {
    id: "bring",
    title: "Demander d'apporter quelque chose",
    hint: "Couches, vêtements de rechange, doudou…",
    fields: [{ key: "items", label: "À apporter", kind: "text", required: true, placeholder: "ex. des couches et des vêtements de rechange" }],
  },
  {
    id: "invoice",
    title: "Rappel de règlement",
    hint: "Un rappel poli, sans accusation.",
    fields: [
      { key: "month", label: "Mois concerné", kind: "month", required: true },
      { key: "amount", label: "Montant (facultatif)", kind: "text", required: false, placeholder: "ex. 612,40 €" },
    ],
  },
];

export type Values = Record<string, string>;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-11 » → « novembre 2026 » ; chaîne vide si la valeur n'est pas un mois valide. */
export function formatMonthFR(value: string): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}

function dateFR(value: string | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDateFR(value) : "";
}

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Les champs obligatoires qui manquent (ou sont invalides). */
export function missingFields(template: Template, values: Values): TemplateField[] {
  return template.fields.filter((f) => {
    const v = (values[f.key] ?? "").trim();
    if (!f.required) return false;
    if (f.kind === "date") return dateFR(v) === "";
    if (f.kind === "month") return formatMonthFR(v) === "";
    return v === "";
  });
}

/**
 * Texte du message, ou `null` tant qu'un champ obligatoire manque.
 * @param child prénom de l'enfant
 * @param sender prénom ou nom de l'assistante (signature, omise si vide)
 */
export function renderTemplate(id: TemplateId, values: Values, child: string, sender?: string): string | null {
  const template = findTemplate(id);
  if (!template || missingFields(template, values).length > 0) return null;
  const v = (key: string) => (values[key] ?? "").trim();
  let body: string;

  switch (id) {
    case "absence": {
      const when = v("until") && dateFR(v("until")) !== dateFR(v("date")) ? `du ${dateFR(v("date"))} au ${dateFR(v("until"))}` : `le ${dateFR(v("date"))}`;
      body = `C'est bien noté pour l'absence de ${child} ${when}. Je ne l'attendrai pas ces jours-là.`;
      break;
    }
    case "holidays":
      body = `Je vous informe que je serai en congés du ${dateFR(v("from"))} au ${dateFR(v("to"))}. L'accueil de ${child} ne sera pas assuré pendant cette période.`;
      break;
    case "late":
      body = `Pourriez-vous me dire à quelle heure vous pensez venir chercher ${child} aujourd'hui ?${v("note") ? ` ${capitalize(v("note"))}.` : ""}`;
      break;
    case "pickup":
      body = `Je vous contacte au sujet de ${child} : ${v("reason")}. Pourriez-vous venir chercher ${child} dès que possible ? Merci de me confirmer votre heure d'arrivée.`;
      break;
    case "bring":
      body = `Pourriez-vous apporter pour ${child} : ${v("items")} ? Merci beaucoup.`;
      break;
    case "invoice":
      body = `Un petit rappel concernant le règlement de l'accueil de ${child} pour ${formatMonthFR(v("month"))}${v("amount") ? ` (${v("amount")})` : ""}. Si c'est déjà fait, merci de ne pas tenir compte de ce message.`;
      break;
  }
  const signature = sender?.trim() ? `\n\nBien cordialement,\n${sender.trim()}` : "";
  return `Bonjour,\n\n${body}${signature}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, "");
}
