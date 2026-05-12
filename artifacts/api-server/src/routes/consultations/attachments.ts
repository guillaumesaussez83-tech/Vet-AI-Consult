import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db, consultationAttachmentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireClinicId, getClinicId } from "../../middleware/requireClinicId";

const router = Router({ mergeParams: true });

// MIME type allowlist — only safe document/image types
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// GET /api/consultations/:consultationId/attachments
router.get("/", requireAuth(), requireClinicId, async (req: Request, res: Response) => {
  try {
    const consultationId = parseInt(req.params.consultationId as string, 10);
    if (isNaN(consultationId)) return res.status(400).json({ error: "Invalid consultationId" });
    const clinicId = getClinicId(req) as string;

    const rows = await db
      .select({
        id: consultationAttachmentsTable.id,
        fileName: consultationAttachmentsTable.fileName,
        mimeType: consultationAttachmentsTable.mimeType,
        fileSize: consultationAttachmentsTable.fileSize,
        fileUrl: consultationAttachmentsTable.fileUrl,
        createdAt: consultationAttachmentsTable.createdAt,
      })
      .from(consultationAttachmentsTable)
      .where(
        and(
          eq(consultationAttachmentsTable.consultationId, consultationId),
          eq(consultationAttachmentsTable.clinicId, clinicId)
        )
      );

    return res.json({ data: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/consultations/:consultationId/attachments/:id/download
router.get("/:id/download", requireAuth(), requireClinicId, async (req: Request, res: Response) => {
  try {
    const attachmentId = parseInt(req.params.id as string, 10);
    if (isNaN(attachmentId)) return res.status(400).json({ error: "Invalid attachment id" });
    const clinicId = getClinicId(req) as string;

    const [row] = await db
      .select()
      .from(consultationAttachmentsTable)
      .where(
        and(
          eq(consultationAttachmentsTable.id, attachmentId),
          eq(consultationAttachmentsTable.clinicId, clinicId)
        )
      );

    if (!row) return res.status(404).json({ error: "Attachment not found" });

    if (row.dataBase64) {
      const buffer = Buffer.from(row.dataBase64, "base64");
      res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${row.fileName || "file"}"`
      );
      return res.send(buffer);
    } else if (row.fileUrl) {
      return res.redirect(row.fileUrl);
    } else {
      return res.status(404).json({ error: "No file data available" });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/consultations/:consultationId/attachments
router.post("/", requireAuth(), requireClinicId, async (req: Request, res: Response) => {
  try {
    const consultationId = parseInt(req.params.consultationId as string, 10);
    if (isNaN(consultationId)) return res.status(400).json({ error: "Invalid consultationId" });
    const clinicId = getClinicId(req) as string;
    const { fileName, mimeType, fileSize, dataBase64, fileUrl } = req.body;

    if (!fileName || (!dataBase64 && !fileUrl)) {
      return res
        .status(400)
        .json({ error: "fileName and (dataBase64 or fileUrl) required" });
    }

    // Validate MIME type against allowlist
    const effectiveMime = mimeType || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.has(effectiveMime)) {
      return res
        .status(400)
        .json({ error: `MIME type not allowed: ${effectiveMime}` });
    }

    // Validate declared size
    const effectiveSize = fileSize || 0;
    if (effectiveSize > MAX_SIZE_BYTES) {
      return res.status(400).json({ error: "File exceeds 5 MB limit" });
    }

    // Validate actual base64 payload size (independent of client declaration)
    if (dataBase64) {
      const actualBytes = Math.ceil((dataBase64.length * 3) / 4);
      if (actualBytes > MAX_SIZE_BYTES) {
        return res.status(400).json({ error: "File exceeds 5 MB limit" });
      }
    }

    const [row] = await db
      .insert(consultationAttachmentsTable)
      .values({
        consultationId,
        clinicId,
        fileName,
        mimeType: effectiveMime,
        fileSize: effectiveSize,
        dataBase64: dataBase64 || null,
        fileUrl: fileUrl || null,
      })
      .returning();

    return res.status(201).json({ data: row });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/consultations/:consultationId/attachments/:id
router.delete("/:id", requireAuth(), requireClinicId, async (req: Request, res: Response) => {
  try {
    const attachmentId = parseInt(req.params.id as string, 10);
    if (isNaN(attachmentId)) return res.status(400).json({ error: "Invalid attachment id" });
    const clinicId = getClinicId(req) as string;

    await db
      .delete(consultationAttachmentsTable)
      .where(
        and(
          eq(consultationAttachmentsTable.id, attachmentId),
          eq(consultationAttachmentsTable.clinicId, clinicId)
        )
      );

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
