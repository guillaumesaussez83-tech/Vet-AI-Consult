export const TVA_DEFAULT_RATE = 20;
export const TVA_RATE_MULTIPLIER = 0.20;
export const TVA_RATE_WITH_BASE = 1.20;

export const PAGINATION_DEFAULT_LIMIT = 50;

export const AI_MODEL_LABEL = "Claude";

export const ACTE_CATEGORIES = [
  "consultation",
  "chirurgie",
  "vaccination",
  "analyse",
  "imagerie",
  "hospitalisation",
  "médicament",
  "autre",
] as const;

export type ActeCategorie = typeof ACTE_CATEGORIES[number];
