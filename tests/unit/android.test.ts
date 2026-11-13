import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAssetLinks, normalizeFingerprint } from "@/lib/android";

const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0").toUpperCase()).join(":");

describe("assetlinks (Android TWA)", () => {
  it("renvoie [] sans empreinte valide", () => {
    expect(buildAssetLinks(undefined, undefined)).toEqual([]);
    expect(buildAssetLinks("fr.cheztata.app", "pas-une-empreinte")).toEqual([]);
  });

  it("construit la relation avec le paquet par défaut", () => {
    const out = buildAssetLinks(undefined, FP);
    expect(out).toHaveLength(1);
    expect(out[0].target).toEqual({ namespace: "android_app", package_name: "fr.cheztata.app", sha256_cert_fingerprints: [FP] });
  });

  it("accepte plusieurs empreintes, sans doublon, avec ou sans deux-points", () => {
    const bare = FP.replace(/:/g, "").toLowerCase();
    const other = FP.replace(/^00/, "FF");
    const out = buildAssetLinks("fr.exemple.app", `${FP}, ${bare}\n${other}`);
    expect(out[0].target.package_name).toBe("fr.exemple.app");
    expect(out[0].target.sha256_cert_fingerprints).toEqual([FP, other]);
  });

  it("ignore un nom de paquet invalide", () => {
    expect(buildAssetLinks("x; DROP", FP)[0].target.package_name).toBe("fr.cheztata.app");
  });

  it("normalise ou rejette une empreinte", () => {
    expect(normalizeFingerprint(FP.toLowerCase())).toBe(FP);
    expect(normalizeFingerprint("AA:BB")).toBeNull();
  });

  it("garde /.well-known public dans le proxy", () => {
    const src = readFileSync("src/proxy.ts", "utf8");
    expect(src).toMatch(/PUBLIC_PATHS = \[[^\]]*"\/\.well-known"/);
  });
});
