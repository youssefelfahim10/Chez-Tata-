import "server-only";

/** Configuration de la démo : tout vient de variables d'environnement serveur, jamais du navigateur. */
export function getDemoConfig(): { code: string; email: string; password: string } | null {
  const code = process.env.DEMO_ACCESS_CODE;
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!code || code.length < 16 || !email || !password) return null;
  return { code, email: email.toLowerCase(), password };
}

export function isDemoEmail(email: string | undefined | null): boolean {
  const config = getDemoConfig();
  return Boolean(config && email && email.toLowerCase() === config.email);
}
