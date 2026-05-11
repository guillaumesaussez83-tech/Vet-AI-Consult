-- Migration 010: ajouter colonne est_stupefiant sur stock_items
-- et flaguer les stupéfiants réglementés (kétamine, Zoletil, morphine, etc.)

-- Ajouter la colonne booléenne
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS est_stupefiant BOOLEAN NOT NULL DEFAULT FALSE;

-- Index pour filtrage rapide
CREATE INDEX IF NOT EXISTS stock_items_stupefiant_idx ON stock_items(est_stupefiant) WHERE est_stupefiant = TRUE;

-- Migration 011: flaguer les stupéfiants connus par pattern sur le nom
UPDATE stock_items
SET est_stupefiant = TRUE
WHERE LOWER(nom) SIMILAR TO '%ketamine%'
   OR LOWER(nom) SIMILAR TO '%kétamine%'
   OR LOWER(nom) SIMILAR TO '%zoletil%'
   OR LOWER(nom) SIMILAR TO '%morphine%'
   OR LOWER(nom) SIMILAR TO '%fentanyl%'
   OR LOWER(nom) SIMILAR TO '%methadone%'
   OR LOWER(nom) SIMILAR TO '%méthadone%'
   OR LOWER(nom) SIMILAR TO '%tramadol%'
   OR LOWER(nom) SIMILAR TO '%butorphanol%'
   OR LOWER(nom) SIMILAR TO '%medetomidine%'
   OR LOWER(nom) SIMILAR TO '%médétomidine%'
   OR LOWER(nom) SIMILAR TO '%acepromazine%'
   OR LOWER(nom) SIMILAR TO '%acépromazine%'
   OR LOWER(nom) SIMILAR TO '%tiletamine%'
   OR LOWER(nom) SIMILAR TO '%tilétamine%';
