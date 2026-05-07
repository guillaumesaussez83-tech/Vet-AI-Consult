import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "../../../db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── GET /api/stock ─── Liste des articles avec stock actuel + alertes
router.get("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { category, alert } = req.query;

    let whereExtra = "";
    if (category) whereExtra += ` AND si.category = '${String(category)}'`;
    if (alert === "low") whereExtra += " AND si.current_stock <= si.min_stock AND si.min_stock > 0";
    if (alert === "out") whereExtra += " AND si.current_stock <= 0";

    const items = await db.execute(sql.raw(`
      SELECT
        si.*,
        -- Prochaine péremption
        (SELECT MIN(sm.expiration_date) FROM stock_movements sm
         WHERE sm.stock_item_id = si.id AND sm.expiration_date >= CURRENT_DATE
           AND sm.type = 'ENTREE') AS next_expiration,
        -- Alerte péremption < 30j
        (SELECT COUNT(*) FROM stock_movements sm
         WHERE sm.stock_item_id = si.id AND sm.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
           AND sm.type = 'ENTREE') AS expiring_soon_count,
        -- Fournisseur
        f.name AS supplier_name
      FROM stock_items si
      LEFT JOIN fournisseurs f ON f.id = si.supplier_id
      WHERE si.clinic_id = '${clinicId}' AND si.active = true
      ${whereExtra}
      ORDER BY si.name
    `));

    // Stats globales
    const stats = await db.execute(sql.raw(`
      SELECT
        COUNT(*)::int AS total_articles,
        COUNT(CASE WHEN current_stock <= 0 THEN 1 END)::int AS ruptures,
        COUNT(CASE WHEN current_stock <= min_stock AND min_stock > 0 AND current_stock > 0 THEN 1 END)::int AS stocks_faibles,
        COALESCE(SUM(current_stock * unit_price_buy), 0)::numeric AS valeur_stock
      FROM stock_items
      WHERE clinic_id = '${clinicId}' AND active = true
    `));

    res.json({ data: { items: items.rows, stats: stats.rows[0] } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/stock ─── Créer un article
router.post("/", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { name, reference, category, unit, minStock, unitPriceBuy, unitPriceSell, tvaRate, supplierId, location } = req.body;
    if (!name) return res.status(400).json({ error: "name requis" });

    const [row] = await db.execute(sql`
      INSERT INTO stock_items (clinic_id, name, reference, category, unit, min_stock, unit_price_buy, unit_price_sell, tva_rate, supplier_id, location)
      VALUES (${clinicId}, ${name}, ${reference||null}, ${category||'MEDICAMENT'}, ${unit||'unité'},
              ${Number(minStock)||0}, ${Number(unitPriceBuy)||0}, ${Number(unitPriceSell)||0},
              ${Number(tvaRate)||20}, ${supplierId||null}, ${location||null})
      RETURNING *
    `);
    res.status(201).json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/stock/:id ─── Modifier un article
router.put("/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { id } = req.params;
    const { name, reference, category, unit, minStock, unitPriceBuy, unitPriceSell, tvaRate, supplierId, location, active } = req.body;

    const [row] = await db.execute(sql`
      UPDATE stock_items SET
        name = COALESCE(${name}, name),
        reference = COALESCE(${reference||null}, reference),
        category = COALESCE(${category}, category),
        unit = COALESCE(${unit}, unit),
        min_stock = COALESCE(${minStock !== undefined ? Number(minStock) : null}, min_stock),
        unit_price_buy = COALESCE(${unitPriceBuy !== undefined ? Number(unitPriceBuy) : null}, unit_price_buy),
        unit_price_sell = COALESCE(${unitPriceSell !== undefined ? Number(unitPriceSell) : null}, unit_price_sell),
        tva_rate = COALESCE(${tvaRate !== undefined ? Number(tvaRate) : null}, tva_rate),
        supplier_id = COALESCE(${supplierId||null}, supplier_id),
        location = COALESCE(${location||null}, location),
        active = COALESCE(${active !== undefined ? active : null}, active),
        updated_at = NOW()
      WHERE id = ${Number(id)} AND clinic_id = ${clinicId}
      RETURNING *
    `);
    if (!row) return res.status(404).json({ error: "Article non trouvé" });
    res.json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/stock/:id/mouvement ─── Enregistrer un mouvement de stock
router.post("/:id/mouvement", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { id } = req.params;
    const { userId } = (req as any).auth || {};
    const { type, quantity, unitPrice, expirationDate, batchNumber, reference, notes } = req.body;

    if (!type || !quantity) return res.status(400).json({ error: "type et quantity requis" });

    // Vérifier que l'article appartient à la clinique
    const check = await db.execute(sql`SELECT id, current_stock FROM stock_items WHERE id = ${Number(id)} AND clinic_id = ${clinicId} LIMIT 1`);
    if (!check.rows.length) return res.status(404).json({ error: "Article non trouvé" });

    const qty = type === 'SORTIE' ? -Math.abs(Number(quantity)) : Math.abs(Number(quantity));

    // Enregistrer le mouvement
    const [mvt] = await db.execute(sql`
      INSERT INTO stock_movements (clinic_id, stock_item_id, type, quantity, unit_price, expiration_date, batch_number, reference, notes, created_by)
      VALUES (${clinicId}, ${Number(id)}, ${type}, ${qty}, ${unitPrice ? Number(unitPrice) : null},
              ${expirationDate||null}, ${batchNumber||null}, ${reference||null}, ${notes||null}, ${userId||null})
      RETURNING *
    `);

    // Mettre à jour le stock actuel
    await db.execute(sql`
      UPDATE stock_items SET
        current_stock = current_stock + ${qty},
        updated_at = NOW()
      WHERE id = ${Number(id)} AND clinic_id = ${clinicId}
    `);

    // Vérifier alertes automatiques
    const updated = await db.execute(sql`SELECT current_stock, min_stock FROM stock_items WHERE id = ${Number(id)}`);
    const item = updated.rows[0] as any;
    if (Number(item.current_stock) <= 0) {
      await db.execute(sql`
        INSERT INTO stock_alerts (clinic_id, stock_item_id, alert_type)
        VALUES (${clinicId}, ${Number(id)}, 'OUT_OF_STOCK')
        ON CONFLICT DO NOTHING
      `).catch(() => {}); // ignore if table constraint issue
    } else if (Number(item.current_stock) <= Number(item.min_stock) && Number(item.min_stock) > 0) {
      await db.execute(sql`
        INSERT INTO stock_alerts (clinic_id, stock_item_id, alert_type)
        VALUES (${clinicId}, ${Number(id)}, 'LOW_STOCK')
        ON CONFLICT DO NOTHING
      `).catch(() => {});
    }

    res.status(201).json({ data: mvt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/stock/:id/mouvements ─── Historique des mouvements
router.get("/:id/mouvements", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;
    const { id } = req.params;

    const mvts = await db.execute(sql`
      SELECT * FROM stock_movements
      WHERE clinic_id = ${clinicId} AND stock_item_id = ${Number(id)}
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ data: mvts.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/stock/alertes ─── Toutes les alertes actives
router.get("/alertes/actives", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).clinicId;

    const alertes = await db.execute(sql`
      SELECT
        si.id, si.name, si.reference, si.category,
        si.current_stock, si.min_stock, si.unit,
        CASE
          WHEN si.current_stock <= 0 THEN 'OUT_OF_STOCK'
          WHEN si.current_stock <= si.min_stock AND si.min_stock > 0 THEN 'LOW_STOCK'
          ELSE NULL
        END AS alert_type,
        -- Péremptions proches
        (SELECT MIN(sm.expiration_date) FROM stock_movements sm
         WHERE sm.stock_item_id = si.id AND sm.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
           AND sm.type = 'ENTREE') AS expiration_proche
      FROM stock_items si
      WHERE si.clinic_id = ${clinicId} AND si.active = true
        AND (
          si.current_stock <= 0
          OR (si.current_stock <= si.min_stock AND si.min_stock > 0)
          OR EXISTS (
            SELECT 1 FROM stock_movements sm
            WHERE sm.stock_item_id = si.id AND sm.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
              AND sm.type = 'ENTREE'
          )
        )
      ORDER BY si.current_stock ASC
    `);
    res.json({ data: alertes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
