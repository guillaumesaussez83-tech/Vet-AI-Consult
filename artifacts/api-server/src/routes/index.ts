// artifacts/api-server/src/routes/index.ts
// MODIFIÉ — ajout routes Sprint 7

import { Router } from "express";
import rendezVousRouter from "./rendez-vous";
import agendaRouter from "./agenda";
import patientsRouter from "./patients";
import ownersRouter from "./owners";
import consultationsRouter from "./consultations";
import facturesRouter from "./factures";
import ordonnancesRouter from "./ordonnances";
import stocksRouter from "./stocks";
import rappelsRouter from "./rappels";
import clinicRouter from "./clinic";

// Sprint 7 — Phase 1 MVP Clinique
import permissionsRouter from "./permissions";
import smsRouter from "./sms";
import recurringAppointmentsRouter from "./recurring-appointments";
import weightHistoryRouter from "./weight-history";
import clientLettersRouter from "./client-letters";

const router = Router();

// Routes existantes
router.use("/rendez-vous", rendezVousRouter);
router.use("/agenda", agendaRouter);
router.use("/patients", patientsRouter);
router.use("/owners", ownersRouter);
router.use("/consultations", consultationsRouter);
router.use("/factures", facturesRouter);
router.use("/ordonnances", ordonnancesRouter);
router.use("/stocks", stocksRouter);
router.use("/rappels", rappelsRouter);
router.use("/clinic", clinicRouter);

// Sprint 7 — nouvelles routes
router.use("/permissions", permissionsRouter);
router.use("/sms", smsRouter);
router.use("/recurring-appointments", recurringAppointmentsRouter);
router.use("/weight-history", weightHistoryRouter);
router.use("/client-letters", clientLettersRouter);

export default router;
