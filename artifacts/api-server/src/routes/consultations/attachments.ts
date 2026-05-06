import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "../../../db";
import { consultationAttachmentsTable } from "../../../../lib/db/src/schema";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

// GET /api/consultations/:consultationId/attachments
router.get("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const consultationId = Number(req.params.consultationId);
    const rows = await db
      .select({
        id: consultationAttachmentsTable.id,
        filename: consultationAttachmentsTable.filename,
        mimeType: consultationAttachmentsTable.mimeType,
        sizeBytes: consultationAttachmentsTable.sizeBytes,
        uploadedBy: consultationAttachmentsTable.uploadedBy,
        createdAt: consultationAttachmentsTable.createdAt,
      })
      .from(consultationAttachmentsTable)
      .where(eq(consultationAttachmentsTable.consultationId, consultationId));
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/consultations/:consultationId/attachments/:id/download
router.get("/:id/download", requireAuth(), async (req: Request, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(consultationAttachmentsTable)
      .where(eq(consultationAttachmentsTable.id, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Attachment not found" });
    const buffer = Buffer.from(row.dataBase64, "base64");
    res.setHeader("Content-Type", row.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${row.filename}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/consultations/:consultationId/attachments
router.post("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const consultationId = Number(req.params.consultationId);
    const { filename, mimeType, sizeBytes, dataBase64, uploadedBy } = req.body;
    if (!filename || !dataBase64) return res.status(400).json({ error: "filename and dataBase64 required" });
    const [row] = await db
      .insert(consultationAttachmentsTable)
      .values({ consultationId, filename, mimeType: mimeType || "application/octet-stream", sizeBytes: sizeBytes || 0, dataBase64, uploadedBy })
      .returning();
    res.status(201).json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/consultations/:consultationId/attachments/:id
router.delete("/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    await db.delete(consultationAttachmentsTable).where(eq(consultationAttachmentsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
