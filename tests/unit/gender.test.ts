import { describe, expect, it } from "vitest";
import { GENDER_INFO, toGender } from "@/lib/children/gender";

describe("icône fille / garçon", () => {
  it("ne reconnaît que les deux valeurs prévues, sans jamais deviner", () => {
    expect(toGender("girl")).toBe("girl");
    expect(toGender("boy")).toBe("boy");
    expect(toGender("")).toBeNull();
    expect(toGender(null)).toBeNull();
    expect(toGender("autre")).toBeNull();
  });

  it("une icône par genre, avec un libellé écrit", () => {
    expect(GENDER_INFO.girl).toMatchObject({ emoji: "👧", label: "Fille" });
    expect(GENDER_INFO.boy).toMatchObject({ emoji: "👦", label: "Garçon" });
  });
});
