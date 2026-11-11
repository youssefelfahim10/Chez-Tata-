import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Row, type TestDb, type TestUser } from "./harness";

/**
 * Tests d'isolation multi-tenant exécutés contre un vrai moteur PostgreSQL
 * (PGlite) avec les migrations du dépôt. Données entièrement fictives.
 */

let t: TestDb;

// Deux assistantes indépendantes.
let alice: TestUser;
let bob: TestUser;
let aliceOrg: string;
let bobOrg: string;
const aliceData: Record<string, string> = {};

// Une MAM : Claire (propriétaire), Dana (assistante invitée).
let claire: TestUser;
let dana: TestUser;
let mam: string;

const TENANT_TABLES = [
  "organizations",
  "organization_members",
  "organization_settings",
  "children",
  "families",
  "child_family_links",
  "contracts",
  "daily_events",
  "daily_event_revisions",
  "attendance_records",
  "child_health",
  "monthly_statements",
  "payments",
  "expenses",
  "documents",
  "audit_logs",
  "sync_operations",
  "backups",
];

async function createOrg(user: TestUser, name: string, type: "independent" | "mam") {
  return t.as(user, async (q) => {
    const rows = await q("select public.create_organization($1, $2) as id", [name, type]);
    return rows[0].id as string;
  });
}

/** Jeu de données complet pour une assistante dans une organisation. */
async function seedFullDataset(user: TestUser, org: string, firstName: string) {
  return t.as(user, async (q) => {
    const one = async (sql: string, params: unknown[]) => (await q(sql, params))[0].id as string;
    const child = await one(
      "insert into children (organization_id, first_name, birth_date) values ($1, $2, '2025-03-01') returning id",
      [org, firstName],
    );
    const family = await one(
      "insert into families (organization_id, name, contact_details) values ($1, $2, $3) returning id",
      [org, `Famille de ${firstName}`, { phone: "0600000000" }],
    );
    await q(
      "insert into child_family_links (organization_id, child_id, family_id) values ($1, $2, $3)",
      [org, child, family],
    );
    await q(
      "insert into child_health (organization_id, child_id, allergies, updated_by) values ($1, $2, 'Allergie fictive', $3)",
      [org, child, user.id],
    );
    const contract = await one(
      `insert into contracts (organization_id, child_id, assigned_assmat_id, start_date,
         scheduled_hours, hourly_rate, maintenance_allowance_cents, status)
       values ($1, $2, $3, '2026-09-01', 40, 4.5, 400, 'active') returning id`,
      [org, child, user.id],
    );
    const event = await one(
      `insert into daily_events (organization_id, child_id, assmat_id, event_type, started_at)
       values ($1, $2, $3, 'arrival', now()) returning id`,
      [org, child, user.id],
    );
    await q(
      "insert into attendance_records (organization_id, child_id, contract_id, date, status) values ($1, $2, $3, current_date, 'present')",
      [org, child, contract],
    );
    const statement = await one(
      `insert into monthly_statements (organization_id, contract_id, period, calculated_hours, gross_amount_cents)
       values ($1, $2, '2026-10-01', 173.33, 78000) returning id`,
      [org, contract],
    );
    const payment = await one(
      "insert into payments (organization_id, statement_id, amount_cents) values ($1, $2, 78000) returning id",
      [org, statement],
    );
    const expense = await one(
      "insert into expenses (organization_id, owner_id, category, amount_cents, date) values ($1, $2, 'jouets', 2500, current_date) returning id",
      [org, user.id],
    );
    const document = await one(
      "insert into documents (organization_id, owner_id, child_id, document_type, storage_path) values ($1, $2, $3, 'decompte', $4) returning id",
      [org, user.id, child, `${org}/${user.id}/decompte.pdf`],
    );
    await q(
      "insert into sync_operations (organization_id, user_id, device_operation_id, operation_type) values ($1, $2, gen_random_uuid(), 'event.create')",
      [org, user.id],
    );
    return { child, family, contract, event, statement, payment, expense, document };
  });
}

async function expectDenied(promise: Promise<unknown>, pattern: RegExp) {
  await expect(promise).rejects.toThrow(pattern);
}

