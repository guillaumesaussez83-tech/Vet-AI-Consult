import { Router } from "express";
import { db } from "@workspace/db";
import { ownersTable } from "@workspace/db";
import { CreateOwnerBody, GetOwnerParams, UpdateOwnerBody, UpdateOwnerParams, DeleteOwnerParams, ListOwnersQueryParams } from "@workspace/api-zod";
import { eq, ilike, or } from "drizzle-orm";

const router = Router();

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

    return res.json(owners.map(o => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
    })));
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
    return res.status(201).json({ ...owner, createdAt: owner.createdAt.toISOString() });
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

    return res.json({ ...owner, createdAt: owner.createdAt.toISOString() });
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

    return res.json({ ...owner, createdAt: owner.createdAt.toISOString() });
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

export default router;
