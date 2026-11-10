import { describe, expect, it } from "vitest";
import { safeEqual } from "@/lib/security/compare";

describe("comparaison de secrets", () => {
  it("accepte l'égalité exacte seulement", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc123", "abc1234")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
