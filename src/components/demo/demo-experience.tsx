"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useState } from "react";
import { Icon } from "@/components/icons";
import { Phone } from "@/components/demo/phone";
import { Sandbox } from "@/components/demo/sandbox";
import { SceneScreen } from "@/components/demo/screens";
import { initialPlayer, playerReducer, SCENES } from "@/lib/demo/script";

const TICK = 100;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const TRY_STEPS = [
  "Touchez « Arrivée » sur Lou, puis « Repas » et « Sieste ».",
  "Touchez « Bilan » : le message est écrit à partir de vos gestes.",
  "Touchez « Urgence » pour voir la fiche (les numéros sont fictifs).",
];

const btnBase = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border transition disabled:opacity-40";
const btn = `${btnBase} border-line bg-surface text-ink hover:border-sun`;
const btnPlay = `${btnBase} size-12 border-primary bg-primary text-white hover:brightness-110`;
const LINK_PRIMARY = "inline-flex min-h-13 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-strong px-7 text-base font-bold tracking-wide text-white shadow-[0_10px_24px_-10px_rgb(1_39_95/0.7)] transition hover:brightness-110";
const LINK_GHOST = "inline-flex min-h-13 items-center justify-center rounded-xl border border-line bg-surface px-7 text-base font-bold tracking-wide text-ink transition hover:border-sun";

