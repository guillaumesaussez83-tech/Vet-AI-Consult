import { Router } from "express";
import { db } from "@workspace/db";
import { facturesTable, consultationsTable, actesConsultationsTable, actesTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDayThisMonth = new Date(year, month, 1).toISOString().split("T")[0];
    const firstDayLastMonth = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const lastDayLastMonth = new Date(year, month, 0).toISOString().split("T")[0];
    const twelveMonthsAgo = new Date(year - 1, month + 1, 1).toISOString().split("T")[0];

    const allFactures = await db.select().from(facturesTable);
    const allConsultations = await db.select().from(consultationsTable);

    const todayConsultations = allConsultations.filter(c => c.date === todayStr);
    const paidFactures = allFactures.filter(f => f.statut === "payee");
    const totalEmis = allFactures.reduce((s, f) => s + (f.montantTTC ?? 0), 0);
    const totalEncaisse = paidFactures.reduce((s, f) => s + (f.montantTTC ?? 0), 0);

    // CA aujourd'hui = factures payées aujourd'hui (date paiement ou date émission)
    const todayPaidFactures = paidFactures.filter(f =>
      (f.datePaiement === todayStr) || (!f.datePaiement && f.dateEmission === todayStr)
    );
    const caAujourdhui = todayPaidFactures.reduce((s, f) => s + (f.montantTTC ?? 0), 0);
    const caAujourdhuiHT = todayPaidFactures.reduce((s, f) => s + (f.montantHT ?? 0), 0);
    const facturesEmisesAujourdhui = allFactures.filter(f => f.dateEmission === todayStr).length;
    const consultationsAujourdhui = todayConsultations.length;

    // Taux encaissement sur le mois en cours
    const thisMonthFactures = allFactures.filter(f =>
      f.dateEmission >= firstDayThisMonth && f.dateEmission <= todayStr
    );
    const thisMonthPaid = thisMonthFactures.filter(f => f.statut === "payee");
    const tauxEncaissement = thisMonthFactures.length > 0
      ? Math.round((thisMonthPaid.length / thisMonthFactures.length) * 100)
      : 0;

    // CA mensuel = factures payées dans le mois
    const caThisMonth = paidFactures
      .filter(f => (f.datePaiement ?? f.dateEmission) >= firstDayThisMonth && (f.datePaiement ?? f.dateEmission) <= todayStr)
      .reduce((s, f) => s + (f.montantTTC ?? 0), 0);
    const caLastMonth = paidFactures
      .filter(f => (f.datePaiement ?? f.dateEmission) >= firstDayLastMonth && (f.datePaiement ?? f.dateEmission) <= lastDayLastMonth)
      .reduce((s, f) => s + (f.montantTTC ?? 0), 0);

    const monthlyData: { month: string; ca: number; nbConsultations: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mPaidFactures = paidFactures.filter(f =>
        (f.datePaiement ?? f.dateEmission)?.startsWith(mStr)
      );
      const mConsultations = allConsultations.filter(c => c.date?.startsWith(mStr));
      monthlyData.push({
        month: mStr,
        ca: mPaidFactures.reduce((s, f) => s + (f.montantTTC ?? 0), 0),
        nbConsultations: mConsultations.length,
      });
    }

    const actesConso = await db
      .select({
        nomActe: sql<string>`COALESCE(${actesTable.nom}, ${actesConsultationsTable.description}, 'Acte libre')`,
        totalQuantite: sql<number>`sum(${actesConsultationsTable.quantite})`,
        totalValeur: sql<number>`sum(${actesConsultationsTable.quantite} * ${actesConsultationsTable.prixUnitaire})`,
      })
      .from(actesConsultationsTable)
      .leftJoin(actesTable, eq(actesConsultationsTable.acteId, actesTable.id))
      .groupBy(sql`COALESCE(${actesTable.nom}, ${actesConsultationsTable.description}, 'Acte libre')`)
      .orderBy(desc(sql`sum(${actesConsultationsTable.quantite})`))
      .limit(10);

    const parVeterinaire = allConsultations.reduce<Record<string, { nbConsultations: number; ca: number }>>((acc, c) => {
      if (!c.veterinaire) return acc;
      if (!acc[c.veterinaire]) acc[c.veterinaire] = { nbConsultations: 0, ca: 0 };
      acc[c.veterinaire].nbConsultations++;
      return acc;
    }, {});

    const facturesByConsultation = new Map(allFactures.map(f => [f.consultationId, f]));
    allConsultations.forEach(c => {
      if (!c.veterinaire) return;
      const f = facturesByConsultation.get(c.id);
      if (f) {
        parVeterinaire[c.veterinaire].ca += f.montantTTC ?? 0;
      }
    });

    const vetStats = Object.entries(parVeterinaire).map(([vet, data]) => ({
      veterinaire: vet,
      nbConsultations: data.nbConsultations,
      ca: data.ca,
      panierMoyen: data.nbConsultations > 0 ? data.ca / data.nbConsultations : 0,
    })).sort((a, b) => b.ca - a.ca);

    return res.json({
      kpis: {
        caAujourdhui,
        caAujourdhuiHT,
        facturesEmisesAujourdhui,
        consultationsAujourdhui,
        tauxEncaissement,
        caThisMonth,
        caLastMonth,
        evolutionMensuelle: caLastMonth > 0 ? Math.round(((caThisMonth - caLastMonth) / caLastMonth) * 100) : null,
      },
      monthly: monthlyData,
      topActes: actesConso,
      parVeterinaire: vetStats,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
