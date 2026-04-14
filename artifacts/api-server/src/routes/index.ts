import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ownersRouter from "./owners";
import patientsRouter from "./patients";
import consultationsRouter from "./consultations";
import actesRouter from "./actes";
import facturesRouter from "./factures";
import aiRouter from "./ai";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/owners", ownersRouter);
router.use("/patients", patientsRouter);
router.use("/consultations", consultationsRouter);
router.use("/actes", actesRouter);
router.use("/factures", facturesRouter);
router.use("/ai", aiRouter);
router.use("/dashboard", dashboardRouter);

export default router;