export function DemoExperience() {
  const [mode, setMode] = useState<"tour" | "try">("tour");
  const [state, dispatch] = useReducer(playerReducer, undefined, initialPlayer);
  const [touched, setTouched] = useState(false);
  const scene = SCENES[state.index];
  const isLast = state.index === SCENES.length - 1;
  const finished = isLast && !state.playing && state.elapsed >= scene.duration;
  const playing = mode === "tour" && state.playing;

  // Démarre seul, sauf si la personne demande moins de mouvement (le lecteur reste alors manuel).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => dispatch({ type: "play" }), 700);
    return () => clearTimeout(id);
  }, []);

  // Horloge du lecteur.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => dispatch({ type: "tick", step: TICK }), TICK);
    return () => clearInterval(id);
  }, [playing]);

  // Pause quand l'onglet est caché.
  useEffect(() => {
    const onHide = () => document.hidden && dispatch({ type: "pause" });
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const go = useCallback((index: number, play?: boolean) => dispatch({ type: "go", index, play }), []);

  // Flèches du clavier pour changer de chapitre.
  useEffect(() => {
    if (mode !== "tour") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(state.index + 1);
      if (e.key === "ArrowLeft") go(state.index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, state.index, go]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="ct-glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 font-display text-2xl font-semibold text-primary-strong">
            <Image src="/logo-sm.png" alt="" width={40} height={40} className="size-9 rounded-lg" priority />
            Chez TaTa
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/connexion" className="inline-flex min-h-11 items-center rounded-xl px-4 font-semibold hover:bg-primary-soft">Se connecter</Link>
            <Link href="/inscription" className="hidden min-h-11 items-center rounded-xl bg-primary px-5 font-bold text-white sm:inline-flex">Créer mon espace</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_auto] lg:gap-20 lg:py-14">
        <section aria-labelledby="demo-title" className="order-2 flex flex-col gap-6 lg:order-1">
          <p className="w-fit rounded-full border border-sun/60 bg-sun-soft px-3.5 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gold-deep">
            Démonstration · données fictives
          </p>

          {mode === "tour" ? (
            <div key={`${state.index}-${state.runKey}`} className="d-caption flex flex-col gap-3">
              <p className="font-display text-3xl font-medium text-gold-deep">{ROMAN[state.index]}</p>
              <h1 id="demo-title" className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">{scene.title}</h1>
              <p className="max-w-xl text-lg leading-relaxed text-ink-soft">{scene.text}</p>
              {isLast ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setMode("try")} className={LINK_PRIMARY}>Essayer vous-même</button>
                  <Link href="/inscription" className={LINK_GHOST}>Créer mon espace</Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="d-caption flex flex-col gap-3">
              <h1 id="demo-title" className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">À vous de jouer</h1>
              <p className="max-w-xl text-lg leading-relaxed text-ink-soft">Voici l’application, avec deux enfants fictifs. Rien n’est enregistré ni envoyé : tout disparaît quand vous quittez la page.</p>
              <ol className="mt-2 flex max-w-xl flex-col gap-2.5">
                {TRY_STEPS.map((t, i) => (
                  <li key={t} className="flex gap-3 text-ink-soft">
                    <span className="font-display text-xl font-medium text-gold-deep">{ROMAN[i]}</span>
                    {t}
                  </li>
                ))}
              </ol>
              {touched ? (
                <div className="d-in mt-3 flex flex-wrap gap-3">
                  <Link href="/inscription" className={LINK_PRIMARY}>Créer mon espace</Link>
                  <Link href="/connexion" className={LINK_GHOST}>Se connecter</Link>
                </div>
              ) : null}
              <button type="button" onClick={() => setMode("tour")} className="mt-1 min-h-11 w-fit text-sm font-bold text-primary underline">
                ← Revoir la présentation
              </button>
            </div>
          )}

          {mode === "tour" ? (
            <div className="flex flex-col gap-4">
              <div role="progressbar" aria-label="Avancement du chapitre" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((state.elapsed / scene.duration) * 100)} className="h-1 w-full max-w-xl overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-sun transition-[width] duration-100 ease-linear" style={{ width: `${Math.min(100, (state.elapsed / scene.duration) * 100)}%` }} />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className={btn} onClick={() => go(state.index - 1)} disabled={state.index === 0} aria-label="Chapitre précédent">
                  <Icon name="skipBack" className="size-4" />
                </button>
                <button type="button" className={btnPlay} onClick={() => dispatch({ type: "toggle" })} aria-label={playing ? "Mettre en pause" : finished ? "Rejouer" : "Lecture"}>
                  <Icon name={playing ? "pause" : finished ? "replay" : "play"} className="size-5" />
                </button>
                <button type="button" className={btn} onClick={() => go(state.index + 1)} disabled={isLast} aria-label="Chapitre suivant">
                  <Icon name="skipForward" className="size-4" />
                </button>
                <button type="button" onClick={() => setMode("try")} className="ml-auto min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-primary transition hover:border-sun">
                  Essayer vous-même
                </button>
              </div>
              <ol className="flex max-w-xl flex-wrap gap-2" aria-label="Chapitres">
                {SCENES.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => go(i, true)}
                      aria-current={i === state.index ? "step" : undefined}
                      className={`min-h-9 rounded-full border px-3 text-xs font-bold transition ${i === state.index ? "border-sun bg-sun-soft text-gold-deep" : "border-line bg-surface text-ink-soft hover:border-sun"}`}
                    >
                      {s.chapter}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>

        <div className="order-1 origin-top scale-[0.72] -mb-40 sm:scale-[0.85] sm:-mb-20 lg:order-2 lg:mb-0 lg:scale-100" data-paused={mode === "tour" && !state.playing ? "true" : "false"}>
          <Phone label={mode === "tour" ? `Aperçu animé : ${scene.title}` : "Application en démonstration, utilisable avec des enfants fictifs"}>
            {mode === "tour" ? <SceneScreen key={`${state.index}-${state.runKey}`} id={scene.id} /> : <Sandbox onTouched={() => setTouched(true)} />}
          </Phone>
        </div>
      </main>

      <footer className="border-t border-line bg-surface px-4 py-4 text-center text-xs text-ink-soft">
        Démonstration : aucune donnée réelle, rien n’est envoyé ni enregistré. <Link href="/confidentialite" className="font-bold text-primary underline">Confidentialité</Link>
      </footer>
    </div>
  );
}
