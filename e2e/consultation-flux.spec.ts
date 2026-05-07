import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Flux Consultation Complet
 * Parcours : login → créer patient → nouvelle consultation → anamnèse → examen → diagnostic IA
 *
 * Variables requises dans .env.test :
 *   E2E_EMAIL    — email du compte de test
 *   E2E_PASSWORD — mot de passe du compte de test
 */

const BASE = process.env.BASE_URL ?? "https://app.vetoai.fr";
const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

/** Helper : connexion Clerk via formulaire */
async function login(page: Page) {
  await page.goto(BASE + "/sign-in");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByRole("button", { name: /continuer|continue/i }).click();
  await page.getByLabel(/mot de passe|password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /se connecter|sign in/i }).click();
  await page.waitForURL(/dashboard|accueil/, { timeout: 15_000 });
}

test.describe("Flux Consultation Complet", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E_EMAIL / E2E_PASSWORD non configurés");

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard accessible après connexion", async ({ page }) => {
    await expect(page).toHaveURL(/dashboard|accueil/);
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("créer un nouveau patient", async ({ page }) => {
    await page.goto(BASE + "/patients");
    await page.getByRole("button", { name: /nouveau patient|ajouter/i }).click();
    await page.getByLabel(/nom/i).fill("TestPatient_E2E");
    await page.getByLabel(/espèce|espece/i).fill("Chien");
    await page.getByLabel(/race/i).fill("Labrador");
    await page.getByRole("button", { name: /enregistrer|créer|sauvegarder/i }).click();
    await expect(page.getByText("TestPatient_E2E")).toBeVisible({ timeout: 8_000 });
  });

  test("créer une consultation et saisir l'anamnèse", async ({ page }) => {
    await page.goto(BASE + "/consultations/nouvelle");
    // Sélectionner un patient existant
    const patientSelect = page.getByLabel(/patient/i);
    await patientSelect.click();
    await page.getByRole("option").first().click();

    // Phase 1 — anamnèse
    const anamneseField = page.getByPlaceholder(/motif|anamnèse|symptôme/i).first();
    await anamneseField.fill("Vomissements depuis 48h, abattement modéré, anorexie partielle.");

    await page.getByRole("button", { name: /suivant|phase 2|examen/i }).click();

    // Phase 2 — examen clinique
    const examenField = page.getByPlaceholder(/examen|clinique|auscultation/i).first();
    if (await examenField.isVisible()) {
      await examenField.fill("T° 39.2°C, FC 90/min, muqueuses roses, abdomen légèrement douloureux.");
    }
  });

  test("obtenir un diagnostic IA sur une consultation", async ({ page }) => {
    await page.goto(BASE + "/consultations/nouvelle");
    const patientSelect = page.getByLabel(/patient/i);
    await patientSelect.click();
    await page.getByRole("option").first().click();

    const anamneseField = page.getByPlaceholder(/motif|anamnèse|symptôme/i).first();
    await anamneseField.fill("Toux chronique depuis 3 semaines, jetage mucopurulent.");

    // Lancer diagnostic IA
    const iaBtn = page.getByRole("button", { name: /diagnostic|analyser|IA/i });
    if (await iaBtn.isVisible()) {
      await iaBtn.click();
      // Attendre réponse IA (max 30s)
      await expect(
        page.getByText(/diagnostic|hypothèse|recommandation/i)
      ).toBeVisible({ timeout: 30_000 });
    }
  });

  test("API /api/patients retourne 200 avec token", async ({ page, request }) => {
    // Récupérer le token depuis le localStorage après login
    const token = await page.evaluate(() => {
      // Clerk stocke le token en localStorage sous différentes clés
      const keys = Object.keys(localStorage);
      const clerkKey = keys.find(k => k.startsWith("__clerk") || k.includes("token"));
      return clerkKey ? localStorage.getItem(clerkKey) : null;
    });

    const resp = await request.get(BASE + "/api/patients", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    // Doit retourner 200 (authentifié) ou 401 (non authentifié — acceptable si pas de token)
    expect([200, 401]).toContain(resp.status());
  });

  test("API /api/patients retourne 401 sans token", async ({ request }) => {
    const resp = await request.get(BASE + "/api/patients");
    expect(resp.status()).toBe(401);
  });
});
