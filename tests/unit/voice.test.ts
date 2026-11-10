import { describe, expect, it } from "vitest";
import { detectTime, normalize, parseVoice } from "@/lib/voice/parse";

const kids = [
  { id: "lou", firstName: "Lou" },
  { id: "noa", firstName: "Noa" },
  { id: "elea", firstName: "Eléa" },
];
const one = [{ id: "lou", firstName: "Lou" }];
const brief = (t: string, c = kids) => parseVoice(t, c).proposals.map((p) => `${p.childId}:${p.action}${p.time ? "@" + p.time : ""}`);

describe("dictée vocale", () => {
  it("normalise accents, ponctuation et apostrophes", () => {
    expect(normalize("Eléa s’est réveillée !")).toBe("elea s est reveillee");
  });

  it("comprend l'heure sous plusieurs formes", () => {
    expect(detectTime("arrive a 8h30")).toBe("08:30");
    expect(detectTime("arrive a 8 h 30")).toBe("08:30");
    expect(detectTime("parti a 17h")).toBe("17:00");
    expect(detectTime("arrive a 8 heures 15")).toBe("08:15");
    expect(detectTime("arrive a 25h")).toBeNull();
    expect(detectTime("il a mange")).toBeNull();
  });

  it.each([
    ["Lou est arrivé à 8h30", ["lou:arrival@08:30"]],
    ["Noa est partie", ["noa:departure"]],
    ["Eléa a mangé", ["elea:meal"]],
    ["Lou s'est endormi", ["lou:nap"]],
    ["Lou s'est réveillé", ["lou:nap_end"]],
    ["fin de sieste pour Noa", ["noa:nap_end"]],
    ["Noa a eu un change", ["noa:diaper"]],
    ["Lou a pris du doliprane", ["lou:care"]],
  ])("« %s »", (phrase, expected) => expect(brief(phrase)).toEqual(expected));

  it("gère plusieurs enfants et plusieurs actions", () => {
    expect(brief("Lou est arrivé à 8h30 et Noa a mangé")).toEqual(["lou:arrival@08:30", "noa:meal"]);
    expect(brief("Lou est arrivé et a mangé")).toEqual(["lou:arrival", "lou:meal"]);
  });

  it("partage l'action entre plusieurs prénoms", () => {
    expect(brief("Lou et Noa ont mangé")).toEqual(["lou:meal", "noa:meal"]);
  });

  it("extrait les précisions sans rien inventer", () => {
    const p = parseVoice("Lou a tout mangé", kids).proposals[0];
    expect(p.details).toEqual({ amount: "all" });
    expect(parseVoice("Lou a mangé", kids).proposals[0].details).toEqual({});
    expect(parseVoice("Noa a eu un change selle", kids).proposals[0].details).toEqual({ diaper: "soiled" });
  });

  it("ne choisit pas d'enfant quand il y en a plusieurs et aucun nom", () => {
    expect(parseVoice("il est arrivé", kids).proposals[0].childId).toBeNull();
  });

  it("devine l'enfant seulement s'il n'y en a qu'un", () => {
    expect(brief("il est arrivé à 9h", one)).toEqual(["lou:arrival@09:00"]);
  });

  it("ne propose rien pour une phrase incomprise ou vide", () => {
    expect(parseVoice("il fait beau aujourd'hui", kids)).toEqual({ proposals: [], understood: false });
    expect(parseVoice("   ", kids).understood).toBe(false);
    expect(brief("Lou")).toEqual([]);
  });
});
