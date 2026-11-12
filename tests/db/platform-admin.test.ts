import { beforeAll, describe, expect, it } from "vitest";
import type { Overview } from "../../src/lib/admin/stats";
import { createTestDb, type TestDb, type TestUser } from "./harness";

/**
 * Administration de la plateforme : droit d'accès, comptages, liste des comptes, suspension et journal des connexions.
 * Données entièrement fictives.
 */

let t: TestDb;
let boss: TestUser; // administrateur de la plateforme
let alice: TestUser;
let bob: TestUser;
let demo: TestUser;

const FORBIDDEN = /Accès réservé/;

async function overviewAs(user: TestUser, exclude: string | null = null): Promise<Overview> {
  const rows = await t.as(user, (q) => q("select public.admin_overview($1) as o", [exclude]));
  return rows[0].o as Overview;
}

async function createOrg(user: TestUser, name: string) {
  return t.as(user, async (q) => (await q("select public.create_organization($1, 'independent') as id", [name]))[0].id as string);
}

beforeAll(async () => {
  t = await createTestDb();
  boss = await t.createUser("Boss");
  alice = await t.createUser("Alice");
  bob = await t.createUser("Bob");
  demo = await t.createUser("Demo");

  await t.admin("update auth.users set raw_app_meta_data = '{\"provider\": \"google\"}' where id = $1", [alice.id]);
  await t.admin("insert into private.platform_admins (user_id) values ($1)", [boss.id]);

  const aliceOrg = await createOrg(alice, "Espace Alice");
  await createOrg(bob, "Espace Bob");
  await t.as(alice, (q) =>
    q("insert into children (organization_id, first_name) values ($1, 'Lou'), ($1, 'Mia')", [aliceOrg]),
  );
});

describe("droit d'administration", () => {
  it("ne reconnaît que les comptes listés", async () => {
    expect((await t.as(boss, (q) => q("select public.am_i_platform_admin() as ok")))[0].ok).toBe(true);
    expect((await t.as(alice, (q) => q("select public.am_i_platform_admin() as ok")))[0].ok).toBe(false);
  });

  it("refuse toutes les fonctions d'administration à un compte ordinaire", async () => {
    await expect(t.as(alice, (q) => q("select public.admin_overview()"))).rejects.toThrow(FORBIDDEN);
    await expect(t.as(alice, (q) => q("select * from public.admin_list_users()"))).rejects.toThrow(FORBIDDEN);
    await expect(t.as(alice, (q) => q("select public.admin_set_user_suspended($1, true)", [bob.id]))).rejects.toThrow(
      FORBIDDEN,
    );
  });

  it("refuse l'accès sans session", async () => {
    await expect(t.as(null, (q) => q("select public.admin_overview()"))).rejects.toThrow(/permission denied/);
    await expect(t.as(null, (q) => q("select public.am_i_platform_admin()"))).rejects.toThrow(/permission denied/);
  });

  it("n'expose aucune table d'administration à l'API", async () => {
    await expect(t.as(boss, (q) => q("select * from private.platform_admins"))).rejects.toThrow(/permission denied/);
    await expect(t.as(alice, (q) => q("select * from private.login_events"))).rejects.toThrow(/permission denied/);
    await expect(t.as(alice, (q) => q("insert into private.platform_admins (user_id) values ($1)", [alice.id]))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("ne s'obtient pas en prenant l'adresse e-mail de l'administrateur", async () => {
    const impostor: TestUser = { id: alice.id, email: boss.email };
    expect((await t.as(impostor, (q) => q("select public.am_i_platform_admin() as ok")))[0].ok).toBe(false);
  });
});

describe("tableau de bord", () => {
  it("compte les comptes, les espaces et les enfants, sans le compte exclu", async () => {
    const o = await overviewAs(boss, demo.email);
    expect(o).toMatchObject({
      users_total: 3, // boss, alice, bob (demo exclu)
      users_google: 1,
      users_email: 2,
      signups_7d: 3,
      organizations: 2,
      children: 2,
    });
    expect(o.daily).toHaveLength(30);
    expect(o.daily.at(-1)).toMatchObject({ signups: 3 });
  });

  it("n'expose aucune donnée d'enfant", async () => {
    const o = await overviewAs(boss);
    expect(JSON.stringify(o)).not.toMatch(/Lou|Mia/);
  });
});

describe("journal des connexions", () => {
  it("enregistre une connexion, une seule par minute", async () => {
    await t.as(alice, (q) => q("select public.record_login('google')"));
    await t.as(alice, (q) => q("select public.record_login('google')"));
    await t.as(bob, (q) => q("select public.record_login('email')"));
    const rows = await t.admin("select user_id, provider from private.login_events order by id");
    expect(rows).toEqual([
      { user_id: alice.id, provider: "google" },
      { user_id: bob.id, provider: "email" },
    ]);
  });

  it("ignore un fournisseur inconnu et refuse l'absence de session", async () => {
    await t.as(boss, (q) => q("select public.record_login('n_importe_quoi')"));
    const rows = await t.admin("select provider from private.login_events where user_id = $1", [boss.id]);
    expect(rows).toEqual([{ provider: "email" }]);
    await expect(t.as(null, (q) => q("select public.record_login('google')"))).rejects.toThrow(/permission denied/);
  });

  it("alimente les chiffres de connexion, jour par jour", async () => {
    const o = await overviewAs(boss, demo.email);
    expect(o.logins_7d).toBe(3);
    expect(o.logins_30d).toBe(3);
    expect(o.daily.at(-1)).toMatchObject({ logins: 3, people: 3 });
  });

  it("disparaît avec le compte (effacement)", async () => {
    await t.admin("delete from auth.users where id = $1", [boss.id]);
    expect(await t.admin("select 1 from private.login_events where user_id = $1", [boss.id])).toHaveLength(0);
    // L'administrateur supprimé est retiré de la liste des administrateurs.
    expect(await t.admin("select 1 from private.platform_admins where user_id = $1", [boss.id])).toHaveLength(0);
    // Pour la suite : un nouvel administrateur.
    boss = await t.createUser("Boss2");
    await t.admin("insert into private.platform_admins (user_id) values ($1)", [boss.id]);
  });
});

describe("liste des comptes", () => {
  it("liste les comptes avec leurs comptages", async () => {
    const rows = await t.as(boss, (q) => q("select * from public.admin_list_users(null, 25, 0, $1)", [demo.email]));
    const names = rows.map((r) => r.display_name);
    expect(names).toContain("Alice");
    expect(names).not.toContain("Demo");
    const aliceRow = rows.find((r) => r.user_id === alice.id)!;
    expect(aliceRow).toMatchObject({
      email: alice.email,
      provider: "google",
      suspended: false,
      is_admin: false,
      space_name: "Espace Alice",
      space_count: 1,
      children_count: 2,
    });
    expect(Number(aliceRow.total_count)).toBe(rows.length);
  });

  it("ne renvoie jamais de nom d'enfant ni de contenu d'espace", async () => {
    const rows = await t.as(boss, (q) => q("select * from public.admin_list_users()"));
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        "children_count",
        "created_at",
        "display_name",
        "email",
        "is_admin",
        "last_sign_in_at",
        "provider",
        "space_count",
        "space_name",
        "suspended",
        "total_count",
        "user_id",
      ].sort(),
    );
  });

  it("filtre par e-mail ou prénom, sans interpréter les caractères spéciaux", async () => {
    const byName = await t.as(boss, (q) => q("select * from public.admin_list_users('alic')"));
    expect(byName.map((r) => r.user_id)).toEqual([alice.id]);
    const wildcard = await t.as(boss, (q) => q("select * from public.admin_list_users('%')"));
    expect(wildcard).toHaveLength(0);
  });

  it("limite la taille des pages", async () => {
    const rows = await t.as(boss, (q) => q("select * from public.admin_list_users(null, 1, 0)"));
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].total_count)).toBeGreaterThan(1);
    const huge = await t.as(boss, (q) => q("select * from public.admin_list_users(null, 100000, 0)"));
    expect(huge.length).toBeLessThanOrEqual(100);
  });
});

