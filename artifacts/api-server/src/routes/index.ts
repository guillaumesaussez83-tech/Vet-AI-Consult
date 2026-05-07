// artifacts/api-server/src/routes/index.ts
// MODIFIE -- fix imports + ajout routes manquantes (audit Phase 0)

import { Router } from "express";
import rendezVousRouter from "./rendez-vous";
import agendaRouter from "./agenda";
import patientsRouter from "./patients";
import ownersRouter from "./owners";
import consultationsRouter from "./consultations";
import facturesRouter from "./factures";
import ordonnancesRouter from "./ordonnances";
import stockRouter from "./stock";
import rappelsRouter from "./rappels";
// NOTE: import clinicRouter supprime -- repertoire inexistant

// Sprint 7 -- Phase 1 MVP Clinique
import permissionsRouter from "./permissions";
import smsRouter from "./sms";
import recurringAppointmentsRouter from "./recurring-appointments";
import weightHistoryRouter from "./weight-history";
import clientLettersRouter from "./client-letters";

// Routes Phase 2 -- branchees (audit Phase 0)
import encaissementsRouter from "./encaissements";
import equipeRouter from "./equipe";
import ventesRouter from "./ventes";
import statistiquesRouter from "./statistiques";
import vaccinationsRouter from "./vaccinations";
import fournisseursRouter from "./fournisseurs";

const router = Router();

// Routes existantes
router.use("/rendez-vous", rendezVousRouter);
router.use("/agenda", agendaRouter);
router.use("/patients", patientsRouter);
router.use("/owners", ownersRouter);
router.use("/consultations", consultationsRouter);
router.use("/factures", facturesRouter);
router.use("/ordonnances", ordonnancesRouter);
router.use("/stocks", stockRouter);
router.use("/rappels", rappelsRouter);
// NOTE: route /clinic supprimee -- module inexistant

// Sprint 7 -- nouvelles routes
router.use("/permissions", permissionsRouter);
router.use("/sms", smsRouter);
router.use("/recurring-appointments", recurringAppointmentsRouter);
router.use("/weight-history", weightHistoryRouter);
router.use("/client-letters", clientLettersRouter);

// Routes Phase 2 -- branchees (audit Phase 0)
router.use("/encaissements", encaissementsRouter);
router.use("/equipe", equipeRouter);
router.use("/ventes", ventesRouter);
router.use("/statistiques", statistiquesRouter);
router.use("/vaccinations", vaccinationsRouter);
router.use("/fournisseurs", fournisseursRouter);

export default router;
