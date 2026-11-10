import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./harness";

/** Paiement reçu → facture : numérotation, isolation, validations, figement. Données fictives. */

let t: TestDb;
let alice: TestUser;
let bob: TestUser;
let aliceOrg: string;
let bobOrg: string;
const contracts: Record<string, string> = {};

const lines = (...amounts: number[]) => JSON.stringify(amounts.map((a, i) => ({ label: `Ligne ${i + 1}`, amount_cents: a })));
const finalize = (user: TestUser, contract: string, period: string, l = lines(78000, 675), paid = "2026-11-10", method = "virement") =>
  t.as(user, async (q) => (await q("select public.finalize_invoice($1, $2, $3::jsonb, $4, $5) as r", [contract, period, l, paid, method]))[0].r as Record<string, unknown>);

async function seed(user: TestUser, org: string, child: string) {
  return t.as(user, async (q) => {
    const c = (await q("insert into children (organization_id, first_name) values ($1, $2) returning id", [org, child]))[0].id as string;
    const k = (
      await q(
        `insert into contracts (organization_id, child_id, assigned_assmat_id, start_date, scheduled_hours, hourly_rate, status)
         values ($1, $2, $3, '2026-09-01', 40, 4.5, 'active') returning id`,
        [org, c, user.id],
      )
    )[0].id as string;
    return k;
  });
}

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("Alice");
  bob = await t.createUser("Bob");
  const mk = (u: TestUser, n: string) => t.as(u, async (q) => (await q("select public.create_organization($1, 'independent') as id", [n]))[0].id as string);
  aliceOrg = await mk(alice, "Espace Alice");
  bobOrg = await mk(bob, "Espace Bob");
  contracts.alice1 = await seed(alice, aliceOrg, "Lou");
  contracts.alice2 = await seed(alice, aliceOrg, "Noa");
  contracts.bob1 = await seed(bob, bobOrg, "Eli");
});

describe("finalize_invoice", () => {
  it("émet une facture numérotée, fige le décompte et enregistre le paiement", async () => {
    const r = await finalize(alice, contracts.alice1, "2026-11-01");
    expect(r.invoice_number).toMatch(/^FAC-\d{4}-0001$/);
    expect(r.total_cents).toBe(78675);
    const s = await t.admin("select status, total_cents, paid_at::text, payment_method, invoice_number, finalized_at is not null as done from monthly_statements where contract_id = $1", [contracts.alice1]);
    expect(s[0]).toMatchObject({ status: "finalized", total_cents: 78675, paid_at: "2026-11-10", payment_method: "virement", done: true });
    const p = await t.admin("select amount_cents, status from payments where statement_id = $1", [r.statement_id]);
    expect(p).toEqual([{ amount_cents: 78675, status: "received" }]);
  });

  it("continue la numérotation pour la même assistante et repart de 1 pour une autre", async () => {
    const second = await finalize(alice, contracts.alice2, "2026-11-01");
    expect(second.invoice_number).toMatch(/^FAC-\d{4}-0002$/);
    const bobFirst = await finalize(bob, contracts.bob1, "2026-11-01");
    expect(bobFirst.invoice_number).toMatch(/^FAC-\d{4}-0001$/);
  });

  it("refuse une seconde facture pour le même mois", async () => {
    await expect(finalize(alice, contracts.alice1, "2026-11-01")).rejects.toThrow(/existe déjà/);
    const next = await finalize(alice, contracts.alice1, "2026-12-01");
    expect(next.invoice_number).toMatch(/-0003$/);
  });

  it("refuse de facturer le contrat d'une autre assistante", async () => {
    await expect(finalize(bob, contracts.alice1, "2027-01-01")).rejects.toThrow(/Contrat introuvable/);
    const count = await t.admin("select count(*)::int as n from monthly_statements where contract_id = $1", [contracts.alice1]);
    expect(count[0].n).toBe(2);
  });

  it("refuse un appel sans connexion", async () => {
    await expect(t.as(null, (q) => q("select public.finalize_invoice($1, '2027-02-01', $2::jsonb, '2027-02-02', 'virement')", [contracts.alice1, lines(100)]))).rejects.toThrow();
  });

  it.each([
    ["aucune ligne", "[]", "2027-03-01", "2026-11-10", "virement", /invalides/],
    ["total à zéro", lines(500, -500), "2027-03-01", "2026-11-10", "virement", /Total/],
    ["total négatif", lines(-100), "2027-03-01", "2026-11-10", "virement", /Total/],
    ["montant décimal", JSON.stringify([{ label: "x", amount_cents: 10.5 }]), "2027-03-01", "2026-11-10", "virement", /Ligne/],
    ["montant en texte", JSON.stringify([{ label: "x", amount_cents: "100" }]), "2027-03-01", "2026-11-10", "virement", /Ligne/],
    ["libellé vide", JSON.stringify([{ label: "  ", amount_cents: 100 }]), "2027-03-01", "2026-11-10", "virement", /Ligne/],
    ["libellé trop long", JSON.stringify([{ label: "x".repeat(121), amount_cents: 100 }]), "2027-03-01", "2026-11-10", "virement", /Ligne/],
    ["période qui n'est pas un 1er", lines(100), "2027-03-15", "2026-11-10", "virement", /Période/],
    ["mode de paiement inconnu", lines(100), "2027-03-01", "2026-11-10", "bitcoin", /Mode/],
    ["paiement dans le futur", lines(100), "2027-03-01", "2099-01-01", "virement", /Date/],
  ])("valide les entrées : %s", async (_label, l, period, paid, method, error) => {
    await expect(finalize(alice, contracts.alice1, period as string, l as string, paid as string, method as string)).rejects.toThrow(error as RegExp);
  });

  it("accepte une ligne négative (remise) tant que le total reste positif", async () => {
    const r = await finalize(alice, contracts.alice2, "2027-04-01", lines(80000, -2000));
    expect(r.total_cents).toBe(78000);
  });

  it("fige la facture : ni modification ni suppression", async () => {
    await expect(t.as(alice, (q) => q("update monthly_statements set total_cents = 1 where contract_id = $1 and period = '2026-11-01'", [contracts.alice1]))).rejects.toThrow(/finalisé/);
    await expect(t.as(alice, (q) => q("delete from monthly_statements where contract_id = $1 and period = '2026-11-01'", [contracts.alice1]))).rejects.toThrow(/finalisé/);
  });

  it("garde les factures invisibles pour une autre assistante", async () => {
    const seen = await t.as(bob, (q) => q("select invoice_number, total_cents from monthly_statements where contract_id = $1", [contracts.alice1]));
    expect(seen).toEqual([]);
  });

  it("ne donne aucun accès direct aux compteurs de numéros", async () => {
    await expect(t.as(alice, (q) => q("select * from document_counters"))).rejects.toThrow();
  });

  it("garde les détails du contrat privés et bornés", async () => {
    await t.as(alice, (q) => q("update contracts set details = $2::jsonb where id = $1", [contracts.alice1, JSON.stringify({ employee: { address: "1 rue Test" } })]));
    expect(await t.as(bob, (q) => q("select details from contracts where id = $1", [contracts.alice1]))).toEqual([]);
    await expect(t.as(alice, (q) => q("update contracts set details = $2::jsonb where id = $1", [contracts.alice1, JSON.stringify({ x: "y".repeat(25000) })]))).rejects.toThrow();
    await expect(t.as(alice, (q) => q("update contracts set details = '[]'::jsonb where id = $1", [contracts.alice1]))).rejects.toThrow();
  });
});
