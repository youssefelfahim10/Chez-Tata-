import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

export type TestUser = { id: string; email: string };

export type Row = Record<string, unknown>;

/**
 * Base PostgreSQL en mémoire (PGlite) avec le shim Supabase et toutes les
 * migrations du dépôt appliquées dans l'ordre.
 */
export async function createTestDb() {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  for (const file of readdirSync(migrationsDir).sort()) {
    if (file.endsWith(".sql")) {
      await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    }
  }

  let counter = 0;

  /** Crée un compte comme le ferait Supabase Auth (déclenche handle_new_user). */
  async function createUser(name: string): Promise<TestUser> {
    counter += 1;
    const email = `${name}-${counter}@exemple.test`;
    const { rows } = await db.query<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [email, { display_name: name }],
    );
    return { id: rows[0].id, email };
  }

  /** Exécute des requêtes avec le rôle et les claims qu'aurait l'API pour cet utilisateur. */
  async function as<T>(
    user: TestUser | null,
    fn: (q: (sql: string, params?: unknown[]) => Promise<Row[]>) => Promise<T>,
  ): Promise<T> {
    const claims = user ? { sub: user.id, email: user.email, role: "authenticated" } : {};
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    await db.exec(`set role ${user ? "authenticated" : "anon"}`);
    try {
      return await fn(async (sql, params) => (await db.query<Row>(sql, params)).rows);
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims', '', false)");
    }
  }

  /** Requête en super-utilisateur (préparation et vérification des données). */
  async function admin(sql: string, params?: unknown[]): Promise<Row[]> {
    return (await db.query<Row>(sql, params)).rows;
  }

  return { db, createUser, as, admin };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
