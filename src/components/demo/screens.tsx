import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { ACTION_EMOJI, ACTION_TONE } from "@/lib/journal/labels";
import { buildDayReport, renderSummary } from "@/lib/whatsapp/summary";
import type { JournalEvent } from "@/lib/journal/day";
import type { SceneId } from "@/lib/demo/script";
import { TONES, type ToneName } from "@/lib/ui/tones";

/* Écrans animés du « film ». Purement décoratifs (aria-hidden côté lecteur) : le texte de chaque chapitre est lu à côté. */

const at = (seconds: number) => ({ ["--d" as string]: `${seconds}s` });

/** Doigt qui vient toucher son parent (positionné dans l'élément touché : aucune coordonnée à régler). */
function Tap({ when, children, className = "" }: { when: number; children: ReactNode; className?: string }) {
  return (
    <span className={`relative ${className}`}>
      <span className="d-press flex size-full flex-col items-center justify-center gap-1" style={at(when + 0.7)}>
        {children}
      </span>
      <span aria-hidden className="d-ripple pointer-events-none absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-deep/40" style={at(when + 0.72)} />
      <span aria-hidden className="d-finger pointer-events-none absolute -bottom-3 right-1 z-20 flex size-9 items-center justify-center rounded-full bg-ink/85 text-white shadow-lg" style={at(when)}>
        <span className="text-lg leading-none">👆</span>
      </span>
    </span>
  );
}

function Toast({ children, when, hideAt }: { children: ReactNode; when: number; hideAt?: number }) {
  return (
    <p
      className={`absolute inset-x-3 bottom-3 z-10 flex items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-[11px] font-semibold text-white shadow-lg ${hideAt ? "d-out" : "d-in"}`}
      style={hideAt ? at(hideAt) : at(when)}
    >
      {hideAt ? <span className="d-in contents" style={at(when)}>{children}</span> : children}
    </p>
  );
}

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-4 pb-2">
      <p className="font-display text-2xl font-semibold leading-tight">{title}</p>
      {sub ? <p className="text-[11px] text-ink-soft">{sub}</p> : null}
    </div>
  );
}

function Avatar({ letter, tone = "bg-primary-soft text-primary" }: { letter: string; tone?: string }) {
  return <span className={`flex size-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold ${tone}`}>{letter}</span>;
}

type Btn = { emoji: string; label: string; tone: ToneName; tapAt?: number };

function ActionGrid({ buttons }: { buttons: Btn[] }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {buttons.map((b) => {
        const tone = TONES[b.tone];
        const cls = `h-[68px] rounded-xl border text-[11px] font-bold text-ink ${tone.box}`;
        const inner = (
          <>
            <span aria-hidden className="text-xl leading-none">{b.emoji}</span>
            {b.label}
          </>
        );
        return b.tapAt !== undefined ? (
          <Tap key={b.label} when={b.tapAt} className={cls}>{inner}</Tap>
        ) : (
          <span key={b.label} className={`flex flex-col items-center justify-center gap-1 ${cls}`}>{inner}</span>
        );
      })}
    </div>
  );
}

/**
 * Deux versions d'un même élément, empilées dans la même cellule : « avant » disparaît, « après » apparaît à l'instant `when`.
 * Sans animation (mouvement réduit), « avant » est masqué et « après » prend naturellement sa place.
 */
function Swap({ when, before, after, className = "" }: { when: number; before: ReactNode; after: ReactNode; className?: string }) {
  return (
    <span className={`inline-grid ${className}`}>
      <span className="d-out [grid-area:1/1]" style={at(when)}>{before}</span>
      <span className="d-in [grid-area:1/1]" style={at(when)}>{after}</span>
    </span>
  );
}

const pill = (text: string, tone: string, glyph?: string) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>
    {glyph ? <span aria-hidden>{glyph}</span> : null}
    {text}
  </span>
);

