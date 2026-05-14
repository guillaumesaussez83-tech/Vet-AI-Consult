import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userPermissions } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { isAdmin } from "../../middleware/isAdmin";

const router = Router();

// RBAC: all admin permission routes require auth + admin role
router.use(requireAuth(), isAdmin);

// GET /api/admin/permissions?userId=xxx  OR  GET /api/admin/permissions (all)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    let rows;
    if (userId && typeof userId === "string") {
      rows = await db.select().from(userPermissions).where(eq(userPermissions.userId, userId));
    } else {
      rows = await db.select().from(userPermissions);
    }
    return res.json({ data: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/permissions
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, module, canRead, canWrite, canDelete } = req.body;
    if (!userId || !module) {
      return res.status(400).json({ error: "userId and module required" });
    }
    const [row] = await db
      .insert(userPermissions)
      .values({ userId, clinicId: req.clinicId!, module, canRead: !!canRead, canWrite: !!canWrite, canDelete: !!canDelete })
      .onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.module],
        set: { canRead: !!canRead, canWrite: !!canWrite, canDelete: !!canDelete, updatedAt: new Date() },
      })
      .returning();
    return res.status(201).json({ data: row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/permissions/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { canRead, canWrite, canDelete } = req.body;
    const [row] = await db
      .update(userPermissions)
      .set({ canRead: !!canRead, canWrite: !!canWrite, canDelete: !!canDelete, updatedAt: new Date() })
      .where(eq(userPermissions.id, String(id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Permission not found" });
    return res.json({ data: row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/permissions/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(userPermissions).where(eq(userPermissions.id, String(id)));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
