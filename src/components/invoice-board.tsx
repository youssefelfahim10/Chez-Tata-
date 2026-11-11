"use client";

import { useMemo, useState } from "react";
import { confirmPayment } from "@/app/actions/billing";
import { ChildAvatar } from "@/components/child-avatar";
import { Notice } from "@/components/ui";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { PAYMENT_METHODS, buildDraftLines, paymentMethodLabel, type BillingContract, type MonthActivity, type PaymentMethod } from "@/lib/billing/invoice";
import { buildInvoiceDoc, type ContractDetails, type StoredLine } from "@/lib/documents/details";
import { downloadPdf, loadFontBytes, safeFileName, sharePdf } from "@/lib/pdf/browser";
import { buildInvoicePdf } from "@/lib/pdf/invoice";
import { formatDateFR, formatEuros, monthNameFR } from "@/lib/sheet/compute";
import { buildWhatsAppUrl, toWhatsAppNumber } from "@/lib/whatsapp/link";

export type InvoiceItem = {
  contractId: string;
  childName: string;
  childGender?: string | null;
  contract: BillingContract;
  activity: MonthActivity;
  details: ContractDetails;
  fallbackEmployeeName: string;
  existing: null | { number: string; totalCents: number; paidAt: string; method: string; lines: StoredLine[] };
};

type Props = { month: string; today: string; items: InvoiceItem[]; canInvoice: boolean };

/** « 12,50 » ou « -5 » → centimes (négatif accepté : remise) ; invalide → null. */
export function parseSignedEuros(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(",", ".");
  const m = /^(-)?(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const cents = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || 0);
  return m[1] ? -cents : cents;
}

const inputClass = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";

export function InvoiceBoard({ month, today, items, canInvoice }: Props) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <InvoiceCard key={item.contractId} item={item} month={month} today={today} canInvoice={canInvoice} />
      ))}
    </ul>
  );
}

type Draft = { id: string; label: string; detail: string; amount: string; on: boolean; manual: boolean };