const BASE: Btn[] = [
  { emoji: ACTION_EMOJI.arrival, label: "Arrivée", tone: ACTION_TONE.arrival },
  { emoji: ACTION_EMOJI.departure, label: "Départ", tone: ACTION_TONE.departure },
  { emoji: ACTION_EMOJI.meal, label: "Repas", tone: ACTION_TONE.meal },
  { emoji: ACTION_EMOJI.nap, label: "Sieste", tone: ACTION_TONE.nap },
  { emoji: ACTION_EMOJI.diaper, label: "Change", tone: ACTION_TONE.diaper },
  { emoji: ACTION_EMOJI.care, label: "Soins", tone: ACTION_TONE.care },
];

function Arrivee() {
  return (
    <div className="relative h-full">
      <Header title="Bonjour TaTa !" sub="mardi 10 novembre 2026" />
      <div className="mx-3 rounded-2xl border border-line bg-surface p-3 shadow-luxe">
        <div className="flex items-center gap-2.5">
          <Avatar letter="L" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-none">Lou</p>
            <p className="mt-1 text-[10px] text-ink-soft">
              <Swap when={2.9} before={<>Journée du jour</>} after={<>Arrivée 08 h 12</>} />
            </p>
          </div>
          <Swap when={2.9} before={pill("Pas encore arrivé", "bg-sun-soft text-gold-deep")} after={pill("Présent", "bg-leaf-soft text-leaf", "✓")} className="shrink-0" />
        </div>
        <ActionGrid buttons={BASE.map((b) => (b.label === "Arrivée" ? { ...b, tapAt: 1.3 } : b))} />
      </div>
      <Toast when={3.1}>
        <Icon name="check" className="size-3.5 shrink-0 text-sun" />
        <span className="flex-1">Arrivée enregistrée pour Lou · 08 h 12</span>
        <span className="rounded-lg bg-white/15 px-2 py-1 text-sun">Annuler</span>
      </Toast>
    </div>
  );
}

function Gestes() {
  return (
    <div className="relative h-full">
      <Header title="Lou" sub="Présent depuis 08 h 12" />
      <div className="mx-3 rounded-2xl border border-line bg-surface p-3 shadow-luxe">
        <ActionGrid
          buttons={BASE.map((b) =>
            b.label === "Repas" ? { ...b, tapAt: 0.5 } : b.label === "Sieste" ? { ...b, tapAt: 3.3 } : b.label === "Change" ? { ...b, tapAt: 5 } : b,
          )}
        />
        <div className="mt-3 flex min-h-[26px] flex-wrap gap-1.5">
          <span className="d-pop" style={at(1.5)}>{pill("Repas ×1", TONES.gold.chip, "🍽️")}</span>
          <span className="d-pop" style={at(4.2)}>{pill("Sieste en cours", TONES.dusk.chip, "😴")}</span>
          <span className="d-pop" style={at(5.9)}>{pill("Change ×1", TONES.aqua.chip, "🧷")}</span>
        </div>
      </div>
      <div className="d-in mx-3 mt-3 rounded-2xl border border-sun/50 bg-sun-soft p-3" style={at(1.6)}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold-deep">Précision du repas</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px] font-bold">
          <span className="rounded-lg border border-line bg-surface py-2 text-center">Un peu</span>
          <span className="d-pop rounded-lg border border-sun bg-gradient-to-b from-[#d9b865] to-sun py-2 text-center text-ink" style={at(2.4)}>Tout mangé</span>
          <span className="rounded-lg border border-line bg-surface py-2 text-center">Rien</span>
        </div>
      </div>
    </div>
  );
}

