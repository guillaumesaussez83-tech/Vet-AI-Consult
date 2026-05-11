import { Router, Request, Response } from "express";
import { db } from "@vetoai/db";
import { consultationAttachmentsTable } from "@vetoai/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

const MAX_BASE64_BYTES = 5 * 1024 * 1024; // 5 MB limit for legacy base64 uploads

// GET /consultations/:consultationId/attachments
router.get("/", async (req: Request, res: Response) => {
  try {
    const { consultationId } = req.params;
    const clinicId = (req as any).clinicId as string;

    const rows = await db
      .select()
      .from(consultationAttachmentsTable)
      .where(
        and(
          eq(consultationAttachmentsTable.consultationId, consultationId),
          eq(consultationAttachmentsTable.clinicId, clinicId)
        )
      );

    // Strip raw base64 data from the list response (can be large)
    const safe = rows.map(({ dataBase64: _omit, ...rest }) => rest);
    return res.json(safe);
  } catch (err) {
    console.error("GET attachments error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /consultations/:consultationId/attachments
router.post("/", async (req: Request, res: Response) => {
  try {
    const { consultationId } = req.params;
    const clinicId = (req as any).clinicId as string;

    const { fileName, nom, type, mimeType, fileSize, fileUrl, dataBase64 } =
      req.body as {
        fileName?: string;
        nom?: string;
        type?: string;
        mimeType?: string;
        fileSize?: number;
        fileUrl?: string;
        dataBase64?: string;
      };

    // Require at least one storage mechanism
    if (!fileUrl && !dataBase64) {
      return res
        .status(400)
        .json({ error: "Either fileUrl or dataBase64 is required" });
    }

    // Validate fileUrl: must be a well-formed https:// URL
    if (fileUrl) {
      try {
        const parsed = new URL(fileUrl);
        if (parsed.protocol !== "https:") {
          return res.status(400).json({ error: "fileUrl must use HTTPS" });
        }
      } catch {
        return res.status(400).json({ error: "fileUrl is not a valid URL" });
      }
    }

    // Reject oversized base64 payloads (legacy path only)
    if (dataBase64 && !fileUrl) {
      const estimatedBytes = Math.ceil((dataBase64.length * 3) / 4);
      if (estimatedBytes > MAX_BASE64_BYTES) {
        return res.status(413).json({
          error: `File too large for base64 storage. Maximum size is 5 MB. Use fileUrl instead.`,
        });
      }
    }

    const [row] = await db
      .insert(consultationAttachmentsTable)
      .values({
        consultationId,
        clinicId,
        fileName: fileName ?? null,
        nom: nom ?? null,
        type: type ?? null,
        mimeType: mimeType ?? null,
        fileSize: fileSize ?? null,
        fileUrl: fileUrl ?? null,
        // Only store base64 when no fileUrl is provided (legacy fallback)
        dataBase64: !fileUrl && dataBase64 ? dataBase64 : null,
      })
      .returning();

    const { dataBase64: _omit, ...safe } = row;
    return res.status(201).json(safe);
  } catch (err) {
    console.error("POST attachment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /consultations/:consultationId/attachments/:attachmentId/download
router.get("/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const { consultationId, attachmentId } = req.params;
    const clinicId = (req as any).clinicId as string;

    const [row] = await db
      .select()
      .from(consultationAttachmentsTable)
      .where(
        and(
          eq(consultationAttachmentsTable.id, attachmentId),
          eq(consultationAttachmentsTable.consultationId, consultationId),
          eq(consultationAttachmentsTable.clinicId, clinicId)
        )
      );

    if (!row) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Preferred path: redirect to external file URL (CDN / S3 / etc.)
    if (row.fileUrl) {
      return res.redirect(302, row.fileUrl);
    }

    // Legacy path: serve from base64-encoded database column (old files only)
    if (row.dataBase64) {
      const buffer = Buffer.from(row.dataBase64, "base64");
      res.setHeader(
        "Content-Type",
        row.mimeType ?? "application/octet-stream"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${row.fileName ?? row.nom ?? "attachment"}"`
      );
      return res.send(buffer);
    }

    return res.status(404).json({ error: "No file data available" });
  } catch (err) {
    console.error("GET download error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /consultations/:consultationId/attachments/:attachmentId
router.delete("/:attachmentId", async (req: Request, res: Response) => {
  try {
    const { consultationId, attachmentId } = req.params;
    const clinicId = (req as any).clinicId as string;

    const [deleted] = await db
      .delete(consultationAttachmentsTable)
      .where(
        and(
          eq(consultationAttachmentsTable.id, attachmentId),
          eq(consultationAttachmentsTable.consultationId, consultationId),
          eq(consultationAttachmentsTable.clinicId, clinicId)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error("DELETE attachment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
