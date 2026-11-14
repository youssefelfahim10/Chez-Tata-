import type { ReactNode } from "react";
import { ChildAvatar } from "@/components/child-avatar";
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

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-4 pb-2">
      <p className="font-display text-2xl font-semibold leading-tight">{title}</p>
      {sub ? <p className="text-[11px] text-ink-soft">{sub}</p> : null}
    </div>
  );
}

type Btn = { emoji: string; label: string; tone: ToneName; tapAt?: number };

function ActionGrid({ buttons, compact = false }: { buttons: Btn[]; compact?: boolean }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {buttons.map((b) => {
        const tone = TONES[b.tone];
        const cls = `${compact ? "h-[54px]" : "h-[68px]"} rounded-xl border text-[11px] font-bold text-ink ${tone.box}`;
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

type RowType = "arrival" | "departure" | "meal" | "nap" | "diaper" | "care";

/** Ligne de la « Journée de … » : même présentation que dans l'application (emoji teinté, heure, précision, boutons). */
function Row({ type, label, time, detail, pills = false, compact = false, tapModify, tapCancel }: { type: RowType; label: string; time: ReactNode; detail?: ReactNode; pills?: boolean; compact?: boolean; tapModify?: number; tapCancel?: number }) {
  const modify = "inline-flex h-6 items-center rounded-full border border-primary/30 bg-surface px-2 text-[9px] font-extrabold text-primary";
  const cancel = "inline-flex h-6 items-center rounded-full border border-line bg-surface px-2 text-[9px] font-bold text-ink-soft";
  return (
    <div className={`flex items-start gap-2 border-t border-line first:border-t-0 ${compact ? "py-1" : "py-1.5"}`}>
      <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-lg border ${compact ? "size-7 text-base" : "size-8 text-lg"} ${TONES[ACTION_TONE[type]].box}`}>
        {ACTION_EMOJI[type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold leading-tight">
          {label} <span className="font-semibold text-ink-soft">· {time}</span>
        </p>
        {detail ? <p className="text-[10px] leading-tight text-ink-soft">{detail}</p> : null}
        {pills ? (
          <span className="mt-1 flex gap-1.5">
            {tapModify !== undefined ? <Tap when={tapModify} className={modify}>✏️ Modifier</Tap> : <span className={modify}>✏️ Modifier</span>}
            {tapCancel !== undefined ? <Tap when={tapCancel} className={cancel}>✕ Annuler</Tap> : <span className={cancel}>✕ Annuler</span>}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Journee({ name, children, className = "" }: { name: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mx-3 mt-2 rounded-xl border border-line bg-cream p-2 ${className}`}>
      <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold-deep">Journée de {name}</h3>
      {children}
    </section>
  );
}

function KidHeader({ name, gender, sub, status }: { name: string; gender: "girl" | "boy"; sub: ReactNode; status: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <ChildAvatar name={name} gender={gender} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-none">{name}</p>
        <p className="mt-1 text-[10px] text-ink-soft">{sub}</p>
      </div>
      {status}
    </div>
  );
}

/** Retour dans la carte (comme dans l'application) : confirmation + bouton d'annulation. */
function Feedback({ children, action, className = "", style }: { children: ReactNode; action?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl border border-leaf/30 bg-leaf-soft p-2 text-[11px] ${className}`} style={style}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-extrabold">✓ {children}</p>
        {action ? <span className="shrink-0 rounded-lg border border-ink/15 bg-surface px-2 py-1 text-[10px] font-extrabold text-primary">{action}</span> : null}
      </div>
    </div>
  );
}

/** Contenu visible de l'instant `from` à l'instant `to` (sans `to` : jusqu'à la fin). Empilé dans la même cellule : rien ne « saute ». */
function Timed({ from, to, children }: { from: number; to?: number; children: ReactNode }) {
  return (
    <span className="d-in block [grid-area:1/1]" style={at(from)}>
      {to !== undefined ? (
        <span className="d-out block" style={at(to)}>
          {children}
        </span>
      ) : (
        children
      )}
    </span>
  );
}

function Arrivee() {
  return (
    <div className="relative h-full">
      <Header title="Bonjour TaTa !" sub="mardi 10 novembre 2026" />
      <div className="mx-3 rounded-2xl border border-line bg-surface p-3 shadow-luxe">
        <KidHeader
          name="Lou"
          gender="girl"
          sub={<Swap when={2.9} before={<>Aucune arrivée saisie</>} after={<>Arrivée 08 h 12</>} />}
          status={<Swap when={2.9} before={pill("Pas encore arrivé", "bg-sun-soft text-gold-deep")} after={pill("Présent", "bg-leaf-soft text-leaf", "✓")} className="shrink-0" />}
        />
        <ActionGrid buttons={BASE.map((b) => (b.label === "Arrivée" ? { ...b, tapAt: 1.3 } : b))} />
        <Feedback className="d-in mt-2" action="Annuler" style={at(3.1)}>
          Arrivée enregistrée
        </Feedback>
      </div>
      <Journee name="Lou" className="d-in" >
        <Row type="arrival" label="Arrivée" time="08 h 12" pills />
      </Journee>
    </div>
  );
}

function Gestes() {
  return (
    <div className="relative h-full">
      <div className="mx-3 mt-1 rounded-2xl border border-line bg-surface p-3 shadow-luxe">
        <KidHeader name="Lou" gender="girl" sub="Arrivée 08 h 12" status={pill("Présent", "bg-leaf-soft text-leaf", "✓")} />
        <ActionGrid
          compact
          buttons={BASE.map((b) =>
            b.label === "Repas" ? { ...b, tapAt: 0.5 } : b.label === "Sieste" ? { ...b, tapAt: 3.3 } : b.label === "Change" ? { ...b, tapAt: 5 } : b,
          )}
        />
        <div className="mt-2 grid min-h-[72px]">
          <Timed from={1.0} to={3.4}>
            <div className="rounded-xl border border-leaf/30 bg-leaf-soft p-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-extrabold">✓ Repas enregistré</p>
                <span className="rounded-lg border border-ink/15 bg-surface px-2 py-1 text-[10px] font-extrabold text-primary">Annuler</span>
              </div>
              <p className="mt-1 text-[9px] font-bold text-ink-soft">Comment s’est passé le repas ? (facultatif)</p>
              <div className="mt-1 grid grid-cols-3 gap-1 whitespace-nowrap text-[9px] font-bold">
                <span className="rounded-full border border-line bg-surface py-1 text-center">Un peu</span>
                <span className="d-pop rounded-full border border-sun bg-gradient-to-b from-[#d9b865] to-sun py-1 text-center text-ink" style={at(2.4)}>Tout mangé</span>
                <span className="rounded-full border border-line bg-surface py-1 text-center">Rien</span>
              </div>
            </div>
          </Timed>
          <Timed from={3.6} to={5.2}>
            <Feedback action="Annuler">Sieste enregistrée</Feedback>
          </Timed>
          <Timed from={5.3}>
            <Feedback action="Annuler">Change enregistré</Feedback>
          </Timed>
        </div>
      </div>
      <Journee name="Lou">
        <Row compact type="arrival" label="Arrivée" time="08 h 12" />
        <div className="d-in" style={at(1.0)}>
          <Row compact type="meal" label="Repas" time="11 h 45" detail={<Swap when={2.5} before={<>—</>} after={<>tout mangé</>} />} />
        </div>
        <div className="d-in" style={at(3.6)}>
          <Row compact type="nap" label="Sieste" time="12 h 30 → en cours" />
        </div>
        <div className="d-in" style={at(5.3)}>
          <Row compact type="diaper" label="Change" time="14 h 10" />
        </div>
      </Journee>
    </div>
  );
}

function Corriger() {
  return (
    <div className="relative h-full">
      <Header title="Journée de Lou" sub="Une erreur ? Rien n’est perdu" />
      {/* Retours dans la carte, l'un après l'autre, dans la même cellule. */}
      <div className="mx-3 grid min-h-[78px]">
        <Timed from={1.9} to={3.9}>
          <div className="rounded-xl border border-sun/60 bg-surface p-2.5">
            <p className="text-[11px] font-extrabold">Modifier : Change</p>
            <div className="mt-1.5 grid grid-cols-[1fr_auto] items-end gap-2">
              <div>
                <p className="text-[9px] font-bold text-ink-soft">Heure</p>
                <p className="mt-0.5 flex h-8 items-center rounded-lg border border-line px-2 text-[12px]">
                  <Swap when={2.9} before={<>14 h 10</>} after={<span className="font-bold">14 h 25</span>} />
                </p>
              </div>
              <Tap when={3.1} className="flex h-8 w-28 rounded-lg bg-gradient-to-b from-primary to-primary-strong text-[11px] font-extrabold text-white">
                ✓ Enregistrer
              </Tap>
            </div>
          </div>
        </Timed>
        <Timed from={4.0} to={5.2}>
          <Feedback action="↩ Annuler la modification">Change modifié</Feedback>
        </Timed>
        <Timed from={5.3} to={7.6}>
          <Feedback action="↩ Rétablir">Repas de 11 h 45 annulé</Feedback>
        </Timed>
        <Timed from={7.7}>
          <Feedback>Repas de 11 h 45 rétabli</Feedback>
        </Timed>
      </div>

      <Journee name="Lou">
        <Row type="arrival" label="Arrivée" time="08 h 12" pills />
        {/* Le repas : visible, puis archivé, puis rétabli (même emplacement, aucun saut). */}
        <div className="grid">
          <div className="d-collapse grid [grid-area:1/1]" style={at(5.3)}>
            <div className="min-h-0 overflow-hidden">
              <Row type="meal" label="Repas" time="11 h 45" detail="tout mangé" pills tapCancel={4.4} />
            </div>
          </div>
          <div className="d-expand grid [grid-area:1/1]" style={at(7.7)}>
            <div className="min-h-0 overflow-hidden">
              <Row type="meal" label="Repas" time="11 h 45" detail="tout mangé" pills />
            </div>
          </div>
        </div>
        <Row
          type="diaper"
          label="Change"
          time={<Swap when={3.9} before={<>14 h 10</>} after={<>14 h 25</>} />}
          pills
          tapModify={1.2}
        />
      </Journee>

      <div className="mx-3 mt-2 grid min-h-[64px]">
        <Timed from={5.4} to={7.6}>
          <div className="rounded-xl border border-dashed border-line bg-surface/70 p-2">
            <p className="text-[10px] font-bold text-ink-soft">🗂️ Annulés aujourd’hui (1) · rien n’est perdu</p>
            <div className="mt-1 flex items-center gap-2">
              <span aria-hidden className="text-base opacity-60">🍽️</span>
              <p className="flex-1 text-[10px] text-ink-soft line-through decoration-ink-soft/60">Repas · 11 h 45 · tout mangé</p>
              <Tap when={6.6} className="inline-flex h-7 min-w-[74px] rounded-lg border border-line bg-surface text-[10px] font-extrabold text-primary">
                ↩ Rétablir
              </Tap>
            </div>
          </div>
        </Timed>
      </div>
    </div>
  );
}

function Reseau() {
  return (
    <div className="relative h-full">
      <div className="relative mx-3 mb-2 mt-1 min-h-[44px]">
        <div className="d-in" style={at(1.0)}>
          <div className="d-out flex items-start gap-2 rounded-xl bg-sun-soft px-3 py-2.5 text-[11px] font-bold text-ink" style={at(5.1)}>
            <span aria-hidden className="mt-px shrink-0">📴</span>
            Hors ligne : vos saisies sont gardées sur ce téléphone et partiront dès le retour du réseau.
          </div>
        </div>
        <div className="d-in absolute inset-0 flex items-start gap-2 rounded-xl bg-leaf-soft px-3 py-2.5 text-[11px] font-bold text-ink" style={at(5.1)}>
          <Icon name="check" className="mt-0.5 size-4 shrink-0 text-leaf" />
          Connexion revenue : tout est envoyé automatiquement.
        </div>
      </div>
      <div className="mx-3 rounded-2xl border border-line bg-surface p-3 shadow-luxe">
        <KidHeader name="Lou" gender="girl" sub="Arrivée 08 h 12" status={pill("Présent", "bg-leaf-soft text-leaf", "✓")} />
        <ActionGrid buttons={BASE.map((b) => (b.label === "Repas" ? { ...b, tapAt: 2 } : b))} />
        <div className="mt-2 grid min-h-[34px] justify-items-start">
          <span className="d-pop [grid-area:1/1]" style={at(3.2)}>
            <span className="d-out inline-flex" style={at(5.1)}>{pill("1 saisie à envoyer", "bg-primary-soft text-primary", "⏳")}</span>
          </span>
          <span className="d-pop [grid-area:1/1]" style={at(5.2)}>{pill("Envoyé · heure réelle du geste", "bg-leaf-soft text-leaf", "✓")}</span>
        </div>
      </div>
      <Journee name="Lou">
        <Row type="arrival" label="Arrivée" time="08 h 12" />
        <div className="d-in" style={at(3.0)}>
          <Row type="meal" label="Repas" time="11 h 45" detail={<Swap when={5.2} before={<>enregistré hors ligne</>} after={<>envoyé · heure réelle conservée</>} />} />
        </div>
      </Journee>
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
          <ChildAvatar name="Noa" gender="boy" size="sm" />
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

function Impots() {
  const months: [string, boolean][] = [["Juil.", true], ["Août", true], ["Sept.", true], ["Oct.", false]];
  return (
    <div className="relative h-full">
      <Header title="Impôts et documents" sub="Revenus d’accueil 2026 · une aide" />
      <div className="mx-3 rounded-2xl border border-line bg-surface p-3 shadow-luxe">
        <KidHeader name="Lou" gender="girl" sub="Famille Test" status={pill("2026", "bg-primary-soft text-primary")} />
        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-[1.35fr_1fr_1fr] bg-primary-soft px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">
            <span>Mois</span>
            <span className="text-right">Salaire</span>
            <span className="text-right">Indemnités</span>
          </div>
          {months.map(([name, estimated], i) => (
            <div key={name} className="d-in grid grid-cols-[1.35fr_1fr_1fr] items-center border-t border-line px-2 py-1.5 text-[10px] font-semibold" style={at(0.5 + i * 0.5)}>
              <span className="flex min-w-0 items-center gap-1">
                {name}
                {estimated ? (
                  <span className="d-pop rounded-full bg-sun-soft px-1.5 py-px text-[8px] font-bold text-gold-deep" style={at(0.9 + i * 0.5)}>estimé</span>
                ) : (
                  <span className="text-leaf">✓</span>
                )}
              </span>
              <span className="text-right tabular-nums">612,40 €</span>
              <span className="text-right tabular-nums">92,50 €</span>
            </div>
          ))}
        </div>
        <p className="d-in mt-2 rounded-xl border border-sun/60 bg-sun-soft px-2.5 py-2 text-[10px] leading-snug" style={at(3.0)}>
          ✨ <b>3 mois remplis automatiquement</b> d’après le contrat et vos présences. Estimations : corrigez-les si besoin, ou validez la facture du mois pour le montant réel.
        </p>
        <div className="d-in mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-bold" style={at(4.2)}>
          <Tap when={4.8} className="h-9 rounded-lg border border-line bg-surface text-primary">
            <span className="d-out inline-flex" style={at(6.2)}>📄 PDF d’aide</span>
            <span className="d-in absolute inset-0 flex items-center justify-center" style={at(6.2)}>✓ PDF créé</span>
          </Tap>
          <span className="flex h-9 items-center justify-center rounded-lg border border-line bg-surface text-primary">🧾 Attestation</span>
        </div>
      </div>
      <p className="d-fade mx-4 mt-2 text-center text-[10px] text-ink-soft" style={at(6.6)}>
        Une aide à la déclaration, jamais un document officiel.
      </p>
    </div>
  );
}

const SCREENS: Record<SceneId, () => ReactNode> = {
  arrivee: Arrivee,
  gestes: Gestes,
  corriger: Corriger,
  reseau: Reseau,
  dictee: Dictee,
  bilan: Bilan,
  urgence: Urgence,
  papiers: Papiers,
  impots: Impots,
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
