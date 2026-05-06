export const AI_MODEL = "claude-sonnet-4-6" as const;
export const AI_MAX_TOKENS = { long: 8192, short: 2048 } as const;

export const GPT_MODEL = "gpt-4o-mini" as const;
export const GPT_MAX_TOKENS = { long: 4096, short: 2048 } as const;

/** Cost in USD per 1M tokens */
export const AI_COSTS = {
  "claude-sonnet-4-6": { inputPerM: 3.00, outputPerM: 15.00 },
  "gpt-4o-mini": { inputPerM: 0.150, outputPerM: 0.600 },
} as const;

export const TVA_DEFAULT_RATE = 20;
export const TVA_RATE_MULTIPLIER = 0.20;
export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 200;
