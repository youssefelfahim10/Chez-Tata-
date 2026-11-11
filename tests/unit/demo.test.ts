import { describe, expect, it } from "vitest";
import { initialPlayer, playerReducer, SCENES, totalDuration, type PlayerState } from "@/lib/demo/script";
import { applyAction, demoBilan, DEMO_EMERGENCY, DEMO_KIDS, runOps } from "@/lib/demo/sandbox";
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

  it("présente les mêmes fonctions que l'application : corriger, archives, impôts, dictée", () => {
    const ids = SCENES.map((s) => s.id);
    for (const id of ["gestes", "corriger", "dictee", "bilan", "urgence", "papiers", "impots"] as const) expect(ids).toContain(id);
    expect(ids.indexOf("corriger")).toBeGreaterThan(ids.indexOf("gestes"));
    expect(ids.at(-1)).toBe("fin");
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

  it("annuler un geste le met en archive et le rétablit avec ses précisions (code réel de l'application)", () => {
    let state = { events: applyAction([], lou, "arrival", t(8, 0)).events, archived: [] as JournalEvent[] };
    const meal = applyAction(state.events, lou, "meal", t(11, 30));
    state = { ...state, events: meal.events };
    state = runOps(state, [{ kind: "detail", id: "d1", targetId: meal.created!, payload: { amount: "all" } }]);
    state = runOps(state, [{ kind: "undo", id: "u1", targetId: meal.created!, undo: "event" }]);
    expect(state.events.map((e) => e.event_type)).toEqual(["arrival"]);
    expect(state.archived).toHaveLength(1);
    state = runOps(state, [{ kind: "restore", id: "r1", targetId: meal.created! }]);
    expect(state.events.map((e) => e.event_type)).toEqual(["arrival", "meal"]);
    expect(state.archived).toEqual([]);
    expect(state.events[1].event_payload).toEqual({ amount: "all" });
  });

  it("les identifiants restent uniques même après une annulation", () => {
    const first = applyAction([], lou, "arrival", t(8, 0));
    const second = applyAction(first.events, lou, "meal", t(9, 0));
    const archivedOnly = runOps({ events: second.events, archived: [] }, [{ kind: "undo", id: "u", targetId: first.created!, undo: "event" }]);
    const third = applyAction(archivedOnly.events, lou, "care", t(10, 0));
    const ids = [...third.events, ...archivedOnly.archived].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
