import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./harness";

/** Fiche santé et urgences : écriture, contraintes et isolation. Données entièrement fictives. */

let t: TestDb;
let alice: TestUser;
let bob: TestUser;
let aliceOrg: string;
let bobOrg: string;
let aliceChild: string;
let bobChild: string;

async function createOrg(user: TestUser, name: string) {
  return t.as(user, async (q) => (await q("select public.create_organization($1, 'independent') as id", [name]))[0].id as string);
}

async function createChild(user: TestUser, org: string, name: string) {
  return t.as(user, async (q) => (await q("insert into children (organization_id, first_name) values ($1, $2) returning id", [org, name]))[0].id as string);
}

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("Alice");
  bob = await t.createUser("Bob");
  aliceOrg = await createOrg(alice, "Espace Alice");
  bobOrg = await createOrg(bob, "Espace Bob");
  aliceChild = await createChild(alice, aliceOrg, "Lou");
  bobChild = await createChild(bob, bobOrg, "Mia");
});

describe("fiche santé", () => {
  it("enregistre allergies, contacts d'urgence et personnes autorisées", async () => {
    const rows = await t.as(alice, (q) =>
      q(
        `insert into child_health (organization_id, child_id, allergies, doctor_name, doctor_phone, emergency_contacts, authorized_pickups, updated_by)
         values ($1, $2, 'Arachides (fictif)', 'Dr Exemple', '0102030405', $3, $4, $5) returning *`,
        [
          aliceOrg,
          aliceChild,
          JSON.stringify([{ name: "Parent Test", relation: "mère", phone: "0600000000" }]),
          JSON.stringify([{ name: "Tante Test", relation: "tante", phone: "" }]),
          alice.id,
        ],
      ),
    );
    expect(rows[0]).toMatchObject({ allergies: "Arachides (fictif)", doctor_name: "Dr Exemple" });
    expect(rows[0].emergency_contacts).toEqual([{ name: "Parent Test", relation: "mère", phone: "0600000000" }]);
  });

  it("n'accepte qu'une fiche par enfant", async () => {
    await expect(
      t.as(alice, (q) => q("insert into child_health (organization_id, child_id) values ($1, $2)", [aliceOrg, aliceChild])),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("refuse des listes qui ne sont pas des tableaux ou trop longues", async () => {
    const other = await createChild(alice, aliceOrg, "Noa");
    await expect(
      t.as(alice, (q) =>
        q("insert into child_health (organization_id, child_id, emergency_contacts) values ($1, $2, '{}'::jsonb)", [aliceOrg, other]),
      ),
    ).rejects.toThrow(/check/i);
    const seven = JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, relation: "", phone: "" })));
    await expect(
      t.as(alice, (q) =>
        q("insert into child_health (organization_id, child_id, authorized_pickups) values ($1, $2, $3)", [aliceOrg, other, seven]),
      ),
    ).rejects.toThrow(/check/i);
  });

  it("ne laisse pas déplacer la fiche vers un autre enfant ou espace", async () => {
    await expect(
      t.as(alice, (q) => q("update child_health set child_id = $1 where child_id = $2", [bobChild, aliceChild])),
    ).rejects.toThrow();
  });

  it("garde une trace d'audit sans conserver les valeurs", async () => {
    const rows = await t.admin("select entity_type, action from audit_logs where entity_type = 'child_health'");
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain("Arachides");
  });
});

describe("isolation de la fiche santé", () => {
  it("Bob ne voit pas la fiche d'Alice", async () => {
    const rows = await t.as(bob, (q) => q("select * from child_health where child_id = $1", [aliceChild]));
    expect(rows).toEqual([]);
  });

  it("Bob ne peut pas écrire une fiche sur l'enfant d'Alice", async () => {
    await expect(
      t.as(bob, (q) => q("insert into child_health (organization_id, child_id) values ($1, $2)", [aliceOrg, aliceChild])),
    ).rejects.toThrow(/row-level security|foreign key/i);
    await expect(
      t.as(bob, (q) => q("insert into child_health (organization_id, child_id) values ($1, $2)", [bobOrg, aliceChild])),
    ).rejects.toThrow(/foreign key/i);
  });

  it("Bob ne peut ni modifier ni supprimer la fiche d'Alice", async () => {
    const updated = await t.as(bob, (q) => q("update child_health set allergies = 'piraté' where child_id = $1 returning id", [aliceChild]));
    expect(updated).toEqual([]);
    const deleted = await t.as(bob, (q) => q("delete from child_health where child_id = $1 returning id", [aliceChild]));
    expect(deleted).toEqual([]);
    const still = await t.admin("select allergies from child_health where child_id = $1", [aliceChild]);
    expect(still[0].allergies).toBe("Arachides (fictif)");
  });

  it("un visiteur non connecté n'a aucun accès", async () => {
    await expect(t.as(null, (q) => q("select * from child_health"))).rejects.toThrow(/permission denied/);
  });

  it("supprimer l'enfant supprime sa fiche santé", async () => {
    const temp = await createChild(bob, bobOrg, "Éphémère");
    await t.as(bob, (q) => q("insert into child_health (organization_id, child_id, allergies) values ($1, $2, 'x')", [bobOrg, temp]));
    await t.admin("delete from children where id = $1", [temp]);
    expect(await t.admin("select 1 from child_health where child_id = $1", [temp])).toEqual([]);
  });
});
