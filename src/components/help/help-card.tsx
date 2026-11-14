"use client";

import { useSpeech } from "@/components/help/use-speech";
import { spokenText, type HelpTopic } from "@/lib/help/topics";

/** Contenu d'une explication : grand, lisible, avec un exemple et la lecture à voix haute. Partagé par le « ? » et la visite guidée. */
export function HelpCard({ topic, titleId, compact = false }: { topic: HelpTopic; titleId: string; compact?: boolean }) {
  const { supported, speaking, speak, stop } = useSpeech();
  return (
    <div>
      <div className="flex items-start gap-3">
        <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-2xl border border-sun/50 bg-sun-soft ${compact ? "size-11 text-2xl" : "size-14 text-3xl"}`}>
          {topic.emoji}
        </span>
        <h2 id={titleId} className={`font-display font-semibold leading-tight text-ink ${compact ? "pt-0.5 text-xl" : "pt-1 text-2xl"}`}>
          {topic.title}
        </h2>
      </div>
      <p className={`text-ink ${compact ? "mt-2 text-[17px] leading-snug" : "mt-3 text-lg leading-relaxed"}`}>{topic.text}</p>
      {topic.example ? (
        <p className={`rounded-2xl border border-sun/50 bg-sun-soft leading-snug ${compact ? "mt-2 px-3 py-2 text-[15px]" : "mt-3 px-4 py-3 text-base"}`}>
          <span className="font-bold text-gold-deep">Exemple : </span>
          {topic.example}
        </p>
      ) : null}
      {supported ? (
        <button
          type="button"
          onClick={() => (speaking ? stop() : speak(spokenText(topic)))}
          aria-pressed={speaking}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-cream px-4 text-sm font-bold text-primary ${compact ? "mt-2" : "mt-3"}`}
        >
          <span aria-hidden>{speaking ? "⏹️" : "🔊"}</span>
          {speaking ? "Arrêter la lecture" : "Écouter l’explication"}
        </button>
      ) : null}
    </div>
  );
}
