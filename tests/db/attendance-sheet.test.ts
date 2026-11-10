import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb, type TestUser } from "./harness";

/** Champs de la fiche de présence A4 : écriture et isolation. Données fictives. */

let t: TestDb;
let alice: TestUser;
let bob: TestUser;
let aliceOrg: string;
let aliceChild: string;

async function createOrg(user: TestUser, name: string) {
  return t.as(user, async (q) => (await q("select public.create_organization($1, 'independent') as id", [name]))[0].id as string);
}

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("Alice");
  bob = await t.createUser("Bob");
  aliceOrg = await createOrg(alice, "Espace Alice");
  await createOrg(bob, "Espace Bob");
  aliceChild = await t.as(alice, async (q) => {
    const rows = await q("insert into children (organization_id, first_name) values ($1, 'Lou') returning id", [aliceOrg]);
    return rows[0].id as string;
  });
});

describe("champs de la fiche de présence", () => {
  it("enregistre une journée complète", async () => {
    const rows = await t.as(alice, (q) =>
      q(
        `insert into attendance_records
           (organization_id, child_id, date, status, actual_start, actual_end,
            absence_minutes, extra_minutes, maintenance_due, meal_due, leave_kind, note)
         values ($1, $2, '2026-11-09', 'present', '2026-11-09T08:00:00Z', '2026-11-09T16:30:00Z',
                 15, 30, true, true, null, 'RDV pédiatre') returning *`,
        [aliceOrg, aliceChild],
      ),
    );
    expect(rows[0]).toMatchObject({ absence_minutes: 15, extra_minutes: 30, maintenance_due: true, note: "RDV pédiatre" });
  });

  it("a des valeurs par défaut neutres", async () => {
    const rows = await t.as(alice, (q) =>
      q(
        "insert into attendance_records (organization_id, child_id, date) values ($1, $2, '2026-11-10') returning *",
        [aliceOrg, aliceChild],
      ),
    );
    expect(rows[0]).toMatchObject({
      absence_minutes: 0,
      extra_minutes: 0,
      maintenance_due: false,
      meal_due: false,
      leave_kind: null,
      note: null,
      status: "planned",
    });
  });

  it.each([
    ["absence négative", "absence_minutes = -1"],
    ["absence > 24 h", "absence_minutes = 1441"],
    ["heures complémentaires > 24 h", "extra_minutes = 1441"],
    ["type de congé inconnu", "leave_kind = 'RTT'"],
    ["observation trop longue", "note = repeat('x', 301)"],
  ])("refuse : %s", async (_label, assignment) => {
    await expect(
      t.as(alice, (q) =>
        q(`update attendance_records set ${assignment} where child_id = $1 and date = '2026-11-09'`, [aliceChild]),
      ),
    ).rejects.toThrow();
  });

  it("n'expose aucun montant en euros dans la table partagée", async () => {
    const cols = await t.admin(
      "select column_name from information_schema.columns where table_name = 'attendance_records' and column_name like '%cents%'",
    );
    expect(cols).toEqual([]);
  });

  it("reste invisible et intouchable pour une autre assistante", async () => {
    const seen = await t.as(bob, (q) => q("select * from attendance_records"));
    expect(seen).toEqual([]);
    const changed = await t.as(bob, (q) =>
      q("update attendance_records set note = 'piraté' where child_id = $1 returning id", [aliceChild]),
    );
    expect(changed).toEqual([]);
    await expect(
      t.as(bob, (q) =>
        q("insert into attendance_records (organization_id, child_id, date) values ($1, $2, '2026-11-11')", [aliceOrg, aliceChild]),
      ),
    ).rejects.toThrow();
    const note = await t.admin("select note from attendance_records where child_id = $1 and date = '2026-11-09'", [aliceChild]);
    expect(note[0].note).toBe("RDV pédiatre");
  });
});