function Reseau() {
  return (
    <div className="relative h-full">
      <div className="flex items-start justify-between px-4 pb-2">
        <div>
          <p className="font-display text-2xl font-semibold leading-tight">Lou</p>
          <p className="text-[11px] text-ink-soft">Présent</p>
        </div>
        <span className="mt-1 inline-grid justify-items-end">
          <span className="d-out [grid-area:1/1]" style={at(0.9)}>{pill("En ligne", "bg-leaf-soft text-leaf", "✓")}</span>
          <span className="d-in [grid-area:1/1]" style={at(0.9)}>
            <span className="d-out inline-flex" style={at(5.1)}>{pill("Hors ligne", "bg-sun-soft text-gold-deep", "📴")}</span>
          </span>
          <span className="d-in [grid-area:1/1]" style={at(5.1)}>{pill("Synchronisé", "bg-leaf-soft text-leaf", "✓")}</span>
        </span>
      </div>
      <div className="relative mx-3 mb-3 min-h-[46px]">
        <div className="d-in" style={at(1.2)}>
          <div className="d-out flex items-start gap-2 rounded-xl bg-sun-soft px-3 py-2.5 text-[11px] text-ink" style={at(5.1)}>
            <span aria-hidden className="mt-px shrink-0">📴</span>
            Pas de réseau : vos saisies restent sur le téléphone.
          </div>
        </div>
        <div className="d-in absolute inset-0 flex items-start gap-2 rounded-xl bg-leaf-soft px-3 py-2.5 text-[11px] text-ink" style={at(5.1)}>
          <Icon name="check" className="mt-0.5 size-4 shrink-0 text-leaf" />
          Connexion revenue : tout est envoyé automatiquement.
        </div>
      </div>
      <div className="mx-3 rounded-2xl border border-line bg-surface p-3 shadow-luxe">
        <ActionGrid buttons={BASE.map((b) => (b.label === "Repas" ? { ...b, tapAt: 2 } : b))} />
        <div className="mt-3 grid min-h-[26px] justify-items-start">
          <span className="d-pop [grid-area:1/1]" style={at(3.2)}>
            <span className="d-out inline-flex" style={at(5.1)}>{pill("1 saisie à envoyer", "bg-primary-soft text-primary", "⏳")}</span>
          </span>
          <span className="d-pop [grid-area:1/1]" style={at(5.2)}>{pill("Envoyé · heure réelle du geste", "bg-leaf-soft text-leaf", "✓")}</span>
        </div>
      </div>
      <Toast when={3}>
        <Icon name="check" className="size-3.5 shrink-0 text-sun" />
        <span className="flex-1">Repas enregistré pour Lou (hors ligne)</span>
      </Toast>
    </div>
  );
}

function Dictee() {
  const bars = [0.1, 0.35, 0.2, 0.5, 0.05, 0.4, 0.25, 0.55, 0.15, 0.45, 0.3];
  return (
    <div className="relative h-full">
      <Header title="Dictée" sub="Parlez, l’appli propose" />
      <div className="mx-3 flex flex-col items-center rounded-2xl border border-line bg-surface p-4 shadow-luxe">
        <span className="d-glow flex size-14 items-center justify-center rounded-full bg-gradient-to-b from-primary to-primary-strong text-white">
          <span aria-hidden className="text-2xl">🎙️</span>
        </span>
        <div aria-hidden className="mt-3 flex h-8 items-center gap-1">
          {bars.map((d, i) => (
            <span key={i} className="d-bar h-full w-1 rounded-full bg-gold-deep" style={at(d)} />
          ))}
        </div>
        <p className="mt-3 min-h-10 text-center font-display text-lg font-medium leading-snug">
          <span className="d-type inline-block" style={{ ["--d" as string]: "0.8s", ["--t" as string]: "2.2s", ["--n" as string]: "32" }}>
            « Noa a mangé toute son assiette »
          </span>
        </p>
      </div>
      <div className="d-in mx-3 mt-3 rounded-2xl border border-sun/60 bg-sun-soft p-3" style={at(3.2)}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold-deep">Proposition à confirmer</p>
        <div className="mt-2 flex items-center gap-2.5">
          <Avatar letter="N" tone="bg-sun text-ink" />
          <div className="flex-1 text-xs">
            <p className="font-bold">Noa · Repas</p>
            <p className="text-ink-soft">Tout mangé</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
          <span className="flex h-10 items-center justify-center rounded-lg border border-line bg-surface">Corriger</span>
          <Tap when={4.6} className="h-10 rounded-lg bg-gradient-to-b from-primary to-primary-strong text-white">
            <span className="d-out inline-flex items-center" style={at(6)}>Confirmer</span>
            <span className="d-in absolute inset-0 flex items-center justify-center gap-1" style={at(6)}>
              <Icon name="check" className="size-4" /> Enregistré
            </span>
          </Tap>
        </div>
      </div>
      <p className="d-fade mx-4 mt-3 text-center text-[10px] text-ink-soft" style={at(6.4)}>
        Jamais d’enregistrement sans votre validation.
      </p>
    </div>
  );
}

