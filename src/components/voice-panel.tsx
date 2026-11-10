"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { LABELS, type ActionType } from "@/lib/journal/labels";
import { parseVoice, type VoiceAction } from "@/lib/voice/parse";

type Child = { id: string; firstName: string };
export type VoiceRow = { key: string; childId: string; action: VoiceAction; time: string; details: Record<string, string>; heard: string; include: boolean };

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

const getCtor = () => {
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
const subscribeNone = () => () => {};
const ACTIONS: VoiceAction[] = ["arrival", "departure", "meal", "nap", "nap_end", "diaper", "care"];

type Props = {
  kids: Child[];
  /** Renvoie les messages d'erreur éventuels ; une liste vide = tout est enregistré. */
  onValidate: (rows: VoiceRow[]) => string[];
  onClose: () => void;
};

/**
 * Dictée vocale avec confirmation obligatoire : la phrase est transcrite, interprétée,
 * puis PROPOSÉE. Rien n'est enregistré tant que vous n'avez pas appuyé sur « Valider ».
 */
export function VoicePanel({ kids, onValidate, onClose }: Props) {
  const supported = useSyncExternalStore(subscribeNone, () => Boolean(getCtor()), () => false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<VoiceRow[] | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const recognition = useRef<Recognition | null>(null);

  function analyse(value: string) {
    const result = parseVoice(value, kids);
    if (!result.understood) {
      setRows([]);
      setMessage("Je n’ai rien compris d’exploitable. Corrigez le texte ou choisissez directement une action sur la carte de l’enfant.");
      return;
    }
    setMessage(null);
    setRows(
      result.proposals.map((p, i) => ({
        key: `${i}-${p.childId}-${p.action}`,
        childId: p.childId ?? "",
        action: p.action,
        time: p.time ?? "",
        details: p.details,
        heard: p.heard,
        include: true,
      })),
    );
  }

  function listen() {
    const Ctor = getCtor();
    if (!Ctor) return;
    setMessage(null);
    setRows(null);
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let line = "";
      for (let i = 0; i < e.results.length; i += 1) line += e.results[i][0].transcript;
      finalText = line;
      setText(line);
    };
    rec.onerror = (e) => {
      setListening(false);
      setMessage(e.error === "not-allowed" ? "Le micro est refusé : autorisez-le dans les réglages du navigateur." : "La dictée a échoué. Réessayez ou écrivez la phrase.");
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) analyse(finalText);
    };
    recognition.current = rec;
    setListening(true);
    rec.start();
  }

  function stop() {
    recognition.current?.stop();
  }

  const update = (key: string, patch: Partial<VoiceRow>) => setRows((r) => r && r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const chosen = rows?.filter((r) => r.include) ?? [];
  const incomplete = chosen.some((r) => !r.childId);

  function validate() {
    const problems = onValidate(chosen);
    setErrors(problems);
    if (problems.length === 0) onClose();
  }

  return (
    <section aria-label="Dictée vocale" className="rounded-card border border-line bg-surface p-4 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">🎙️ Dicter</h2>
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-3 font-bold text-ink-soft" aria-label="Fermer la dictée">
          ✕
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">Ex. « Lou est arrivé à 8h30 » ou « Noa a tout mangé ». Rien n’est enregistré avant votre validation.</p>

      {supported ? (
        <button
          type="button"
          onClick={listening ? stop : listen}
          className={`mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-extrabold text-white ${listening ? "animate-pulse bg-danger" : "bg-primary"}`}
        >
          <span aria-hidden className="text-3xl">
            {listening ? "⏹️" : "🎙️"}
          </span>
          {listening ? "J’écoute… appuyez pour finir" : "Appuyer et parler"}
        </button>
      ) : (
        <p className="mt-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
          La dictée intégrée n’est pas disponible sur ce navigateur. Écrivez la phrase ci-dessous, ou utilisez le micro 🎙️ du clavier de votre téléphone.
        </p>
      )}

      <label className="mt-3 flex flex-col gap-1.5 text-sm font-bold">
        Ce que j’ai compris (modifiable)
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="min-h-16 rounded-2xl border border-line bg-cream p-3 text-base font-normal" />
      </label>
      <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => analyse(text)} disabled={!text.trim()}>
        Analyser le texte
      </Button>

      {message ? <p className="mt-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm">{message}</p> : null}

      {rows && rows.length > 0 ? (
        <div className="mt-4">
          <h3 className="font-extrabold">Vérifiez avant de valider</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.key} className={`rounded-2xl border p-3 ${row.include ? "border-leaf/40 bg-leaf-soft" : "border-line opacity-60"}`}>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" className="size-5 accent-primary" checked={row.include} onChange={(e) => update(row.key, { include: e.target.checked })} />
                  J’ai entendu : « {row.heard} »
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select aria-label="Enfant" value={row.childId} onChange={(e) => update(row.key, { childId: e.target.value })} className="min-h-12 rounded-xl border border-line bg-surface px-3">
                    <option value="">Quel enfant ?</option>
                    {kids.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Action" value={row.action} onChange={(e) => update(row.key, { action: e.target.value as VoiceAction })} className="min-h-12 rounded-xl border border-line bg-surface px-3">
                    {ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {LABELS[a as ActionType].icon} {LABELS[a as ActionType].label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  Heure
                  <input type="time" value={row.time} onChange={(e) => update(row.key, { time: e.target.value })} className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-3" />
                  <span className="text-ink-soft">{row.time ? "" : "vide = maintenant"}</span>
                </label>
              </li>
            ))}
          </ul>
          {errors.length > 0 ? (
            <ul role="alert" className="mt-3 rounded-2xl bg-pink-soft px-4 py-3 text-sm text-danger">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <Button type="button" className="mt-3 w-full" onClick={validate} disabled={chosen.length === 0 || incomplete}>
            ✓ Valider {chosen.length > 1 ? `les ${chosen.length} actions` : "l’action"}
          </Button>
          {incomplete ? <p className="mt-2 text-sm text-ink-soft">Choisissez l’enfant concerné pour chaque action.</p> : null}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-ink-soft">
        Selon votre téléphone, la reconnaissance vocale peut être assurée par le service du navigateur (Google ou Apple). Aucun son n’est conservé par Chez TaTa.
      </p>
    </section>
  );
}
