import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP, spokenText, type HelpId } from "@/lib/help/topics";
import { TOURS } from "@/lib/help/tours";

const words = (s: string) => s.trim().split(/\s+/).length;
const sentences = (s: string) => s.split(/[.!?…]+\s*/).filter((x) => x.trim().length > 0);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(tsx|ts)$/.test(name) ? [full] : [];
  });
}
const SRC = join(__dirname, "..", "..", "src");
const allSource = sourceFiles(SRC).filter((f) => !f.includes(join("lib", "help"))).map((f) => readFileSync(f, "utf8")).join("\n");

describe("explications : simples et courtes", () => {
  const entries = Object.entries(HELP) as [HelpId, (typeof HELP)[HelpId]][];

  it.each(entries)("%s : titre court, explication courte, phrases courtes", (id, topic) => {
    expect(topic.emoji.length).toBeGreaterThan(0);
    expect(topic.title.length).toBeGreaterThanOrEqual(3);
    expect(topic.title.length, `${id} titre`).toBeLessThanOrEqual(40);
    expect(topic.text.length, `${id} texte`).toBeGreaterThanOrEqual(30);
    expect(topic.text.length, `${id} texte`).toBeLessThanOrEqual(210);
    if ("example" in topic) expect(topic.example.length, `${id} exemple`).toBeLessThanOrEqual(110);
    for (const s of sentences(topic.text)) expect(words(s), `${id} : « ${s} »`).toBeLessThanOrEqual(26);
  });

  it("n'utilise aucun jargon technique", () => {
    const jargon = /\b(RLS|PWA|API|serveur|base de données|synchronis|cache|token|JSON|PDF généré)\b/i;
    for (const [id, topic] of entries) expect(`${topic.title} ${topic.text} ${"example" in topic ? topic.example : ""}`, id).not.toMatch(jargon);
  });

  it("parle en vouvoiement, jamais en tutoiement", () => {
    for (const [id, topic] of entries) expect(topic.text, id).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
  });

  it("se lit à voix haute : titre, explication, exemple", () => {
    expect(spokenText(HELP["invoice.base"])).toContain("Accueil mensualisé");
    expect(spokenText(HELP["invoice.base"])).toContain("Exemple :");
    expect(spokenText(HELP["today.edit"])).not.toContain("Exemple");
  });
});

describe("visites guidées", () => {
  const tours = Object.entries(TOURS);

  it.each(tours)("%s : étapes valides, ni trop longues ni trop courtes", (_, tour) => {
    expect(tour.steps.length).toBeGreaterThanOrEqual(3);
    expect(tour.steps.length).toBeLessThanOrEqual(10);
    for (const step of tour.steps) expect(HELP[step.topic], step.topic).toBeDefined();
  });

  it("chaque élément éclairé existe vraiment dans l'application (data-tour)", () => {
    const missing = new Set<string>();
    for (const [, tour] of tours) {
      for (const step of tour.steps) {
        if (!step.target) continue;
        if (!allSource.includes(`tour="${step.target}"`) && !allSource.includes(`tour: "${step.target}"`)) missing.add(step.target);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("toutes les explications utilisées par le code existent", () => {
    const used = [...allSource.matchAll(/help="([a-zA-Z]+\.[a-zA-Z]+)"/g)].map((m) => m[1]);
    const unknown = used.filter((id) => !(id in HELP));
    expect(unknown).toEqual([]);
  });
});