const FIXED = (h: number, m: number) => new Date(Date.UTC(2026, 10, 10, h - 1, m)).toISOString();
const BILAN_EVENTS: JournalEvent[] = [
  { id: "1", child_id: "x", event_type: "arrival", started_at: FIXED(8, 12), ended_at: null },
  { id: "2", child_id: "x", event_type: "meal", started_at: FIXED(11, 45), ended_at: null, event_payload: { amount: "all" } },
  { id: "3", child_id: "x", event_type: "nap", started_at: FIXED(12, 30), ended_at: FIXED(14, 10) },
  { id: "4", child_id: "x", event_type: "diaper", started_at: FIXED(10, 0), ended_at: null },
  { id: "5", child_id: "x", event_type: "departure", started_at: FIXED(17, 5), ended_at: null },
];

/** Même texte que celui de l'application : produit par le vrai code, à partir de gestes fictifs. */
export const BILAN_TEXT = renderSummary(buildDayReport("Lou", new Date(Date.UTC(2026, 10, 10, 12)), BILAN_EVENTS), "Tata");

function Bilan() {
  const lines = BILAN_TEXT.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("📅"));
  return (
    <div className="relative h-full">
      <Header title="Bilan de Lou" sub="Relisez, modifiez, puis partagez" />
      <div className="mx-3 rounded-2xl rounded-tl-sm bg-[#dcf8c6] p-3 text-[11px] leading-relaxed text-[#0b2a14] shadow-luxe">
        {lines.map((l, i) => (
          <p key={i} className="d-in" style={at(0.4 + i * 0.5)}>
            {l}
          </p>
        ))}
      </div>
      <div className="d-in mx-3 mt-3 flex items-center gap-2 rounded-xl bg-leaf-soft px-3 py-2.5 text-xs font-bold" style={at(4.2)}>
        <Tap when={4.5} className="size-5 rounded border border-leaf/60 bg-surface">
          <span className="d-in contents" style={at(5.3)}>
            <Icon name="check" className="size-4 text-leaf" />
          </span>
        </Tap>
        J’ai relu ce message
      </div>
      <p className="mx-3 mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-xs font-extrabold text-[#06301a]">
        <WhatsAppIcon className="size-5 text-white" /> Partager sur WhatsApp
      </p>
      <p className="d-fade mx-4 mt-2 text-center text-[10px] text-ink-soft" style={at(5.6)}>
        Rien ne part seul : vous appuyez sur « Envoyer » vous-même.
      </p>
    </div>
  );
}

