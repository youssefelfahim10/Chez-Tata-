import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./harness";

/** Suppression de compte : effacement complet, MAM partagée, isolation. Données fictives. */

let t: TestDb;
let solo: TestUser; // assistante indépendante
let claire: TestUser; // propriétaire de MAM
let dana: TestUser; // assistante invitée dans la MAM de Claire
let other: TestUser; // tiers, ne doit jamais être touché
let soloOrg: string;
let mam: string;
let otherOrg: string;

const orgOf = (u: TestUser, name: string, type: "independent" | "mam") =>
  t.as(u, async (q) => (await q("select public.create_organization($1, $2) as id", [name, type]))[0].id as string);

async function seed(u: TestUser, org: string, name: string) {
  return t.as(u, async (q) => {
    const child = (await q("insert into children (organization_id, first_name) values ($1, $2) returning id", [org, name]))[0].id as string;
    const contract = (
      await q(
        `insert into contracts (organization_id, child_id, assigned_assmat_id, start_date, scheduled_hours, hourly_rate, status)
         values ($1, $2, $3, '2026-09-01', 40, 4.5, 'active') returning id`,
        [org, child, u.id],
      )
    )[0].id as string;
    await q("insert into daily_events (organization_id, child_id, assmat_id, event_type, started_at) values ($1, $2, $3, 'arrival', now())", [org, child, u.id]);
    await q("insert into expenses (organization_id, owner_id, category, amount_cents, date) values ($1, $2, 'jeux', 1000, current_date)", [org, u.id]);
    await q("select public.finalize_invoice($1, '2026-10-01', $2::jsonb, current_date, 'virement')", [contract, JSON.stringify([{ label: "Accueil", amount_cents: 78000 }])]);
    return { child, contract };
  });
}

const count = async (sql: string, params: unknown[] = []) => (await t.admin(sql, params))[0].n as number;

beforeAll(async () => {
  t = await createTestDb();
  solo = await t.createUser("Solo");
  claire = await t.createUser("Claire");
  dana = await t.createUser("Dana");
  other = await t.createUser("Autre");
  soloOrg = await orgOf(solo, "Espace Solo", "independent");
  mam = await orgOf(claire, "MAM des Lilas", "mam");
  otherOrg = await orgOf(other, "Espace Autre", "independent");
  await seed(solo, soloOrg, "Lou");
  await seed(other, otherOrg, "Noa");
  await seed(claire, mam, "Eli");
  // Dana rejoint la MAM par invitation, puis pointe et facture.
  const token = await t.as(claire, async (q) => (await q("select public.create_invitation($1, $2, 'assmat') as t", [mam, dana.email]))[0].t as string);
  await t.as(dana, (q) => q("select public.accept_invitation($1)", [token]));
  await seed(dana, mam, "Zoé");
});

describe("delete_my_account", () => {
  it("refuse un appel sans connexion", async () => {
    await expect(t.as(null, (q) => q("select public.delete_my_account()"))).rejects.toThrow();
  });

  it("supprime l'espace entier et le compte d'une assistante indépendante, factures figées comprises", async () => {
    await t.as(solo, (q) => q("select public.delete_my_account()"));
    expect(await count("select count(*)::int as n from auth.users where id = $1", [solo.id])).toBe(0);
    expect(await count("select count(*)::int as n from organizations where id = $1", [soloOrg])).toBe(0);
    expect(await count("select count(*)::int as n from children where organization_id = $1", [soloOrg])).toBe(0);
    expect(await count("select count(*)::int as n from monthly_statements where organization_id = $1", [soloOrg])).toBe(0);
    expect(await count("select count(*)::int as n from profiles where id = $1", [solo.id])).toBe(0);
  });

  it("ne touche à aucune donnée d'une autre personne", async () => {
    expect(await count("select count(*)::int as n from children where organization_id = $1", [otherOrg])).toBe(1);
    expect(await count("select count(*)::int as n from monthly_statements where organization_id = $1", [otherOrg])).toBe(1);
    expect(await count("select count(*)::int as n from auth.users where id = $1", [other.id])).toBe(1);
  });

  it("dans une MAM : supprime les données personnelles de l'assistante qui part, garde enfants et journal", async () => {
    await t.as(dana, (q) => q("select public.delete_my_account()"));
    expect(await count("select count(*)::int as n from auth.users where id = $1", [dana.id])).toBe(0);
    // personnelles : parties
    expect(await count("select count(*)::int as n from contracts where assigned_assmat_id = $1", [dana.id])).toBe(0);
    expect(await count("select count(*)::int as n from expenses where owner_id = $1", [dana.id])).toBe(0);
    // partagées : conservées, auteur anonymisé
    expect(await count("select count(*)::int as n from children where organization_id = $1 and first_name = 'Zoé'", [mam])).toBe(1);
    const ev = await t.admin("select assmat_id from daily_events where organization_id = $1 and child_id = (select id from children where first_name = 'Zoé' and organization_id = $1)", [mam]);
    expect(ev).toEqual([{ assmat_id: null }]);
    // le reste de la MAM est intact
    expect(await count("select count(*)::int as n from monthly_statements where organization_id = $1", [mam])).toBe(1);
    expect(await count("select count(*)::int as n from organization_members where organization_id = $1", [mam])).toBe(1);
  });

  it("la dernière membre qui part supprime la MAM", async () => {
    await t.as(claire, (q) => q("select public.delete_my_account()"));
    expect(await count("select count(*)::int as n from organizations where id = $1", [mam])).toBe(0);
    expect(await count("select count(*)::int as n from children where organization_id = $1", [mam])).toBe(0);
  });

  it("ne protège plus rien hors effacement : la facture d'une autre reste figée", async () => {
    await expect(t.as(other, (q) => q("update monthly_statements set total_cents = 1 where organization_id = $1", [otherOrg]))).rejects.toThrow(/finalisé/);
    await expect(t.admin("select set_config('app.erasure', 'on', false)")).resolves.toBeTruthy();
    await t.admin("select set_config('app.erasure', 'off', false)");
  });
});
