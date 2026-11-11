import { describe, expect, it } from "vitest";
import { ACTION_EMOJI, ACTION_TONE, LABELS, type ActionType } from "@/lib/journal/labels";
import { TONES } from "@/lib/ui/tones";

const ACTIONS = Object.keys(LABELS) as ActionType[];

describe("couleurs fonctionnelles", () => {
  it("chaque geste a un émoji et une teinte connue", () => {
    for (const a of ACTIONS) {
      expect(ACTION_EMOJI[a], a).toBeTruthy();
      expect(TONES[ACTION_TONE[a]], a).toBeTruthy();
    }
  });

  it("les gestes du quotidien se distinguent d'un coup d'œil (une teinte chacun)", () => {
    const main: ActionType[] = ["arrival", "departure", "meal", "nap", "diaper", "care"];
    expect(new Set(main.map((a) => ACTION_TONE[a])).size).toBe(main.length);
  });

  it("chaque teinte porte ses classes (jamais de couleur seule : émoji + texte restent)", () => {
    for (const tone of Object.values(TONES)) {
      expect(tone.box).toMatch(/^bg-.*-soft border-/);
      expect(tone.icon).toMatch(/^text-/);
      expect(tone.chip).toMatch(/^bg-.*-soft text-/);
    }
  });
});
