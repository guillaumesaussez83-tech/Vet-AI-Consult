// Express Request type augmentation
// Adds properties set by middleware (requireClinicId, Clerk auth) to Express.Request

declare global {
  namespace Express {
    interface Request {
      /** clinic_id extracted from Clerk session claims by requireClinicId middleware */
      clinicId?: string;
      /** Clerk auth object attached by @clerk/express requireAuth() */
      auth?: {
        userId: string;
        sessionId?: string;
        orgId?: string;
        sessionClaims?: Record<string, unknown>;
      };
    }
  }
}

export {};
