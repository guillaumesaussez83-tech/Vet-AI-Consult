import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ownersRouter from "./owners";
import patientsRouter from "./patients";
import consultationsRouter from "./consultations";
import actesRouter from "./actes";
import facturesRouter from "./factures";
import aiRouter from "./ai";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import rappelsRouter from "./rappels";
import vaccinationsRouter from "./vaccinations";
import stockRouter from "./stock";
import rendezVousRouter from "./rendez-vous";
import anesthesieRouter from "./anesthesie";
import portailRouter from "./portail";
import statistiquesRouter from "./statistiques";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/owners", ownersRouter);
router.use("/patients", patientsRouter);
router.use("/consultations", consultationsRouter);
router.use("/actes", actesRouter);
router.use("/factures", facturesRouter);
router.use("/ai", aiRouter);
router.use("/dashboard", dashboardRouter);
router.use("/rappels", rappelsRouter);
router.use("/vaccinations", vaccinationsRouter);
router.use("/stock", stockRouter);
router.use("/rendez-vous", rendezVousRouter);
router.use("/anesthesie", anesthesieRouter);
router.use("/statistiques", statistiquesRouter);
router.use("/portail", portailRouter);
router.use(storageRouter);

export default router;
