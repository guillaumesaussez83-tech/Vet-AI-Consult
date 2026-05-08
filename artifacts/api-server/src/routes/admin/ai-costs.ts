import { Router } from "express";
import { db, aiUsageLogsTable } from "@workspace/db";
import { sql, gte, eq, and } from "drizzle-orm";
import { MODEL_COSTS } from "../../lib/ai/aiMetrics";
import { requireAuth } from "@clerk/express";
import { requireClinicId } from "../../middleware/requireClinicId";
import { isAdmin } from "../../middleware/isAdmin";

const router = Router();

// RBAC: all admin routes require auth + clinic + admin role
router.use(requireAuth(), requireClinicId, isAdmin);

/**
 * GET /api/admin/ai-costs?period=30d
 * Returns AI usage breakdown by model + task for the clinic over the given period.
 */
router.get("/ai-costs", async (req, res) => {
  try {
    const rawPeriod = (req.query.period as string) ?? "30d";
    const days = parseInt(rawPeriod.replace(/\D/g, "")) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const clinicId = req.clinicId;

    const rows = await db
      .select({
        model: aiUsageLogsTable.model,
        taskType: aiUsageLogsTable.taskType,
        calls: sql<number>`count(*)`,
        tokensIn: sql<number>`sum(${aiUsageLogsTable.tokensIn})`,
        tokensOut: sql<number>`sum(${aiUsageLogsTable.tokensOut})`,
        costUsd: sql<number>`sum(${aiUsageLogsTable.costUsd})`,
      })
      .from(aiUsageLogsTable)
      .where(and(
        eq(aiUsageLogsTable.clinicId, clinicId),
        gte(aiUsageLogsTable.createdAt, since),
      ))
      .groupBy(aiUsageLogsTable.model, aiUsageLogsTable.taskType);

    const totalCostUsd = rows.reduce((s, r) => s + Number(r.costUsd ?? 0), 0);
    const totalCalls = rows.reduce((s, r) => s + Number(r.calls ?? 0), 0);

    return res.json({
      period: rawPeriod,
      since: since.toISOString(),
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      totalCalls,
      breakdown: rows.map(r => ({
        model: r.model,
        taskType: r.taskType,
        calls: Number(r.calls ?? 0),
        tokensIn: Number(r.tokensIn ?? 0),
        tokensOut: Number(r.tokensOut ?? 0),
        costUsd: Math.round(Number(r.costUsd ?? 0) * 1_000_000) / 1_000_000,
      })),
      modelCosts: MODEL_COSTS,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch AI costs" });
  }
});

export default router;
