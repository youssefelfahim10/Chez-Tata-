/**
 * Coordonnées (en pixels de l'image du modèle, 1055 × 1491) des zones à remplir
 * sur la fiche A4 illustrée « Chez TaTa ». L'image reste intacte hors de ces zones.
 */

export const TEMPLATE = { width: 1055, height: 1491, src: "/fiche/modele-a4.jpg" } as const;

export type Box = { x: number; y: number; w: number; h: number };

/*
 * Mesures relevées sur l'image du modèle (lignes du tableau, filets des champs).
 * Si le modèle illustré change, c'est le seul fichier à recaler (voir tests/unit/sheet.test.ts).
 */

export const HEADER = {
  month: { x: 393, y: 151, w: 112, h: 37, bg: "#ffe4ee" },
  year: { x: 634, y: 151, w: 132, h: 37, bg: "#e1fbe6" },
  child: { x: 188, y: 265, w: 318, h: 30 },
  caregiver: { x: 692, y: 265, w: 330, h: 30 },
} as const;

/** Chaque zone est posée juste au-dessus du filet imprimé du champ. */
export const CONTRACT = {
  startDate: { x: 262, y: 367, w: 190, h: 25 },
  schedule: { x: 280, y: 397, w: 210, h: 23 },
  monthlyHours: { x: 292, y: 427, w: 104, h: 23 },
  weeklyHours: { x: 286, y: 457, w: 112, h: 23 },
  hourlyNet: { x: 712, y: 357, w: 170, h: 22 },
  monthlyNet: { x: 722, y: 387, w: 158, h: 22 },
  maintenance: { x: 764, y: 417, w: 116, h: 22 },
  meal: { x: 777, y: 446, w: 104, h: 22 },
} as const;

/** Colonnes du tableau (abscisses de début et de fin, entre les filets verticaux). */
export const COLUMNS = [
  { key: "in", x0: 112, x1: 212 },
  { key: "out", x0: 216, x1: 316 },
  { key: "absence", x0: 319, x1: 429 },
  { key: "extra", x0: 433, x1: 536 },
  { key: "maintenance", x0: 542, x1: 640 },
  { key: "meal", x0: 646, x1: 743 },
  { key: "leave", x0: 749, x1: 860 },
  { key: "note", x0: 867, x1: 1031 },
] as const;
export type ColumnKey = (typeof COLUMNS)[number]["key"];

/** 31 lignes de 19,52 px entre le bandeau coloré (y = 600) et la ligne des totaux. */
export const TABLE = { top: 600, bottom: 1205, rows: 31 } as const;

/** Ligne des totaux (sous le tableau). */
export const TOTALS_ROW = { y: 1206, h: 21 } as const;

/** Récapitulatif du mois : 8 lignes de pointillés, de haut en bas (valeur posée au-dessus). */
export const RECAP = { x: 592, w: 108, h: 17, ys: [1280, 1298, 1317, 1336, 1355, 1374, 1393, 1416] } as const;

export const SIGNATURES = {
  parentsDate: { x: 132, y: 1306, w: 152, h: 22 },
  caregiverDate: { x: 815, y: 1317, w: 155, h: 22 },
  parentsBox: { x: 100, y: 1348, w: 218, h: 74 },
  caregiverBox: { x: 742, y: 1356, w: 228, h: 70 },
} as const;
