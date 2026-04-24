import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright pour Vet-AI-Consult.
 *
 * Usage local:
 *   pnpm exec playwright test
 *   pnpm exec playwright test --ui
 *
 * Variables d'environnement attendues (à placer dans `.env.e2e` ou CI secrets):
 *   E2E_BASE_URL        URL cible (default https://app.vetoai.fr)
 *   E2E_USER_EMAIL      Compte de test Clerk (skip auth.spec si absent)
 *   E2E_USER_PASSWORD   Password du compte de test
 *   E2E_OWNER_NAME      Nom d'un propriétaire existant (fallback 'Test Owner')
 *   E2E_PATIENT_NAME    Nom d'un patient existant (fallback 'Test Patient')
 *   E2E_PORTAIL_TOKEN   Token portail pré-généré pour tester sans login
 */
const baseURL = process.env.E2E_BASE_URL ?? "https://app.vetoai.fr";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Storage state signed-in est généré par la suite auth.spec puis réutilisé
    // par les autres suites via --project=authenticated.
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name: "anonymous",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /\.spec\.ts$/,
      testIgnore: /(dashboard|consultation|upload|ai-ordonnance|facture)\.spec\.ts$/,
    },
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.spec\.ts$/,
    },
  ],

  outputDir: "test-results",
});
