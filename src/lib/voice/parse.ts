/**
 * Interprétation d'une dictée en français. Elle PROPOSE des actions ; rien n'est
 * enregistré sans validation explicite de l'utilisatrice (écran de confirmation).
 * En cas de doute, on ne propose rien plutôt que de deviner.
 */

export type VoiceAction = "arrival" | "departure" | "meal" | "nap" | "nap_end" | "diaper" | "care";

export type VoiceProposal = {
  /** null = enfant non identifié : l'utilisatrice doit choisir. */
  childId: string | null;
  action: VoiceAction;
  /** « HH:MM » à Paris, ou null = maintenant. */
  time: string | null;
  details: Record<string, string>;
  /** Passage de la dictée qui a servi à cette proposition (pour que l'on puisse vérifier). */
  heard: string;
};

export type VoiceResult = { proposals: VoiceProposal[]; understood: boolean };

export const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9: ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Rule = { action: VoiceAction; test: RegExp };

// L'ordre compte : « réveil » avant « sieste », « fin de sieste » avant « dort ».
const RULES: Rule[] = [
  { action: "nap_end", test: /\b(reveil\w*|fin de (la )?sieste|se leve|debout)\b/ },
  { action: "nap", test: /\b(sieste|dort|endormi\w*|s endort|endort\w*)\b/ },
  { action: "departure", test: /\b(parti\w*|part|depart|repart\w*|recupere\w*|est rentre\w*)\b/ },
  { action: "arrival", test: /\b(arrive\w*|arrivee|depose\w*|est la)\b/ },
  { action: "meal", test: /\b(mange\w*|repas|dejeun\w*|gouter|goute\w*|diner|biberon)\b/ },
  { action: "diaper", test: /\b(change\w*|pipi|selle\w*|caca|couche)\b/ },
  { action: "care", test: /\b(soin\w*|medicament\w*|doliprane|temperature|fievre|bobo|creme|nez)\b/ },
];

function detectAction(segment: string): VoiceAction | null {
  for (const rule of RULES) if (rule.test.test(segment)) return rule.action;
  return null;
}

/** « 8h30 », « 8 h 30 », « 17h », « 8 heures 30 », « 08:30 » → « 08:30 ». */
export function detectTime(segment: string): string | null {
  const m = /\b(?:a|vers)?\s*(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?\b/.exec(segment);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function detectDetails(action: VoiceAction, segment: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (action === "meal") {
    if (/\bbiberon\b/.test(segment)) out.amount = "bottle";
    else if (/\b(rien|refuse\w*)\b/.test(segment)) out.amount = "none";
    else if (/\bpresque tout\b/.test(segment)) out.amount = "most";
    else if (/\b(tout|bien) mange\w*\b|\btout (son|le)\b|\ba tout\b/.test(segment)) out.amount = "all";
    else if (/\bmoitie\b/.test(segment)) out.amount = "half";
    else if (/\bun peu\b/.test(segment)) out.amount = "little";
  }
  if (action === "diaper") {
    if (/\bles deux\b/.test(segment)) out.diaper = "both";
    else if (/\b(selle\w*|caca)\b/.test(segment)) out.diaper = "soiled";
    else if (/\bpipi\b/.test(segment)) out.diaper = "wet";
  }
  if (action === "care") {
    if (/\b(medicament\w*|doliprane)\b/.test(segment)) out.care = "medicine";
    else if (/\b(fievre|temperature)\b/.test(segment)) out.care = "fever";
    else if (/\bbobo\b/.test(segment)) out.care = "bump";
    else if (/\bcreme\b/.test(segment)) out.care = "cream";
    else if (/\bnez\b/.test(segment)) out.care = "nose";
  }
  return out;
}

export function parseVoice(transcript: string, children: { id: string; firstName: string }[]): VoiceResult {
  const text = normalize(transcript);
  if (!text) return { proposals: [], understood: false };

  // Positions des prénoms cités.
  const mentions: { index: number; length: number; id: string }[] = [];
  for (const child of children) {
    const name = normalize(child.firstName);
    if (!name) continue;
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    for (const match of text.matchAll(re)) mentions.push({ index: match.index!, length: name.length, id: child.id });
  }
  mentions.sort((a, b) => a.index - b.index);

  type Segment = { ids: string[]; text: string };
  const segments: Segment[] = [];
  if (mentions.length === 0) {
    segments.push({ ids: [], text });
  } else {
    // Texte avant le premier prénom : il se rapporte au premier enfant cité.
    const lead = text.slice(0, mentions[0].index).trim();
    mentions.forEach((m, i) => {
      const start = m.index + m.length;
      const end = i + 1 < mentions.length ? mentions[i + 1].index : text.length;
      const body = `${i === 0 ? lead + " " : ""}${text.slice(start, end)}`.trim();
      segments.push({ ids: [m.id], text: body });
    });
    // « Lou et Noa ont mangé » : un prénom sans action partage celle du segment suivant.
    for (let i = 0; i < segments.length - 1; i += 1) {
      if (!detectAction(segments[i].text) && detectAction(segments[i + 1].text)) {
        segments[i + 1].ids = [...new Set([...segments[i].ids, ...segments[i + 1].ids])];
        segments[i].ids = [];
      }
    }
  }

  const proposals: VoiceProposal[] = [];
  for (const seg of segments) {
    if (!seg.ids.length && mentions.length) continue;
    // Plusieurs actions dans un même segment (« est arrivé et a mangé ») : une proposition par action.
    const parts = seg.text.split(/\b(?:et puis|puis|ensuite|et)\b|[,;]/).map((p) => p.trim()).filter(Boolean);
    const pieces = parts.length ? parts : [seg.text];
    let lastTime: string | null = null;
    for (const piece of pieces) {
      const action = detectAction(piece);
      if (!action) continue;
      const time: string | null = detectTime(piece) ?? (pieces.length === 1 ? lastTime : null);
      lastTime = time;
      const targets = seg.ids.length ? seg.ids : [children.length === 1 ? children[0].id : null];
      for (const childId of targets) proposals.push({ childId, action, time, details: detectDetails(action, piece), heard: piece });
    }
  }
  return { proposals, understood: proposals.length > 0 };
}
