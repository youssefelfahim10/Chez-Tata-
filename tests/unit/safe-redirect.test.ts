import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/invitation/abc")).toBe("/invitation/abc");
  });
  it.each(["https://pirate.example", "//pirate.example", "/\\pirate.example", "javascript:alert(1)", "", null, undefined, 42])(
    "refuse %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/aujourdhui");
    },
  );
});
