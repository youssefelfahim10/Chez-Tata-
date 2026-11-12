import { describe, expect, it } from "vitest";
import { ANDROID_PACKAGE_DEFAULT, androidFingerprints, androidPackageName, assetLinks } from "@/lib/android";

const FP1 = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";
const FP2 = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";

describe("liens d'application Android", () => {
  it("reste vide tant qu'aucune empreinte n'est renseignée", () => {
    expect(assetLinks({})).toEqual([]);
    expect(assetLinks({ ANDROID_SHA256_CERT_FINGERPRINTS: "  " })).toEqual([]);
  });

  it("publie le paquet et l'empreinte déclarés", () => {
    expect(assetLinks({ ANDROID_SHA256_CERT_FINGERPRINTS: FP1 })).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: ANDROID_PACKAGE_DEFAULT, sha256_cert_fingerprints: [FP1] },
      },
    ]);
  });

  it("accepte plusieurs empreintes, en majuscules et sans doublon", () => {
    const env = { ANDROID_SHA256_CERT_FINGERPRINTS: `${FP1.toLowerCase()}, ${FP2} ,${FP1}` };
    expect(androidFingerprints(env)).toEqual([FP1, FP2]);
  });

  it("écarte les empreintes mal formées plutôt que de publier un lien invalide", () => {
    expect(androidFingerprints({ ANDROID_SHA256_CERT_FINGERPRINTS: "pas-une-empreinte,12:34" })).toEqual([]);
    expect(assetLinks({ ANDROID_SHA256_CERT_FINGERPRINTS: "n'importe quoi" })).toEqual([]);
  });

  it("utilise le nom de paquet configuré s'il est valide, sinon celui par défaut", () => {
    expect(androidPackageName({ ANDROID_PACKAGE_NAME: "fr.exemple.cheztata" })).toBe("fr.exemple.cheztata");
    expect(androidPackageName({ ANDROID_PACKAGE_NAME: "pas un nom" })).toBe(ANDROID_PACKAGE_DEFAULT);
    expect(androidPackageName({})).toBe(ANDROID_PACKAGE_DEFAULT);
  });
});
