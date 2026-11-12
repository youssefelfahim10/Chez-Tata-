import { describe, expect, it } from "vitest";
import { detectSpeechEnv, explainSpeechError } from "@/lib/voice/errors";
import { diagnoseMic, mergeDictation, readMicPermission, WATCHDOG_MS, WATCHDOG_PROMPT_MS, watchdogMs, type MicCheck } from "@/lib/voice/session";

const ANDROID_CHROME = detectSpeechEnv({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36" });
const ANDROID_APP = detectSpeechEnv({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile" }, true);
const IPHONE_SAFARI = detectSpeechEnv({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17 Mobile Safari/604.1" });
const IPHONE_APP = detectSpeechEnv({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", standalone: true });
const DESKTOP = detectSpeechEnv({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126" });

const base = { supported: true, secure: true, online: true, permission: "granted" as const };
const byLabel = (checks: MicCheck[], label: string) => checks.find((c) => c.label === label);

describe("délai de sécurité du micro", () => {
  it("laisse le temps de répondre à la fenêtre d'autorisation", () => {
    expect(watchdogMs("prompt")).toBe(WATCHDOG_PROMPT_MS);
    expect(WATCHDOG_PROMPT_MS).toBeGreaterThanOrEqual(30000);
  });

  it("reste court quand le micro est déjà autorisé, refusé ou inconnu", () => {
    for (const state of ["granted", "denied", "unknown"] as const) expect(watchdogMs(state)).toBe(WATCHDOG_MS);
    expect(WATCHDOG_MS).toBeLessThan(10000);
  });
});

describe("dictée en plusieurs fois", () => {
  it("complète le texte déjà présent au lieu de l'écraser", () => {
    expect(mergeDictation("Lou est arrivé à 8h30", "Noa a tout mangé")).toBe("Lou est arrivé à 8h30 Noa a tout mangé");
  });

  it("garde le texte quand rien n'est entendu, et ne laisse pas d'espaces parasites", () => {
    expect(mergeDictation("  Lou est arrivé ", "   ")).toBe("Lou est arrivé");
    expect(mergeDictation("", "  Noa a dormi ")).toBe("Noa a dormi");
    expect(mergeDictation("", "")).toBe("");
  });

  it("recalcule à chaque mise à jour provisoire sans cumuler les doublons", () => {
    const base = "Lou est arrivé";
    expect(mergeDictation(base, "Noa")).toBe("Lou est arrivé Noa");
    expect(mergeDictation(base, "Noa a mangé")).toBe("Lou est arrivé Noa a mangé");
  });
});

describe("autorisation du micro", () => {
  it("répond « inconnue » quand le navigateur ne sait pas la lire, sans planter", async () => {
    expect(await readMicPermission()).toBe("unknown");
  });
});

describe("environnement Android", () => {
  it("reconnaît Android, y compris l'application installée", () => {
    expect(ANDROID_CHROME).toMatchObject({ ios: false, android: true, standalone: false });
    expect(ANDROID_APP).toMatchObject({ ios: false, android: true, standalone: true });
    expect(IPHONE_SAFARI.android).toBe(false);
    expect(DESKTOP.android).toBe(false);
  });

  it("ne renvoie pas vers une icône 🔒 inexistante dans l'application installée", () => {
    expect(explainSpeechError("not-allowed", ANDROID_APP)).toContain("Réglages › Applications › Chrome");
    expect(explainSpeechError("not-allowed", ANDROID_APP)).not.toContain("🔒");
    expect(explainSpeechError("not-allowed", ANDROID_CHROME)).toContain("🔒");
  });

  it("explique une erreur réseau sans accuser la connexion à tort", () => {
    const message = explainSpeechError("network", DESKTOP);
    expect(message).toContain("Chrome");
    expect(message).toContain("micro du clavier");
  });
});

describe("diagnostic du micro", () => {
  it("ne signale aucun problème quand tout est en ordre", () => {
    const checks = diagnoseMic({ ...base, env: ANDROID_CHROME });
    expect(checks.every((c) => c.ok !== false)).toBe(true);
    expect(byLabel(checks, "Autorisation du micro")?.ok).toBe(true);
  });

  it("signale la dictée indisponible et propose une issue", () => {
    const check = byLabel(diagnoseMic({ ...base, supported: false, env: DESKTOP }), "Dictée intégrée");
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain("micro du clavier");
  });

  it("signale l'absence de réseau et de connexion sécurisée", () => {
    const checks = diagnoseMic({ ...base, online: false, secure: false, env: DESKTOP });
    expect(byLabel(checks, "Réseau")?.ok).toBe(false);
    expect(byLabel(checks, "Connexion sécurisée")?.ok).toBe(false);
  });

  it("donne la marche à suivre propre à chaque appareil quand le micro est refusé", () => {
    const detail = (env: typeof DESKTOP) => byLabel(diagnoseMic({ ...base, permission: "denied", env }), "Autorisation du micro")!.detail;
    expect(detail(IPHONE_SAFARI)).toContain("Réglages › Safari › Micro");
    expect(detail(ANDROID_APP)).toContain("Réglages Android");
    expect(detail(DESKTOP)).toContain("🔒");
    expect(byLabel(diagnoseMic({ ...base, permission: "denied", env: DESKTOP }), "Autorisation du micro")?.ok).toBe(false);
  });

  it("présente l'autorisation non demandée ou inconnue comme une information, pas une erreur", () => {
    expect(byLabel(diagnoseMic({ ...base, permission: "prompt", env: DESKTOP }), "Autorisation du micro")?.ok).toBeNull();
    expect(byLabel(diagnoseMic({ ...base, permission: "unknown", env: IPHONE_SAFARI }), "Autorisation du micro")?.ok).toBeNull();
  });

  it("prévient que l'application iPhone installée bloque la dictée, et que sur Android l'autorisation est celle de Chrome", () => {
    expect(byLabel(diagnoseMic({ ...base, env: IPHONE_APP }), "Application installée")?.ok).toBe(false);
    expect(byLabel(diagnoseMic({ ...base, env: ANDROID_APP }), "Application installée")?.detail).toContain("Chrome");
  });
});
