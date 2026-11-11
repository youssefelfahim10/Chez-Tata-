"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { LABELS, type ActionType } from "@/lib/journal/labels";
import { detectSpeechEnv, explainSpeechError, keyboardTip, MIC_NO_ANSWER, NOTHING_HEARD, SAFARI_ADVICE, type SpeechEnv } from "@/lib/voice/errors";
import { parseVoice, type VoiceAction } from "@/lib/voice/parse";

type Child = { id: string; firstName: string };
export type VoiceRow = { key: string; childId: string; action: VoiceAction; time: string; details: Record<string, string>; heard: string; include: boolean };

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
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
/** Environnement (iPhone, application installée) : lu côté navigateur uniquement, sans décalage à l'hydratation. */
const getEnvKey = () => {
  const env = detectSpeechEnv(navigator as Navigator & { standalone?: boolean }, window.matchMedia("(display-mode: standalone)").matches);
  return `${env.ios ? "ios" : "other"}${env.standalone ? "-app" : ""}${env.thirdParty ? "-other" : ""}`;
};
const WATCHDOG_MS = 7000;
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
  const envKey = useSyncExternalStore(subscribeNone, getEnvKey, () => "other");
  const env: SpeechEnv = { ios: envKey.startsWith("ios"), standalone: envKey.includes("-app"), thirdParty: envKey.endsWith("-other") };
  const [text, setText] = useState("");
  const [rows, setRows] = useState<VoiceRow[] | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const recognition = useRef<Recognition | null>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(
    () => () => {
      if (watchdog.current) clearTimeout(watchdog.current);
      recognition.current?.stop();
    },
    [],
  );

  const clearWatchdog = () => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  };

  const lastAnalysed = useRef("");
  const kidsRef = useRef(kids);
  useEffect(() => {
    kidsRef.current = kids;
  });
  const [copied, setCopied] = useState(false);

  const analyse = useCallback(
    (value: string) => {
      lastAnalysed.current = value;
      const result = parseVoice(value, kidsRef.current);
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
    },
    [],
  );

  // Texte écrit ou dicté au clavier : la proposition apparaît toute seule après une courte pause (rien n'est enregistré sans « Valider »).
  useEffect(() => {
    if (listening || starting) return;
    const value = text.trim();
    if (value.length < 4 || value === lastAnalysed.current) return;
    const id = setTimeout(() => analyse(value), 1400);
    return () => clearTimeout(id);
  }, [text, listening, starting, analyse]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setMessage(`Copiez ce lien : ${window.location.origin}`);
    }
  }

  function listen() {
    const Ctor = getCtor();
    if (!Ctor) return;
    setMessage(null);
    setRows(null);
    let rec: Recognition;
    try {
      rec = new Ctor();
    } catch {
      setMessage(explainSpeechError("service-not-allowed", env));
      return;
    }
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    let failed = false;
    rec.onstart = () => {
      clearWatchdog();
      setStarting(false);
      setListening(true);
    };
    rec.onresult = (e) => {
      let line = "";
      for (let i = 0; i < e.results.length; i += 1) line += e.results[i][0].transcript;
      finalText = line;
      setText(line);
    };
    rec.onerror = (e) => {
      failed = true;
      clearWatchdog();
      setStarting(false);
      setListening(false);
      setMessage(explainSpeechError(e.error, env));
      textarea.current?.focus();
    };
    rec.onend = () => {
      clearWatchdog();
      setStarting(false);
      setListening(false);
      if (finalText.trim()) analyse(finalText);
      else if (!failed) setMessage(NOTHING_HEARD);
    };
    recognition.current = rec;
    setStarting(true);
    // Délai de sécurité : si le navigateur ne démarre jamais l'écoute (autorisation en attente, dictée bloquée), on le dit.
    watchdog.current = setTimeout(() => {
      failed = true;
      setStarting(false);
      setListening(false);
      setMessage(MIC_NO_ANSWER);
      try {
        rec.stop();
      } catch {
        /* déjà arrêté */
      }
    }, WATCHDOG_MS);
    try {
      rec.start();
    } catch {
      failed = true;
      clearWatchdog();
      setStarting(false);
      setMessage(explainSpeechError("service-not-allowed", env));
    }
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
          onClick={listening || starting ? stop : listen}
          className={`mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-extrabold text-white ${listening ? "animate-pulse bg-danger" : "bg-primary"}`}
        >
          <span aria-hidden className="text-3xl">
            {listening ? "⏹️" : "🎙️"}
          </span>
          {listening ? "J’écoute… appuyez pour finir" : starting ? "Démarrage du micro…" : "Appuyer et parler"}
        </button>
      ) : (
        <p className="mt-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
          La dictée intégrée n’est pas disponible sur ce navigateur. Écrivez la phrase ci-dessous, ou utilisez le micro 🎙️ du clavier de votre téléphone.
        </p>
      )}

      {env.thirdParty ? (
        <div className="mt-3 rounded-2xl border border-sun/60 bg-sun-soft px-4 py-3 text-sm">
          <p>{SAFARI_ADVICE}</p>
          <button type="button" onClick={copyLink} className="mt-2 min-h-11 rounded-xl border border-line bg-surface px-4 font-bold text-primary">
            {copied ? "✓ Lien copié : collez-le dans Safari" : "Copier le lien du site"}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => textarea.current?.focus()}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-bold text-primary"
      >
        <span aria-hidden>⌨️</span> Écrire ou dicter avec le clavier
      </button>
      <p className="mt-1.5 text-xs text-ink-soft">{keyboardTip(env)}</p>

      <label className="mt-3 flex flex-col gap-1.5 text-sm font-bold">
        Ce que j’ai compris (modifiable)
        <textarea ref={textarea} value={text} onChange={(e) => setText(e.target.value)} rows={2} className="min-h-16 rounded-2xl border border-line bg-cream p-3 text-base font-normal" />
      </label>
      <Button type="button" variant={text.trim() ? "primary" : "ghost"} className="mt-2 w-full" onClick={() => analyse(text)} disabled={!text.trim()}>
        Analyser le texte
      </Button>

      {message ? (
        <p role="status" className="mt-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}

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
                        {LABELS[a as ActionType].label}
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
