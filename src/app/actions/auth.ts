"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GOOGLE_SIGNIN_ENABLED } from "@/lib/auth/google";
import { safeNextPath } from "@/lib/safe-redirect";

export type FormState = { error?: string; message?: string };

const credentials = z.object({
  email: z.email("Adresse e-mail invalide.").max(254),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(128),
});

const signUpSchema = credentials.extend({
  displayName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
});

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  // Message volontairement identique quel que soit le motif de l'échec.
  const failure = { error: "E-mail ou mot de passe incorrect." };
  if (!parsed.success) return failure;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirmez d'abord votre adresse grâce à l'e-mail que nous vous avons envoyé." };
    }
    return failure;
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "weak_password") {
      return { error: "Ce mot de passe est trop fragile. Choisissez-en un plus long ou moins courant." };
    }
    return { error: "Inscription impossible pour le moment. Réessayez dans quelques instants." };
  }
  if (data.session) redirect(next);
  // Même message que l'adresse existe déjà ou non (pas d'énumération de comptes).
  return { message: "Vérifiez votre boîte mail : un lien de confirmation vient de vous être envoyé." };
}

/**
 * Connexion (ou création de compte) avec Google. Le navigateur est envoyé chez Google puis revient sur
 * /auth/callback. Seule une destination interne est acceptée (pas de redirection ouverte).
 * Chez TaTa ne reçoit de Google que le nom et l'adresse e-mail : aucun accès aux contacts ni à Gmail.
 */
export async function signInWithGoogle(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!GOOGLE_SIGNIN_ENABLED) return { error: "La connexion avec Google n'est pas encore activée. Utilisez votre e-mail." };
  const next = safeNextPath(z.string().max(500).safeParse(formData.get("next")).data);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      // Laisse choisir le compte Google (utile quand plusieurs comptes sont connectés sur le téléphone).
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return { error: "La connexion avec Google n'est pas disponible pour le moment. Utilisez votre e-mail." };
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
