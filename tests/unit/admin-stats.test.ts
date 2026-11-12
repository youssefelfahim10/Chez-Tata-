import { describe, expect, it } from "vitest";
import {
  barPercent,
  cleanSearch,
  formatDateTime,
  parseOverview,
  parsePage,
  parseUserRows,
  providerLabel,
  shortDay,
} from "@/lib/admin/stats";

const overview = {
  users_total: 3,
  users_google: 1,
  users_email: 2,
  signups_7d: 3,
  signups_30d: 3,
  active_7d: 2,
  active_30d: 3,
  logins_7d: 4,
  logins_30d: 4,
  organizations: 2,
  children: 5,
  daily: [{ day: "2026-11-12", signups: 1, logins: 2, people: 2 }],
};

describe("parseOverview", () => {
  it("accepte une réponse complète", () => {
    expect(parseOverview(overview)).toEqual(overview);
  });

  it("convertit les nombres reçus en texte", () => {
    expect(parseOverview({ ...overview, users_total: "3" })?.users_total).toBe(3);
  });

  it("rejette une réponse incomplète, négative ou mal formée", () => {
    expect(parseOverview(null)).toBeNull();
    expect(parseOverview({ ...overview, users_total: -1 })).toBeNull();
    expect(parseOverview({ ...overview, daily: [{ day: "demain", signups: 0, logins: 0, people: 0 }] })).toBeNull();
    const partial: Partial<typeof overview> = { ...overview };
    delete partial.children;
    expect(parseOverview(partial)).toBeNull();
  });
});

describe("parseUserRows", () => {
  const row = {
    user_id: "3f6c1478-ce6d-4628-abe2-13499dc14647",
    email: "alice@exemple.test",
    display_name: "Alice",
    provider: "google",
    created_at: "2026-11-11T23:00:00Z",
    last_sign_in_at: null,
    suspended: false,
    is_admin: false,
    space_name: null,
    space_count: 0,
    children_count: 0,
    total_count: "1",
  };

  it("valide les lignes et convertit le total", () => {
    expect(parseUserRows([row])?.[0].total_count).toBe(1);
  });

  it("rejette une ligne sans identifiant valide", () => {
    expect(parseUserRows([{ ...row, user_id: "pas-un-uuid" }])).toBeNull();
    expect(parseUserRows("n'importe quoi")).toBeNull();
  });
});

describe("paramètres de l'adresse", () => {
  it("normalise le numéro de page", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("999999")).toBe(1);
  });

  it("nettoie la recherche", () => {
    expect(cleanSearch("  alice   dupont ")).toBe("alice dupont");
    expect(cleanSearch(undefined)).toBe("");
    expect(cleanSearch("x".repeat(200))).toHaveLength(80);
  });
});

describe("présentation", () => {
  it("calcule la hauteur des barres, une valeur non nulle restant visible", () => {
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(10, 10)).toBe(100);
    expect(barPercent(1, 1000)).toBe(4);
    expect(barPercent(5, 0)).toBe(0);
  });

  it("formate les jours et les dates à l'heure de Paris", () => {
    expect(shortDay("2026-11-12")).toBe("12/11");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("pas une date")).toBe("—");
    expect(formatDateTime("2026-11-12T08:30:00Z")).toMatch(/12\/11\/2026.*09:30/);
  });

  it("nomme la méthode de connexion", () => {
    expect(providerLabel("google")).toBe("Google");
    expect(providerLabel("email")).toBe("E-mail");
  });
});