const RLS_VIOLATION = /row-level security/;
const PERMISSION_DENIED = /permission denied/;

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("alice");
  bob = await t.createUser("bob");
  claire = await t.createUser("claire");
  dana = await t.createUser("dana");

  aliceOrg = await createOrg(alice, "Chez Alice", "independent");
  bobOrg = await createOrg(bob, "Chez Bob", "independent");
  mam = await createOrg(claire, "MAM Les Petits Pas", "mam");

  Object.assign(aliceData, await seedFullDataset(alice, aliceOrg, "Léo"));
  await seedFullDataset(bob, bobOrg, "Mia");
});

describe("configuration de sécurité du schéma", () => {
  it("active la RLS sur toutes les tables du schéma public", async () => {
    const rows = await t.admin(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it("n'accorde aucun privilège au rôle anon", async () => {
    const tables = await t.admin(
      "select table_name from information_schema.role_table_grants where grantee in ('anon', 'PUBLIC') and table_schema in ('public', 'private')",
    );
    expect(tables).toEqual([]);
    const functions = await t.admin(
      "select routine_name from information_schema.role_routine_grants where grantee in ('anon', 'PUBLIC') and routine_schema in ('public', 'private')",
    );
    expect(functions).toEqual([]);
  });

  it("reprend le prénom fourni par Google, sans rien inventer", async () => {
    const cases: [Record<string, string>, string][] = [
      [{ given_name: "Marie", full_name: "Marie Test" }, "Marie"],
      [{ full_name: "Jeanne Exemple" }, "Jeanne"],
      [{ name: "Léa Fictive" }, "Léa"],
      [{ display_name: "Tata", given_name: "Autre" }, "Tata"],
      [{}, ""],
    ];
    for (const [meta, expected] of cases) {
      const email = `google-${Math.random().toString(36).slice(2)}@exemple.test`;
      const rows = await t.admin("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, meta]);
      const profile = await t.admin("select display_name from profiles where id = $1", [rows[0].id]);
      expect(profile, JSON.stringify(meta)).toEqual([{ display_name: expected }]);
    }
  });

  it("crée un profil à l'inscription", async () => {
    const rows = await t.admin("select display_name from profiles where id = $1", [alice.id]);
    expect(rows).toEqual([{ display_name: "alice" }]);
  });
});

describe("visiteur non connecté", () => {
  it.each(TENANT_TABLES)("ne peut pas lire %s", async (table) => {
    await expectDenied(
      t.as(null, (q) => q(`select * from ${table}`)),
      PERMISSION_DENIED,
    );
  });

  it("ne peut pas créer d'organisation", async () => {
    await expectDenied(
      t.as(null, (q) => q("select public.create_organization('Pirate', 'independent')")),
      PERMISSION_DENIED,
    );
  });
});

describe("deux assistantes indépendantes", () => {
  it("chacune voit ses propres données dans toutes les tables", async () => {
    for (const table of TENANT_TABLES.filter((n) => !["daily_event_revisions", "backups"].includes(n))) {
      const rows = await t.as(alice, (q) => q(`select * from ${table}`));
      expect(rows.length, table).toBeGreaterThan(0);
    }
  });

  it.each(TENANT_TABLES)("Bob ne lit aucune ligne d'Alice dans %s", async (table) => {
    const column = table === "organizations" ? "id" : "organization_id";
    const rows = await t.as(bob, (q) => q(`select * from ${table} where ${column} = $1`, [aliceOrg]));
    expect(rows).toEqual([]);
  });

  it("Bob ne voit ni le profil ni l'organisation d'Alice", async () => {
    const profiles = await t.as(bob, (q) => q("select id from profiles"));
    expect(profiles).toEqual([{ id: bob.id }]);
    const orgs = await t.as(bob, (q) => q("select id from organizations"));
    expect(orgs).toEqual([{ id: bobOrg }]);
  });

  it("Bob ne peut rien insérer dans l'espace d'Alice", async () => {
    await expectDenied(
      t.as(bob, (q) => q("insert into children (organization_id, first_name) values ($1, 'Intrus')", [aliceOrg])),
      RLS_VIOLATION,
    );
    await expectDenied(
      t.as(bob, (q) => q("insert into families (organization_id, name) values ($1, 'Intrus')", [aliceOrg])),
      RLS_VIOLATION,
    );
    await expectDenied(
      t.as(bob, (q) =>
        q(
          "insert into daily_events (organization_id, child_id, assmat_id, event_type, started_at) values ($1, $2, $3, 'meal', now())",
          [aliceOrg, aliceData.child, bob.id],
        ),
      ),
      RLS_VIOLATION,
    );
    await expectDenied(
      t.as(bob, (q) =>
        q(
          "insert into contracts (organization_id, child_id, assigned_assmat_id, start_date, scheduled_hours, hourly_rate) values ($1, $2, $3, current_date, 10, 4)",
          [aliceOrg, aliceData.child, bob.id],
        ),
      ),
      RLS_VIOLATION,
    );
    await expectDenied(
      t.as(bob, (q) =>
        q("insert into payments (organization_id, statement_id, amount_cents) values ($1, $2, 1)", [
          aliceOrg,
          aliceData.statement,
        ]),
      ),
      RLS_VIOLATION,
    );
  });

  it("Bob ne peut ni modifier ni supprimer les données d'Alice", async () => {
    const attempts: [string, unknown[]][] = [
      ["update children set first_name = 'Piraté' where id = $1 returning id", [aliceData.child]],
      ["delete from children where id = $1 returning id", [aliceData.child]],
      ["update families set name = 'Piraté' where id = $1 returning id", [aliceData.family]],
      ["update contracts set hourly_rate = 0 where id = $1 returning id", [aliceData.contract]],
      ["delete from contracts where id = $1 returning id", [aliceData.contract]],
      ["update daily_events set deleted_at = now() where id = $1 returning id", [aliceData.event]],
      ["update monthly_statements set gross_amount_cents = 0 where id = $1 returning id", [aliceData.statement]],
      ["update payments set status = 'cancelled' where id = $1 returning id", [aliceData.payment]],
      ["delete from expenses where id = $1 returning id", [aliceData.expense]],
      ["delete from documents where id = $1 returning id", [aliceData.document]],
      ["update organizations set name = 'Piraté' where id = $1 returning id", [aliceOrg]],
    ];
    for (const [sql, params] of attempts) {
      const rows = await t.as(bob, (q) => q(sql, params));
      expect(rows, sql).toEqual([]);
    }
    const child = await t.admin("select first_name from children where id = $1", [aliceData.child]);
    expect(child).toEqual([{ first_name: "Léo" }]);
    const contract = await t.admin("select hourly_rate from contracts where id = $1", [aliceData.contract]);
    expect(Number(contract[0].hourly_rate)).toBe(4.5);
  });

  it("Bob ne peut pas rattacher un enfant d'Alice à son propre espace", async () => {
    // Même en connaissant l'identifiant de l'enfant, la clé composite refuse le lien.
    await expectDenied(
      t.as(bob, (q) =>
        q(
          "insert into daily_events (organization_id, child_id, assmat_id, event_type, started_at) values ($1, $2, $3, 'meal', now())",
          [bobOrg, aliceData.child, bob.id],
        ),
      ),
      /foreign key/,
    );
    const bobFamily = (await t.as(bob, (q) => q("select id from families")))[0].id;
    await expectDenied(
      t.as(bob, (q) =>
        q("insert into child_family_links (organization_id, child_id, family_id) values ($1, $2, $3)", [
          bobOrg,
          aliceData.child,
          bobFamily,
        ]),
      ),
      /foreign key/,
    );
  });

  it("personne ne peut s'ajouter soi-même à une organisation", async () => {
    await expectDenied(
      t.as(bob, (q) =>
        q("insert into organization_members (organization_id, user_id, role) values ($1, $2, 'owner')", [
          aliceOrg,
          bob.id,
        ]),
      ),
      PERMISSION_DENIED,
    );
    await expectDenied(
      t.as(bob, (q) => q("update organization_members set role = 'owner' where user_id = $1", [bob.id])),
      PERMISSION_DENIED,
    );
  });

  it("une indépendante ne peut pas créer d'invitation", async () => {
    await expectDenied(
      t.as(alice, (q) => q("select public.create_invitation($1, 'x@exemple.test')", [aliceOrg])),
      /réservées aux MAM/,
    );
  });
});

describe("journal quotidien", () => {
  it("refuse une saisie au nom d'une autre assistante", async () => {
    await expectDenied(
      t.as(alice, (q) =>
        q(
          "insert into daily_events (organization_id, child_id, assmat_id, event_type, started_at) values ($1, $2, $3, 'nap', now())",
          [aliceOrg, aliceData.child, bob.id],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("est idempotent : la même opération d'appareil n'est enregistrée qu'une fois", async () => {
    const op = "11111111-1111-4111-8111-111111111111";
    const insert = (q: (sql: string, params?: unknown[]) => Promise<Row[]>) =>
      q(
        `insert into daily_events (organization_id, child_id, assmat_id, event_type, started_at, client_operation_id)
         values ($1, $2, $3, 'diaper', now(), $4)
         on conflict (organization_id, client_operation_id) do nothing returning id`,
        [aliceOrg, aliceData.child, alice.id, op],
      );
    expect(await t.as(alice, insert)).toHaveLength(1);
    expect(await t.as(alice, insert)).toHaveLength(0);
    const rows = await t.admin("select id from daily_events where client_operation_id = $1", [op]);
    expect(rows).toHaveLength(1);
  });

  it("garde l'historique d'une correction et d'une annulation", async () => {
    await t.as(alice, (q) =>
      q(`update daily_events set event_payload = '{"note":"corrigé"}' where id = $1`, [aliceData.event]),
    );
    await t.as(alice, (q) => q("update daily_events set deleted_at = now() where id = $1", [aliceData.event]));
    const revisions = await t.as(alice, (q) =>
      q("select changed_by, previous from daily_event_revisions where event_id = $1 order by id", [aliceData.event]),
    );
    expect(revisions).toHaveLength(2);
    expect(revisions[0].changed_by).toBe(alice.id);
    expect((revisions[0].previous as Row).event_payload).toEqual({});
    expect((revisions[1].previous as Row).deleted_at).toBeNull();
  });

  it("interdit la suppression définitive et le changement de rattachement", async () => {
    await expectDenied(
      t.as(alice, (q) => q("delete from daily_events where id = $1", [aliceData.event])),
      PERMISSION_DENIED,
    );
    await expectDenied(
      t.as(alice, (q) => q("update daily_events set organization_id = $1 where id = $2", [bobOrg, aliceData.event])),
      /ne peut pas être modifiée/,
    );
    await expectDenied(
      t.as(alice, (q) => q("update daily_event_revisions set previous = '{}'")),
      PERMISSION_DENIED,
    );
  });
});

describe("finances et audit", () => {
  it("fige un décompte finalisé", async () => {
    await t.as(alice, (q) =>
      q("update monthly_statements set status = 'finalized', finalized_at = now() where id = $1", [
        aliceData.statement,
      ]),
    );
    await expectDenied(
      t.as(alice, (q) => q("update monthly_statements set gross_amount_cents = 1 where id = $1", [aliceData.statement])),
      /finalisé/,
    );
    await expectDenied(
      t.as(alice, (q) => q("delete from monthly_statements where id = $1", [aliceData.statement])),
      /finalisé/,
    );
  });

  it("trace les actions sans permettre de réécrire le journal d'audit", async () => {
    const logs = await t.as(alice, (q) =>
      q("select action, entity_type from audit_logs where entity_id = $1", [aliceData.contract]),
    );
    expect(logs).toEqual([{ action: "insert", entity_type: "contracts" }]);
    await expectDenied(
      t.as(alice, (q) =>
        q("insert into audit_logs (organization_id, action, entity_type) values ($1, 'x', 'y')", [aliceOrg]),
      ),
      PERMISSION_DENIED,
    );
    await expectDenied(
      t.as(alice, (q) => q("delete from audit_logs")),
      PERMISSION_DENIED,
    );
  });
});

describe("MAM : invitations et droits", () => {
  let token: string;
  let claireData: Record<string, string>;
  let danaData: Record<string, string>;

  it("la propriétaire invite une assistante ; le jeton n'est jamais stocké en clair", async () => {
    token = await t.as(claire, async (q) => {
      const rows = await q("select public.create_invitation($1, $2) as token", [mam, dana.email.toUpperCase()]);
      return rows[0].token as string;
    });
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const stored = await t.admin("select email, token_hash from organization_invitations where organization_id = $1", [
      mam,
    ]);
    expect(stored[0].email).toBe(dana.email);
    expect(stored[0].token_hash).not.toBe(token);
    await expectDenied(
      t.as(claire, (q) => q("select token_hash from organization_invitations")),
      PERMISSION_DENIED,
    );
  });

  it("un autre compte ne peut pas utiliser l'invitation, même avec le jeton", async () => {
    await expectDenied(
      t.as(bob, (q) => q("select public.accept_invitation($1)", [token])),
      /invalide ou expirée/,
    );
    await expectDenied(
      t.as(dana, (q) => q("select public.accept_invitation('mauvais-jeton')")),
      /invalide ou expirée/,
    );
    expect(await t.as(bob, (q) => q("select id from organizations where id = $1", [mam]))).toEqual([]);
  });

  it("l'assistante invitée rejoint la MAM, une seule fois", async () => {
    const joined = await t.as(dana, (q) => q("select public.accept_invitation($1) as org", [token]));
    expect(joined[0].org).toBe(mam);
    await expectDenied(
      t.as(dana, (q) => q("select public.accept_invitation($1)", [token])),
      /invalide ou expirée/,
    );
    const members = await t.as(dana, (q) =>
      q("select user_id, role from organization_members where organization_id = $1 order by role", [mam]),
    );
    expect(members).toEqual([
      { user_id: dana.id, role: "assmat" },
      { user_id: claire.id, role: "owner" },
    ]);
  });

  it("refuse une invitation expirée", async () => {
    const erin = await t.createUser("erin");
    const expired = await t.as(claire, async (q) => {
      const rows = await q("select public.create_invitation($1, $2) as token", [mam, erin.email]);
      return rows[0].token as string;
    });
    await t.admin("update organization_invitations set expires_at = now() - interval '1 minute' where email = $1", [
      erin.email,
    ]);
    await expectDenied(
      t.as(erin, (q) => q("select public.accept_invitation($1)", [expired])),
      /invalide ou expirée/,
    );
  });

  it("partage les enfants et le journal, mais pas les contrats ni les finances", async () => {
    claireData = await seedFullDataset(claire, mam, "Noé");
    danaData = await seedFullDataset(dana, mam, "Zoé");

    // Partagé : enfants, familles, journal, présences.
    for (const table of ["children", "families", "daily_events", "attendance_records"]) {
      expect(await t.as(dana, (q) => q(`select id from ${table} where organization_id = $1`, [mam])), table).toHaveLength(2);
      expect(await t.as(claire, (q) => q(`select id from ${table} where organization_id = $1`, [mam])), table).toHaveLength(2);
    }

    // Personnel : chacune ne voit que les siens, même la propriétaire de la MAM.
    for (const table of ["contracts", "monthly_statements", "payments", "expenses", "documents"]) {
      const forDana = await t.as(dana, (q) => q(`select id from ${table} where organization_id = $1`, [mam]));
      const forClaire = await t.as(claire, (q) => q(`select id from ${table} where organization_id = $1`, [mam]));
      expect(forDana, table).toHaveLength(1);
      expect(forClaire, table).toHaveLength(1);
      expect(forDana[0].id, table).not.toBe(forClaire[0].id);
    }
  });

  it("une collègue ne peut pas modifier le contrat ou les finances d'une autre", async () => {
    const attempts: [string, unknown[]][] = [
      ["update contracts set hourly_rate = 1 where id = $1 returning id", [claireData.contract]],
      ["update monthly_statements set gross_amount_cents = 1 where id = $1 returning id", [claireData.statement]],
      ["update payments set amount_cents = 1 where id = $1 returning id", [claireData.payment]],
      ["delete from expenses where id = $1 returning id", [claireData.expense]],
    ];
    for (const [sql, params] of attempts) {
      expect(await t.as(dana, (q) => q(sql, params)), sql).toEqual([]);
    }
    await expectDenied(
      t.as(dana, (q) =>
        q(
          "insert into contracts (organization_id, child_id, assigned_assmat_id, start_date, scheduled_hours, hourly_rate) values ($1, $2, $3, current_date, 10, 4)",
          [mam, claireData.child, claire.id],
        ),
      ),
      RLS_VIOLATION,
    );
  });

  it("une assistante corrige ses saisies mais pas celles d'une collègue", async () => {
    expect(
      await t.as(dana, (q) => q("update daily_events set deleted_at = now() where id = $1 returning id", [claireData.event])),
    ).toEqual([]);
    expect(
      await t.as(dana, (q) => q("update daily_events set deleted_at = now() where id = $1 returning id", [danaData.event])),
    ).toHaveLength(1);
  });

  it("le journal d'audit ne révèle pas les opérations financières des collègues", async () => {
    const seenByClaire = await t.as(claire, (q) =>
      q("select entity_type from audit_logs where organization_id = $1 and actor_id = $2", [mam, dana.id]),
    );
    const types = new Set(seenByClaire.map((r) => r.entity_type));
    expect(types.has("children")).toBe(true);
    expect(types.has("contracts")).toBe(false);
    expect(types.has("payments")).toBe(false);
    const seenByDana = await t.as(dana, (q) =>
      q("select 1 from audit_logs where organization_id = $1 and actor_id = $2", [mam, claire.id]),
    );
    expect(seenByDana).toEqual([]);
  });

  it("une assistante ne peut ni inviter, ni suspendre, ni supprimer un enfant", async () => {
    await expectDenied(
      t.as(dana, (q) => q("select public.create_invitation($1, 'z@exemple.test')", [mam])),
      /réservée aux responsables/,
    );
    await expectDenied(
      t.as(dana, (q) => q("select public.set_member_status($1, $2, 'suspended')", [mam, claire.id])),
      /non autorisée/,
    );
    expect(await t.as(dana, (q) => q("delete from children where id = $1 returning id", [claireData.child]))).toEqual([]);
    expect(await t.as(dana, (q) => q("select id from organization_invitations"))).toEqual([]);
  });

  it("la propriétaire ne peut pas être suspendue", async () => {
    await expectDenied(
      t.as(claire, (q) => q("select public.set_member_status($1, $2, 'suspended')", [mam, claire.id])),
      /non autorisée/,
    );
  });

  it("un membre suspendu perd immédiatement tout accès", async () => {
    await t.as(claire, (q) => q("select public.set_member_status($1, $2, 'suspended')", [mam, dana.id]));
    for (const table of ["organizations", "children", "daily_events", "contracts", "expenses", "organization_members"]) {
      const column = table === "organizations" ? "id" : "organization_id";
      expect(await t.as(dana, (q) => q(`select * from ${table} where ${column} = $1`, [mam])), table).toEqual([]);
    }
    await expectDenied(
      t.as(dana, (q) => q("insert into children (organization_id, first_name) values ($1, 'Test')", [mam])),
      RLS_VIOLATION,
    );
    await t.as(claire, (q) => q("select public.set_member_status($1, $2, 'active')", [mam, dana.id]));
    expect(await t.as(dana, (q) => q("select id from children where organization_id = $1", [mam]))).toHaveLength(2);
  });
});

describe("effacement", () => {
  it("la suppression d'une organisation efface toutes ses données, y compris les décomptes finalisés", async () => {
    await t.admin("delete from organizations where id = $1", [aliceOrg]);
    for (const table of TENANT_TABLES.filter((n) => n !== "organizations")) {
      const rows = await t.admin(`select 1 from ${table} where organization_id = $1`, [aliceOrg]);
      expect(rows, table).toEqual([]);
    }
    const bobChildren = await t.admin("select 1 from children where organization_id = $1", [bobOrg]);
    expect(bobChildren).toHaveLength(1);
  });
});
