import { assetLinks } from "@/lib/android";

/** Lien de confiance entre le site et l'appli Android (voir src/lib/android.ts). Public par nature. */
export function GET() {
  return Response.json(assetLinks(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
