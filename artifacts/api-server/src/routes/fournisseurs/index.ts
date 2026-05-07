import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "../../../db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── GET /api/fournisseurs ─── Liste des fournisseurs
router.get("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const rows = await db.execute(sql`
      SELECT f.*,
        COUNT(c.id)::int AS nb_commandes,
        MAX(c.order_date) AS derniere_commande
      FROM fournisseurs f
      LEFT JOIN commandes_fournisseurs c ON c.fournisseur_id = f.id
      WHERE f.clinic_id = ${clinicId} AND f.active = true
      GROUP BY f.id
      ORDER BY f.name
    `);
    res.json({ data: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/fournisseurs ─── Créer un fournisseur
router.post("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { name, contact, email, phone, address, siret, paymentConditions } = req.body;
    if (!name) return res.status(400).json({ error: "name requis" });
    const [row] = await db.execute(sql`
      INSERT INTO fournisseurs (clinic_id, name, contact, email, phone, address, siret, payment_conditions)
      VALUES (${clinicId}, ${name}, ${contact||null}, ${email||null}, ${phone||null}, ${address||null}, ${siret||null}, ${paymentConditions||null})
      RETURNING *
    `);
    res.status(201).json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/fournisseurs/:id ─── Modifier un fournisseur
router.put("/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { name, contact, email, phone, address, siret, paymentConditions } = req.body;
    const [row] = await db.execute(sql`
      UPDATE fournisseurs SET
        name = COALESCE(${name}, name),
        contact = COALESCE(${contact||null}, contact),
        email = COALESCE(${email||null}, email),
        phone = COALESCE(${phone||null}, phone),
        address = COALESCE(${address||null}, address),
        siret = COALESCE(${siret||null}, siret),
        payment_conditions = COALESCE(${paymentConditions||null}, payment_conditions)
      WHERE id = ${Number(req.params.id)} AND clinic_id = ${clinicId}
      RETURNING *
    `);
    if (!row) return res.status(404).json({ error: "Fournisseur non trouvé" });
    res.json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/fournisseurs/:id ─── Désactiver un fournisseur
router.delete("/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    await db.execute(sql`UPDATE fournisseurs SET active = false WHERE id = ${Number(req.params.id)} AND clinic_id = ${clinicId}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/fournisseurs/commandes ─── Liste des commandes
router.get("/commandes", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { status } = req.query;
    const whereStatus = status ? `AND c.status = '${String(status)}'` : "";
    const rows = await db.execute(sql.raw(`
      SELECT c.*, f.name AS fournisseur_name, f.email AS fournisseur_email,
        COUNT(l.id)::int AS nb_lignes
      FROM commandes_fournisseurs c
      JOIN fournisseurs f ON f.id = c.fournisseur_id
      LEFT JOIN commande_lignes l ON l.commande_id = c.id
      WHERE c.clinic_id = '${clinicId}' ${whereStatus}
      GROUP BY c.id, f.name, f.email
      ORDER BY c.order_date DESC
    `));
    res.json({ data: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/fournisseurs/commandes ─── Créer une commande
router.post("/commandes", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { userId } = (req as any).auth || {};
    const { fournisseurId, expectedDate, notes, lignes } = req.body;
    if (!fournisseurId || !lignes?.length) return res.status(400).json({ error: "fournisseurId et lignes requis" });

    // Calculer totaux
    let totalHt = 0;
    for (const l of lignes) {
      totalHt += Number(l.quantity) * Number(l.unitPrice);
    }
    const totalTva = totalHt * 0.20;
    const totalTtc = totalHt + totalTva;

    // Numéro de commande auto
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const count = await db.execute(sql`SELECT COUNT(*)::int AS n FROM commandes_fournisseurs WHERE clinic_id = ${clinicId}`);
    const orderNumber = `CMD-${today}-${String((count.rows[0] as any).n + 1).padStart(4, "0")}`;

    const [cmd] = await db.execute(sql`
      INSERT INTO commandes_fournisseurs (clinic_id, fournisseur_id, order_number, order_date, expected_date, total_ht, total_tva, total_ttc, notes, created_by)
      VALUES (${clinicId}, ${Number(fournisseurId)}, ${orderNumber}, CURRENT_DATE, ${expectedDate||null}, ${totalHt}, ${totalTva}, ${totalTtc}, ${notes||null}, ${userId||null})
      RETURNING *
    `);

    // Insérer les lignes
    for (const l of lignes) {
      const lineHt = Number(l.quantity) * Number(l.unitPrice);
      await db.execute(sql`
        INSERT INTO commande_lignes (commande_id, stock_item_id, designation, reference, quantity, unit_price, tva_rate, total_ht)
        VALUES (${(cmd as any).id}, ${l.stockItemId||null}, ${l.designation}, ${l.reference||null},
                ${Number(l.quantity)}, ${Number(l.unitPrice)}, ${Number(l.tvaRate)||20}, ${lineHt})
      `);
    }

    res.status(201).json({ data: { ...(cmd as any), orderNumber } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/fournisseurs/commandes/:id ─── Détail d'une commande + lignes
router.get("/commandes/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const cmd = await db.execute(sql`
      SELECT c.*, f.name AS fournisseur_name, f.email AS fournisseur_email, f.address AS fournisseur_address, f.siret AS fournisseur_siret
      FROM commandes_fournisseurs c
      JOIN fournisseurs f ON f.id = c.fournisseur_id
      WHERE c.id = ${Number(req.params.id)} AND c.clinic_id = ${clinicId}
      LIMIT 1
    `);
    if (!cmd.rows.length) return res.status(404).json({ error: "Commande non trouvée" });

    const lignes = await db.execute(sql`
      SELECT l.*, si.name AS stock_item_name, si.reference AS stock_item_ref
      FROM commande_lignes l
      LEFT JOIN stock_items si ON si.id = l.stock_item_id
      WHERE l.commande_id = ${Number(req.params.id)}
      ORDER BY l.id
    `);

    res.json({ data: { commande: cmd.rows[0], lignes: lignes.rows } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/fournisseurs/commandes/:id/status ─── Changer le statut
router.put("/commandes/:id/status", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status requis" });

    await db.execute(sql`
      UPDATE commandes_fournisseurs SET status = ${status}, updated_at = NOW()
      WHERE id = ${Number(req.params.id)} AND clinic_id = ${clinicId}
    `);

    // Si RECUE → mettre à jour le stock automatiquement
    if (status === 'RECUE') {
      const lignes = await db.execute(sql`
        SELECT l.*, c.clinic_id FROM commande_lignes l
        JOIN commandes_fournisseurs c ON c.id = l.commande_id
        WHERE l.commande_id = ${Number(req.params.id)}
      `);
      for (const ligne of lignes.rows as any[]) {
        if (ligne.stock_item_id) {
          await db.execute(sql`
            INSERT INTO stock_movements (clinic_id, stock_item_id, type, quantity, unit_price, reference)
            VALUES (${clinicId}, ${ligne.stock_item_id}, 'ENTREE', ${Number(ligne.quantity)}, ${Number(ligne.unit_price)}, ${`CMD-${req.params.id}`})
          `);
          await db.execute(sql`
            UPDATE stock_items SET current_stock = current_stock + ${Number(ligne.quantity)}, updated_at = NOW()
            WHERE id = ${ligne.stock_item_id} AND clinic_id = ${clinicId}
          `);
        }
      }
    }

    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
