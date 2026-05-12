// Sprint 4B - Static veterinary drug contraindications (50 entries)
// ASCII-only strings for safe btoa encoding

export interface Contraindication {
  drug_a: string;
  drug_b: string;
  species?: string;
  severity: "CRITIQUE" | "MODERE" | "INFO";
  message: string;
}

export const CONTRAINDICATIONS: Contraindication[] = [
  { drug_a: "paracetamol", drug_b: "", species: "chat", severity: "CRITIQUE", message: "Paracetamol est LETHAL chez le chat. Contre-indication absolue." },
  { drug_a: "acetaminophen", drug_b: "", species: "chat", severity: "CRITIQUE", message: "Acetaminophen est LETHAL chez le chat. Ne jamais administrer." },
  { drug_a: "amoxicilline", drug_b: "", species: "lapin", severity: "CRITIQUE", message: "Amoxicilline peut provoquer une enterotoxemie fatale chez le lapin." },
  { drug_a: "ampicilline", drug_b: "", species: "lapin", severity: "CRITIQUE", message: "Ampicilline contre-indiquee chez le lapin: risque enteropathogie." },
  { drug_a: "lincomycine", drug_b: "", species: "lapin", severity: "CRITIQUE", message: "Lincomycine est fatale chez le lapin (dysbiose severe)." },
  { drug_a: "clindamycine", drug_b: "", species: "lapin", severity: "CRITIQUE", message: "Clindamycine contre-indiquee chez le lapin (dysbiose)." },
  { drug_a: "ivermectine", drug_b: "", species: "chien", severity: "CRITIQUE", message: "Ivermectine toxique chez chiens MDR1/ABCB1 (Colley, Berger, Bobtail)." },
  { drug_a: "milbemycine", drug_b: "", species: "chien", severity: "MODERE", message: "Milbemycine: prudence chez races MDR1+. Tester mutation avant usage." },
  { drug_a: "loperamide", drug_b: "", species: "chien", severity: "CRITIQUE", message: "Loperamide: accumulation SNC chez chiens MDR1 positifs. Eviter." },
  { drug_a: "ains", drug_b: "corticoide", severity: "CRITIQUE", message: "AINS + corticoide: risque ulcere gastrique et hemorragie digestive majeur." },
  { drug_a: "aspirine", drug_b: "ibuprofene", severity: "CRITIQUE", message: "Double AINS: toxicite digestive et renale cumulee. Contre-indique." },
  { drug_a: "meloxicam", drug_b: "ketoprofene", severity: "CRITIQUE", message: "Meloxicam + Ketoprofene: double AINS interdit." },
  { drug_a: "prednisolone", drug_b: "dexamethasone", severity: "CRITIQUE", message: "Double corticotherapie: suppression surrenalienne severe." },
  { drug_a: "enrofloxacine", drug_b: "", species: "chat", severity: "MODERE", message: "Enrofloxacine chez le chat: doses >5mg/kg/j risque de cecite (retinotoxicite)." },
  { drug_a: "fluoroquinolone", drug_b: "", species: "chat", severity: "MODERE", message: "Fluoroquinolones: retinotoxicite feline possible a haute dose." },
  { drug_a: "tetracycline", drug_b: "", species: "chiot", severity: "MODERE", message: "Tetracyclines contre-indiquees chez chiots < 6 mois (coloration dentaire)." },
  { drug_a: "doxycycline", drug_b: "", species: "chaton", severity: "MODERE", message: "Doxycycline chez chaton < 6 mois: risque coloration emaill dentaire." },
  { drug_a: "acepromazine", drug_b: "", species: "chien", severity: "MODERE", message: "Acepromazine: hypotension severe possible chez Boxer et brachycephales." },
  { drug_a: "xylazine", drug_b: "", species: "chat", severity: "MODERE", message: "Xylazine chez le chat: sensibilite 10x superieure au chien. Doses reduites." },
  { drug_a: "morphine", drug_b: "diazepam", severity: "MODERE", message: "Morphine + Diazepam: depression respiratoire potentialisee. Surveillance." },
  { drug_a: "ketamine", drug_b: "xylazine", species: "chat", severity: "MODERE", message: "Ketamine + Xylazine chez chat: apnee possible. Oxygenation obligatoire." },
  { drug_a: "metronidazole", drug_b: "phenobarbital", severity: "MODERE", message: "Metronidazole + Phenobarbital: neurotoxicite possible. Reduire doses." },
  { drug_a: "ciclosporine", drug_b: "ketoconazole", severity: "MODERE", message: "Ciclosporine + Ketoconazole: inhibition CYP3A4, hausse taux ciclosporine." },
  { drug_a: "digoxine", drug_b: "furosemide", severity: "MODERE", message: "Digoxine + Furosemide: hypokaliemie augmente toxicite digitale." },
  { drug_a: "enalapril", drug_b: "spironolactone", severity: "MODERE", message: "IECA + Spironolactone: risque hyperkaliemie. Surveiller kaliemie." },
  { drug_a: "phenobarbital", drug_b: "chloramphenicol", severity: "MODERE", message: "Phenobarbital + Chloramphenicol: inhibition metabolism, toxicite barbiturique." },
  { drug_a: "amiodarone", drug_b: "digoxine", severity: "MODERE", message: "Amiodarone + Digoxine: toxicite digitale augmentee. Contre-indique." },
  { drug_a: "atropine", drug_b: "metoclopramide", severity: "MODERE", message: "Atropine + Metoclopramide: effets antagonistes sur motilite intestinale." },
  { drug_a: "insuline", drug_b: "corticoide", severity: "MODERE", message: "Insuline + Corticoide: antagonisme glycemique. Adapter doses insuline." },
  { drug_a: "trimethoprime", drug_b: "sulfadiazine", species: "chat", severity: "MODERE", message: "Trimethoprime-Sulfa chez chat: risque keratoconjonctivite seche (KCS)." },
  { drug_a: "gentamicine", drug_b: "furosemide", severity: "MODERE", message: "Gentamicine + Furosemide: nephrotoxicite et ototoxicite cumulees." },
  { drug_a: "amikacine", drug_b: "furosemide", severity: "MODERE", message: "Amikacine + Furosemide: potentialisation nephrotoxique. Eviter." },
  { drug_a: "cisapride", drug_b: "ketoconazole", severity: "CRITIQUE", message: "Cisapride + Azoles: allongement QT, arythmie cardiaque fatale possible." },
  { drug_a: "cisapride", drug_b: "erythromycine", severity: "CRITIQUE", message: "Cisapride + Erythromycine: torsades de pointe, mort subite cardiaque." },
  { drug_a: "tramadol", drug_b: "ssri", severity: "MODERE", message: "Tramadol + SSRI: risque syndrome serotoninergique (agitation, hyperthermie)." },
  { drug_a: "tramadol", drug_b: "maoi", severity: "CRITIQUE", message: "Tramadol + IMAO: syndrome serotoninergique severe, contre-indique." },
  { drug_a: "fluorouracile", drug_b: "", species: "chat", severity: "CRITIQUE", message: "5-Fluorouracile: neurotoxicite fatale chez le chat. Contre-indique." },
  { drug_a: "benzocaine", drug_b: "", species: "chat", severity: "CRITIQUE", message: "Benzocaine (certaines pommades): methemoglobinemie fatale chez le chat." },
  { drug_a: "permethrine", drug_b: "", species: "chat", severity: "CRITIQUE", message: "Permethrine (antiparasitaires chien): neurotoxicite LETALE chez le chat." },
  { drug_a: "tea tree", drug_b: "", species: "chat", severity: "CRITIQUE", message: "Huile tea tree: hepatotoxicite et neurotoxicite severe chez chat et chien." },
  { drug_a: "xylitol", drug_b: "", species: "chien", severity: "CRITIQUE", message: "Xylitol: hypoglycemie severe et insuffisance hepatique aigue chez le chien." },
  { drug_a: "heparine", drug_b: "ains", severity: "CRITIQUE", message: "Heparine + AINS: risque hemorragique majeur. Association contre-indiquee." },
  { drug_a: "warfarine", drug_b: "ains", severity: "CRITIQUE", message: "Anticoagulants + AINS: potentialisation anticoagulation, hemorragie." },
  { drug_a: "methotrexate", drug_b: "trimethoprime", severity: "CRITIQUE", message: "Methotrexate + Trimethoprime: toxicite hematologique severe (folates)." },
  { drug_a: "cyclophosphamide", drug_b: "allopurinol", severity: "MODERE", message: "Cyclophosphamide + Allopurinol: augmentation toxicite cyclophosphamide." },
  { drug_a: "vincristine", drug_b: "itraconazole", severity: "MODERE", message: "Vincristine + Azoles: neuropathie augmentee (inhibition CYP3A4)." },
  { drug_a: "acepromazine", drug_b: "propofol", severity: "MODERE", message: "Acepromazine + Propofol: hypotension profonde. Reduire doses propofol." },
  { drug_a: "diazepam", drug_b: "propofol", severity: "INFO", message: "Diazepam + Propofol: depression SNC additive. Reduire induction." },
  { drug_a: "gabapentine", drug_b: "tramadol", severity: "INFO", message: "Gabapentine + Tramadol: sedation cumulee. Surveiller state conscience." },
  { drug_a: "phenobarbital", drug_b: "potassium bromure", severity: "INFO", message: "Phenobarbital + KBr: polydipsie-polyurie et pancreatite possible." },
];

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/acetaminophene/g, "paracetamol")
    .replace(/cortisone|prednisone|prednisolone|dexamethasone|betamethasone/g, "corticoide")
    .replace(/aspirine|ibuprofene|meloxicam|ketoprofene|carprofen|vedaprofene|tolfedine/g, "ains")
    .replace(/enrofloxacine|marbofloxacine|orbifloxacine|pradofloxacine/g, "fluoroquinolone")
    .replace(/gentamicine|amikacine|tobramycine/g, "aminoside")
    .replace(/fluoxetine|sertraline|paroxetine|citalopram/g, "ssri")
    .replace(/selegiline|phenelzine/g, "maoi");
}

export function checkContraindications(
  medicaments: string[],
  species?: string
): Contraindication[] {
  const found: Contraindication[] = [];
  const normalized = medicaments.map(normalize);

  for (const ci of CONTRAINDICATIONS) {
    const speciesMatch = !ci.species || (species && normalize(ci.species) === normalize(species));
    if (!speciesMatch) continue;

    for (const drug of normalized) {
      if (ci.drug_a && drug.includes(normalize(ci.drug_a))) {
        if (!ci.drug_b) {
          found.push(ci);
          break;
        }
        const hasDrugB = normalized.some(d => d.includes(normalize(ci.drug_b)));
        if (hasDrugB) {
          found.push(ci);
          break;
        }
      }
    }
  }

  return found;
}
