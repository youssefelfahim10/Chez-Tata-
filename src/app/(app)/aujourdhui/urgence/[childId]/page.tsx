import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/session";
import { contactsFromJson, telHref, type Contact } from "@/lib/health/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Urgence" };

type FamilyLink = { relationship: string; families: { id: string; name: string; contact_details: { phone?: string } | null } | null };

function CallButton({ href, label, detail, tone = "ghost" }: { href: string | null; label: string; detail?: string; tone?: "danger" | "ghost" }) {
  const base = "flex min-h-14 items-center gap-3 rounded-xl px-4 text-left font-bold transition active:scale-[0.99]";
  const style = tone === "danger" ? "bg-danger text-white" : "border border-line bg-surface text-ink";
  const content = (
    <>
      <Icon name="phone" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {detail ? <span className={`block text-sm font-normal ${tone === "danger" ? "text-white/85" : "text-ink-soft"}`}>{detail}</span> : null}
      </span>
    </>
  );
  return href ? (
    <a href={href} className={`${base} ${style}`}>
      {content}
    </a>
  ) : (
    <div className={`${base} border border-dashed border-line text-ink-soft`}>
      <Icon name="phone" className="size-5 shrink-0 opacity-50" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        <span className="block text-sm font-normal">Pas de numéro renseigné</span>
      </span>
    </div>
  );
}

function ContactList({ title, people, empty }: { title: string; people: Contact[]; empty: string }) {
  return (
    <Card>
      <h2 className="text-lg font-extrabold">{title}</h2>
      {people.length === 0 ? (
        <p className="mt-2 text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {people.map((p, i) => (
            <li key={`${p.name}-${i}`}>
              <CallButton href={telHref(p.phone)} label={p.name} detail={[p.relation, p.phone].filter(Boolean).join(" · ") || undefined} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function Urgence({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(childId)) notFound();
  const { membership } = await requireWorkspace();
  const supabase = await createClient();

  const [child, health, links] = await Promise.all([
    supabase.from("children").select("id, first_name, last_name").eq("id", childId).eq("organization_id", membership.organizationId).maybeSingle(),
    supabase.from("child_health").select("allergies, diet, medication, medical_notes, doctor_name, doctor_phone, emergency_contacts, authorized_pickups").eq("organization_id", membership.organizationId).eq("child_id", childId).maybeSingle(),
    supabase.from("child_family_links").select("relationship, families(id, name, contact_details)").eq("organization_id", membership.organizationId).eq("child_id", childId),
  ]);
  if (child.error || health.error || links.error) throw new Error("Chargement de la fiche d'urgence impossible.");
  if (!child.data) notFound();

  const h = health.data;
  const parents: Contact[] = ((links.data ?? []) as unknown as FamilyLink[])
    .filter((l) => l.families)
    .map((l) => ({ name: l.families!.name, relation: l.relationship, phone: l.families!.contact_details?.phone ?? "" }));
  const facts: [string, string | null | undefined][] = [
    ["Allergies", h?.allergies],
    ["Traitement en cours", h?.medication],
    ["Régime alimentaire", h?.diet],
    ["Autres remarques", h?.medical_notes],
  ];
  const known = facts.filter(([, value]) => value);
  const name = [child.data.first_name, child.data.last_name].filter(Boolean).join(" ");

  return (
    <>
      <PageTitle subtitle="Les informations que vous avez saisies pour cet enfant">Urgence · {name}</PageTitle>
      <Link href="/aujourdhui" className="-mt-2 font-bold text-primary underline">
        ← Retour à Aujourd’hui
      </Link>

      <Card className="border-danger/30 bg-pink-soft">
        <p className="flex items-center gap-2 font-bold text-danger">
          <Icon name="alert" className="size-5" /> Danger vital : appelez sans attendre
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <CallButton href="tel:15" label="15" detail="SAMU" tone="danger" />
          <CallButton href="tel:112" label="112" detail="Urgence européenne" tone="danger" />
          <CallButton href="tel:18" label="18" detail="Pompiers" tone="danger" />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">À savoir</h2>
        {known.length === 0 ? (
          <p className="mt-2 text-ink-soft">
            Aucune information de santé n’est renseignée.{" "}
            <Link href={`/gestion/${childId}#sante`} className="font-bold text-primary underline">
              Compléter la fiche
            </Link>
          </p>
        ) : (
          <dl className="mt-3 flex flex-col gap-3">
            {known.map(([label, value]) => (
              <div key={label} className={`rounded-xl px-4 py-3 ${label === "Allergies" ? "bg-pink-soft" : "bg-cream"}`}>
                <dt className="text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">Médecin</h2>
        <div className="mt-3">
          {h?.doctor_name || h?.doctor_phone ? (
            <CallButton href={telHref(h?.doctor_phone)} label={h?.doctor_name || "Médecin"} detail={h?.doctor_phone || undefined} />
          ) : (
            <p className="text-ink-soft">Aucun médecin renseigné.</p>
          )}
        </div>
      </Card>

      <ContactList title="Parents" people={parents} empty="Aucune famille renseignée pour cet enfant." />
      <ContactList title="Autres contacts d’urgence" people={contactsFromJson(h?.emergency_contacts)} empty="Aucun contact d’urgence supplémentaire." />
      <ContactList title="Autorisés à récupérer l’enfant" people={contactsFromJson(h?.authorized_pickups)} empty="Aucune personne autorisée renseignée : vérifiez avec les parents." />

      <Link href={`/gestion/${childId}#sante`} className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-5 font-bold text-primary">
        Modifier la fiche santé
      </Link>
    </>
  );
}

export default function Page({ params }: PageProps<"/aujourdhui/urgence/[childId]">) {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <Urgence params={params} />
    </Suspense>
  );
}
