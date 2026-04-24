# Checklist RGPD — Vet-AI-Consult

**Rôle Guillaume** : responsable du traitement **et** DPO de fait (petite structure < 250 employés).
**Scope** : données des clients cabinets vétérinaires (vétérinaires, secrétaires) + **données des propriétaires d'animaux** (portail).

> Avertissement : ce document est un support opérationnel, pas un avis juridique. En cas de doute, consulter un avocat spécialisé RGPD.

---

## 1. Base légale des traitements

| Traitement | Base légale | Justification |
|---|---|---|
| Comptes vétérinaires / employés clinique | Exécution du contrat | Nécessaire au service |
| Données de santé animale | Obligation légale (Code rural) + intérêt légitime | Tenue du dossier médical |
| Contacts propriétaires (nom, tel, email) | Intérêt légitime | Communication vétérinaire ↔ propriétaire |
| Portail client (connexion anonyme via token) | Consentement implicite (à expliciter) | Accès aux données de l'animal |
| Logs techniques (IP, user-agent) | Intérêt légitime | Sécurité + debug |
| Analytics (si activé) | Consentement | À demander au 1er accès |
| Communication commerciale | Consentement explicite | Op-in via interface |

---

## 2. Registre des traitements (simplifié)

À maintenir dans un doc dédié (Google Doc ou le repo privé). Pour chaque traitement :

