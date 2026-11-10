"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { buildWhatsAppUrl, toWhatsAppNumber } from "@/lib/whatsapp/link";

export type Recipient = { id: string; label: string; phone: string | null };

type Props = { initialText: string; recipients: Recipient[]; hasContent: boolean };

const CHOOSE_IN_WHATSAPP = "__choose__";

export function ShareSummary({ initialText, recipients, hasContent }: Props) {
  const [text, setText] = useState(initialText);
  const [recipient, setRecipient] = useState(CHOOSE_IN_WHATSAPP);
  const [reviewed, setReviewed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const selected = recipients.find((r) => r.id === recipient);
  const number = selected ? toWhatsAppNumber(selected.phone) : null;
  const ready = hasContent && reviewed && text.trim().length > 0;

  function openWhatsApp() {
    // L'ouverture se fait sur action explicite ; l'envoi reste à faire dans WhatsApp.
    window.open(buildWhatsAppUrl(number, text), "_blank", "noopener,noreferrer");
    setStatus("WhatsApp s’ouvre avec votre message. Rien n’est envoyé tant que vous n’appuyez pas sur « Envoyer » dans WhatsApp.");
  }

  async function nativeShare() {
    try {
      await navigator.share({ text });
      setStatus("Partage ouvert.");
    } catch {
      setStatus("Partage annulé.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Texte copié.");
    } catch {
      setStatus("Copie impossible : sélectionnez le texte et copiez-le.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!hasContent ? (
        <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm">
          Aucune information n’a été enregistrée aujourd’hui pour cet enfant : il n’y a rien à partager.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bilan" className="text-sm font-bold">
          Message (modifiable)
        </label>
        <textarea
          id="bilan"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setReviewed(false);
          }}
          rows={12}
          className="min-h-48 w-full rounded-2xl border border-line bg-surface p-4 text-base leading-relaxed"
        />
        <button type="button" onClick={() => { setText(initialText); setReviewed(false); }} className="self-start text-sm font-bold text-primary underline">
          Rétablir le texte d’origine
        </button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">Destinataire</legend>
        {recipients.map((r) => {
          const valid = toWhatsAppNumber(r.phone) !== null;
          return (
            <label
              key={r.id}
              className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 ${valid ? "border-line" : "border-line opacity-60"}`}
            >
              <input type="radio" name="recipient" className="size-5 accent-primary" disabled={!valid} checked={recipient === r.id} onChange={() => setRecipient(r.id)} />
              <span>
                {r.label}
                <span className="block text-sm text-ink-soft">{valid ? r.phone : r.phone ? "Numéro non exploitable" : "Pas de numéro renseigné"}</span>
              </span>
            </label>
          );
        })}
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line px-4">
          <input type="radio" name="recipient" className="size-5 accent-primary" checked={recipient === CHOOSE_IN_WHATSAPP} onChange={() => setRecipient(CHOOSE_IN_WHATSAPP)} />
          <span>
            Choisir dans WhatsApp
            <span className="block text-sm text-ink-soft">Vous sélectionnez le contact vous-même.</span>
          </span>
        </label>
      </fieldset>

      <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-leaf-soft px-4 font-bold">
        <input type="checkbox" className="size-5 accent-primary" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
        J’ai relu ce message
      </label>

      <button
        type="button"
        onClick={openWhatsApp}
        disabled={!ready}
        className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#25D366] px-5 text-lg font-extrabold text-[#06301a] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <WhatsAppIcon className="size-8 text-white" />
        Partager sur WhatsApp
      </button>

      <div className="grid grid-cols-2 gap-3">
        {canShare ? (
          <Button type="button" variant="ghost" onClick={nativeShare} disabled={!ready}>
            Partager…
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={copy} disabled={!ready} className={canShare ? "" : "col-span-2"}>
          Copier le texte
        </Button>
      </div>

      <p className="text-sm text-ink-soft">
        Ce message contient des informations sur un enfant. Chez TaTa ne l’envoie jamais seul : vous relisez, vous choisissez le destinataire,
        puis vous envoyez vous-même depuis WhatsApp.
      </p>
      {status ? (
        <p role="status" className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold">
          {status}
        </p>
      ) : null}
    </div>
  );
}
