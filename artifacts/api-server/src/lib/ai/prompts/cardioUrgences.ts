/**
 * Catalogue des urgences cardiologiques « à ne jamais rater » (V1).
 *
 * Source : matière clinique figée, validée par un cardiologue. Chaque signal se
 * déclenche sur des déclencheurs verbatim (ce que rapporte le propriétaire)
 * et/ou des items d'examen (ce que constate le vétérinaire). Une détection
 * ratée = une urgence vitale manquée : ce catalogue privilégie la sécurité
 * (sur-signaler plutôt que rater).
 *
 * Données pures, sans dépendance, pour rester testables et réutilisables :
 * - injectées dans le prompt de diagnostic (`buildDiagnosticPrompt`) via
 *   `renderCardioUrgencesBlock()` ;
 * - réutilisables par le futur pré-filtre déterministe (matching verbatim,
 *   filet de sécurité indépendant du LLM) et par le workflow consultation.
 */

/** Les deux niveaux de gravité de la matière. */
export type NiveauUrgenceVitale = "alerte" | "alerte forte";

export interface SignalUrgenceCardio {
  /** Identifiant stable (slug) — clé et ancrage des tests / de la sortie. */
  id: string;
  /** Nom clinique du signal. */
  nom: string;
  /** Déclencheurs verbatim — ce que rapporte le propriétaire. */
  verbatim: string[];
  /** Items d'examen — ce que constate / dicte le vétérinaire. */
  examen: string[];
  /** Règle de seuil : ce qui distingue « alerte » de « alerte forte ». */
  seuil: string;
  /** Cause(s) mortelle(s) derrière le signal — à remonter même si peu probable. */
  causeMortelle: string;
  /** Règles cliniques spécifiques à ne pas oublier (Holter, 1re manifestation…). */
  reglesSpecifiques?: string[];
}

/** Version figée du catalogue (validation cardiologue). */
export const CATALOGUE_CARDIO_VERSION = "v1-2026-06-cardio";

export const SIGNAUX_URGENCE_CARDIO: readonly SignalUrgenceCardio[] = [
  {
    id: "detresse-respiratoire-aigue",
    nom: "Détresse respiratoire aiguë",
    verbatim: [
      "respire vite / fort / bouche ouverte",
      "halète sans avoir bougé",
      "du mal à respirer",
      "reste assis sans se coucher",
      "gencives bleues / grises",
      "commencé d'un coup / cette nuit",
    ],
    examen: [
      "FR au repos élevée",
      "dyspnée / orthopnée",
      "cyanose",
      "± bruit de galop",
      "T° < 37,5 °C",
      "FC > 200 (chat)",
    ],
    seuil:
      "Apparition aiguë + au moins 1 signe respiratoire majeur → alerte. " +
      "Chat + (galop OU T° < 37,5 °C OU FC > 200) → alerte forte.",
    causeMortelle:
      "Œdème pulmonaire / ICC décompensée, épanchement pleural, tamponnade.",
  },
  {
    id: "syncope-collapsus",
    nom: "Syncope / collapsus",
    verbatim: [
      "tombé / évanoui",
      "fait un malaise",
      "écroulé puis relevé",
      "arrive quand il court / s'excite / aboie",
      "tout mou d'un coup",
    ],
    examen: [
      "race sentinelle (Doberman, Boxer)",
      "arythmie auscultée",
      "antécédents familiaux",
    ],
    seuil:
      "Tout épisode syncopal → alerte. " +
      "Survenue à l'effort / excitation OU race prédisposée → alerte forte.",
    causeMortelle: "Trouble du rythme grave / risque de mort subite.",
    reglesSpecifiques: ["Un ECG normal ponctuel ne rassure PAS → Holter."],
  },
  {
    id: "paralysie-posterieure-aigue-tea",
    nom: "Paralysie postérieure aiguë + douleur (thrombo-embolie aortique)",
    verbatim: [
      "ne peut plus bouger l'arrière-train",
      "traîne ses pattes arrière d'un coup",
      "crie de douleur",
      "pattes arrière froides / dures",
      "brutalement",
    ],
    examen: [
      "absence de pouls fémoral",
      "membre(s) froid(s)",
      "coussinets pâles / cyanosés",
      "douleur majeure",
      "± souffle / galop",
    ],
    seuil:
      "Paralysie postérieure aiguë + (douleur OU froideur OU pouls absent) → alerte forte immédiate.",
    causeMortelle: "Thrombo-embolie aortique (TEA).",
    reglesSpecifiques: [
      "Peut être la 1re manifestation d'une cardiopathie jusque-là inconnue.",
    ],
  },
  {
    id: "bas-debit-choc-cardiogenique",
    nom: "Bas débit / choc cardiogénique",
    verbatim: [
      "complètement abattu / prostré",
      "il est froid",
      "ne réagit plus",
      "tout faible",
    ],
    examen: [
      "hypothermie",
      "muqueuses pâles",
      "TRC > 2 s",
      "pouls fémoral faible",
      "brady- ou tachycardie",
      "extrémités froides",
    ],
    seuil:
      "Hypothermie + (pouls faible OU muqueuses pâles OU prostration) → alerte forte.",
    causeMortelle: "Choc cardiogénique / décompensation à bas débit.",
    reglesSpecifiques: [
      "Distinguer avec / sans obstruction avant tout inotrope.",
    ],
  },
  {
    id: "distension-abdominale-aigue-tamponnade",
    nom: "Distension abdominale aiguë + abattement (tamponnade)",
    verbatim: [
      "son ventre a gonflé d'un coup",
      "ballonné et abattu",
      "tout faible et le ventre gros",
    ],
    examen: [
      "bruits cardiaques assourdis",
      "distension jugulaire",
      "pouls paradoxal / faible",
      "ascite",
      "silhouette cardiaque globuleuse",
    ],
    seuil:
      "Distension abdominale aiguë + (bruits assourdis OU jugulaires distendues OU pouls paradoxal) → alerte forte.",
    causeMortelle: "Épanchement péricardique avec tamponnade.",
    reglesSpecifiques: ["Péricardiocentèse urgente."],
  },
  {
    id: "arythmie-grave-auscultation",
    nom: "Arythmie grave à l'auscultation",
    verbatim: [
      "son cœur bat bizarre / trop vite / irrégulier",
      "(souvent une découverte d'examen, sans plainte du propriétaire)",
    ],
    examen: [
      "rythme irrégulier",
      "FC > 200 (chat) ou tachycardie marquée (chien)",
      "bradycardie sévère",
      "déficit pouls-cœur",
    ],
    seuil:
      "Arythmie marquée ou FC hors bornes → alerte. Associée à syncope / faiblesse → alerte forte.",
    causeMortelle: "TV / FV, fibrillation atriale rapide, ou BAV complet.",
    reglesSpecifiques: [
      "Arythmie fugace : un ECG ponctuel ne rassure pas → Holter.",
    ],
  },
];

