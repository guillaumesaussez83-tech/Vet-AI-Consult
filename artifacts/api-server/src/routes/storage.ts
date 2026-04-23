import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { Readable } from "stream";
import { getAuth } from "@clerk/express";
import rateLimit from "express-rate-limit";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { fail } from "../lib/response";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Rate limit strict sur les endpoints publics pour empêcher l'énumération
// d'object paths par bruteforce.
const publicObjectLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const RequestUploadUrlBody = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive().optional(),
  contentType: z.string().min(1).max(255),
});

/**
 * Génère une URL d'upload signée. Auth requise.
 * Le path d'upload est préfixé par clinic_id côté service pour limiter le
 * blast-radius en cas d'erreur ACL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json(fail("UNAUTHENTICATED", "Authentification requise."));
    return;
  }
  if (!req.clinicId) {
    res.status(403).json(fail("CLINIC_NOT_ASSIGNED", "Clinique non résolue."));
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(
      fail("VALIDATION_ERROR", "Champs invalides ou manquants.", parsed.error.flatten().fieldErrors),
    );
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL({
      clinicId: req.clinicId,
      ownerUserId: auth.userId,
    });
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ success: true, data: { uploadURL, objectPath, metadata: { name, size, contentType } } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json(fail("STORAGE_ERROR", "Impossible de générer l'URL d'upload."));
  }
});

/**
 * Lit un objet PUBLIC (logos, templates partagés, etc.).
 * Rate-limited + path-traversal sanitization.
 */
router.get(
  "/storage/public-objects/*filePath",
  publicObjectLimiter,
  async (req: Request, res: Response) => {
    try {
      const raw = (req.params as Record<string, string | string[]>).filePath;
      const filePath = Array.isArray(raw) ? raw.join("/") : raw;

      // Refuser toute tentative de path traversal.
      if (!filePath || filePath.includes("..") || /%2e%2e/i.test(filePath)) {
        res.status(400).json(fail("INVALID_PATH", "Chemin invalide."));
        return;
      }

      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json(fail("NOT_FOUND", "Fichier introuvable."));
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json(fail("STORAGE_ERROR", "Erreur de lecture."));
    }
  },
);

/**
 * Lit un objet privé. Exige :
 *   - Auth Clerk (userId)
 *   - ACL qui autorise ce userId (canAccessObjectEntity)
 *   - clinicId == celui stocké dans les metadata ACL de l'objet
 */
router.get("/storage/objects/*objectPath", async (req: Request, res: Response) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json(fail("UNAUTHENTICATED", "Authentification requise."));
    return;
  }

  try {
    const raw = (req.params as Record<string, string | string[]>).objectPath;
    const rawStr = Array.isArray(raw) ? raw.join("/") : raw;

    if (!rawStr || rawStr.includes("..") || /%2e%2e/i.test(rawStr)) {
      res.status(400).json(fail("INVALID_PATH", "Chemin invalide."));
      return;
    }

    const objectPath = `/objects/${rawStr}`;

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const authorized = await objectStorageService.canAccessObjectEntity({
      userId: auth.userId,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!authorized) {
      // Ne pas révéler l'existence de l'objet.
      res.status(404).json(fail("NOT_FOUND", "Objet introuvable."));
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json(fail("NOT_FOUND", "Objet introuvable."));
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json(fail("STORAGE_ERROR", "Erreur de lecture."));
  }
});

export default router;
