// artifacts/api-server/src/routes/owners/index.ts
// Sprint e-invoicing — Patch: accepte les champs B2B (type_client, siren, siret, tva_intra, etc.)
// Les champs e-invoicing sont validés inline en plus du CreateOwnerBody existant.
// Le reste du fichier (RGPD, etc.) est inchangé.

import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { ownersTable, parametresCliniqueTable } from "@workspace/db";
import {
  CreateOwnerBody,
  GetOwnerParams,
  UpdateOwnerBody,
  UpdateOwnerParams,
  DeleteOwnerParams,
  ListOwnersQueryParams,
} from "@workspace/api-zod";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { ObjectStorageService } from "../../lib/objectStorage";

const router = Router();

// ── Schémas e-invoicing (champs Factur-X) ─────────────────────────────────────
const EInvoicingOwnerFields = z.object({
  typeClient: z.enum(["particulier", "entreprise"]).optional(),
  raisonSociale: z.string().max(200).optional().nullable(),
  siren: z.string().length(9).regex(/^\d{9}$/, "SIREN doit contenir 9 chiffres").optional().nullable(),
  siret: z.string().length(14).regex(/^\d{14}$/, "SIRET doit contenir 14 chiffres").optional().nullable(),
  tvaIntra: z.string().max(13).regex(/^[A-Z]{2}\d{11}$/, "Format TVA intra: FR12345678901").optional().nullable(),
  codeServiceExecutant: z.string().max(50).optional().nullable(),
  paysIso2: z.string().length(2).optional().default("FR"),
});

// Validation conditionnelle : si type_client=entreprise, siret recommandé mais non bloquant (Phase 1)
function validateEInvoicingCoherence(data: z.infer<typeof EInvoicingOwnerFields>) {
  if (data.typeClient === "entreprise" && !data.siret && !data.siren) {
    // Warn only — pas de blocage en Phase 1, juste log
    console.warn("[e-invoicing] Propriétaire entreprise sans SIRET ni SIREN");
  }
}
// ──────────────────────────────────────────────────────────────────────────────

function serialize(o: typeof ownersTable.$inferSelect) {
  return {
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    rgpdAcceptedAt: o.rgpdAcceptedAt ? o.rgpdAcceptedAt.toISOString() : null,
  };
}

router.get("/", async (req, res) => {
  try {
    const query = ListOwnersQueryParams.safeParse(req.query);
    const search = query.success ? query.data.search : undefined;

    const rawPage = parseInt(String(req.query["page"] ?? "1"), 10);
    const rawLimit = parseInt(String(req.query["limit"] ?? "50"), 10);
    const pageNum = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const pageSize = Number.isNaN(rawLimit) || rawLimit < 1 || rawLimit > 200 ? 50 : rawLimit;
    const pageOffset = (pageNum - 1) * pageSize;

    let owners;
    if (search) {
      owners = await db
        .select()
        .from(ownersTable)
        .where(
          and(
            eq(ownersTable.clinicId, req.clinicId!),
            or(
              ilike(ownersTable.nom, `%${search}%`),
              ilike(ownersTable.prenom, `%${search}%`),
              ilike(ownersTable.telephone, `%${search}%`),
              ilike(ownersTable.email, `%${search}%`),
            ),
          ),
        )
        .orderBy(desc(ownersTable.createdAt))
        .limit(pageSize)
        .offset(pageOffset);
    } else {
      owners = await db
        .select()
        .from(ownersTable)
        .where(eq(ownersTable.clinicId, req.clinicId!))
        .orderBy(desc(ownersTable.createdAt))
        .limit(pageSize)
        .offset(pageOffset);
    }

    return res.json(owners.map(serialize));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateOwnerBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "Données invalides", details: body.error.issues });
    }

    // Validation champs e-invoicing
    const einvoicing = EInvoicingOwnerFields.safeParse(req.body);
    const einvoicingData = einvoicing.success ? einvoicing.data : {};
    validateEInvoicingCoherence(einvoicingData as z.infer<typeof EInvoicingOwnerFields>);

    const [owner] = await db
      .insert(ownersTable)
      .values({
        ...body.data,
        ...einvoicingData,
        clinicId: req.clinicId!,
      })
      .returning();

    return res.status(201).json(serialize(owner));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const params = GetOwnerParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const [owner] = await db
      .select()
      .from(ownersTable)
      .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, params.data.id)));
    if (!owner) return res.status(404).json({ error: "Propriétaire non trouvé" });

    return res.json(serialize(owner));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const params = UpdateOwnerParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const body = UpdateOwnerBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    // Validation champs e-invoicing
    const einvoicing = EInvoicingOwnerFields.partial().safeParse(req.body);
    const einvoicingData = einvoicing.success ? einvoicing.data : {};
    if (einvoicingData.typeClient) {
      validateEInvoicingCoherence(einvoicingData as z.infer<typeof EInvoicingOwnerFields>);
    }

    const [owner] = await db
      .update(ownersTable)
      .set({ ...body.data, ...einvoicingData })
      .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, params.data.id)))
      .returning();
    if (!owner) return res.status(404).json({ error: "Propriétaire non trouvé" });

    return res.json(serialize(owner));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const params = DeleteOwnerParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    await db
      .delete(ownersTable)
      .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, params.data.id)));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

