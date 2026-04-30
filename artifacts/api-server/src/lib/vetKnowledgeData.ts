—/**
 * Base de connaissances vétérinaires embarquée
 * Sources : ANMV (Agence Nationale du Médicament Vétérinaire), EMA (European Medicines Agency),
 *           RESAPATH (Réseau de Surveillance de l'Antibiorésistance des Pathogènes des Animaux)
 * Données compilées à partir des références officielles françaises/européennes.
 */

export interface KnowledgeEntry {
  source: "ANMV" | "EMA" | "RESAPATH";
  categorie: "medicament" | "antibiogramme" | "pathologie" | "protocole";
  titre: string;
  contenu: string;
  metadata?: Record<string, unknown>;
}

export const VET_KNOWLEDGE_DATA: KnowledgeEntry[] = [
  // ─────────────────────────────────────────────────────────────────
  // MÉDICAMENTS — ANMV / EMA
  // ─────────────────────────────────────────────────────────────────
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Amoxicilline-Acide clavulanique (Synulox®, Clavaseptin®)",
    contenu: `MOLÉCULE : Amoxicilline + acide clavulanique (bêtalactamine + inhibiteur de bêtalactamase)
ESPÈCES AUTORISÉES AMM : chien, chat
POSOLOGIE :
  - Per os : 12,5 à 25 mg/kg/12h (comprimés palatables)
  - IM/SC : 8,75 mg/kg/24h (solution injectable)
INDICATIONS : infections cutanées (pyodermite superficielle/profonde), infections urinaires, otites externes bactériennes, infections des voies respiratoires, abcès dentaires, morsures infectées.
DURÉE RECOMMANDÉE : 5-7j (infections superficielles), 14-28j (infections profondes, ostéomyélite), 7-14j (urinaires)
CONTRE-INDICATIONS : hypersensibilité aux bêtalactamines, insuffisance rénale sévère (ajuster la dose).
EFFETS INDÉSIRABLES : troubles gastro-intestinaux (vomissements, diarrhée), rare réaction d'hypersensibilité.
ANTIBIORÉSISTANCE : taux de résistance E. coli urinaire chien ≈ 20-30% (RESAPATH 2022). Privilégier antibiogramme si récidive.`,
    metadata: { molecules: ["amoxicilline", "acide clavulanique"], classes: ["bêtalactamine"], especes: ["chien", "chat"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Carprofène (Rimadyl®, Carprieve®, Norocarp®) — AINS",
    contenu: `MOLÉCULE : Carprofène (AINS — inhibiteur sélectif COX-2)
ESPÈCES AUTORISÉES AMM : chien (> 4 semaines), chat (usage unique injectable)
POSOLOGIE CHIEN : 4 mg/kg/j PO en 1 ou 2 prises (2 mg/kg × 2/j) ; 4 mg/kg SC/IV (injection unique péri-opératoire)
POSOLOGIE CHAT : 4 mg/kg SC dose unique (péri-opératoire uniquement — usage PO non autorisé)
INDICATIONS : douleur et inflammation musculo-squelettique, arthrose, douleur post-opératoire, affections des tissus mous.
DURÉE : usage long terme possible chez le chien avec surveillance biologique (NFS + bilan hépatique + rénale tous les 3-6 mois). Chat : dose unique uniquement.
CONTRE-INDICATIONS : insuffisance rénale ou hépatique, affections gastro-intestinales (ulcères, hémorragie), gestation avancée, moins de 4 semaines, association avec d'autres AINS ou corticoïdes.
EFFETS INDÉSIRABLES : hépato-toxicité (surveiller ALAT), insuffisance rénale, ulcères GI. Arrêter si vomissements, diarrhée, ictère, polyurie.
PROTECTION GASTRIQUE : oméprazole 0,7 mg/kg/j PO si traitement > 7 jours ou antécédents digestifs.`,
    metadata: { molecules: ["carprofène"], classes: ["AINS", "COX-2"], especes: ["chien", "chat"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Méloxicam (Metacam®, Loxicom®) — AINS",
    contenu: `MOLÉCULE : Méloxicam (AINS — inhibiteur préférentiel COX-2)
ESPÈCES AUTORISÉES AMM : chien, chat, lapin, bovins, porcs, chevaux
POSOLOGIE CHIEN : 0,2 mg/kg J1 (dose de charge), puis 0,1 mg/kg/j (maintenance). SC/IV péri-opératoire : 0,2 mg/kg.
POSOLOGIE CHAT : 0,3 mg/kg SC/IV (dose unique péri-opératoire). PO long terme déconseillé sauf protocole strict (0,025 mg/kg/j - hors AMM France).
POSOLOGIE LAPIN : 0,3-0,5 mg/kg/j PO
INDICATIONS : douleur et inflammation musculo-squelettique (arthrose, luxation de rotule), douleur post-chirurgicale, affections fébriles bovines.
CONTRE-INDICATIONS : insuffisance rénale (y compris compensée), hépatique ou cardiaque, troubles GI, gestation, lactation, moins de 6 semaines.
EFFETS INDÉSIRABLES : idem AINS — néphrotoxicité chez chat particulièrement (déshydratation = facteur aggravant). Toujours vérifier hydratation avant injection.
INTERACTION : ne pas associer à d'autres AINS, corticoïdes, anticoagulants.`,
    metadata: { molecules: ["méloxicam"], classes: ["AINS", "COX-2"], especes: ["chien", "chat", "lapin", "bovins"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Marbofloxacine (Marbocyl®) — Fluoroquinolone",
    contenu: `MOLÉCULE : Marbofloxacine (fluoroquinolone de 3ème génération)
ESPÈCES AUTORISÉES AMM : chien, chat, bovins (voie injectable)
POSOLOGIE CHIEN/CHAT : 2 mg/kg/j PO (comprimés) ; 2 mg/kg IM/SC (solution injectable)
POSOLOGIE ESCALADE : jusqu'à 5 mg/kg/j si germes moins sensibles (Pseudomonas : 5 mg/kg/j)
INDICATIONS : infections respiratoires (trachéobronchite, pneumonie), infections urinaires hautes, infections cutanées profondes (pyodermite, cellulite), infections ostéo-articulaires, septicémie.
DURÉE : 7-10 jours (infections superficielles à modérées), 14-28 jours (profondes, osseuses). Antibiogramme recommandé.
CONTRE-INDICATIONS : jeunes animaux en croissance (chien < 12 mois petite race, < 18 mois grande race — risque arthropathie), chats < 12 semaines. Association avec AINS sur insuffisant rénal.
EFFETS INDÉSIRABLES : troubles GI légers, arthropathie (jeunes), névrite optique rare (chat).
RÉSISTANCE CROISÉE : résistance croisée avec enrofloxacine (même classe). Un antibiogramme favorable à l'enrofloxacine est prédictif pour la marbofloxacine.
ANTIBIOTIQUE CRITIQUE OMS : fluoroquinolone = antibiotique critique — usage restreint aux cas cliniquement justifiés après antibiogramme.`,
    metadata: { molecules: ["marbofloxacine"], classes: ["fluoroquinolone"], especes: ["chien", "chat", "bovins"], critique: true },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Enrofloxacine (Baytril®) — Fluoroquinolone",
    contenu: `MOLÉCULE : Enrofloxacine (fluoroquinolone 2ème génération)
ESPÈCES AUTORISÉES AMM : chien, chat (dose réduite), bovins, porcs, volailles
POSOLOGIE CHIEN : 5 mg/kg/j PO ou SC/IM (une prise quotidienne)
POSOLOGIE CHAT : 2,5 mg/kg/j MAXIMUM — NE JAMAIS DÉPASSER. Rétinopathie irréversible à doses > 5 mg/kg chez le chat.
INDICATIONS : infections respiratoires, urinaires, cutanées, gastro-intestinales.
DURÉE : 5-10 jours. CHEZ LE CHAT : préférer la marbofloxacine ou la pradofloxacine (meilleure tolérance féline).
CONTRE-INDICATIONS ABSOLUES CHAT : > 5 mg/kg/j → cécité irréversible par dégénérescence rétinienne. Chien < 12 mois (petite race), < 18 mois (grande race).
EFFETS INDÉSIRABLES : nausées (donner avec nourriture), arthropathie jeunes, convulsions (surdosage).
ANTIBIOTIQUE CRITIQUE OMS : prescrit uniquement après antibiogramme favorable.
IMPORTANT CHAT : JAMAIS > 2,5 mg/kg/j. Préférer marbofloxacine ou pradofloxacine.`,
    metadata: { molecules: ["enrofloxacine"], classes: ["fluoroquinolone"], especes: ["chien", "chat", "bovins"], alerte_chat: true },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Céfovécine (Convenia®) — Céphalosporine 3ème génération injectable longue action",
    contenu: `MOLÉCULE : Céfovécine sodique (céphalosporine 3G — bêtalactamine)
ESPÈCES AUTORISÉES AMM : chien, chat
POSOLOGIE : 8 mg/kg SC (injection unique sous-cutanée)
DURÉE D'ACTION : 7-14 jours (demi-vie 6,9j chien, 5,6j chat)
INDICATIONS AMM : infections cutanées et des tissus mous (plaies, abcès, pyodermite), infections bucco-dentaires (gingivite, abcès).
AVANTAGE COMPLIANCE : idéal quand l'administration orale est impossible ou refusée. Propriétaire ne peut pas « oublier » la dose.
CONTRE-INDICATIONS : hypersensibilité aux bêtalactamines/céphalosporines. Insuffisance rénale sévère (accumulation).
EFFETS INDÉSIRABLES : douleur au site d'injection, réaction GI rare. Impossible d'arrêter le traitement en cas d'effet indésirable (durée fixe).
LIMITES : spectre insuffisant pour Pseudomonas, SARM/MRSP. Antibiogramme indispensable si récidive.
CÉPHALOSPORINE 3G : antibiotique critiquement important OMS — usage justifié uniquement si alternatives insuffisantes.`,
    metadata: { molecules: ["céfovécine"], classes: ["céphalosporine 3G", "bêtalactamine"], especes: ["chien", "chat"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Prednisolone / Prednisone — Corticostéroïde",
    contenu: `MOLÉCULE : Prednisolone (corticostéroïde — glucocorticoïde)
ESPÈCES : chien, chat (prednisolone préférable au chat car meilleure biodisponibilité orale)
POSOLOGIE ANTI-INFLAMMATOIRE : 0,5 à 1 mg/kg/j PO (chien), 1-2 mg/kg/j PO (chat, métabolisme plus rapide)
POSOLOGIE IMMUNOSUPPRESSEUR : 1-2 mg/kg/j (chien), 2-4 mg/kg/j (chat) — maladies immuno-médiées
DÉCROISSANCE OBLIGATOIRE : jamais arrêt brutal après > 7 jours. Réduire de 25-50% toutes les 1-2 semaines selon réponse.
INDICATIONS : dermatites allergiques, prurit, maladies auto-immunes (IMHA, LAPI, polyarthrite), choc anaphylactique (IV), œdème cérébral, bronchospasme.
CONTRE-INDICATIONS : diabète (hyperglycémie), infections actives non contrôlées (masque les signes d'infection), ulcères gastro-intestinaux, insuffisance rénale ou cardiaque décompensée.
EFFETS INDÉSIRABLES : syndrome de Cushing iatrogène (PU/PD, polyphagie, redistribution des graisses), alopécie, insuffisance surrénalienne au sevrage brutal, immunosuppression, atrophie musculaire.
PROTECTION GASTRIQUE : oméprazole ou sucralfate si traitement > 5 jours ou association AINS (contre-indiquée).`,
    metadata: { molecules: ["prednisolone", "prednisone"], classes: ["corticostéroïde"], especes: ["chien", "chat"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Dexaméthasone — Corticostéroïde injectable",
    contenu: `MOLÉCULE : Dexaméthasone (glucocorticoïde puissant — pouvoir 25× supérieur à hydrocortisone)
ESPÈCES : chien, chat, bovins, équins
POSOLOGIE ANTI-INFLAMMATOIRE : 0,1-0,2 mg/kg IV/IM/SC
POSOLOGIE ANTI-CHOC/URGENCE : 2-4 mg/kg IV lente (choc, œdème cérébral aigu)
POSOLOGIE ANTI-ALLERGIQUE/ANAPHYLAXIE : 0,5-1 mg/kg IV
INDICATIONS URGENCE : choc anaphylactique (avec adrénaline), œdème cérébral (traumatisme crânien), œdème laryngé, réaction d'hypersensibilité sévère.
DURÉE D'ACTION : 36-72h (action prolongée) — PAS DE DÉCROISSANCE OBLIGATOIRE pour usage unique.
CONTRE-INDICATIONS : idem prednisolone + usage systémique prolongé très limité (puissance élevée = effets iatrogènes importants).
DEXAMÉTHASONE LONG TERME : ÉVITER — préférer prednisolone pour traitements chroniques.`,
    metadata: { molecules: ["dexaméthasone"], classes: ["corticostéroïde"], especes: ["chien", "chat", "bovins"], urgence: true },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Métronidazole — Antiprotozoaire et antibactérien anaérobie",
    contenu: `MOLÉCULE : Métronidazole (nitroimidazole — antibactérien anaérobie + antiprotozoaire)
ESPÈCES : chien, chat (AMM + usage hors AMM)
POSOLOGIE : 15-25 mg/kg/12h PO (chien/chat) ; 25 mg/kg/24h en une prise possible
  GIARDIOSE : 25 mg/kg/12h × 5-7 jours
  INFECTIONS ANAÉROBIES : 15 mg/kg/8h (plus agressif)
INDICATIONS : giardiose, infections à bactéries anaérobies (abcès profonds, péritonite, infections bucco-dentaires), diarrhée bactérienne chronique (entérite à Clostridium), infections du SNC à anaérobies.
CONTRE-INDICATIONS : gestation (tératogène au 1er trimestre), jeunes < 6 semaines, insuffisance hépatique sévère (métabolisation hépatique), troubles neurologiques préexistants.
EFFETS INDÉSIRABLES : troubles neurologiques (neurotoxicité à hautes doses ou traitement prolongé > 14j) : ataxie, convulsions — arrêt immédiat si signes. Nausées, vomissements (donner avec repas).
DURÉE MAXIMALE : 5-7j (giardiose), 7-10j (anaérobies). Dépasser 14j augmente risque neurotoxicité.
INTERACTION : potentialise les anticoagulants oraux (coumarines).`,
    metadata: { molecules: ["métronidazole"], classes: ["nitroimidazole"], especes: ["chien", "chat"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Maropitant (Cerenia®) — Antiémétique",
    contenu: `MOLÉCULE : Maropitant (antagoniste des récepteurs NK1 — antiémétique central et périphérique)
ESPÈCES AUTORISÉES AMM : chien, chat
POSOLOGIE CHIEN :
  - Nausées/vomissements : 1 mg/kg SC ou 2 mg/kg PO × 1/j (jusqu'à 5 jours)
  - Prévention mal des transports : 8 mg/kg PO 1-2h avant voyage (chien uniquement)
  - Péri-anesthésique (réduction besoins anesthésiques) : 1 mg/kg SC 1h avant prémédication
POSOLOGIE CHAT : 1 mg/kg SC (préférer SC — biodisponibilité PO variable)
INDICATIONS : vomissements d'origines diverses (médicamenteux, métaboliques, mouvements), nausées postopératoires, prévention des vomissements sous chimiothérapie.
DURÉE : 5 jours maximum consécutifs (PO). SC : jusqu'à 5j.
CONTRE-INDICATIONS : gestation (données insuffisantes). Prudence insuffisance hépatique (métabolisation hépatique).
EFFETS INDÉSIRABLES : somnolence légère, douleur au site d'injection SC (solution acide — injecter lentement). Rare hypersalivation.
AVANTAGE PÉRI-OP : effet antidouleur viscéral (NK1) + réduction de 25% des besoins en anesthésiques = bénéfique en combinaison protocolaire.`,
    metadata: { molecules: ["maropitant"], classes: ["antiémétique", "NK1"], especes: ["chien", "chat"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Furosémide (Dimazon®, Furovet®) — Diurétique de l'anse",
    contenu: `MOLÉCULE : Furosémide (diurétique de l'anse de Henlé — inhibiteur Na-K-2Cl)
ESPÈCES : chien, chat, bovins, équins
POSOLOGIE CHIEN : 1-4 mg/kg/8-12h PO ; 1-4 mg/kg IM/IV en urgence
POSOLOGIE CHAT : 1-2 mg/kg/12-24h PO ; 0,5-2 mg/kg IV/IM urgence
INDICATION URGENCE OEDÈME PULMONAIRE : 2-4 mg/kg IV bolus → réévaluation 30-60 min → répéter si nécessaire
INDICATIONS CHRONIQUES : insuffisance cardiaque congestive (Stade B2/C/D — avec IECA + pimobendan), ascite, oedème, hypertension portale.
SURVEILLANCE : ionogramme (hypokaliémie, hyponatrémie fréquentes), créatinine (déshydratation), poids (ajuster dose).
CONTRE-INDICATIONS : déshydratation sévère, anurie, insuffisance rénale oligurique, hypokaliémie préexistante non corrigée.
EFFETS INDÉSIRABLES : hypokaliémie (supplémenter en K+ si traitement chronique), déshydratation, alcalose métabolique, ototoxicité (doses très élevées IV rapide).
SUPPLÉMENTATION POTASSIQUE : gluconate de potassium 1-3 mEq/kg/j PO si traitement chronique (> 2 semaines).`,
    metadata: { molecules: ["furosémide"], classes: ["diurétique"], especes: ["chien", "chat", "bovins"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Doxycycline — Antibiotique tétracycline",
    contenu: `MOLÉCULE : Doxycycline (tétracycline 2ème génération — bactériostatique)
ESPÈCES : chien, chat (hors AMM — usage justifié par activité antirickettsiale)
POSOLOGIE : 5-10 mg/kg/12h PO (dose divisée) ; 10 mg/kg/24h (dose unique)
ADMINISTRATION : TOUJOURS donner avec nourriture ou grand verre d'eau — risque d'œsophagite/ulcères oesophagiens (chat particulièrement à risque)
INDICATIONS : infections à Ehrlichia canis, Anaplasma phagocytophilum, Rickettsia spp, Borrelia burgdorferi (maladie de Lyme), Mycoplasmose féline (Mycoplasma haemofelis), Bordetella bronchiseptica, Chlamydophila felis (conjonctivite féline), infections respiratoires atypiques.
DURÉE : 21-28 jours pour ehrlichiose/anaplasmose/borréliose ; 14-21j respiratoires/Mycoplasma.
CONTRE-INDICATIONS : grossesse (dysgénésie osseuse/dentaire foetale), jeunes (< 6 mois — coloration dentaire), insuffisance hépatique sévère.
EFFETS INDÉSIRABLES : nausées (avec nourriture), photosensibilisation, vomissements. Chat : ulcères oesophagiens si comprimé collé dans l'oesophage → donner avec seringue d'eau (5 mL) après le comprimé.
CHAT : ADMINISTRER AVEC 5 ML D'EAU après le comprimé pour éviter l'oesophagite.`,
    metadata: { molecules: ["doxycycline"], classes: ["tétracycline"], especes: ["chien", "chat"], alerte_oesophage: true },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Kétamine — Anesthésique dissociatif (Stupéfiant)",
    contenu: `MOLÉCULE : Kétamine chlorhydrate (antagoniste NMDA — anesthésique dissociatif)
STATUT : STUPÉFIANT — ordonnance sécurisée obligatoire. Registre des stupéfiants. Coffre-fort réglementaire.
ESPÈCES : chien, chat, équins, bovins, petits ruminants, NAC
POSOLOGIE INDUCTION IV (chien/chat) : 5-10 mg/kg IV (en combinaison avec benzodiazépine ou alpha-2)
POSOLOGIE IM (chien/chat) : 10-20 mg/kg IM (en combinaison)
CRI (perfusion continue) : 0,2-0,6 mg/kg/h IV — analgésie péri-opératoire, hyperalgésie
PROTOCOLES COURANTS :
  - Kétamine + Médétomidine + Butorphanol (KMB) IM : chien/chat
  - Propofol induction puis kétamine CRI : maintien antalgique
  - Kétamine + Diazépam IV : induction chez patient à risque cardiaque
PROPRIÉSÉS : maintien des réflexes laryngés (utile), bronchodilatateur, stimulant cardiaque (tachycardie — CI dans hyperthyroïdie féline), augmentation PIC (CI traumatisme crânien controversé).
CONTRE-INDICATIONS RELATIVES : hypertension, insuffisance cardiaque à débit élevé, épilepsie non contrôlée, hyperthyroïdie (chat), traumatisme crânien avec HTIC.
EFFETS INDÉSIRABLES : rigidité musculaire (prémédicater avec benzodiazépine), hypersalivation, émergence agitée.`,
    metadata: { molecules: ["kétamine"], classes: ["anesthésique", "NMDA"], statut: "stupéfiant", especes: ["chien", "chat"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Oméprazole — Inhibiteur de la pompe à protons (IPP)",
    contenu: `MOLÉCULE : Oméprazole (inhibiteur de la pompe à protons — IPP)
ESPÈCES : chien, chat (hors AMM — usage courant justifié), équins (Gastrogard®)
POSOLOGIE CHIEN : 0,7-1 mg/kg/j PO à jeun (1h avant repas pour absorption optimale)
POSOLOGIE CHAT : 0,5-1 mg/kg/j PO (comprimés à avaler entier — ne pas écraser)
INDICATIONS : prévention et traitement des ulcères gastroduodénaux (médicamenteux : AINS, corticoïdes), gastrite hémorragique, reflux gastro-oesophagien, syndrome de Zollinger-Ellison, vomissements bilieux.
PROTECTION GASTRIQUE PRÉVENTIVE OBLIGATOIRE : associer oméprazole si AINS > 7 jours + antécédents digestifs OU corticoïdes > 7 jours OU combinaison AINS+corticoïdes (jamais associer directement).
DURÉE : 2-4 semaines (traitement), long terme possible sous surveillance (ulcères chroniques).
EFFETS INDÉSIRABLES : bien toléré. Long terme > 8 semaines : hypomagnesémie possible, risque d'hypochlorhydrie (bacterial overgrowth). Discontinuer progressivement après traitement prolongé.
NE PAS ÉCRASER : les comprimés à enrobage entérique perdent leur effet si écrasés. Utiliser forme liquide ou comprimés sécables appropriés.`,
    metadata: { molecules: ["oméprazole"], classes: ["IPP", "gastroprotecteur"], especes: ["chien", "chat"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Amoxicilline (Amoxicare®, Betamox®) — Bêtalactamine",
    contenu: `MOLÉCULE : Amoxicilline (aminopénicilline — bêtalactamine)
ESPÈCES AMM : chien, chat, bovins, porcs, lapins
POSOLOGIE CHIEN/CHAT : 10-20 mg/kg/12h PO ; 7 mg/kg/24h IM/SC injectable
POSOLOGIE LAPIN : 5-10 mg/kg/24h SC (PO déconseillé — dysbiose intestinale)
INDICATIONS : infections respiratoires simples (bronchite, rhinite), infections urinaires basses non récidivantes, infections cutanées superficielles, plaies récentes.
AVANTAGES/LIMITES : spectre limité (pas active sur bêtalactamases) — pour germes sensibles documentés ou infections communautaires simples. Préférer amoxicilline-clavulanate si suspicion résistance.
CONTRE-INDICATIONS : hypersensibilité bêtalactamines, lapin (PO déconseillé — risque entérocolite mortelle).
DURÉE : 5-7 jours (infections simples), 10-14 jours (urinaires).`,
    metadata: { molecules: ["amoxicilline"], classes: ["bêtalactamine"], especes: ["chien", "chat", "bovins", "lapin"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Robenacoxib (Onsior®) — AINS sélectif COX-2 (chat)",
    contenu: `MOLÉCULE : Robenacoxib (AINS — inhibiteur très sélectif COX-2)
ESPÈCES AUTORISÉES AMM : chien ET CHAT (AINS le mieux toléré chez le chat pour usage PO répété)
POSOLOGIE CHAT : 1-2,4 mg/kg/j PO (comprimés) — 1 comprimé de 6mg si poids 2,5-6 kg
POSOLOGIE CHIEN : 1-2 mg/kg/j PO
AVANTAGE FÉLIN : meilleure tolérance rénale et GI que méloxicam ou carprofène chez le chat pour traitement prolongé de l'arthrose.
INDICATIONS : douleur et inflammation musculo-squelettique, arthrose féline, douleur post-opératoire (injectable Onsior).
DURÉE CHAT : jusqu'à 6 jours PO autorisé dans AMM ; études de sécurité jusqu'à 12 semaines.
CONTRE-INDICATIONS : insuffisance rénale (même légère), hépatique, cardiaque, trouble GI, gestation.
EFFETS INDÉSIRABLES : vomissements (moins que méloxicam), néphrotoxicité possible si déshydratation.
SURVEILLER : créatinine + ionogramme si traitement > 7 jours chez le chat.`,
    metadata: { molecules: ["robenacoxib"], classes: ["AINS", "COX-2"], especes: ["chat", "chien"] },
  },
  {
    source: "ANMV",
    categorie: "medicament",
    titre: "Clindamycine (Antirobe®) — Lincosamide",
    contenu: `MOLÉCULE : Clindamycine (lincosamide — antibiotique bactériostatique à bactéricide)
ESPÈCES : chien, chat (AMM)
POSOLOGIE : 5-10 mg/kg/12h PO (chien) ; 25 mg/kg/24h PO (chat) — bonne biodisponibilité orale
INDICATIONS : infections osseuses et articulaires (ostéomyélite — excellente pénétration osseuse), abcès dentaires et périostite, pyodermite profonde, toxoplasmose (chat — 12,5-25 mg/kg/12h × 4 semaines), infections à anaérobies.
AVANTAGE MAJEUR : excellente pénétration tissu osseux et articulaire — 1er choix ostéomyélite si Staphylocoque sensible.
CONTRE-INDICATIONS : herbivores (lapins, cochons d'Inde, hamsters — entérocolite pseudomembraneuse mortelle), maladies hépatiques sévères.
DURÉE : ostéomyélite 4-8 semaines ; pyodermite profonde 4-6 semaines ; dentaire 5-7 jours.
EFFETS INDÉSIRABLES : troubles GI (vomissements, diarrhée — donner avec nourriture), hépatotoxicité rare.`,
    metadata: { molecules: ["clindamycine"], classes: ["lincosamide"], especes: ["chien", "chat"] },
  },

  // ─────────────────────────────────────────────────────────────────
  // ANTIBIOGRAMMES — RESAPATH 2020-2023
  // ─────────────────────────────────────────────────────────────────
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "E. coli — Infections urinaires chien (RESAPATH 2022)",
    contenu: `BACTÉRIE : Escherichia coli — isolats urinaires chien
SOURCE : RESAPATH rapport 2022 (Réseau surveillance antibiorésistance France)
TAUX DE RÉSISTANCE (%) observés en France — chiens :
  - Ampicilline : 50-60% résistance
  - Amoxicilline seule : 50-60% résistance (idem ampicilline)
  - Amoxicilline-acide clavulanique : 20-30% résistance
  - Triméthoprime-sulfamides (TMP-SMZ) : 30-40% résistance
  - Tétracyclines : 40-55% résistance
  - Fluoroquinolones (enrofloxacine, marbofloxacine) : 25-35% résistance
  - Céphalosporines 3G (céftiofur) : 10-20% résistance (producteurs de BLSE en hausse)
  - Amikacine : < 5% résistance (molécule de réserve)
  - Nitrofurantoïne (usage vétérinaire limité) : < 10% résistance
INTERPRÉTATION CLINIQUE :
  - L'antibiogramme est indispensable pour les infections urinaires récidivantes.
  - En 1ère intention infection urinaire basse non compliquée: amoxicilline-clavulanate (si E. coli probable, résistance 20-30%).
  - En cas d'échec ou infection haute : antibiogramme obligatoire avant escalade fluoroquinolone.
  - Fluoroquinolones UNIQUEMENT sur antibiogramme favorable (résistance 25-35% en France).
  - BLSE E. coli : options limitées → carbapénèmes (usage exceptionnel, médecine spécialisée).`,
    metadata: { bacterie: "E. coli", site: "urinaire", espece: "chien", annee: 2022 },
  },
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "E. coli — Infections urinaires chat (RESAPATH 2022)",
    contenu: `BACTÉRIE : Escherichia coli — isolats urinaires chat
SOURCE : RESAPATH rapport 2022
TAUX DE RÉSISTANCE (%) observés en France — chats :
  - Ampicilline : 45-55% résistance
  - Amoxicilline-acide clavulanique : 15-25% résistance
  - Fluoroquinolones : 20-30% résistance
  - Céphalosporines 3G : 8-15% résistance
  - TMP-SMZ : 25-35% résistance
  - Amikacine : < 5% résistance
RECOMMANDATION THÉRAPEUTIQUE :
  - 1ère intention (infection basse simple) : amoxicilline-clavulanate PO 12,5 mg/kg/12h × 7-10j
  - Réévaluation obligatoire si pas d'amélioration à 72h → antibiogramme urine
  - Fluoroquinolones chez le chat : PRUDENCE — enrofloxacine max 2,5 mg/kg/j (rétinopathie), préférer marbofloxacine 2 mg/kg/j
  - CU/PU récidivantes : exclure diabète, hyperthyroïdie, PNK avant antibiothérapie prolongée.`,
    metadata: { bacterie: "E. coli", site: "urinaire", espece: "chat", annee: 2022 },
  },
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "Staphylococcus pseudintermedius — Dermatologie chien (RESAPATH 2022)",
    contenu: `BACTÉRIE : Staphylococcus pseudintermedius — isolats dermatologiques chien (principal pathogène cutané canin)
SOURCE : RESAPATH rapport 2022
TAUX DE RÉSISTANCE (%) observés en France — chiens :
  - Pénicilline G (ampicilline) : 70-80% résistance (bêtalactamase)
  - Amoxicilline seule : 70-80% résistance
  - Amoxicilline-acide clavulanique : 20-30% résistance (si non-MRSP)
  - MRSP (Méticilline-Résistant Staph. pseudintermedius) : 15-25% des isolats
    → Si MRSP : résistance à TOUTES les bêtalactamines (amoxicilline, cloxacilline, céfovécine, céfalexine)
  - Céfalexine (céphalosporine 1G) : 20-30% résistance
  - Clindamycine : 30-40% résistance si MRSP, 10-20% si non-MRSP
  - Fluoroquinolones : 35-50% résistance si MRSP, 15-25% si non-MRSP
  - Chloramphénicol : 70-80% sensibilité (alternative MRSP, usage topique préférable)
  - Rifampicine : 85-95% sensibilité (jamais en monothérapie — résistance rapide)
  - Linézolide/Vancomycine : réservés médecine humaine — usage vétérinaire interdit en France
CONDUITE À TENIR :
  - Pyodermite superficielle primo-infection : amoxicilline-clavulanate 14-21j ou céfalexine 12,5-25 mg/kg/12h.
  - Récidive ou échec : ANTIBIOGRAMME OBLIGATOIRE pour détecter MRSP.
  - MRSP confirmé : traitements topiques intensifs (shampooings chlorhexidine 3-4%/sem), clindamycine (si sensible), consultation dermatologue vétérinaire.`,
    metadata: { bacterie: "Staphylococcus pseudintermedius", site: "cutané", espece: "chien", annee: 2022 },
  },
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "Pseudomonas aeruginosa — Otologie chien (RESAPATH 2022)",
    contenu: `BACTÉRIE : Pseudomonas aeruginosa — isolats otologiques chien (otite externe/interne)
SOURCE : RESAPATH rapport 2022
CARACTÈRE : résistance naturelle élevée + capacité acquisitions résistances → pathogène parmi les plus résistants
TAUX DE RÉSISTANCE (%) chiens :
  - Amoxicilline : 95%+ résistance NATURELLE
  - Amoxicilline-clavulanate : 90%+ résistance NATURELLE
  - Céfalexine/Céfovécine : 85-90% résistance NATURELLE
  - TMP-SMZ : 70-80% résistance
  - Fluoroquinolones (systémiques — enrofloxacine, marbofloxacine) : 30-50% résistance → ANTIBIOGRAMME OBLIGATOIRE
  - Amikacine : 20-30% résistance (usage topique plus efficace que systémique)
  - Ticarcilline (topique oreille) : 25-35% résistance
  - Polymyxine B/Colistine (topique) : < 10% résistance (réservé usage topique)
TRAITEMENT OTITE À PSEUDOMONAS :
  → Traitement topique EN PRIORITÉ : nettoyage Tris-EDTA + chlorhexidine 0,05-0,15% + gouttes spécifiques selon antibiogramme (amikacine locale, ticarcilline locale)
  → Traitement systémique : UNIQUEMENT si otite moyenne/interne. Antibiogramme obligatoire. Marbofloxacine 5 mg/kg/j × 21-42j si sensible.
  → JAMAIS de traitement systémique aveugle à Pseudomonas sans antibiogramme.
  → Référence spécialiste dermatologue/oto-rhino vétérinaire si récidivant.`,
    metadata: { bacterie: "Pseudomonas aeruginosa", site: "otologique", espece: "chien", annee: 2022 },
  },
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "Pasteurella multocida — Morsures et infections chat (RESAPATH 2022)",
    contenu: `BACTÉRIE : Pasteurella multocida — isolats plaies/morsures chat et chien
SOURCE : RESAPATH rapport 2022
CARACTÈRE : naturellement sensible à la plupart des bêtalactamines (bonne nouvelle !)
TAUX DE SENSIBILITÉ (%) — chats/chiens :
  - Amoxicilline seule : 85-95% sensibilité
  - Amoxicilline-acide clavulanique : 90-97% sensibilité
  - Doxycycline : 80-90% sensibilité
  - TMP-SMZ : 75-85% sensibilité
  - Fluoroquinolones : 85-95% sensibilité
  - Chloramphénicol : 80-90% sensibilité
  - Clindamycine : ATTENTION — 30-50% résistance naturelle (Pasteurella souvent R aux lincosamides)
  - Méticilline/Cloxacilline : variable — peut être résistante (pas d'indication pour Pasteurella)
TRAITEMENT MORSURES DE CHAT (abcès Pasteurella spp.) :
  → Amoxicilline-clavulanate PO 12,5-25 mg/kg/12h × 7-10j = traitement de 1ère intention
  → Doxycycline si intolérance bêtalactamines : 10 mg/kg/j × 7-10j
  → Drainage chirurgical de l'abcès indispensable en complément
  → Antibiogramme si récidive ou échec à 72h.`,
    metadata: { bacterie: "Pasteurella multocida", site: "plaie/morsure", espece: "chat", annee: 2022 },
  },
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "Klebsiella pneumoniae — Infections urinaires chien (RESAPATH 2022)",
    contenu: `BACTÉRIE : Klebsiella pneumoniae — isolats urinaires chien
SOURCE : RESAPATH rapport 2022
CARACTÈRE : résistance naturelle aux aminopénicillines (ampicilline, amoxicilline) — bêtalactamase chromosomique constitutive
TAUX DE RÉSISTANCE (%) — chiens :
  - Ampicilline/Amoxicilline : 85-95% résistance NATURELLE
  - Amoxicilline-clavulanate : 25-40% résistance
  - TMP-SMZ : 25-40% résistance
  - Fluoroquinolones : 20-35% résistance
  - Céphalosporines 3G (céftiofur) : 15-25% résistance (BLSE en hausse)
  - Amikacine : 5-10% résistance
  - Carbapénèmes (usage réservé médecine humaine) : < 5% résistance
RECOMMANDATION :
  → Antibiogramme OBLIGATOIRE pour Klebsiella — résistances imprévisibles.
  → Ne jamais traiter à l'amoxicilline seule (résistance naturelle).
  → Amoxicilline-clavulanate en 1ère intention si sensible à l'antibiogramme.
  → En cas de BLSE : carbapénèmes (usage spécialisé uniquement — zoonose potentielle).
  → Identifier et corriger le facteur prédisposant (lithiase, anomalie anatomique).`,
    metadata: { bacterie: "Klebsiella pneumoniae", site: "urinaire", espece: "chien", annee: 2022 },
  },
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "Staphylococcus aureus / Streptococcus canis — Infections diverses chien/chat",
    contenu: `BACTÉRIE : Streptococcus canis et Staphylococcus aureus — isolats divers chien/chat
SOURCE : RESAPATH rapport 2022
STREPTOCOCCUS CANIS :
  - Amoxicilline : > 95% sensibilité (rarement résistant — bêtalactamine de choix)
  - Amoxicilline-clavulanate : > 95% sensibilité
  - Clindamycine : 80-90% sensibilité
  - Macrolides (érythromycine) : 75-85% sensibilité
  - Fluoroquinolones : 70-80% sensibilité (moins indiquées — résistance naturelle relative)
  - Traitement : amoxicilline PO 10-20 mg/kg/12h × 7-14j est suffisant pour Streptococcus canis

STAPHYLOCOCCUS AUREUS (important pour médecins vétérinaires — zoonose potentielle) :
  - SARM (Staphylocoque aureus Résistant Méticilline) : 10-20% des isolats canins
  - Amoxicilline-clavulanate : 60-70% sensibilité (si non-SARM)
  - Clindamycine : 60-70% sensibilité (si non-SARM)
  - TMP-SMZ : 75-85% sensibilité
  - Amikacine : 80-90% sensibilité
  - Si SARM : consultation spécialiste infectiologue vétérinaire.
  - Risque zoonotique SARM : hygiène des mains, isolement animaux infectés.`,
    metadata: { bacterie: "Streptococcus canis / S. aureus", site: "divers", espece: "chien chat", annee: 2022 },
  },
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "Proteus mirabilis — Infections urinaires et otologiques chien",
    contenu: `BACTÉRIE : Proteus mirabilis — isolats urinaires et otologiques chien
SOURCE : RESAPATH rapport 2022
CARACTÈRE : résistance naturelle à la colistine/polymyxine, à la tétracycline et nitrofurantoïne
TAUX DE RÉSISTANCE (%) — chiens :
  - Ampicilline/Amoxicilline : 15-25% résistance (moins résistant que E. coli)
  - Amoxicilline-clavulanate : 10-20% résistance
  - TMP-SMZ : 20-30% résistance
  - Fluoroquinolones : 20-30% résistance
  - Céphalosporines 1G (céfalexine) : 10-20% résistance
  - Céphalosporines 3G : 8-15% résistance
  - Amikacine : < 5% résistance
TRAITEMENT OTITE À PROTEUS :
  → Amoxicilline-clavulanate systémique si sensible + traitement topique
  → Résistance aux tétracyclines NATURELLE — ne jamais prescrire doxycycline pour Proteus.
  → Antibiogramme recommandé si récidive.`,
    metadata: { bacterie: "Proteus mirabilis", site: "urinaire/otologique", espece: "chien", annee: 2022 },
  },
  {
    source: "RESAPATH",
    categorie: "antibiogramme",
    titre: "Principes antibiorésistance — Règles d'or vétérinaires (RESAPATH/OMS)",
    contenu: `PRINCIPES D'ANTIBIOTHÉRAPIE RAISONNÉE EN MÉDECINE VÉTÉRINAIRE
Source : RESAPATH / OMS / EMA (Plan Ecoantibio France)

ANTIBIOTIQUES CRITIQUES OMS (interdits sans antibiogramme en médecine vétérinaire) :
  1. Fluoroquinolones (enrofloxacine, marbofloxacine, pradofloxacine) — Groupe A critique
  2. Céphalosporines 3ème et 4ème génération (céfovécine, céfpodoxime) — Groupe A critique
  3. Carbapénèmes (imipénème, méropénème) — RÉSERVÉS médecine humaine
  4. Colistine/Polymyxine — usage topique local vétérinaire uniquement

RÈGLES D'OR :
  1. DIAGNOSTIC AVANT TRAITEMENT : toujours identifier le site infectieux et le germe probable avant prescrire.
  2. ANTIBIOGRAMME OBLIGATOIRE : récidives, infections profondes, résistances suspectées.
  3. DURÉE MINIMALE EFFICACE : ne pas prolonger inutilement. Arrêter à 48h si pas d'amélioration.
  4. TRAITEMENT DE PREMIÈRE INTENTION : amoxicilline ou amoxicilline-clavulanate pour la plupart des infections communautaires.
  5. ESCALADE JUSTIFIÉE SEULEMENT : fluoroquinolones et céphalosporines 3G uniquement sur antibiogramme favorable.
  6. PAS D'ANTIBIOTIQUE PRÉVENTIF : sauf protocoles chirurgicaux spécifiques (antibioprophylaxie périopératoire).

RAPPORT BÉNÉFICE/RISQUE À ÉVALUER SYSTÉMATIQUEMENT : la pression de sélection sur la résistance est une externalité qui dépasse le cas individuel.`,
    metadata: { type: "guidelines", source_org: "OMS/RESAPATH/EMA" },
  },

  // ─────────────────────────────────────────────────────────────────
  // PROTOCOLES ANESTH.ASIQUES — REFERENCE
  // ─────────────────────────────────────────────────────────────────
  {
    source: "EMA",
    categorie: "protocole",
    titre: "Protocole anesthésique chien ASA I-II — Chirurgie élective",
    contenu: `PROTOCOLE ANESTHÉSIQUE STANDARD CHIEN ASA I-II (chirurgie élective)
Basé sur les recommandations de l'ESAVS (European School of Advanced Veterinary Studies)

PRÉMÉDICATION (IM, 20-30 min avant induction) :
  Option A (standard) : Médétomidine 5-20 µg/kg + Butorphanol 0,2 mg/kg IM
  Option B (si agité) : Médétomidine 10-20 µg/kg + Méthadone 0,3 mg/kg IM + Maropitant 1 mg/kg SC
  Option C (douleur préopératoire) : Dexmédétomidine 5-10 µg/kg + Morphine 0,5 mg/kg IM

INDUCTION (IV, cathéter veineux) :
  - Propofol 4-6 mg/kg IV titré (lent, sur 30-60 secondes) — 1er choix
  - Alfaxalone 2-3 mg/kg IV titré — alternative (meilleure marge de sécurité)
  - Kétamine 5 mg/kg + Diazépam 0,25 mg/kg IV — si risque cardiaque ou manque de voie IV stable

ENTRETIEN :
  - Isoflurane 1,5-2% (FiO2 40-60%) en circuit fermé ou semi-fermé
  - Analgésie CRI si douleur per-opératoire : Morphine 0,1-0,3 mg/kg/h IV ou Kétamine 0,2-0,6 mg/kg/h IV

RÉVEIL : Atipamézole (antagoniste alpha-2) 5× la dose médétomidine en µg = dose atipamézole µg/kg IM

ANALGÉSIE POST-OP :
  - AINS (carprofène 4 mg/kg/j ou méloxicam 0,2 mg/kg J1 → 0,1 mg/kg/j) dès réveil complet
  - Buprenorphine 0,02 mg/kg IM/IV toutes 6-8h si douleur modérée-sévère
  - Maropitant 1 mg/kg SC pour nausées post-op`,
    metadata: { type: "protocole_anesthesie", espece: "chien", asa: "I-II" },
  },
  {
    source: "EMA",
    categorie: "protocole",
    titre: "Protocole anesthésique chat ASA I-II — Chirurgie élective",
    contenu: `PROTOCOLE ANESTHÉSIQUE STANDARD CHAT ASA I-II (chirurgie élective)
Basé sur les recommandations de l'ISFM (International Society of Feline Medicine) et ESAVS

PRÉMÉDICATION (IM, 20-30 min avant induction) :
  Option A (standard) : Dexmédétomidine 10-20 µg/kg + Butorphanol 0,2-0,4 mg/kg IM
  Option B (douleur) : Dexmédétomidine 10-20 µg/kg + Méthadone 0,3-0,5 mg/kg IM + Maropitant 1 mg/kg SC
  Option C (stressé/difficile) : Protocole Tiletamine-Zolazépam (Zoletil®) 2-4 mg/kg IM (induction distante)

INDUCTION :
  - Alfaxalone 2-3 mg/kg IV titré (1er choix chat — meilleure tolérance que propofol)
  - Propofol 4-6 mg/kg IV titré (apnée possible — avoir atropine prête)
  - Kétamine 5-7 mg/kg + Médétomidine 0,05-0,08 mg/kg IM (si sans voie IV)

ENTRETIEN :
  - Isoflurane 1,5-2% ou Sévoflurane 2,5-3% (sévoflurane préférable chez chat — réveil plus doux)

RÉVEIL : Atipamézole 5× dose médétomidine µg IM (chat : diluer 10× pour précision)

ANALGÉSIE POST-OP :
  - Robenacoxib 1-2 mg/kg PO/SC (meilleur AINS pour usage répété chez le chat)
  - Buprenorphine 0,02 mg/kg IV/IM toutes 4-6h si douleur modérée-sévère
  - NE PAS utiliser : carprofène PO long terme, paracétamol (toxique chat), aspirine (toxique chat)

SPÉCIFICITÉS CHAT :
  - Hyperthermie peropératoire fréquente → surveiller T°, refroidir si > 39,5°C
  - Hypothermie post-op → réchauffement actif (couverture chauffante)
  - Enrofloxacine : MAX 2,5 mg/kg/j si antibiothérapie post-op`,
    metadata: { type: "protocole_anesthesie", espece: "chat", asa: "I-II" },
  },
];
