/**
 * N'accepte qu'un chemin interne (« /… ») comme destination de redirection,
 * pour empêcher les redirections ouvertes vers un site tiers.
 */
export function safeNextPath(value: unknown, fallback = "/aujourdhui"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
