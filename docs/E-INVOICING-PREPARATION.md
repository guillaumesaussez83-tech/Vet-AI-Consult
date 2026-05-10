# Préparation Facturation Électronique — VetoAI

## Contexte et calendrier réforme française

La réforme de la facturation électronique (B2B obligatoire) est structurée comme suit :

| Date | Étape |
|------|-------|
| **Sept 2026** | Obligation de **réception** pour toutes les entreprises |
| **Sept 2027** | Obligation d'**émission** pour les TPE/PME (dont les cliniques vétérinaires) |
| **2024-2026** | Immatriculation des PDP (Partenaires de Dématérialisation Publics) |

Le e-reporting B2C (transactions avec particuliers) suit un calendrier parallèle — les données de synthèse doivent être transmises à l'administration.

**Impact VetoAI :** Une clinique vétérinaire est une TPE (souvent SELARL). Elle doit pouvoir émettre des factures électroniques au format **Factur-X** (norme franco-européenne = PDF enrichi d'un fichier XML EN16931) d'ici septembre 2027. La préparation dès maintenant évite une refonte complète du module facturation.

---

## Profil cible

**Factur-X EN16931 / BASIC** — suffisant pour 99% des cas en clientèle vétérinaire :
- Couvre factures B2C (particuliers) et B2B (entreprises, élevages professionnels)
- Conforme EN16931 = base de la directive européenne
- Profil MINIMUM : obligatoire dès 2027
- Profil EXTENDED (EDI) : non requis pour démarrer, réservé aux grands comptes

---

## Gap Analysis — Champs Factur-X requis

### Table `clinics` (BG-4 = Seller)

| Champ Factur-X | Référence BT | Existe dans DB ? | Action |
|----------------|-------------|-----------------|--------|
| Nom entreprise | BT-27 | ✅ `name` | OK |
| SIRET | BT-30 | ✅ `siret` | OK |
| SIREN | BT-30 (alt) | ❌ | **ADD** `siren` |
| TVA intra | BT-31 | ❌ | **ADD** `tva_intra` |
| Pays ISO | BT-40 | ❌ | **ADD** `pays_iso2` DEFAULT 'FR' |
| Forme juridique | Légal | ❌ | **ADD** `forme_juridique` |
| Code NAF | Légal | ❌ | **ADD** `code_naf` DEFAULT '8520Z' |
| IBAN/BIC | BT-84 | ❌ | **ADD** `iban`, `bic`, `nom_compte_bancaire` |
| RCS | Mentions légales | ❌ | **ADD** `rcs_ville`, `rcs_numero` |

### Table `owners` (BG-7 = Buyer)

| Champ Factur-X | Référence BT | Existe dans DB ? | Action |
|----------------|-------------|-----------------|--------|
| Type client | Logique | ❌ | **ADD** `type_client` DEFAULT 'particulier' |
| Raison sociale | BT-44 | ❌ | **ADD** `raison_sociale` |
| SIRET acheteur | BT-46 | ❌ | **ADD** `siret` |
| TVA intra | BT-48 | ❌ | **ADD** `tva_intra` |
| Pays ISO | BT-55 | ❌ | **ADD** `pays_iso2` DEFAULT 'FR' |

### Table `factures` (BG-2)

| Champ | BT | Existe ? | Action |
|-------|-----|---------|--------|
| Type document | BT-3 | ❌ | **ADD** `code_type_document` '380' |
| Date échéance | BT-9 | ❌ | **ADD** `date_echeance` |
| Réf acheteur | BT-10 | ❌ | **ADD** `reference_acheteur` |
| Devise | BT-5 | ❌ | **ADD** `currency_iso` 'EUR' |
| Note | BT-22 | ❌ | **ADD** `note_facture` |
| Réf précédente | BT-25 | ❌ | **ADD** `reference_facture_precedente` |
| Code paiement | BT-81 | ❌ | **ADD** `mode_paiement_code` |
| Mention loi | L441-6 | ❌ | **ADD** `mention_loi` |
| Statut e-invoice | PDP | ❌ | **ADD** `statut_einvoice` 'draft' |

### Table `actes_consultations` (BG-25 = Lignes)

| Champ | BT | Existe ? | Action |
|-------|-----|---------|--------|
| Code article | BT-155 | ❌ | **ADD** `code_article` |
| Unité mesure | BT-130 | ❌ | **ADD** `unite_mesure_code` 'PCE' |
| Date réalisation | BT-134 | ❌ | **ADD** `date_realisation` |
| Code TVA | BT-151 | ❌ | **ADD** `code_tva` 'S' |
| Montant ligne HT | BT-131 | ❌ | **ADD** `montant_ligne_ht` |

---

## Calendrier réforme française

| Date | Étape |
|------|-------|
| Sept 2026 | Réception obligatoire pour toutes entreprises |
| Sept 2027 | Émission obligatoire TPE/PME |
| 2024-2026 | Immatriculation PDP |

## Gaps résiduels Phase 2

1. Génération XML Factur-X embarqué dans le PDF
2. Connexion PDP certifié
3. e-reporting B2C
4. Signature électronique PDF
5. Archivage légal 10 ans
6. Profil EXTENDED (grands comptes)

## Recommandations

- Intégrer lib Factur-X Node.js pour générer XML EN16931
- Connecter Chorus Pro pour B2G
- Workflow statuts : draft → to_be_sent → sent → acknowledged → paid
- Archivage PDF immuable (S3 + SHA256)
