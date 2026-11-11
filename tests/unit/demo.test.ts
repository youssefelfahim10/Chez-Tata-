import { describe, expect, it } from "vitest";
import { initialPlayer, playerReducer, SCENES, totalDuration, type PlayerState } from "@/lib/demo/script";
import { applyAction, demoBilan, DEMO_EMERGENCY, DEMO_KIDS } from "@/lib/demo/sandbox";
import type { JournalEvent } from "@/lib/journal/day";

describe("scénario de la démo", () => {
  it("a des chapitres uniques, complets et d'une durée raisonnable", () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    for (const s of SCENES) {
      expect(s.title.length).toBeGreaterThan(5);
      expect(s.text.length).toBeGreaterThan(20);
      expect(s.duration).toBeGreaterThanOrEqual(5000);
      expect(s.duration).toBeLessThanOrEqual(10_000);
    }
    expect(totalDuration()).toBeLessThan(90_000);
  });
});

describe("lecteur", () => {
  const play = (s: PlayerState) => playerReducer(s, { type: "play" });

  it("ne bouge pas tant qu'il est en pause", () => {
    const s = initialPlayer();
    expect(playerReducer(s, { type: "tick", step: 100 })).toBe(s);
  });

  it("passe au chapitre suivant à la fin de la durée, puis s'arrête sur le dernier", () => {
    let s = play(initialPlayer());
    s = playerReducer(s, { type: "tick", step: SCENES[0].duration });
    expect(s).toMatchObject({ index: 1, elapsed: 0, playing: true });
    s = playerReducer(s, { type: "go", index: SCENES.length - 1 });
    s = playerReducer(s, { type: "tick", step: SCENES[SCENES.length - 1].duration });
    expect(s).toMatchObject({ index: SCENES.length - 1, playing: false });
  });

  it("go borne l'index et relance l'animation du chapitre", () => {
    const s = playerReducer(initialPlayer(), { type: "go", index: 99 });
    expect(s.index).toBe(SCENES.length - 1);
    expect(playerReducer(s, { type: "go", index: -5 }).index).toBe(0);
    expect(playerReducer(s, { type: "go", index: 0 }).runKey).toBeGreaterThan(s.runKey);
  });

  it("rejouer après la fin repart du début", () => {
    let s = playerReducer(initialPlayer(), { type: "go", index: SCENES.length - 1, play: true });
    s = playerReducer(s, { type: "tick", step: 999_999 });
    expect(s.playing).toBe(false);
    expect(playerReducer(s, { type: "toggle" })).toMatchObject({ index: 0, elapsed: 0, playing: true });
  });
});

describe("bac à sable", () => {
  const lou = DEMO_KIDS[0].id;
  const t = (h: number, m: number) => new Date(Date.UTC(2026, 10, 10, h, m));

  it("refuse un départ sans arrivée et une arrivée en double", () => {
    expect(applyAction([], lou, "departure", t(8, 0)).error).toBe(true);
    const r = applyAction([], lou, "arrival", t(8, 0));
    expect(r.events).toHaveLength(1);
    expect(applyAction(r.events, lou, "arrival", t(8, 5)).error).toBe(true);
  });

  it("gère une sieste en cours : une seule à la fois, fin sur la même ligne", () => {
    let ev: JournalEvent[] = applyAction([], lou, "arrival", t(8, 0)).events;
    ev = applyAction(ev, lou, "nap", t(12, 0)).events;
    expect(applyAction(ev, lou, "nap", t(12, 5)).error).toBe(true);
    ev = applyAction(ev, lou, "nap_end", t(13, 0)).events;
    expect(ev.filter((e) => e.event_type === "nap")).toHaveLength(1);
    expect(ev.find((e) => e.event_type === "nap")?.ended_at).not.toBeNull();
    expect(applyAction(ev, lou, "nap_end", t(13, 5)).error).toBe(true);
  });

  it("ne mélange pas les enfants", () => {
    const ev = applyAction([], DEMO_KIDS[1].id, "arrival", t(8, 0)).events;
    expect(applyAction(ev, lou, "departure", t(9, 0)).error).toBe(true);
  });

  it("le bilan vient du vrai code et n'invente rien", () => {
    expect(demoBilan(lou, [], t(10, 0)).hasContent).toBe(false);
    let ev = applyAction([], lou, "arrival", t(8, 0)).events;
    ev = applyAction(ev, lou, "meal", t(11, 30)).events;
    const bilan = demoBilan(lou, ev, t(12, 0));
    expect(bilan.hasContent).toBe(true);
    expect(bilan.text).toContain("Bilan de la journée — Lou");
    expect(bilan.text).toContain("Repas");
    expect(bilan.text).not.toContain("Sieste");
    expect(bilan.text).not.toContain("Noa");
  });

  it("la fiche d'urgence fictive n'utilise que de faux numéros", () => {
    for (const info of Object.values(DEMO_EMERGENCY)) {
      for (const p of info.parents) expect(p.phone).toMatch(/^0[1-9]( \d\d){4}$/);
    }
  });
});
