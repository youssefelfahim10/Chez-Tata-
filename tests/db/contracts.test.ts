import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./harness";

let t: TestDb;
let alice: TestUser;
let bob: TestUser;
let org: string;
let child: string;

const insertContract = (q: (sql: string, p?: unknown[]) => Promise<unknown[]>, user: TestUser, status = "active") =>
  q(
    `insert into contracts (organization_id, child_id, assigned_assmat_id, start_date, scheduled_hours, hourly_rate,
       maintenance_allowance_cents, meal_allowance_cents, status)
     values ($1, $2, $3, '2026-09-01', 40, 4.5, 350, 400, $4)`,
    [org, child, user.id, status],
  );

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("Alice");
  bob = await t.createUser("Bob");
  org = await t.as(alice, async (q) => (await q("select public.create_organization('Espace Alice', 'independent') as id"))[0].id as string);
  await t.as(bob, (q) => q("select public.create_organization('Espace Bob', 'independent')"));
  child = await t.as(alice, async (q) => (await q("insert into children (organization_id, first_name) values ($1, 'Lou') returning id", [org]))[0].id as string);
});

describe("contrats", () => {
  it("refuse un second contrat actif pour le même enfant", async () => {
    await t.as(alice, (q) => insertContract(q, alice));
    await expect(t.as(alice, (q) => insertContract(q, alice))).rejects.toThrow(/contracts_one_active/);
  });

  it("autorise un nouveau contrat une fois l'ancien terminé", async () => {
    await t.as(alice, (q) => q("update contracts set status = 'ended', end_date = '2026-10-31' where child_id = $1", [child]));
    await t.as(alice, (q) => insertContract(q, alice));
    const rows = await t.as(alice, (q) => q("select status from contracts where child_id = $1 order by status", [child]));
    expect(rows.map((r) => r.status)).toEqual(["active", "ended"]);
  });

  it("refuse une fin de contrat antérieure au début", async () => {
    await expect(
      t.as(alice, (q) => q("update contracts set status = 'ended', end_date = '2026-08-01' where status = 'active' and child_id = $1", [child])),
    ).rejects.toThrow();
  });

  it("garde les montants du contrat invisibles pour une autre assistante", async () => {
    expect(await t.as(bob, (q) => q("select * from contracts"))).toEqual([]);
  });

  it("refuse un contrat sans mensualisation valide ou avec un taux négatif", async () => {
    await expect(
      t.as(alice, (q) =>
        q(
          `insert into contracts (organization_id, child_id, assigned_assmat_id, start_date, scheduled_hours, hourly_rate, status)
           values ($1, $2, $3, '2026-09-01', 0, 4.5, 'draft')`,
          [org, child, alice.id],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      t.as(alice, (q) =>
        q(
          `insert into contracts (organization_id, child_id, assigned_assmat_id, start_date, scheduled_hours, hourly_rate, status)
           values ($1, $2, $3, '2026-09-01', 40, -1, 'draft')`,
          [org, child, alice.id],
        ),
      ),
    ).rejects.toThrow();
  });
});
