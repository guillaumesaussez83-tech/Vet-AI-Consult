import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ScrollText, Shield, FileText } from "lucide-react";

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" aria-label="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Informations légales</h1>
            <p className="text-xs text-muted-foreground">VétoAI — Logiciel vétérinaire</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <nav className="flex flex-wrap gap-2 text-sm">
          <a href="#mentions" className="text-primary hover:underline">Mentions légales</a>
          <span className="text-muted-foreground">·</span>
          <a href="#confidentialite" className="text-primary hover:underline">Confidentialité (RGPD)</a>
          <span className="text-muted-foreground">·</span>
          <a href="#cgu" className="text-primary hover:underline">CGU</a>
        </nav>

        <p className="text-xs text-muted-foreground">Dernière mise à jour : avril 2026</p>

        {/* === MENTIONS LÉGALES === */}
        <section id="mentions" className="scroll-mt-20 space-y-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">1. Mentions légales</h2>
          </div>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-base">Éditeur du site</h3>
            <p className="text-muted-foreground">
              <strong>VétoAI SAS</strong><br />
              [Adresse du siège social à compléter]<br />
              SIRET : [à compléter]<br />
              RCS : [Ville et numéro à compléter]<br />
              Capital social : [montant à compléter]<br />
              N° TVA intracommunautaire : [à compléter]<br />
              Directeur de la publication : [Nom du représentant légal à compléter]<br />
              Email : contact@vetoai.fr<br />
              Téléphone : [à compléter]
            </p>

            <h3 className="font-semibold text-base pt-2">Hébergeur</h3>
            <p className="text-muted-foreground">
              <strong>Railway Corp.</strong><br />
              548 Market St PMB 17126, San Francisco, California 94104, États-Unis<br />
              Site : <a href="https://railway.app" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">railway.app</a><br />
              <br />
              <em>(En cas de migration sur infrastructure européenne :)</em><br />
              <strong>OVH SAS</strong> — 2 rue Kellermann, 59100 Roubaix, France<br />
              Site : <a href="https://www.ovhcloud.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ovhcloud.com</a>
            </p>

            <h3 className="font-semibold text-base pt-2">Propriété intellectuelle</h3>
            <p className="text-muted-foreground">
              L'ensemble du contenu de ce site (textes, graphismes, logos, code) est la propriété exclusive de VétoAI SAS, sauf mention contraire. Toute reproduction, représentation, modification ou exploitation sans autorisation écrite préalable est interdite et constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle.
            </p>
          </div>
        </section>

        {/* === RGPD === */}
        <section id="confidentialite" className="scroll-mt-20 space-y-4 pt-6 border-t">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">2. Politique de confidentialité (RGPD)</h2>
          </div>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-base">Responsable du traitement</h3>
            <p className="text-muted-foreground">
              VétoAI SAS, représentée par [Nom du représentant légal], en sa qualité d'éditeur du logiciel SaaS VétoAI à destination des cliniques vétérinaires.
            </p>

            <h3 className="font-semibold text-base pt-2">Données personnelles collectées</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Données du vétérinaire utilisateur</strong> : nom, prénom, adresse email, numéro Ordre National des Vétérinaires (ONV), identifiant de connexion.</li>
              <li><strong>Données des propriétaires d'animaux</strong> : nom, prénom, adresse postale, téléphone, email.</li>
              <li><strong>Données des animaux</strong> : identification (nom, espèce, race, date de naissance, numéro de puce / tatouage), historique médical, ordonnances, vaccinations.</li>
              <li><strong>Données de facturation</strong> : montants, modes de paiement, dates.</li>
              <li><strong>Données techniques</strong> : adresse IP, journaux de connexion, identifiants de session.</li>
            </ul>

            <h3 className="font-semibold text-base pt-2">Finalités du traitement</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Gestion des dossiers patients vétérinaires (base légale : exécution du contrat de service).</li>
              <li>Tenue du registre des stupéfiants conformément à l'article R.5132-36 du Code de la santé publique (base légale : obligation légale).</li>
              <li>Émission de factures et conservation comptable (base légale : obligation légale, article L.123-22 du Code de commerce).</li>
              <li>Statistiques anonymisées d'usage du logiciel (base légale : intérêt légitime).</li>
              <li>Assistance au diagnostic via intelligence artificielle (base légale : exécution du contrat ; les données transmises au modèle d'IA sont anonymisées dans la mesure du possible).</li>
            </ul>

            <h3 className="font-semibold text-base pt-2">Destinataires des données</h3>
            <p className="text-muted-foreground">
              Les données sont accessibles aux seuls utilisateurs habilités de la clinique vétérinaire (vétérinaires, ASV). Sous-traitants techniques :
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Clerk Inc.</strong> — gestion de l'authentification (États-Unis, clauses contractuelles types).</li>
              <li><strong>Anthropic PBC</strong> — modèle d'IA Claude pour l'assistance au diagnostic (États-Unis, clauses contractuelles types).</li>
              <li><strong>Railway Corp.</strong> — hébergement applicatif.</li>
              <li><strong>Resend Inc.</strong> — envoi d'emails transactionnels.</li>
            </ul>

            <h3 className="font-semibold text-base pt-2">Durée de conservation</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li><strong>Dossiers médicaux animaux</strong> : 10 ans à compter de la dernière consultation (recommandation Ordre National des Vétérinaires).</li>
              <li><strong>Registre des stupéfiants</strong> : 10 ans (article R.5132-36 CSP).</li>
              <li><strong>Factures et données comptables</strong> : 10 ans (article L.123-22 Code de commerce).</li>
              <li><strong>Données de connexion</strong> : 12 mois maximum (LCEN).</li>
              <li><strong>Comptes utilisateurs inactifs</strong> : suppression après 3 ans d'inactivité.</li>
            </ul>

            <h3 className="font-semibold text-base pt-2">Droits des personnes concernées</h3>
            <p className="text-muted-foreground">
              Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants : <strong>accès, rectification, effacement, limitation, portabilité, opposition</strong>, et droit de retirer votre consentement à tout moment. Pour exercer ces droits, contactez : <a href="mailto:dpo@vetoai.fr" className="text-primary hover:underline">dpo@vetoai.fr</a>
            </p>
            <p className="text-muted-foreground">
              Vous pouvez également introduire une réclamation auprès de la <strong>CNIL</strong> (3 place de Fontenoy, 75007 Paris — <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
            </p>

            <h3 className="font-semibold text-base pt-2">Délégué à la protection des données (DPO)</h3>
            <p className="text-muted-foreground">
              Email : <a href="mailto:dpo@vetoai.fr" className="text-primary hover:underline">dpo@vetoai.fr</a><br />
              Courrier : VétoAI SAS — DPO, [Adresse à compléter]
            </p>

            <h3 className="font-semibold text-base pt-2">Sécurité</h3>
            <p className="text-muted-foreground">
              Les données sont chiffrées en transit (TLS 1.3) et au repos. L'accès est restreint par authentification multi-organisation (Clerk) avec gestion des rôles. Les données de santé animale ne sont pas considérées comme données de santé au sens de l'article 9 RGPD, mais bénéficient des mêmes mesures de sécurité.
            </p>
          </div>
        </section>

        {/* === CGU === */}
        <section id="cgu" className="scroll-mt-20 space-y-4 pt-6 border-t">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">3. Conditions générales d'utilisation</h2>
          </div>

          <div className="space-y-3 text-sm leading-relaxed">
            <h3 className="font-semibold text-base">Article 1 — Objet</h3>
            <p className="text-muted-foreground">
              Les présentes CGU régissent l'accès et l'utilisation du logiciel SaaS <strong>VétoAI</strong>, édité par VétoAI SAS, à destination des cliniques vétérinaires inscrites à l'Ordre National des Vétérinaires.
            </p>

            <h3 className="font-semibold text-base pt-2">Article 2 — Accès au service</h3>
            <p className="text-muted-foreground">
              L'accès est réservé aux professionnels vétérinaires titulaires d'un numéro ONV en cours de validité. La création d'un compte requiert l'acceptation des présentes CGU et de la politique de confidentialité. L'éditeur se réserve le droit de suspendre tout compte en cas d'usage non conforme.
            </p>

            <h3 className="font-semibold text-base pt-2">Article 3 — Disponibilité</h3>
            <p className="text-muted-foreground">
              L'éditeur s'engage à fournir le service avec une disponibilité cible de 99,5 % en moyenne mensuelle, hors fenêtres de maintenance planifiées (notifiées 48 h à l'avance). Aucune garantie de résultat n'est due, l'obligation étant de moyens.
            </p>

            <h3 className="font-semibold text-base pt-2">Article 4 — Responsabilités de l'utilisateur</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Saisir des données exactes et tenues à jour ;</li>
              <li>Conserver la confidentialité de ses identifiants ;</li>
              <li>Ne pas utiliser le service à des fins illicites ou contraires à la déontologie vétérinaire ;</li>
              <li>Vérifier systématiquement les suggestions formulées par l'intelligence artificielle, qui ne se substituent en aucun cas au jugement clinique du praticien ;</li>
              <li>Tenir à jour le registre des stupéfiants conformément à la réglementation en vigueur.</li>
            </ul>

            <h3 className="font-semibold text-base pt-2">Article 5 — Intelligence artificielle</h3>
            <p className="text-muted-foreground">
              Les fonctionnalités d'aide au diagnostic différentiel et de génération d'ordonnances sont fournies à titre indicatif. <strong>Le vétérinaire reste seul responsable de l'acte médical et de la prescription.</strong> L'éditeur ne saurait être tenu responsable d'un préjudice résultant d'une décision clinique fondée sur une suggestion de l'IA.
            </p>

            <h3 className="font-semibold text-base pt-2">Article 6 — Propriété intellectuelle</h3>
            <p className="text-muted-foreground">
              Le logiciel, son code source, son interface et ses contenus restent la propriété exclusive de VétoAI SAS. L'utilisateur bénéficie d'un droit d'usage personnel, non exclusif et non cessible, pour la durée de son abonnement. Les données saisies par l'utilisateur (dossiers patients, factures) restent sa propriété ; l'éditeur n'en revendique aucun droit.
            </p>

            <h3 className="font-semibold text-base pt-2">Article 7 — Limitation de responsabilité</h3>
            <p className="text-muted-foreground">
              L'éditeur ne peut être tenu responsable des dommages indirects (perte d'exploitation, perte de chiffre d'affaires, atteinte à la réputation). En toute hypothèse, sa responsabilité est plafonnée au montant des sommes versées par l'utilisateur au titre des 12 derniers mois.
            </p>

            <h3 className="font-semibold text-base pt-2">Article 8 — Résiliation</h3>
            <p className="text-muted-foreground">
              L'utilisateur peut résilier son abonnement à tout moment depuis l'espace paramètres. À l'issue de la résiliation, les données restent accessibles en lecture pendant 30 jours, puis sont définitivement supprimées (sauf obligations légales de conservation listées en section 2).
            </p>

            <h3 className="font-semibold text-base pt-2">Article 9 — Droit applicable et juridiction</h3>
            <p className="text-muted-foreground">
              Les présentes CGU sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux de [Ville à compléter], après tentative préalable de résolution amiable.
            </p>
          </div>
        </section>

        <footer className="pt-8 border-t text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} VétoAI SAS — Tous droits réservés
          </p>
        </footer>
      </main>
    </div>
  );
}
