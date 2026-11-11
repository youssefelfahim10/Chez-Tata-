import { describe, expect, it } from "vitest";
import { findTemplate, formatMonthFR, missingFields, renderTemplate, TEMPLATES } from "@/lib/messages/templates";

describe("modèles de messages", () => {
  it("renvoie null tant qu'un champ obligatoire manque", () => {
    expect(renderTemplate("absence", {}, "Lou")).toBeNull();
    expect(renderTemplate("holidays", { from: "2026-12-21" }, "Lou")).toBeNull();
    expect(renderTemplate("pickup", { reason: "  " }, "Lou")).toBeNull();
  });

  it("écrit une absence sur un jour ou sur une période", () => {
    expect(renderTemplate("absence", { date: "2026-11-12" }, "Lou", "Tata")).toBe(
      "Bonjour,\n\nC'est bien noté pour l'absence de Lou le 12/11/2026. Je ne l'attendrai pas ces jours-là.\n\nBien cordialement,\nTata",
    );
    expect(renderTemplate("absence", { date: "2026-11-12", until: "2026-11-14" }, "Lou")).toContain("du 12/11/2026 au 14/11/2026");
  });

  it("n'ajoute ni signature ni détail qui n'a pas été saisi", () => {
    const text = renderTemplate("late", {}, "Lou")!;
    expect(text).toBe("Bonjour,\n\nPourriez-vous me dire à quelle heure vous pensez venir chercher Lou aujourd'hui ?");
    expect(text).not.toContain("Bien cordialement");
  });

  it("reprend les mots de l'assistante pour demander de venir chercher l'enfant", () => {
    const text = renderTemplate("pickup", { reason: "il est chaud et pleure" }, "Lou")!;
    expect(text).toContain("au sujet de Lou : il est chaud et pleure.");
    expect(text).toContain("venir chercher Lou");
  });

  it("le rappel de règlement n'invente aucun montant", () => {
    expect(renderTemplate("invoice", { month: "2026-10" }, "Lou")).not.toMatch(/€|\(/);
    expect(renderTemplate("invoice", { month: "2026-10", amount: "612,40 €" }, "Lou")).toContain("octobre 2026 (612,40 €)");
  });

  it("valide les formats de date et de mois", () => {
    expect(renderTemplate("holidays", { from: "demain", to: "2026-12-31" }, "Lou")).toBeNull();
    expect(formatMonthFR("2026-13")).toBe("");
    expect(formatMonthFR("2026-01")).toBe("janvier 2026");
  });

  it("chaque modèle est complet et rend un texte avec ses champs obligatoires", () => {
    const sample = { date: "2026-11-12", from: "2026-12-21", to: "2026-12-31", reason: "fatigué", items: "des couches", month: "2026-10" };
    for (const t of TEMPLATES) {
      expect(findTemplate(t.id)).toBe(t);
      expect(missingFields(t, {}).length).toBe(t.fields.filter((f) => f.required).length);
      expect(renderTemplate(t.id, sample, "Lou"), t.id).toContain("Lou");
    }
  });
});
