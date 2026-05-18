// @ts-nocheck
import { Router } from "express";
import { requireAuth } from "@clerk/express";

const router = Router();

// Admin placeholder — routes d'administration
router.get("/", requireAuth(), (_req, res) => {
  res.json({ success: true, data: { message: "Admin endpoint" } });
});

export default router;