function Urgence() {
  const call = (n: string, l: string, i: number) => (
    <span key={n} className="d-pop flex h-14 flex-col items-center justify-center rounded-xl bg-danger text-white" style={at(0.4 + i * 0.15)}>
      <span className="text-lg font-extrabold leading-none">{n}</span>
      <span className="text-[9px] font-semibold">{l}</span>
    </span>
  );
  return (
    <div className="relative h-full">
      <Header title="Urgence · Lou" sub="Les informations que vous avez saisies" />
      <div className="mx-3 rounded-2xl border border-danger/30 bg-pink-soft p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-danger">
          <span aria-hidden>🚨</span> Danger vital : appelez sans attendre
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">{[["15", "SAMU"], ["112", "Européen"], ["18", "Pompiers"]].map(([n, l], i) => call(n, l, i))}</div>
      </div>
      <div className="d-in mx-3 mt-2 rounded-xl bg-pink-soft px-3 py-2" style={at(1.2)}>
        <p className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">Allergies</p>
        <p className="text-xs font-bold">Arachides (exemple fictif)</p>
      </div>
      {[
        ["Médecin", "Dr Exemple", "01 02 03 04 05", 1.9],
        ["Parent", "Famille Test", "06 00 00 00 00", 2.6],
        ["Autorisé à récupérer", "Tante Test", "tante", 3.3],
      ].map(([k, n, p, d]) => (
        <div key={String(k)} className="d-in mx-3 mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2" style={at(Number(d))}>
          <span aria-hidden className="shrink-0 text-base">📞</span>
          <div className="flex-1 text-xs">
            <p className="font-bold">{n}</p>
            <p className="text-[10px] text-ink-soft">{k} · {p}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Papiers() {
  const rows = [["Lun 02", "08 h 10", "17 h 05"], ["Mar 03", "08 h 05", "17 h 00"], ["Mer 04", "08 h 15", "16 h 50"], ["Jeu 05", "08 h 00", "17 h 10"], ["Ven 06", "08 h 20", "17 h 00"]];
  return (
    <div className="relative h-full">
      <div className="d-out" style={at(4.6)}>
        <Header title="Fiche de présence" sub="Remplie à partir du journal" />
        <div className="mx-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-luxe">
          <div className="grid grid-cols-3 bg-primary-soft px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            <span>Jour</span><span>Arrivée</span><span>Départ</span>
          </div>
          {rows.map(([d, a, b], i) => (
            <div key={d} className="d-in grid grid-cols-3 border-t border-line px-3 py-2 text-[11px] font-semibold" style={at(0.4 + i * 0.5)}>
              <span>{d}</span><span>{a}</span><span>{b}</span>
            </div>
          ))}
          <div className="d-in flex items-center justify-between border-t border-sun/60 bg-sun-soft px-3 py-2 text-[11px] font-bold" style={at(3.2)}>
            <span>Total de la semaine</span><span>43 h 10</span>
          </div>
        </div>
        <p className="d-fade mx-4 mt-3 text-center text-[10px] text-ink-soft" style={at(3.5)}>Aucune ressaisie : tout vient de vos pointages.</p>
      </div>
      <div className="d-in absolute inset-x-0 top-0" style={at(4.6)}>
        <Header title="Facture" sub="FAC-2026-0001 · octobre 2026" />
        <div className="mx-3 rounded-2xl border border-line bg-surface p-3 shadow-luxe">
          {[["Salaire net", "612,40 €"], ["Indemnités d’entretien", "58,00 €"], ["Repas", "34,50 €"]].map(([k, v], i) => (
            <p key={k} className="d-in flex justify-between border-b border-line py-2 text-[11px]" style={at(5.0 + i * 0.35)}>
              <span className="text-ink-soft">{k}</span><span className="font-bold">{v}</span>
            </p>
          ))}
          <p className="d-in flex justify-between pt-2 text-xs font-extrabold" style={at(6.2)}>
            <span>Total</span><span>704,90 €</span>
          </p>
        </div>
        <p className="d-pop mx-auto mt-4 flex w-fit -rotate-6 items-center gap-1.5 rounded-lg border-2 border-leaf px-3 py-1.5 text-sm font-extrabold uppercase tracking-wider text-leaf" style={at(7)}>
          <Icon name="check" className="size-4" /> Paiement reçu
        </p>
        <p className="d-fade mx-4 mt-3 text-center text-[10px] text-ink-soft" style={at(7.3)}>Montants fictifs. Facture figée : numéro continu.</p>
      </div>
    </div>
  );
}

function Fin() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-sm.png" alt="" width={96} height={96} className="d-pop size-24 rounded-3xl shadow-luxe" />
      <p className="d-in font-display text-3xl font-semibold leading-tight" style={at(0.4)}>Chez TaTa</p>
      <span aria-hidden className="d-in h-0.5 w-10 bg-sun" style={at(0.7)} />
      <p className="d-in text-sm leading-relaxed text-ink-soft" style={at(0.9)}>Moins d’administratif,<br />plus de temps pour les enfants.</p>
    </div>
  );
}

const SCREENS: Record<SceneId, () => ReactNode> = {
  arrivee: Arrivee,
  gestes: Gestes,
  reseau: Reseau,
  dictee: Dictee,
  bilan: Bilan,
  urgence: Urgence,
  papiers: Papiers,
  fin: Fin,
};

export function SceneScreen({ id }: { id: SceneId }) {
  const Screen = SCREENS[id];
  return (
    <div aria-hidden className="d-scene h-full">
      <Screen />
    </div>
  );
}
