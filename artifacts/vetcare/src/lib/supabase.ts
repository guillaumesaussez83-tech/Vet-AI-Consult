// Stub -- Supabase removed, migrating to REST API
// Unblocks Vite build for legacy permissions/index.tsx
export const supabase = {
  from: (_t: string) => ({
    select: (_c: string) => ({
      order: (_o: string) => Promise.resolve({ data: [] as any[], error: null }),
      eq: (_c2: string, _v: unknown) => Promise.resolve({ data: [] as any[], error: null }),
    }),
    upsert: (_r: unknown[], _o?: unknown) => Promise.resolve({ error: null }),
  }),
};
