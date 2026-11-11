import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const TABLES = [
  "profiles",
  "organizations",
  "organization_members",
  "organization_settings",
  "children",
  "families",
  "child_family_links",
  "child_health",
  "contracts",
  "attendance_records",
  "daily_events",
  "monthly_statements",
  "payments",
  "expenses",
  "documents",
] as const;

/** Export des données de l'utilisatrice : la RLS limite chaque table à ce qu'elle a le droit de voir. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Non connectée." }, { status: 401 });

  const supabase = await createClient();
  const data: Record<string, unknown> = {};
  for (const table of TABLES) {
    const { data: rows, error } = await supabase.from(table).select("*").limit(50000);
    data[table] = error ? { error: "Lecture impossible" } : rows;
  }

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email }, data }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="chez-tata-mes-donnees.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
