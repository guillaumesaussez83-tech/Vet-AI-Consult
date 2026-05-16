// artifacts/api-server/src/routes/facturx/index.ts
// Sprint 2/3 — Factur-X EN16931-BASIC generation
// Routes: POST /:id/generate-xml · GET /:id/facturx.xml · GET /:id/facturx.pdf

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, facturesTable, clinicsTable, ownersTable } from "@workspace/db";

const router = Router();

// ── POST /:id/generate-xml ────────────────────────────────────────────────────
// Génère le XML Factur-X EN16931-BASIC (CII) et le stocke dans factures.facturx_xml
router.post("/:id/generate-xml", async (req, res) => {
  try {
    const factureId = parseInt(req.params.id, 10);
    if (isNaN(factureId)) return res.status(400).json({ error: "ID invalide" });

    const clinicId = req.clinicId;
    if (!clinicId) return res.status(401).json({ error: "Non autorise" });

    const [facture] = await db
      .select()
      .from(facturesTable)
      .where(eq(facturesTable.id, factureId))
      .limit(1);

    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    if (facture.clinicId !== clinicId) return res.status(403).json({ error: "Acces interdit" });

    const [clinic] = await db
      .select()
      .from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId))
      .limit(1);

    if (!clinic) return res.status(404).json({ error: "Clinique introuvable" });

    const [owner] = facture.ownerId
      ? await db.select().from(ownersTable).where(eq(ownersTable.id, facture.ownerId)).limit(1)
      : [null];

    const now = new Date();
    const invoiceDate = facture.date
      ? new Date(facture.date).toISOString().slice(0, 10).replace(/-/g, "")
      : now.toISOString().slice(0, 10).replace(/-/g, "");

    const buyerName = owner
      ? `${(owner as any).firstName ?? ""} ${(owner as any).lastName ?? ""}`.trim()
      : "";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${(facture as any).number ?? factureId}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${invoiceDate}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${(clinic as any).name ?? ""}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${buyerName}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${(owner as any)?.codePostal ?? ""}</ram:PostcodeCode>
          <ram:LineOne>${(owner as any)?.adresse ?? ""}</ram:LineOne>
          <ram:CityName>${(owner as any)?.ville ?? ""}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${(facture as any).totalHt ?? "0.00"}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${(facture as any).totalHt ?? "0.00"}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${(facture as any).totalTva ?? "0.00"}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${(facture as any).totalTtc ?? "0.00"}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${(facture as any).totalTtc ?? "0.00"}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

    await db
      .update(facturesTable)
      .set({
        facturxXml: xml,
        facturxGeneratedAt: now,
        facturxVersion: "EN16931-BASIC",
      })
      .where(eq(facturesTable.id, factureId));

    return res.status(200).json({
      ok: true,
      factureId,
      facturxVersion: "EN16931-BASIC",
      generatedAt: now.toISOString(),
      xmlLength: xml.length,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur generation Factur-X" });
  }
});

// ── GET /:id/facturx.xml ──────────────────────────────────────────────────────
// Retourne le XML stocké avec Content-Type: application/xml
router.get("/:id/facturx.xml", async (req, res) => {
  try {
    const factureId = parseInt(req.params.id, 10);
    if (isNaN(factureId)) return res.status(400).json({ error: "ID invalide" });

    const clinicId = req.clinicId;
    if (!clinicId) return res.status(401).json({ error: "Non autorise" });

    const [facture] = await db
      .select({
        id: facturesTable.id,
        clinicId: facturesTable.clinicId,
        facturxXml: facturesTable.facturxXml,
        number: (facturesTable as any).number,
      })
      .from(facturesTable)
      .where(eq(facturesTable.id, factureId))
      .limit(1);

    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    if (facture.clinicId !== clinicId) return res.status(403).json({ error: "Acces interdit" });
    if (!facture.facturxXml) return res.status(404).json({ error: "XML Factur-X non genere" });

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="facture-${facture.number ?? factureId}.xml"`
    );
    return res.send(facture.facturxXml);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur recuperation XML" });
  }
});

// ── GET /:id/facturx.pdf ──────────────────────────────────────────────────────
// Redirige vers facturx_pdf_url ou 404
router.get("/:id/facturx.pdf", async (req, res) => {
  try {
    const factureId = parseInt(req.params.id, 10);
    if (isNaN(factureId)) return res.status(400).json({ error: "ID invalide" });

    const clinicId = req.clinicId;
    if (!clinicId) return res.status(401).json({ error: "Non autorise" });

    const [facture] = await db
      .select({
        id: facturesTable.id,
        clinicId: facturesTable.clinicId,
        facturxPdfUrl: facturesTable.facturxPdfUrl,
      })
      .from(facturesTable)
      .where(eq(facturesTable.id, factureId))
      .limit(1);

    if (!facture) return res.status(404).json({ error: "Facture introuvable" });
    if (facture.clinicId !== clinicId) return res.status(403).json({ error: "Acces interdit" });
    if (!facture.facturxPdfUrl) {
      return res.status(404).json({ error: "PDF Factur-X non disponible" });
    }

    return res.redirect(302, facture.facturxPdfUrl);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur recuperation PDF" });
  }
});

export default router;
