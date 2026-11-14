"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const subscribeNone = () => () => {};

/**
 * Lecture à voix haute d'une explication (voix du téléphone, en français). Utile pour celles qui lisent moins facilement.
 * Rien n'est envoyé : seul le texte d'aide, jamais une information sur un enfant.
 */
export function useSpeech() {
  const supported = useSyncExternalStore(
    subscribeNone,
    () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined",
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* voix indisponible */
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 0.95;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utterance);
    } catch {
      setSpeaking(false);
    }
  }, []);

  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* rien à arrêter */
      }
    },
    [],
  );

  return { supported, speaking, speak, stop };
}
