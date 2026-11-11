import { describe, expect, it } from "vitest";
import { BAR_SECONDS, chordAt, gapSeconds, MELODY, midiToHz, nextMelody, PROGRESSION } from "@/lib/demo/music";

/** Générateur déterministe pour des tests reproductibles. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);

describe("musique d'ambiance", () => {
  it("convertit les notes MIDI en fréquences", () => {
    expect(midiToHz(69)).toBeCloseTo(440, 5);
    expect(midiToHz(57)).toBeCloseTo(220, 5);
  });

  it("boucle sur 4 accords, sans fin", () => {
    expect(chordAt(0).name).toBe("Cmaj9");
    expect(chordAt(4)).toBe(chordAt(0));
    expect(chordAt(-1)).toBe(chordAt(3));
  });

  it("n'utilise que des notes de la gamme de do majeur, graves et douces", () => {
    for (const chord of PROGRESSION) {
      for (const note of chord.pad) {
        expect(C_MAJOR.has(note % 12), `${chord.name} ${note}`).toBe(true);
        expect(note).toBeGreaterThanOrEqual(36);
        expect(note).toBeLessThanOrEqual(66);
      }
    }
    for (const note of MELODY) expect(C_MAJOR.has(note % 12)).toBe(true);
  });

  it("la mélodie avance de proche en proche, ne répète jamais la même note et reste dans la gamme", () => {
    const rand = seeded(7);
    let previous: number | null = null;
    for (let i = 0; i < 400; i += 1) {
      const note = nextMelody(previous, rand);
      expect(MELODY).toContain(note);
      if (previous !== null) {
        expect(note).not.toBe(previous);
        expect(Math.abs(MELODY.indexOf(note as never) - MELODY.indexOf(previous as never))).toBeLessThanOrEqual(2);
      }
      previous = note;
    }
  });

  it("espace les notes de 1,6 à 4 secondes", () => {
    const rand = seeded(3);
    for (let i = 0; i < 200; i += 1) {
      const gap = gapSeconds(rand);
      expect(gap).toBeGreaterThanOrEqual(1.6);
      expect(gap).toBeLessThanOrEqual(4);
    }
    expect(BAR_SECONDS).toBe(8);
  });
});