- Nom du traitement
- Finalité(s)
- Base légale
- Données collectées (par catégorie)
- Durée de conservation
- Destinataires (internes, sous-traitants)
- Transferts hors UE (oui/non, garanties)
- Sécurité (chiffrement, contrôle d'accès)
- DPIA nécessaire ? (Data Protection Impact Assessment)

**Traitements principaux identifiés** :
1. Gestion des dossiers médicaux animaux
2. Facturation
3. Portail propriétaire
4. IA consultation / ordonnance (sous-traitant Anthropic)
5. Authentification (sous-traitant Clerk)
6. Emails transactionnels (sous-traitant Resend)
7. Logs / monitoring (Sentry)

---

## 3. Sous-traitants (DPA requis)

| Sous-traitant | Rôle | DPA signé ? | Localisation |
|---|---|---|---|
| Railway | Hébergement + DB | À vérifier — https://railway.com/legal/dpa | USA (avec SCC) |
| Clerk | Auth | À signer — https://clerk.com/dpa | USA (avec SCC) |
| Anthropic | IA | DPA standard — https://www.anthropic.com/legal/dpa | USA (avec SCC) |
| Google Cloud Storage | Stockage fichiers | DPA via GCP | UE / USA selon bucket |
| Resend | Emails | À vérifier | USA |
| OVH | DNS + email | DPA FR | France |
| Sentry | Monitoring erreurs | À vérifier | USA (avec SCC) |
| GitHub | Code source | Microsoft DPA | USA |

**Action** : centraliser tous les DPA signés dans `docs/legal/dpa/`.

### Transferts hors UE
Tous les sous-traitants US utilisent des Standard Contractual Clauses (SCC). À préciser dans le registre.
Alternative : migrer GCS vers bucket UE uniquement (europe-west1).

---

## 4. Durées de conservation

| Donnée | Durée | Base |
|---|---|---|
| Dossier médical animal | 5 ans après la dernière consultation | Art. R. 242-45 Code rural |
| Facture | 10 ans | Code commerce |
| Logs techniques | 1 an (6 mois activité, 12 archives) | Recommandation CNIL |
| Cookies analytics | 13 mois max | Guidelines CNIL |
| Contacts propriétaires inactifs | 3 ans après dernière interaction | Intérêt légitime |
| Comptes vétérinaires (post-résiliation) | 30 jours puis anonymisation | Délai de grâce |
| Tokens portail | Révoqués au 1ᵉʳ usage ou expiration 30j | Sécurité |

**Action** : implémenter les purges automatiques (jobs cron) — à développer.

---

## 5. Droits des personnes

### 5.1 Implémentation backend à prévoir

| Droit | Endpoint | Priorité |
|---|---|---|
| Accès (export) | `GET /api/rgpd/export?ownerId=…` → ZIP JSON + PDFs | P1 |
| Rectification | UI existante (modif fiche owner) | ✅ fait |
| Effacement | `DELETE /api/rgpd/owner/:id` → anonymisation | P1 |
| Opposition | Toggle "refuser toute communication" sur la fiche owner | P2 |
| Portabilité | Même endpoint export P1 | P1 |
| Limitation | Flag `blocked` sur compte vétérinaire | P3 |

**Note** : l'effacement en clinique vétérinaire est complexe — le dossier médical a une obligation de conservation légale qui prime sur le droit à l'oubli. Anonymisation = remplacer nom/coordonnées par "[anonymisé]" mais garder les données cliniques.

### 5.2 Délai de réponse
- 1 mois par défaut
- Extension possible à 3 mois sur demandes complexes (avec information du demandeur)

### 5.3 Process opérationnel
1. Réception demande (email `privacy@vetoai.fr` à créer)
2. Vérification identité (copie CNI ou token signé via portail)
3. Traitement (idéalement via endpoint dédié P1 ci-dessus)
4. Envoi réponse + preuve de traitement
5. Log dans registre des demandes (obligatoire 3 ans)

---

## 6. Notification de violation (breach)

**Obligation RGPD** : CNIL dans les 72h si risque pour les droits et libertés.

### Checklist si breach suspecté
- [ ] Isoler + préserver (cf. INCIDENT-RESPONSE.md §4)
- [ ] Évaluer impact : nombre de personnes, type de données (médicales = sensibles)
- [ ] Décision **notifier CNIL ou pas** — en cas de doute, notifier
- [ ] Notification CNIL : formulaire https://www.cnil.fr/professionnel/notifier-une-violation-de-donnees-personnelles
- [ ] Si "risque élevé" : notifier aussi les personnes concernées (propriétaires + vétérinaires)
- [ ] Documenter tout : horodatage, décisions prises, pourquoi

---

## 7. Mentions légales & politique de confidentialité

### Page "Politique de confidentialité" (obligatoire sur le site public)
Doit contenir :
- Identité du responsable de traitement
- Finalités
- Base légale
- Destinataires
- Durées de conservation
- Droits + moyen de les exercer
- Coordonnées DPO
- Existence de décision automatisée (IA ordonnance, oui partiellement)

**Template** : adapter un modèle CNIL ou payer un avocat une fois, puis maintenir.
À créer dans `artifacts/vetcare/src/pages/legal/privacy.tsx`.

### Mentions dans l'UI
- Pop-up cookies à la 1ʳᵉ visite (si analytics activé)
- Note sur les écrans formulaires avec données sensibles : "Vos données sont protégées, voir notre politique"
- Bouton "Exporter mes données" dans les paramètres portail propriétaire

---

## 8. Sécurité technique

### 8.1 Contrôles en place
- TLS partout (Railway default)
- Auth MFA possible via Clerk (à encourager)
- Rate limiting (cf. SECURITY-AUDIT-L2.md)
- Logs sans données sensibles (pino tronque)
- Chiffrement au repos Postgres (Railway default)

### 8.2 À implémenter
- [ ] Chiffrement champ `notes` consultation au repos (AES côté app) — optionnel, à discuter vs coût dev
- [ ] Audit log applicatif (qui a consulté quel dossier quand)
- [ ] Masquage automatique des exports pour les agents techniques (ex : dev qui regarde les logs)

---

## 9. Formation

- Guillaume + chaque futur collaborateur doit lire ce document à l'embauche
- Signature d'une charte informatique annexée au contrat
- Revue annuelle du registre + DPA (date fixée : 1ᵉʳ janvier)

---

## 10. Sources & références

- Texte RGPD : https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Guide CNIL PME : https://www.cnil.fr/fr/les-pme
- Modèle de registre : https://www.cnil.fr/fr/la-tenue-dun-registre-des-traitements
- Violations de données : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles
- Code de déontologie vétérinaire : https://www.ordre.veterinaire.fr/deontologie

---

## Checklist rapide (à cocher trimestriellement)

- [ ] Registre à jour
- [ ] DPA sous-traitants à jour
- [ ] Test restore DB effectué
- [ ] Scan gitleaks clean
- [ ] Purges automatiques fonctionnent (consultations >5 ans, logs >1 an)
- [ ] Politique confidentialité publiée et à jour
- [ ] Incident review (0 ou ≥1 déclarés CNIL ?)
- [ ] Formation équipe à jour
