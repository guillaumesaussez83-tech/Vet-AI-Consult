// artifacts/api-server/src/routes/index.ts
// MODIFIE -- fix imports + ajout routes manquantes (audit Phase 0)

import { Router } from "express";
import { requireClinicId } from "../middleware/requireClinicId";
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


// Routes orphelines branchees -- audit Phase 0
import actesRouter from "./actes";
import adminRouter from "./admin";
import aiRouter from "./ai";
import anesthesieRouter from "./anesthesie";
import communicationsRouter from "./communications";
import comptabiliteRouter from "./comptabilite";
import cremationRouter from "./cremation";
import dashboardRouter from "./dashboard";
import parametresClinique from "./parametres-clinique";
import portailRouter from "./portail";
import searchRouter from "./search";
import vetKnowledgeRouter from "./vet-knowledge";
import analyticsRouter from "./analytics";
import groupeRouter from "./groupe";
import reportsRouter from "./reports";

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


// Routes orphelines -- audit Phase 0
router.use("/actes", actesRouter);
router.use("/admin", adminRouter);
router.use("/ai", aiRouter);
router.use("/anesthesie", anesthesieRouter);
router.use("/communications", communicationsRouter);
router.use("/comptabilite", comptabiliteRouter);
router.use("/cremation", cremationRouter);
router.use("/dashboard", dashboardRouter);
router.use("/parametres-clinique", parametresClinique);
router.use("/portail", portailRouter);
router.use("/search", searchRouter);
router.use("/vet-knowledge", vetKnowledgeRouter);

router.use("/analytics", requireClinicId, analyticsRouter);

router.use("/groupe", requireClinicId, groupeRouter);

router.use("/reports", requireClinicId, reportsRouter);

export default router;
