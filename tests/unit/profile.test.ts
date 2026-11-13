import { describe, expect, it } from "vitest";
import { addressOf, completion, daysUntil, employeeFromProfile, fullName, parseProfileForm, remindersFor, reminderText, type ProfileRow } from "@/lib/profile/schema";

const read = (fields: Record<string, string>) => (key: string) => fields[key] ?? "";

const FULL: ProfileRow = {
  first_name: "Alice", last_name: "Test", phone: "0600000000", contact_email: "alice@exemple.test",
  address_line: "1 rue Fictive", postal_code: "75000", city: "Ville", agreement_number: "AG-1",
  agreement_date: "2026-01-10", agreement_expiry: "2031-01-09", agreement_capacity: 3,
  insurance_company: "Assureur", insurance_policy: "P-1", insurance_expiry: "2026-12-31",
};

describe("parseProfileForm", () => {
  it("accepte un formulaire vide : rien n'est obligatoire ni inventé", () => {
    const r = parseProfileForm(read({}));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ firstName: null, agreementCapacity: null, agreementDate: null, phone: null });
  });

  it("convertit les champs saisis", () => {
    const r = parseProfileForm(read({ firstName: "Alice", agreementCapacity: "3", agreementDate: "2026-01-10", agreementExpiry: "2031-01-09", postalCode: "75000" }));
    expect(r.ok && r.value).toMatchObject({ firstName: "Alice", agreementCapacity: 3, postalCode: "75000" });
  });

  it("refuse les valeurs invalides", () => {
    expect(parseProfileForm(read({ phone: "abc" })).ok).toBe(false);
    expect(parseProfileForm(read({ contactEmail: "pas-un-mail" })).ok).toBe(false);
    expect(parseProfileForm(read({ agreementCapacity: "9" })).ok).toBe(false);
    expect(parseProfileForm(read({ agreementDate: "10/01/2026" })).ok).toBe(false);
    expect(parseProfileForm(read({ displayName: "x".repeat(81) })).ok).toBe(false);
  });

  it("refuse une fin d'agrément avant la date d'agrément", () => {
    const r = parseProfileForm(read({ agreementDate: "2026-05-01", agreementExpiry: "2026-01-01" }));
    expect(r).toEqual({ ok: false, error: "La fin d'agrément ne peut pas être avant la date d'agrément." });
  });
});

describe("pré-remplissage des documents", () => {
  it("compose nom et adresse sans trous", () => {
    expect(fullName(FULL)).toBe("Alice Test");
    expect(addressOf(FULL)).toBe("1 rue Fictive, 75000 Ville");
    expect(addressOf({ address_line: null, postal_code: null, city: "Ville" })).toBe("Ville");
    expect(employeeFromProfile(FULL)).toMatchObject({ fullName: "Alice Test", agrementNumber: "AG-1", insurer: "Assureur", policyNumber: "P-1" });
  });

  it("sans profil, tout reste un blanc à compléter", () => {
    expect(employeeFromProfile(null, "Tata")).toEqual({ fullName: "Tata", address: "", phone: "", email: "", agrementNumber: "", agrementDate: "", insurer: "", policyNumber: "" });
  });

  it("mesure l'avancement de la fiche", () => {
    expect(completion(null)).toEqual({ done: 0, total: 7 });
    expect(completion(FULL)).toEqual({ done: 7, total: 7 });
  });
});

describe("rappels d'échéances", () => {
  it("calcule les jours restants, même autour du changement d'heure", () => {
    expect(daysUntil("2026-11-20", "2026-11-11")).toBe(9);
    expect(daysUntil("2026-03-30", "2026-03-27")).toBe(3);
    expect(daysUntil("2026-11-01", "2026-11-11")).toBe(-10);
  });

  it("ne signale que les échéances dépassées ou proches (60 jours)", () => {
    const today = "2026-11-11";
    const r = remindersFor({ agreement_expiry: "2031-01-09", insurance_expiry: "2026-12-31" }, today);
    expect(r).toEqual([{ key: "insurance", label: "Assurance responsabilité civile", date: "2026-12-31", daysLeft: 50, level: "soon" }]);
    const late = remindersFor({ agreement_expiry: "2026-11-01", insurance_expiry: null }, today);
    expect(late[0]).toMatchObject({ key: "agreement", level: "late", daysLeft: -10 });
    expect(reminderText(late[0])).toBe("Agrément : échéance dépassée depuis 10 jours");
    expect(remindersFor(null, today)).toEqual([]);
    expect(remindersFor({ agreement_expiry: null, insurance_expiry: null }, today)).toEqual([]);
  });

  it("formule correctement aujourd'hui et demain", () => {
    expect(reminderText({ key: "agreement", label: "Agrément", date: "2026-11-11", daysLeft: 0, level: "soon" })).toBe("Agrément : échéance aujourd’hui");
    expect(reminderText({ key: "agreement", label: "Agrément", date: "2026-11-12", daysLeft: 1, level: "soon" })).toBe("Agrément : échéance dans 1 jour");
  });
});