describe("suspension d'un compte", () => {
  it("suspend, coupe les sessions, trace l'action, puis réactive", async () => {
    await t.admin("insert into auth.sessions (user_id) values ($1), ($1)", [bob.id]);

    await t.as(boss, (q) => q("select public.admin_set_user_suspended($1, true)", [bob.id]));
    const [{ suspended }] = await t.as(boss, (q) => q("select suspended from public.admin_list_users('bob')"));
    expect(suspended).toBe(true);
    expect(await t.admin("select 1 from auth.sessions where user_id = $1", [bob.id])).toHaveLength(0);

    await t.as(boss, (q) => q("select public.admin_set_user_suspended($1, false)", [bob.id]));
    const [{ suspended: after }] = await t.as(boss, (q) => q("select suspended from public.admin_list_users('bob')"));
    expect(after).toBe(false);

    const actions = await t.admin("select admin_id, action, target_user from private.admin_actions order by id");
    expect(actions).toEqual([
      { admin_id: boss.id, action: "suspend_user", target_user: bob.id },
      { admin_id: boss.id, action: "reactivate_user", target_user: bob.id },
    ]);
  });

  it("refuse de suspendre son propre compte, un autre administrateur ou un compte inconnu", async () => {
    await expect(t.as(boss, (q) => q("select public.admin_set_user_suspended($1, true)", [boss.id]))).rejects.toThrow(
      /propre compte/,
    );
    const second = await t.createUser("Boss3");
    await t.admin("insert into private.platform_admins (user_id) values ($1)", [second.id]);
    await expect(t.as(boss, (q) => q("select public.admin_set_user_suspended($1, true)", [second.id]))).rejects.toThrow(
      /administrateur/,
    );
    await expect(
      t.as(boss, (q) => q("select public.admin_set_user_suspended('00000000-0000-4000-8000-000000000000', true)")),
    ).rejects.toThrow(/introuvable/);
  });
});
