import { Router } from "express";
import requireClinicId from "../middleware/requireClinicId";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ── Security: authentication + clinic isolation required on ALL routes
router.use(requireAuth(), requireClinicId);

// GET /api/permissions/:userId — tous les modules pour un user
router.get("/:userId", async (req: any, res) => {
  try {
    const { userId } = req.params;
    const rows = await db.execute(sql`
      SELECT * FROM user_permissions WHERE user_id = ${userId}
    `);
    res.json({ success: true, data: rows.rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/permissions — tous les permissions de la clinique
router.get("/", async (req: any, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string;
    // List all unique users with permissions (cross-join style)
    const rows = await db.execute(sql`
      SELECT user_id, module, can_read, can_write, can_delete, created_at, updated_at
      FROM user_permissions
      ORDER BY user_id, module
    `);
    res.json({ success: true, data: rows.rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/permissions/:userId/:module — upsert
router.put("/:userId/:module", async (req: any, res) => {
  try {
    const { userId, module } = req.params;
    const { canRead = true, canWrite = false, canDelete = false } = req.body;
    const now = new Date().toISOString();

    await db.execute(sql`
      INSERT INTO user_permissions (user_id, module, can_read, can_write, can_delete, created_at, updated_at)
      VALUES (${userId}, ${module}, ${canRead}, ${canWrite}, ${canDelete}, ${now}, ${now})
      ON CONFLICT (user_id, module) DO UPDATE SET
        can_read = EXCLUDED.can_read,
        can_write = EXCLUDED.can_write,
        can_delete = EXCLUDED.can_delete,
        updated_at = EXCLUDED.updated_at
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/permissions/:userId/:module
router.delete("/:userId/:module", async (req: any, res) => {
  try {
    const { userId, module } = req.params;
    await db.execute(sql`
      DELETE FROM user_permissions WHERE user_id = ${userId} AND module = ${module}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/permissions/check/:userId/:module — vérifie si un user a le droit
router.get("/check/:userId/:module", async (req: any, res) => {
  try {
    const { userId, module } = req.params;
    const rows = await db.execute(sql`
      SELECT * FROM user_permissions WHERE user_id = ${userId} AND module = ${module}
    `);
    if (rows.rows.length === 0) {
      // Pas de règle = accès complet par défaut (admin-first)
      return res.json({ success: true, data: { canRead: false, canWrite: false, canDelete: false } });
    }
    const p = rows.rows[0] as any;
    res.json({ success: true, data: { canRead: p.can_read, canWrite: p.can_write, canDelete: p.can_delete } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
