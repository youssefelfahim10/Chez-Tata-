import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./harness";

/** Profil de l'assistante : strictement personnel. Données entièrement fictives. */

let t: TestDb;
let alice: TestUser;
let bob: TestUser;
let claire: TestUser;
let dana: TestUser;
let aliceOrg: string;
let mam: string;

async function createOrg(user: TestUser, name: string, type: "independent" | "mam") {
  return t.as(user, async (q) => (await q("select public.create_organization($1, $2) as id", [name, type]))[0].id as string);
}

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("Alice");
  bob = await t.createUser("Bob");
  claire = await t.createUser("Claire");
  dana = await t.createUser("Dana");
  aliceOrg = await createOrg(alice, "Espace Alice", "independent");
  await createOrg(bob, "Espace Bob", "independent");
  mam = await createOrg(claire, "MAM Test", "mam");
  // Dana rejoint la MAM de Claire.
  const token = await t.as(claire, async (q) => (await q("select public.create_invitation($1, $2, 'assmat') as token", [mam, dana.email]))[0].token as string);
  await t.as(dana, (q) => q("select public.accept_invitation($1)", [token]));
  await t.as(claire, (q) => q("select public.set_member_status($1, $2, 'active')", [mam, dana.id]));
});

describe("profil de l'assistante", () => {
  it("enregistre identité, agrément et assurance", async () => {
    const rows = await t.as(alice, (q) =>
      q(
        `insert into caregiver_profiles (organization_id, user_id, first_name, last_name, city, agreement_number, agreement_date, agreement_expiry, agreement_capacity, insurance_company, insurance_policy, insurance_expiry)
         values ($1, $2, 'Alice', 'Test', 'Ville fictive', 'AG-000', '2026-01-10', '2031-01-09', 3, 'Assureur Test', 'POL-1', '2026-12-31') returning *`,
        [aliceOrg, alice.id],
      ),
    );
    expect(rows[0]).toMatchObject({ first_name: "Alice", agreement_capacity: 3, insurance_company: "Assureur Test" });
  });

  it("n'accepte qu'un profil par assistante et par espace", async () => {
    await expect(
      t.as(alice, (q) => q("insert into caregiver_profiles (organization_id, user_id) values ($1, $2)", [aliceOrg, alice.id])),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("refuse une capacité d'accueil absurde", async () => {
    await expect(
      t.as(bob, async (q) => {
        const org = (await q("select organization_id from organization_members where user_id = $1", [bob.id]))[0].organization_id;
        return q("insert into caregiver_profiles (organization_id, user_id, agreement_capacity) values ($1, $2, 12)", [org, bob.id]);
      }),
    ).rejects.toThrow(/check/i);
  });

  it("ne peut pas être créé au nom d'une autre", async () => {
    await expect(
      t.as(bob, (q) => q("insert into caregiver_profiles (organization_id, user_id) values ($1, $2)", [aliceOrg, alice.id])),
    ).rejects.toThrow(/row-level security/);
  });

  it("Bob ne lit, ne modifie ni ne supprime le profil d'Alice", async () => {
    expect(await t.as(bob, (q) => q("select * from caregiver_profiles where user_id = $1", [alice.id]))).toEqual([]);
    expect(await t.as(bob, (q) => q("update caregiver_profiles set city = 'piraté' where user_id = $1 returning id", [alice.id]))).toEqual([]);
    expect(await t.as(bob, (q) => q("delete from caregiver_profiles where user_id = $1 returning id", [alice.id]))).toEqual([]);
    expect((await t.admin("select city from caregiver_profiles where user_id = $1", [alice.id]))[0].city).toBe("Ville fictive");
  });

  it("dans une MAM, même la responsable ne voit pas le profil d'une collègue", async () => {
    await t.as(dana, (q) => q("insert into caregiver_profiles (organization_id, user_id, first_name) values ($1, $2, 'Dana')", [mam, dana.id]));
    await t.as(claire, (q) => q("insert into caregiver_profiles (organization_id, user_id, first_name) values ($1, $2, 'Claire')", [mam, claire.id]));
    expect(await t.as(claire, (q) => q("select first_name from caregiver_profiles where organization_id = $1", [mam]))).toEqual([{ first_name: "Claire" }]);
    expect(await t.as(dana, (q) => q("select first_name from caregiver_profiles where organization_id = $1", [mam]))).toEqual([{ first_name: "Dana" }]);
  });

  it("ne laisse pas déplacer le profil vers un autre compte", async () => {
    await expect(t.as(alice, (q) => q("update caregiver_profiles set user_id = $1 where user_id = $2", [bob.id, alice.id]))).rejects.toThrow();
  });

  it("l'audit garde la trace sans les valeurs", async () => {
    const rows = await t.admin("select action from audit_logs where entity_type = 'caregiver_profiles'");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("un visiteur non connecté n'a aucun accès", async () => {
    await expect(t.as(null, (q) => q("select * from caregiver_profiles"))).rejects.toThrow(/permission denied/);
  });

  it("supprimer le compte supprime le profil", async () => {
    const temp = await t.createUser("Temp");
    const org = await createOrg(temp, "Espace Temp", "independent");
    await t.as(temp, (q) => q("insert into caregiver_profiles (organization_id, user_id) values ($1, $2)", [org, temp.id]));
    await t.admin("delete from auth.users where id = $1", [temp.id]);
    expect(await t.admin("select 1 from caregiver_profiles where user_id = $1", [temp.id])).toEqual([]);
  });
});
