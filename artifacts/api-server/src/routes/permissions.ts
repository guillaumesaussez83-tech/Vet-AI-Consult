import { Router } from "express";
import { requireClinicId } from "../middleware/requireClinicId";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
router.use(requireAuth(), requireClinicId);

router.get("/:userId", async (req: any, res) => {
  try {
    const { userId } = req.params;
    const clinicId = req.clinicId;
    const rows = await db.execute(sql`SELECT * FROM user_permissions WHERE user_id = ${userId} AND clinic_id = ${clinicId}`);
    res.json({ success: true, data: rows.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.get("/", async (req: any, res) => {
  try {
    const clinicId = req.clinicId;
    const rows = await db.execute(sql`SELECT user_id, module, can_read, can_write, can_delete, created_at, updated_at FROM user_permissions WHERE clinic_id = ${clinicId} ORDER BY user_id, module`);
    res.json({ success: true, data: rows.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.put("/:userId/:module", async (req: any, res) => {
  try {
    const { userId, module } = req.params;
    const clinicId = req.clinicId;
    const { canRead = true, canWrite = false, canDelete = false } = req.body;
    const now = new Date().toISOString();
    await db.execute(sql`
      INSERT INTO user_permissions (user_id, clinic_id, module, can_read, can_write, can_delete, created_at, updated_at)
      VALUES (${userId}, ${clinicId}, ${module}, ${canRead}, ${canWrite}, ${canDelete}, ${now}, ${now})
      ON CONFLICT (user_id, module) DO UPDATE SET
        can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write,
        can_delete = EXCLUDED.can_delete, clinic_id = EXCLUDED.clinic_id,
        updated_at = EXCLUDED.updated_at
    `);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete("/:userId/:module", async (req: any, res) => {
  try {
    const { userId, module } = req.params;
    const clinicId = req.clinicId;
    await db.execute(sql`DELETE FROM user_permissions WHERE user_id = ${userId} AND module = ${module} AND clinic_id = ${clinicId}`);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.get("/check/:userId/:module", async (req: any, res) => {
  try {
    const { userId, module } = req.params;
    const clinicId = req.clinicId;
    const rows = await db.execute(sql`SELECT * FROM user_permissions WHERE user_id = ${userId} AND module = ${module} AND clinic_id = ${clinicId}`);
    if (rows.rows.length === 0) return res.json({ success: true, data: { canRead: false, canWrite: false, canDelete: false } });
    const p = rows.rows[0] as any;
    return res.json({ success: true, data: { canRead: p.can_read, canWrite: p.can_write, canDelete: p.can_delete } });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;