/**
 * Rend le catalogue en bloc de prompt injectable dans `buildDiagnosticPrompt`.
 * Le bloc porte la règle de sécurité (forcer le signalement dans
 * `urgencesVitales`) puis les signaux détaillés.
 */
export function renderCardioUrgencesBlock(): string {
  const intro = [
    `RÈGLE DE SÉCURITÉ — URGENCES CARDIO « À NE JAMAIS RATER » (catalogue ${CATALOGUE_CARDIO_VERSION}, validé cardiologue) :`,
    `Pour CHACUN des ${SIGNAUX_URGENCE_CARDIO.length} signaux ci-dessous, examine l'ANAMNÈSE et l'EXAMEN CLINIQUE.`,
    `Si un déclencheur verbatim OU un item d'examen est présent, tu DOIS le signaler dans "urgencesVitales" :`,
    `- "niveau" = "alerte" ou "alerte forte" selon le seuil ;`,
    `- "declencheurs" = la liste des éléments RÉELLEMENT détectés dans le cas ;`,
    `- "causeMortelle" = à nommer même si elle est peu probable.`,
    `Ne JAMAIS omettre un signal détecté, même si un autre diagnostic est plus probable.`,
    `Mets "urgenceVitaleDetectee" à true dès qu'au moins un signal est déclenché.`,
  ].join("\n");

  const signaux = SIGNAUX_URGENCE_CARDIO.map((s, i) => {
    const lignes = [
      `${i + 1}. ${s.nom} [id: ${s.id}]`,
      `   - Déclencheurs (propriétaire) : ${s.verbatim.join(" ; ")}`,
      `   - Examen (vétérinaire) : ${s.examen.join(" ; ")}`,
      `   - Seuil : ${s.seuil}`,
      `   - Cause mortelle : ${s.causeMortelle}`,
    ];
    if (s.reglesSpecifiques?.length) {
      lignes.push(`   - Règles : ${s.reglesSpecifiques.join(" ; ")}`);
    }
    return lignes.join("\n");
  }).join("\n\n");

  return `${intro}\n\n${signaux}`;
}
