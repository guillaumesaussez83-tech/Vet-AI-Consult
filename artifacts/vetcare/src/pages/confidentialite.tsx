import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ConfidentialitePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Politique de confidentialité</h1>
      </div>

      <p className="text-sm text-muted-foreground">Dernière mise à jour : avril 2026</p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Responsable du traitement</h2>
        <p className="text-sm text-muted-foreground">
          Clinique Vétérinaire MonVeto Cogolin<br />
          Email : contact@monveto-cogolin.fr<br />
          Numéro SIRET : à renseigner
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Données collectées</h2>
        <p className="text-sm text-muted-foreground">
          Nous collectons les données suivantes dans le cadre de notre activité vétérinaire :
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Nom et prénom du propriétaire de l'animal</li>
          <li>Coordonnées : adresse postale, téléphone, adresse e-mail</li>
          <li>Informations sur l'animal : nom, espèce, race, sexe, date de naissance, poids, antécédents médicaux</li>
          <li>Données de santé vétérinaire : consultations, diagnostics, prescriptions, vaccinations</li>
          <li>Données de facturation : montants, modes de paiement, coordonnées bancaires (IBAN uniquement pour virements)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Finalités du traitement</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Gestion vétérinaire et suivi médical des animaux</li>
          <li>Facturation et gestion des paiements</li>
          <li>Rappels de vaccination et rendez-vous</li>
          <li>Tenue du carnet de santé numérique de l'animal</li>
          <li>Respect des obligations légales vétérinaires (registre des stupéfiants, etc.)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Base légale du traitement</h2>
        <p className="text-sm text-muted-foreground">
          Le traitement de vos données repose sur deux bases légales :
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li><strong>Intérêt légitime</strong> : pour la gestion de la relation vétérinaire et le suivi médical</li>
          <li><strong>Consentement explicite</strong> : recueilli lors de la création du dossier patient</li>
          <li><strong>Obligation légale</strong> : pour la tenue de certains registres réglementaires</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">5. Durée de conservation</h2>
        <p className="text-sm text-muted-foreground">
          Les données médicales et de facturation sont conservées pendant <strong>10 ans</strong> à compter de la dernière consultation,
          conformément aux obligations légales applicables à l'exercice vétérinaire.
          Les données de rappels et de communication sont conservées pendant 3 ans.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">6. Vos droits</h2>
        <p className="text-sm text-muted-foreground">
          Conformément au RGPD (Règlement UE 2016/679), vous disposez des droits suivants :
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li><strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles</li>
          <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes</li>
          <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données (sous réserve des obligations légales)</li>
          <li><strong>Droit à la limitation</strong> : restreindre le traitement de vos données</li>
          <li><strong>Droit d'opposition</strong> : vous opposer à certains traitements</li>
          <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Pour exercer ces droits, contactez-nous à :{" "}
          <a href="mailto:contact@monveto-cogolin.fr" className="text-primary underline">
            contact@monveto-cogolin.fr
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">7. Hébergement des données</h2>
        <p className="text-sm text-muted-foreground">
          Vos données sont hébergées chez <strong>OVHcloud</strong> (France), dans des datacenters situés sur le territoire français,
          conformément aux exigences du RGPD en matière de transferts de données.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">8. Réclamation</h2>
        <p className="text-sm text-muted-foreground">
          Si vous estimez que le traitement de vos données porte atteinte à vos droits, vous pouvez introduire une réclamation
          auprès de la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés) :{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            www.cnil.fr
          </a>
        </p>
      </section>
    </div>
  );
}
