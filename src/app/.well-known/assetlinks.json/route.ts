import { connection } from "next/server";
import { buildAssetLinks } from "@/lib/android";

/** Public (aucune donnée sensible) : empreintes de signature de l'app Android, lues à chaque requête. */
export async function GET() {
  await connection();
  const body = buildAssetLinks(process.env.ANDROID_PACKAGE, process.env.ANDROID_SHA256_FINGERPRINTS);
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
