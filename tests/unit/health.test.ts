import { describe, expect, it } from "vitest";
import { contactsFromJson, parseHealthForm, telHref } from "@/lib/health/schema";

const CHILD = "11111111-1111-4111-8111-111111111111";

function form(fields: Record<string, string>) {
  return (key: string) => fields[key] ?? "";
}

describe("parseHealthForm", () => {
  it("accepte une fiche vide : rien n'est inventé", () => {
    const r = parseHealthForm(form({ childId: CHILD }));
    expect(r).toEqual({
      ok: true,
      childId: CHILD,
      value: {
        allergies: null, diet: null, medication: null, medicalNotes: null, doctorName: null, doctorPhone: null,
        emergencyContacts: [], authorizedPickups: [],
      },
    });
  });

  it("garde les personnes nommées et ignore les lignes vides", () => {
    const r = parseHealthForm(
      form({ childId: CHILD, allergies: "Arachides", ec_name_0: "Parent Test", ec_relation_0: "mère", ec_phone_0: "06 00 00 00 00", pk_name_2: "Tante Test" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.allergies).toBe("Arachides");
      expect(r.value.emergencyContacts).toEqual([{ name: "Parent Test", relation: "mère", phone: "06 00 00 00 00" }]);
      expect(r.value.authorizedPickups).toEqual([{ name: "Tante Test", relation: "", phone: "" }]);
    }
  });

  it("refuse un numéro sans nom", () => {
    const r = parseHealthForm(form({ childId: CHILD, ec_phone_0: "0600000000" }));
    expect(r).toEqual({ ok: false, error: "Contacts d'urgence : indiquez le nom de la personne." });
  });

  it("refuse un numéro invalide ou des textes trop longs", () => {
    expect(parseHealthForm(form({ childId: CHILD, doctorPhone: "abc" })).ok).toBe(false);
    expect(parseHealthForm(form({ childId: CHILD, allergies: "x".repeat(501) })).ok).toBe(false);
    expect(parseHealthForm(form({ childId: "pas-un-uuid" })).ok).toBe(false);
  });
});

describe("telHref", () => {
  it("construit un lien tel: ou renvoie null", () => {
    expect(telHref("06 00 00 00 00")).toBe("tel:0600000000");
    expect(telHref("+33 6 00 00 00 00")).toBe("tel:+33600000000");
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref("12")).toBeNull();
  });
});

describe("contactsFromJson", () => {
  it("ne fait pas confiance à la forme des données", () => {
    expect(contactsFromJson(null)).toEqual([]);
    expect(contactsFromJson("x")).toEqual([]);
    expect(contactsFromJson([null, 3, { name: "" }, { name: "A", relation: 4, phone: "0600000000" }])).toEqual([
      { name: "A", relation: "", phone: "0600000000" },
    ]);
  });
});
