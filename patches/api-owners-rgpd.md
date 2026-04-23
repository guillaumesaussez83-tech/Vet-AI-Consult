# Patch ciblé `artifacts/api-server/src/routes/owners/index.ts`

## P0-5 · RGPD PDF cross-tenant leak — patch minimal

Seule `buildRgpdPdf()` et son appelant `POST /:id/rgpd/generate` doivent changer.
Le reste du fichier reste identique à l'original.

### Changements à appliquer

**1. Remplacer la signature de `buildRgpdPdf`** (ligne 113) :

```ts
// AVANT
async function buildRgpdPdf(owner: typeof ownersTable.$inferSelect): Promise<Buffer> {
  const [clinique] = await db.select().from(parametresCliniqueTable).limit(1);
  // ...
}

// APRÈS
async function buildRgpdPdf(
  owner: typeof ownersTable.$inferSelect,
  clinicId: string,
): Promise<Buffer> {
  const [clinique] = await db
    .select()
    .from(parametresCliniqueTable)
    .where(eq(parametresCliniqueTable.clinicId, clinicId))
    .limit(1);
  // ...rest unchanged...
}
```

**2. Adapter l'appel côté route** (ligne 257) :

```ts
// AVANT
const pdfBuffer = await buildRgpdPdf(owner);

// APRÈS
const pdfBuffer = await buildRgpdPdf(owner, req.clinicId);
```

**3. Adapter l'appel à `getObjectEntityUploadURL`** (ligne 263) — l'API a changé
pour exiger `{clinicId, ownerUserId}` :

```ts
// AVANT
const uploadURL = await storage.getObjectEntityUploadURL();

// APRÈS
const auth = getAuth(req);
const uploadURL = await storage.getObjectEntityUploadURL({
  clinicId: req.clinicId,
  ownerUserId: auth?.userId ?? "system",
});
```

Et ajouter l'import en haut du fichier :

```ts
import { getAuth } from "@clerk/express";
```

## Justification

Aujourd'hui `buildRgpdPdf` lit **le premier enregistrement** de `parametres_clinique`
sans filtre `clinic_id`. Résultat : le PDF RGPD émis pour un owner de la clinique B
affiche le nom, l'adresse, le n° d'ordre, le responsable RGPD de la clinique A.
Document juridiquement invalide + fuite d'infos entre cliniques.

La correction filtre par `req.clinicId` (injecté par `extractClinic`).
