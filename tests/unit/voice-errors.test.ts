import { describe, expect, it } from "vitest";
import { detectSpeechEnv, explainSpeechError, keyboardTip } from "@/lib/voice/errors";

const IPHONE = { ios: true, standalone: false };
const ANDROID = { ios: false, standalone: false };

describe("détection de l'environnement", () => {
  it("reconnaît un iPhone, un iPad récent et une application installée", () => {
    expect(detectSpeechEnv({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }).ios).toBe(true);
    expect(detectSpeechEnv({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 }).ios).toBe(true);
    expect(detectSpeechEnv({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }).ios).toBe(false);
    expect(detectSpeechEnv({ userAgent: "iPhone", standalone: true }).standalone).toBe(true);
    expect(detectSpeechEnv({ userAgent: "iPhone" }, true).standalone).toBe(true);
  });
});

describe("messages d'erreur de la dictée", () => {
  it("dit quoi faire sur iPhone quand le micro ou la dictée sont bloqués", () => {
    expect(explainSpeechError("not-allowed", IPHONE)).toContain("Réglages › Safari › Micro");
    expect(explainSpeechError("service-not-allowed", IPHONE)).toContain("Activer la dictée");
  });

  it("prévient que l'application installée bloque la dictée sur iOS", () => {
    expect(explainSpeechError("not-allowed", { ios: true, standalone: true })).toContain("ouvrez le site dans Safari");
    expect(explainSpeechError("not-allowed", ANDROID)).not.toContain("Safari");
  });

  it("couvre les autres cas et ne reste jamais muet", () => {
    for (const code of ["no-speech", "audio-capture", "network", "language-not-supported", "aborted", "inconnu", ""]) {
      expect(explainSpeechError(code, ANDROID).length, code).toBeGreaterThan(15);
    }
    expect(explainSpeechError("bizarre", ANDROID)).toContain("code : bizarre");
  });

  it("propose toujours la dictée du clavier", () => {
    expect(keyboardTip(IPHONE)).toContain("iPhone");
    expect(keyboardTip(ANDROID)).toContain("clavier");
  });
});
