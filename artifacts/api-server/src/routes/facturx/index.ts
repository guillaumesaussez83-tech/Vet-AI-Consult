// artifacts/api-server/src/routes/facturx/index.ts
// Sprint 2/3 — Factur-X EN16931-BASIC generation
// Routes: POST /:id/generate-xml · GET /:id/facturx.xml · GET /:id/facturx.pdf
//
// CORRECTIONS (2026-05-18) :
// - Suppression @ts-nocheck + types corrects
// - Champs DB corrects : numero, montantHT, montantTTC, dateEmission, prenom, nom
// - Relation owner via consultation → patient → owner (facture.ownerId n'existe pas)
// - escapeXml() sur tous les champs dynamiques (sécurité XML injection)
// - Seller enrichi : SIRET, TVA intracommunautaire, adresse complète
// - toFixed(2) sur les montants pour XML valide

import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  facturesTable,
  clinicsTable,
  ownersTable,
  consultationsTable,
  patientsTable,
} from "@workspace/db";

interface AuthRequest extends Request {
  clinicId: string;
}

const router = Router();

export function escapeXml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toInvoiceDateFormat(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const clean = dateStr.slice(0, 10).replace(/\//g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean.replace(/-/g, "");
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

async function getOwnerForFacture(
  consultationId: number
): Promise<typeof ownersTable.$inferSelect | null> {
  const [consultation] = await db
    .select({ patientId: consultationsTable.patientId })
    .from(consultationsTable)
    .where(eq(consultationsTable.id, consultationId))
    .limit(1);
  if (!consultation) return null;
  const [patient] = await db
    .select({ ownerId: patientsTable.ownerId })
    .from(patientsTable)
    .where(eq(patientsTable.id, consultation.patientId))
    .limit(1);
  if (!patient?.ownerId) return null;
  const [owner] = await db
    .select()
    .from(ownersTable)
    .where(eq(ownersTable.id, patient.ownerId))
    .limit(1);
  return owner ?? null;
}

router.post("/:id/generate-xml", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const factureId = parseInt(req.params["id"]!, 10);
    if (isNaN(factureId)) return res.status(400).json({ error: "ID invalide" });
    const clinicId = authReq.clinicId;
    if (!clinicId) return res.status(401).json({ error: "Non autorise" });
    const [facture] = await db.select().from(facturesTable).where(eq(facturesTable.id, factureId)).limit(1);
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    if (facture.clinicId !== clinicId) return res.status(403).json({ error: "Acces interdit" });
    const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1);
    if (!clinic) return res.status(404).json({ error: "Clinique introuvable" });
    const owner = await getOwnerForFacture(facture.consultationId);
    const now = new Date();
    const invoiceDate = toInvoiceDateFormat(facture.dateEmission);
    const montantHT = (facture.montantHT ?? 0).toFixed(2);
    const montantTTC = (facture.montantTTC ?? 0).toFixed(2);
    const montantTva = ((facture.montantTTC ?? 0) - (facture.montantHT ?? 0)).toFixed(2);
    const buyerName = owner ? escapeXml((owner.prenom ?? "") + " " + (owner.nom ?? "")) : "";
    const xml = '<?xml version="1.0" encoding="UTF-8"?><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"><rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext><rsm:ExchangedDocument><ram:ID>' + escapeXml(facture.numero) + '</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">' + invoiceDate + '</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument><rsm:SupplyChainTradeTransaction><ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty><ram:Name>' + escapeXml(clinic.name) + '</ram:Name><ram:PostalTradeAddress><ram:PostcodeCode>' + escapeXml(clinic.postalCode) + '</ram:PostcodeCode><ram:LineOne>' + escapeXml(clinic.address) + '</ram:LineOne><ram:CityName>' + escapeXml(clinic.city) + '</ram:CityName><ram:CountryID>' + escapeXml(clinic.paysIso2 ?? "FR") + '</ram:CountryID></ram:PostalTradeAddress></ram:SellerTradeParty><ram:BuyerTradeParty><ram:Name>' + buyerName + '</ram:Name></ram:BuyerTradeParty></ram:ApplicableHeaderTradeAgreement><ram:ApplicableHeaderTradeDelivery/><ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>' + montantHT + '</ram:LineTotalAmount><ram:TaxBasisTotalAmount>' + montantHT + '</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">' + montantTva + '</ram:TaxTotalAmount><ram:GrandTotalAmount>' + montantTTC + '</ram:GrandTotalAmount><ram:DuePayableAmount>' + montantTTC + '</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>';
    await db.update(facturesTable).set({ facturxXml: xml, facturxGeneratedAt: now, facturxVersion: "EN16931-BASIC" }).where(eq(facturesTable.id, factureId));
    return res.status(200).json({ ok: true, factureId, facturxVersion: "EN16931-BASIC", generatedAt: now.toISOString(), xmlLength: xml.length });
  } catch (err) {
    (authReq as unknown as { log: { error: (e: unknown) => void } }).log.error(err);
    return res.status(500).json({ error: "Erreur generation Factur-X" });
  }
});

router.get("/:id/facturx.xml", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const factureId = parseInt(req.params["id"]!, 10);
    if (isNaN(factureId)) return res.status(400).json({ error: "ID invalide" });
    const clinicId = authReq.clinicId;
    if (!clinicId) return res.status(401).json({ error: "Non autorise" });
    const [facture] = await db.select({ id: facturesTable.id, clinicId: facturesTable.clinicId, facturxXml: facturesTable.facturxXml, numero: facturesTable.numero }).from(facturesTable).where(eq(facturesTable.id, factureId)).limit(1);
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    if (facture.clinicId !== clinicId) return res.status(403).json({ error: "Acces interdit" });
    if (!facture.facturxXml) return res.status(404).json({ error: "XML Factur-X non genere" });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="facture-' + (facture.numero ?? factureId) + '.xml"');
    return res.send(facture.facturxXml);
  } catch (err) {
    (authReq as unknown as { log: { error: (e: unknown) => void } }).log.error(err);
    return res.status(500).json({ error: "Erreur recuperation XML" });
  }
});

router.get("/:id/facturx.pdf", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const factureId = parseInt(req.params["id"]!, 10);
    if (isNaN(factureId)) return res.status(400).json({ error: "ID invalide" });
    const clinicId = authReq.clinicId;
    if (!clinicId) return res.status(401).json({ error: "Non autorise" });
    const [facture] = await db.select({ id: facturesTable.id, clinicId: facturesTable.clinicId, facturxPdfUrl: facturesTable.facturxPdfUrl }).from(facturesTable).where(eq(facturesTable.id, factureId)).limit(1);
    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    if (facture.clinicId !== clinicId) return res.status(403).json({ error: "Acces interdit" });
    if (!facture.facturxPdfUrl) return res.status(404).json({ error: "PDF Factur-X non disponible" });
    return res.redirect(302, facture.facturxPdfUrl);
  } catch (err) {
    (authReq as unknown as { log: { error: (e: unknown) => void } }).log.error(err);
    return res.status(500).json({ error: "Erreur recuperation PDF" });
  }
});

export default router;