function InvoiceCard({ item, month, today, canInvoice }: { item: InvoiceItem; month: string; today: string; canInvoice: boolean }) {
  const [existing, setExisting] = useState(item.existing);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    buildDraftLines(item.contract, item.activity).map((l) => ({ id: l.key, label: l.label, detail: l.detail, amount: formatEuros(l.amountCents).replace(/\s/g, ""), on: true, manual: false })),
  );
  const [method, setMethod] = useState<PaymentMethod>("virement");
  const [paidAt, setPaidAt] = useState(today);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<null | "pay" | "pdf" | "share">(null);

  const parsed = drafts.map((d) => ({ d, cents: d.on ? parseSignedEuros(d.amount) : 0 }));
  const invalid = parsed.some((p) => p.d.on && p.cents === null);
  const total = parsed.reduce((t, p) => t + (p.cents ?? 0), 0);
  const parentName = item.details.parents.names.find(Boolean) ?? "";
  const waNumber = toWhatsAppNumber(item.details.parents.phone);
  const periodLabel = `${monthNameFR(month)} ${month.slice(0, 4)}`;
  const set = (id: string, patch: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const pdfBytes = useMemo(
    () => async (inv: NonNullable<InvoiceItem["existing"]>) => {
      const doc = buildInvoiceDoc({
        number: inv.number,
        issuedOn: today,
        period: month,
        details: item.details,
        fallbackEmployeeName: item.fallbackEmployeeName,
        childName: item.childName,
        lines: inv.lines,
        totalCents: inv.totalCents,
        paidOn: inv.paidAt,
        method: inv.method,
      });
      return buildInvoicePdf(doc, await loadFontBytes());
    },
    [item, month, today],
  );

  const messageFor = (inv: NonNullable<InvoiceItem["existing"]>) =>
    `Bonjour${parentName ? ` ${parentName}` : ""}, voici la facture ${inv.number} de ${item.childName} pour ${periodLabel} : ${formatEuros(inv.totalCents)} €. Paiement reçu le ${formatDateFR(inv.paidAt)}, merci ! 🧸`;

  async function pay() {
    setMessage(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) return setMessage({ tone: "error", text: "📴 Hors ligne : la facture se génère avec du réseau." });
    const chosen = parsed.filter((p) => p.d.on);
    if (chosen.length === 0 || invalid) return setMessage({ tone: "error", text: "Vérifiez les montants (ex. 12,50). Un montant peut être négatif pour une remise." });
    if (total <= 0) return setMessage({ tone: "error", text: "Le total doit être supérieur à 0 €." });
    setBusy("pay");
    try {
      const lines = chosen.map((p) => ({ label: p.d.label.trim() || "Ligne", detail: p.d.detail.trim() || undefined, amountCents: p.cents as number }));
      const result = await confirmPayment({ contractId: item.contractId, period: `${month}-01`, paidAt, method, lines });
      if (!result.ok) return setMessage({ tone: "error", text: result.error });
      setExisting({ number: result.number, totalCents: result.totalCents, paidAt, method, lines: lines.map((l) => ({ label: l.label, detail: l.detail, amount_cents: l.amountCents })) });
      setMessage({ tone: "success", text: `Paiement noté ✓ Facture ${result.number} générée.` });
    } catch {
      setMessage({ tone: "error", text: "Impossible de générer la facture. Réessayez." });
    } finally {
      setBusy(null);
    }
  }

  async function output(kind: "pdf" | "share") {
    if (!existing) return;
    setBusy(kind);
    setMessage(null);
    try {
      const bytes = await pdfBytes(existing);
      const name = `Facture_${existing.number}_${safeFileName(item.childName)}.pdf`;
      if (kind === "pdf") {
        downloadPdf(bytes, name);
        setMessage({ tone: "success", text: "Facture PDF créée ✓" });
      } else {
        const text = messageFor(existing);
        const r = await sharePdf(bytes, name, text, buildWhatsAppUrl(waNumber, text));
        setMessage({ tone: "success", text: r === "shared" ? "Partage ouvert : choisissez WhatsApp, puis envoyez vous-même." : "PDF téléchargé et WhatsApp ouvert : joignez le fichier, puis envoyez vous-même." });
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Création du PDF impossible." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-card border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <ChildAvatar name={item.childName} gender={item.childGender} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-extrabold">{item.childName}</h2>
          <p className="text-sm text-ink-soft">{parentName ? `Famille : ${parentName}` : "Parents non renseignés"} · {periodLabel}</p>
        </div>
        {existing ? (
          <span className="rounded-full bg-leaf-soft px-3 py-1 text-xs font-extrabold text-leaf">✓ Payée</span>
        ) : (
          <span className="rounded-full bg-sun-soft px-3 py-1 text-xs font-extrabold">À facturer</span>
        )}
      </div>

      {existing ? (
        <div className="mt-4">
          <div className="rounded-2xl bg-leaf-soft p-4">
            <p className="text-sm font-bold text-leaf">{existing.number}</p>
            <p className="text-3xl font-extrabold">{formatEuros(existing.totalCents)} €</p>
            <p className="text-sm text-ink-soft">Reçu le {formatDateFR(existing.paidAt)} · {paymentMethodLabel(existing.method)}</p>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {existing.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>{l.label}{l.detail ? <span className="block text-xs text-ink-soft">{l.detail}</span> : null}</span>
                <b>{formatEuros(l.amount_cents)} €</b>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3">
            <button type="button" onClick={() => output("share")} disabled={busy !== null} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#25D366] px-5 text-lg font-extrabold text-[#06301a] disabled:opacity-50">
              <WhatsAppIcon className="size-7 text-white" />
              {busy === "share" ? "Préparation…" : "Envoyer la facture par WhatsApp"}
            </button>
            <button type="button" onClick={() => output("pdf")} disabled={busy !== null} className="min-h-12 rounded-2xl border border-line bg-surface font-bold">
              {busy === "pdf" ? "Création…" : "📄 Télécharger le PDF"}
            </button>
          </div>
        </div>
      ) : canInvoice ? (
        <div className="mt-4">
          <p className="text-sm font-bold">Lignes de la facture <span className="font-normal text-ink-soft">(cochez, corrigez si besoin)</span></p>
          <ul className="mt-2 flex flex-col gap-2">
            {drafts.map((d) => (
              <li key={d.id} className={`rounded-2xl border p-3 ${d.on ? "border-leaf bg-leaf-soft" : "border-line opacity-70"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" aria-label={`Inclure ${d.label}`} className="size-6 accent-primary" checked={d.on} onChange={(e) => set(d.id, { on: e.target.checked })} />
                  {d.manual ? (
                    <input aria-label="Libellé" className={`${inputClass} flex-1`} value={d.label} onChange={(e) => set(d.id, { label: e.target.value })} maxLength={120} placeholder="Ex. Remise, régularisation…" />
                  ) : (
                    <span className="min-w-0 flex-1 text-sm font-bold">{d.label}<span className="block text-xs font-normal text-ink-soft">{d.detail}</span></span>
                  )}
                  <span className="flex items-center gap-1">
                    <input aria-label={`Montant ${d.label}`} className="min-h-12 w-24 rounded-xl border border-line bg-surface px-2 text-right text-base font-bold" inputMode="decimal" value={d.amount} onChange={(e) => set(d.id, { amount: e.target.value })} disabled={!d.on} />
                    <span>€</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setDrafts((all) => [...all, { id: `m${all.length}`, label: "", detail: "", amount: "", on: true, manual: true }])} className="mt-2 min-h-11 rounded-full border border-line bg-cream px-4 text-sm font-bold">
            ➕ Ajouter une ligne
          </button>

          <p className="mt-4 text-sm font-bold">Reçu par</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} aria-pressed={method === m.value} className={`min-h-11 rounded-full border px-4 text-sm font-bold ${method === m.value ? "border-primary bg-primary text-white" : "border-line bg-cream"}`}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex flex-col gap-1.5 text-sm font-bold">
            Date de réception
            <input type="date" className={inputClass} value={paidAt} max={today} onChange={(e) => setPaidAt(e.target.value)} />
          </label>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-sun-soft px-4 py-3">
            <span className="font-bold">Total</span>
            <span className="text-2xl font-extrabold">{invalid ? "—" : `${formatEuros(total)} €`}</span>
          </div>
          <button type="button" onClick={pay} disabled={busy !== null} className="mt-3 inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-extrabold text-white disabled:opacity-50">
            {busy === "pay" ? "Génération…" : "✓ Paiement reçu : générer la facture"}
          </button>
          <p className="mt-2 text-xs text-ink-soft">Une fois validée, la facture est numérotée et ne peut plus être modifiée.</p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-sun-soft px-4 py-3 text-sm">Ce mois n’est pas encore commencé : la facture se prépare à partir du mois en cours.</p>
      )}

      {message ? <div role="status" className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
    </li>
  );
}