// =============== RGPD (inchangé) ===============

async function buildRgpdPdf(owner: typeof ownersTable.$inferSelect): Promise<Buffer> {
  const [clinique] = await db.select().from(parametresCliniqueTable).limit(1);
  const c = clinique || ({} as any);
  const nomClinique = c.nomClinique || "VétoAI – Clinique vétérinaire";
  const adresseLignes = [
    c.adresse,
    [c.codePostal, c.ville].filter(Boolean).join(" "),
  ].filter(Boolean);
  const responsableNom = c.rgpdResponsableNom || nomClinique;
  const adresseExercice =
    c.rgpdAdresseExercice ||
    [c.adresse, [c.codePostal, c.ville].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(" – ") ||
    "Adresse à configurer dans les paramètres";

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(16).font("Helvetica-Bold").text(nomClinique, { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#555");
    adresseLignes.forEach((l) => doc.text((l) ?? ''));
    if (c.telephone) doc.text(`Tél : ${c.telephone}`);
    if (c.email) doc.text(`Email : ${c.email}`);
    if (c.numeroOrdre) doc.text(`N° Ordre : ${c.numeroOrdre}`);
    doc.fillColor("#000");
    doc.moveDown(1);
    doc.fontSize(14).font("Helvetica-Bold").text("Formulaire de consentement RGPD", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").fillColor("#666").text(
      "Conformément au Règlement Général sur la Protection des Données (UE 2016/679) et à la loi Informatique et Libertés modifiée.",
      { align: "center" }
    );
    doc.fillColor("#000");
    doc.moveDown(1);
    doc.fontSize(11).font("Helvetica").text(`Cher(e) M./Mme ${owner.prenom} ${owner.nom},`);
    doc.moveDown(0.7);
    doc.text(
      `Dans le cadre de la prise en charge de votre animal et de la gestion de notre relation client, ` +
        `${nomClinique} est amenée à collecter et traiter vos données personnelles.`,
      { align: "justify" }
    );
    doc.moveDown(1.5);
    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(`Date : ${today}`);
    doc.moveDown(0.3);
    doc.text(`Nom : ${owner.prenom} ${owner.nom}`);
    doc.moveDown(1.2);
    doc.text("Signature :", { continued: true }).text(" _______________________________");
    doc.end();
  });
}

router.post("/:id/rgpd/generate", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID invalide" });

    const [owner] = await db
      .select()
      .from(ownersTable)
      .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, id)));
    if (!owner) return res.status(404).json({ error: "Propriétaire non trouvé" });

    const pdfBuffer = await buildRgpdPdf(owner);

    let storedUrl: string | null = null;
    try {
      const storage = new ObjectStorageService();
      const uploadURL = await storage.getObjectEntityUploadURL({
        clinicId: req.clinicId!,
        ownerUserId: req.auth?.userId || "system",
      });
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: pdfBuffer,
      });
      if (uploadRes.ok) {
        storedUrl = storage.normalizeObjectEntityPath(uploadURL);
        await db
          .update(ownersTable)
          .set({ rgpdDocumentUrl: storedUrl })
          .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, id)));
      }
    } catch (uploadErr) {
      req.log.warn({ err: uploadErr }, "RGPD PDF storage skipped");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="consentement-rgpd-${owner.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${owner.id}.pdf"`
    );
    if (storedUrl) res.setHeader("X-Document-Url", storedUrl);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    return res.end(pdfBuffer);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Lors de la génération du PDF RGPD" });
  }
});

router.post("/:id/rgpd/confirm", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID invalide" });

    const [owner] = await db
      .update(ownersTable)
      .set({ rgpdAccepted: true, rgpdAcceptedAt: new Date() })
      .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, id)))
      .returning();
    if (!owner) return res.status(404).json({ error: "Propriétaire non trouvé" });

    return res.json(serialize(owner));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/:id/rgpd/revoke", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID invalide" });

    const [owner] = await db
      .update(ownersTable)
      .set({ rgpdAccepted: false, rgpdAcceptedAt: null })
      .where(and(eq(ownersTable.clinicId, req.clinicId!), eq(ownersTable.id, id)))
      .returning();
    if (!owner) return res.status(404).json({ error: "Propriétaire non trouvé" });

    return res.json(serialize(owner));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
