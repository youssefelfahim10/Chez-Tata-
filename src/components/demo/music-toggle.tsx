"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CalmMusic } from "@/lib/demo/music";

/**
 * Bouton « Musique » de la démonstration. Les navigateurs interdisent le son tant que la personne n'a rien touché :
 * la musique douce démarre donc au premier geste sur la page (sauf si elle a été coupée), et se coupe d'un clic.
 * Le choix « coupée » est mémorisé sur cet appareil.
 */

const KEY = "chez-tata-demo-music";
type Pref = "on" | "off";
const listeners = new Set<() => void>();
let memo: Pref | null = null;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
function readPref(): Pref {
  if (memo === null) {
    try {
      memo = window.localStorage.getItem(KEY) === "off" ? "off" : "on";
    } catch {
      memo = "on";
    }
  }
  return memo;
}
function writePref(next: Pref) {
  memo = next;
  try {
    if (next === "off") window.localStorage.setItem(KEY, "off");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le choix vaut pour cette visite */
  }
  listeners.forEach((l) => l());
}

export function MusicToggle() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "on" as Pref);
  const [playing, setPlaying] = useState(false);
  const engine = useRef<CalmMusic | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);

  const start = useCallback(() => {
    if (engine.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const music = new CalmMusic(new Ctx());
      music.start();
      engine.current = music;
      setPlaying(true);
    } catch {
      /* audio indisponible : la démonstration reste muette */
    }
  }, []);

  const stop = useCallback(() => {
    engine.current?.stop();
    engine.current = null;
    setPlaying(false);
  }, []);

  // Premier geste n'importe où sur la page : la musique douce démarre (le bouton lui-même gère son propre clic).
  useEffect(() => {
    if (pref === "off" || playing) return;
    const first = (event: Event) => {
      if (button.current?.contains(event.target as Node)) return;
      start();
    };
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    return () => {
      window.removeEventListener("pointerdown", first);
      window.removeEventListener("keydown", first);
    };
  }, [pref, playing, start]);

  // Onglet caché : silence ; retour : la musique reprend.
  useEffect(() => {
    const onVisibility = () => engine.current?.setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => () => engine.current?.stop(), []);

  function toggle() {
    if (playing) {
      writePref("off");
      stop();
    } else {
      writePref("on");
      start();
    }
  }

  const muted = pref === "off" && !playing;
  const label = playing ? "Couper la musique" : muted ? "Activer la musique" : "Lancer la musique douce";
  return (
    <button
      ref={button}
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={label}
      title={playing ? "Musique douce · toucher pour couper" : muted ? "Musique coupée · toucher pour l’activer" : "Toucher pour lancer la musique douce"}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-bold transition hover:border-sun ${playing ? "border-sun bg-sun-soft text-gold-deep" : "border-line bg-surface text-ink-soft"}`}
    >
      <span aria-hidden className="text-lg leading-none">{playing ? "🔊" : muted ? "🔇" : "🎵"}</span>
      <span className="hidden sm:inline">{playing ? "Musique" : muted ? "Musique coupée" : "Musique"}</span>
    </button>
  );
}
