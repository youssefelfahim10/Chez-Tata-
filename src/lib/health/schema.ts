import { z } from "zod";

/** Nombre d'emplacements affichés dans le formulaire (la base en accepte 6 au plus). */
export const CONTACT_SLOTS = 4;

export type Contact = { name: string; relation: string; phone: string };

export type HealthValues = {
  allergies: string | null;
  diet: string | null;
  medication: string | null;
  medicalNotes: string | null;
  doctorName: string | null;
  doctorPhone: string | null;
  emergencyContacts: Contact[];
  authorizedPickups: Contact[];
};

const phone = z
  .string()
  .max(30, "Numéro trop long.")
  .refine((v) => v === "" || /^\+?[\d\s().-]{4,29}$/.test(v), "Numéro de téléphone invalide.");

const optionalText = (max: number, label: string) =>
  z.string().max(max, `${label} : ${max} caractères au plus.`).transform((v) => (v === "" ? null : v));

const contactSchema = z.object({
  name: z.string().max(120, "Nom trop long (120 caractères au plus)."),
  relation: z.string().max(40, "Lien trop long (40 caractères au plus)."),
  phone,
});

const schema = z.object({
  childId: z.uuid(),
  allergies: optionalText(500, "Allergies"),
  diet: optionalText(300, "Régime"),
  medication: optionalText(500, "Traitement"),
  medicalNotes: optionalText(500, "Remarques"),
  doctorName: optionalText(120, "Médecin"),
  doctorPhone: phone.transform((v) => (v === "" ? null : v)),
  emergencyContacts: z.array(contactSchema).max(CONTACT_SLOTS),
  authorizedPickups: z.array(contactSchema).max(CONTACT_SLOTS),
});

/** Garde les personnes nommées ; un numéro sans nom est refusé (on ne devine rien). */
function cleanContacts(list: Contact[], label: string): { contacts: Contact[]; error?: string } {
  const contacts: Contact[] = [];
  for (const c of list) {
    const name = c.name.trim();
    if (!name) {
      if (c.phone.trim() || c.relation.trim()) return { contacts, error: `${label} : indiquez le nom de la personne.` };
      continue;
    }
    contacts.push({ name, relation: c.relation.trim(), phone: c.phone.trim() });
  }
  return { contacts };
}

type Read = (key: string) => string;

function readContacts(read: Read, prefix: string): Contact[] {
  return Array.from({ length: CONTACT_SLOTS }, (_, i) => ({
    name: read(`${prefix}_name_${i}`),
    relation: read(`${prefix}_relation_${i}`),
    phone: read(`${prefix}_phone_${i}`),
  }));
}

export type ParsedHealth = { ok: true; childId: string; value: HealthValues } | { ok: false; error: string };

/** Valide la saisie de la fiche santé. `read` renvoie la valeur brute d'un champ (déjà « trimmée »). */
export function parseHealthForm(read: Read): ParsedHealth {
  const parsed = schema.safeParse({
    childId: read("childId"),
    allergies: read("allergies"),
    diet: read("diet"),
    medication: read("medication"),
    medicalNotes: read("medicalNotes"),
    doctorName: read("doctorName"),
    doctorPhone: read("doctorPhone"),
    emergencyContacts: readContacts(read, "ec"),
    authorizedPickups: readContacts(read, "pk"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const d = parsed.data;
  const emergency = cleanContacts(d.emergencyContacts, "Contacts d'urgence");
  if (emergency.error) return { ok: false, error: emergency.error };
  const pickups = cleanContacts(d.authorizedPickups, "Personnes autorisées");
  if (pickups.error) return { ok: false, error: pickups.error };
  return {
    ok: true,
    childId: d.childId,
    value: {
      allergies: d.allergies,
      diet: d.diet,
      medication: d.medication,
      medicalNotes: d.medicalNotes,
      doctorName: d.doctorName,
      doctorPhone: d.doctorPhone,
      emergencyContacts: emergency.contacts,
      authorizedPickups: pickups.contacts,
    },
  };
}

/** Lien `tel:` utilisable, ou null si le numéro n'est pas exploitable (on ne devine pas). */
export function telHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^\d+]/g, "");
  return /^\+?\d{4,15}$/.test(cleaned) ? `tel:${cleaned}` : null;
}

/** Lit la valeur jsonb d'une liste de contacts renvoyée par la base, sans faire confiance à sa forme. */
export function contactsFromJson(value: unknown): Contact[] {
  if (!Array.isArray(value)) return [];
  const out: Contact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    if (!name) continue;
    out.push({ name, relation: typeof o.relation === "string" ? o.relation : "", phone: typeof o.phone === "string" ? o.phone : "" });
  }
  return out;
}
