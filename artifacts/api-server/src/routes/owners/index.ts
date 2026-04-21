import { Router } from "express";
import PDFDocument from "pdfkit";
import { db } from "@workspace/db";
import { ownersTable, parametresCliniqueTable } from "@workspace/db";
import { CreateOwnerBody, GetOwnerParams, UpdateOwnerBody, UpdateOwnerParams, DeleteOwnerParams, ListOwnersQueryParams } from "@workspace/api-zod";
import { eq, ilike, or } from "drizzle-orm";
import { ObjectStorageService } from "../../lib/objectStorage";
import { randomUUID } from "crypto";

const router = Router();

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

    let owners;
    if (search) {
      owners = await db.select().from(ownersTable).where(
        or(
          ilike(ownersTable.nom, `%${search}%`),
          ilike(ownersTable.prenom, `%${search}%`),
          ilike(ownersTable.telephone, `%${search}%`),
          ilike(ownersTable.email, `%${search}%`)
        )
      );
    } else {
      owners = await db.select().from(ownersTable);
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

    const [owner] = await db.insert(ownersTable).values(body.data).returning();
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

    const [owner] = await db.select().from(ownersTable).where(eq(ownersTable.id, params.data.id));
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

    const [owner] = await db.update(ownersTable).set(body.data).where(eq(ownersTable.id, params.data.id)).returning();
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

    await db.delete(ownersTable).where(eq(ownersTable.id, params.data.id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

// =============== RGPD ===============

async function buildRgpdPdf(owner: typeof ownersTable.$inferSelect): Promise<Buffer> {
  const [clinique] = await db.select().from(parametresCliniqueTable).limit(1);
  const c = clinique || ({} as any);
  const nomClinique = c.nomClinique || "VétoAI — Clinique vétérinaire";
  const adresseLignes = [
    c.adresse,
    [c.codePostal, c.ville].filter(Boolean).join(" "),
  ].filter(Boolean);
  const responsableNom = c.rgpdResponsableNom || nomClinique;
  const adresseExercice = c.rgpdAdresseExercice
    || [c.adresse, [c.codePostal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(" — ")
    || "Adresse à configurer dans les paramètres";

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(16).font("Helvetica-Bold").text(nomClinique, { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#555");
    adresseLignes.forEach((l) => doc.text(l));
    if (c.telephone) doc.text(`Tél : ${c.telephone}`);
    if (c.email) doc.text(`Email : ${c.email}`);
    if (c.numeroOrdre) doc.text(`N° Ordre : ${c.numeroOrdre}`);
    doc.fillColor("#000");
    doc.moveDown(1);

    // Title
    doc.fontSize(14).font("Helvetica-Bold").text("Formulaire de consentement RGPD", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").fillColor("#666").text(
      "Conformément au Règlement Général sur la Protection des Données (UE 2016/679) et à la loi Informatique et Libertés modifiée.",
      { align: "center" }
    );
    doc.fillColor("#000");
    doc.moveDown(1);

    // Salutation
    const civilite = "M./Mme";
    doc.fontSize(11).font("Helvetica").text(`Chèr(e) ${civilite} ${owner.prenom} ${owner.nom},`);
    doc.moveDown(0.7);

    doc.text(
      `Dans le cadre de la prise en charge de votre animal et de la gestion de notre relation client, ` +
      `${nomClinique} (ci-après « la clinique ») est amenée à collecter et traiter vos données personnelles.`,
      { align: "justify" }
    );
    doc.moveDown(0.7);

    // Données collectées
    doc.font("Helvetica-Bold").text("Données collectées :");
    doc.font("Helvetica").list([
      "Identité : prénom, nom",
      "Coordonnées : email, téléphone, adresse postale",
      "Bloc notes vétérinaires (informations médicales relatives à votre animal)",
      "Coordonnées bancaires (IBAN/BIC) — uniquement en cas de mandat SEPA pour le règlement des prestations",
    ], { bulletRadius: 2, textIndent: 10, bulletIndent: 5 });
    doc.moveDown(0.5);

    // Usages
    doc.font("Helvetica-Bold").text("Finalités du traitement :");
    doc.font("Helvetica").list([
      "Envoi de rappels de vaccination",
      "Alertes liées à un traitement en cours",
      "Transmission des factures par email",
      "Gestion administrative et comptable de votre dossier",
    ], { bulletRadius: 2, textIndent: 10, bulletIndent: 5 });
    doc.moveDown(0.5);

    // Durée
    doc.font("Helvetica-Bold").text("Durée de conservation :");
    doc.font("Helvetica").text(
      "Vos données sont conservées pendant la durée de la relation contractuelle puis archivées conformément aux obligations légales (10 ans pour la comptabilité, 5 ans pour le dossier médical de l'animal).",
      { align: "justify" }
    );
    doc.moveDown(0.5);

    // Droits RGPD
    doc.font("Helvetica-Bold").text("Vos droits :");
    doc.font("Helvetica").text(
      "Conformément à la réglementation en vigueur, vous disposez des droits suivants sur vos données personnelles :",
    );
    doc.list([
      "Droit d'accès",
      "Droit de rectification",
      "Droit à l'effacement (« droit à l'oubli »)",
      "Droit d'opposition au traitement",
      "Droit à la portabilité de vos données",
      "Droit à la limitation du traitement",
    ], { bulletRadius: 2, textIndent: 10, bulletIndent: 5 });
    doc.moveDown(0.5);

    // Exercice des droits
    doc.font("Helvetica-Bold").text("Pour exercer vos droits :");
    doc.font("Helvetica").text(
      `Vous pouvez contacter le responsable de traitement, ${responsableNom}, par courrier à l'adresse suivante :`,
      { align: "justify" }
    );
    doc.font("Helvetica-Oblique").text(adresseExercice);
    if (c.email) doc.font("Helvetica").text(`ou par email : ${c.email}`);
    doc.font("Helvetica");
    doc.moveDown(0.5);

    // CNIL
    doc.fontSize(9).fillColor("#555").text(
      "Vous disposez également du droit d'introduire une réclamation auprès de la Commission Nationale de l'Informatique " +
      "et des Libertés (CNIL), 3 Place de Fontenoy - TSA 80715 - 75334 PARIS CEDEX 07 — www.cnil.fr",
      { align: "justify" }
    );
    doc.fillColor("#000").fontSize(11);
    doc.moveDown(1.2);

    // Signature
    doc.font("Helvetica-Bold").text("Conforme à l'expression de mon consentement");
    doc.moveDown(0.6);
    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    doc.font("Helvetica").fontSize(11);
    doc.text(`Date : ${today}`);
    doc.moveDown(0.3);
    doc.text(`Nom : ${owner.prenom} ${owner.nom}`);
    doc.moveDown(1.2);
    doc.text("Signature :", { continued: true }).text("  _______________________________");
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#888").text(
      `Document généré le ${new Date().toLocaleString("fr-FR")} — VétoAI`,
      { align: "center" }
    );

    doc.end();
  });
}

router.post("/:id/rgpd/generate", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID invalide" });

    const [owner] = await db.select().from(ownersTable).where(eq(ownersTable.id, id));
    if (!owner) return res.status(404).json({ error: "Propriétaire non trouvé" });

    const pdfBuffer = await buildRgpdPdf(owner);

    // Upload to private object storage so we can re-download later
    let storedUrl: string | null = null;
    try {
      const storage = new ObjectStorageService();
      const uploadURL = await storage.getObjectEntityUploadURL();
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: pdfBuffer,
      });
      if (uploadRes.ok) {
        storedUrl = storage.normalizeObjectEntityPath(uploadURL);
        await db.update(ownersTable)
          .set({ rgpdDocumentUrl: storedUrl })
          .where(eq(ownersTable.id, id));
      } else {
        req.log.warn({ status: uploadRes.status }, "RGPD PDF upload failed, returning inline only");
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
    return res.status(500).json({ error: "Erreur lors de la génération du PDF RGPD" });
  }
});

router.post("/:id/rgpd/confirm", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID invalide" });

    const [owner] = await db.update(ownersTable)
      .set({ rgpdAccepted: true, rgpdAcceptedAt: new Date() })
      .where(eq(ownersTable.id, id))
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

    const [owner] = await db.update(ownersTable)
      .set({ rgpdAccepted: false, rgpdAcceptedAt: null })
      .where(eq(ownersTable.id, id))
      .returning();
    if (!owner) return res.status(404).json({ error: "Propriétaire non trouvé" });

    return res.json(serialize(owner));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
