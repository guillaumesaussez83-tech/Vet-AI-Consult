import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { StethoscopeIcon, ArrowRight, Shield, Clock, Zap } from "lucide-react";

export default function Home() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-xl text-primary">
            <StethoscopeIcon className="h-6 w-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">VetCare Pro</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`${basePath}/sign-in`}>
            <Button variant="ghost">Connexion</Button>
          </Link>
          <Link href={`${basePath}/sign-up`}>
            <Button>Essai Gratuit</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary mb-8">
          Nouveau: Diagnostic IA Intégré
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground max-w-4xl mb-6 leading-tight">
          L'outil de travail quotidien des <span className="text-primary">vétérinaires modernes</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mb-10">
          Rapide, précis, professionnel. Gérez vos patients, consultations, factures et obtenez des diagnostics assistés par IA dans une interface conçue pour la vraie vie en clinique.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
          <Link href={`${basePath}/sign-up`} className="w-full sm:w-auto">
            <Button size="lg" className="w-full text-base h-14 px-8">
              Commencer maintenant <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-5xl w-full text-left">
          <div className="bg-card p-6 rounded-2xl border shadow-sm">
            <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center text-primary mb-4">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Rapide à naviguer</h3>
            <p className="text-muted-foreground">Conçu pour les professionnels qui passent des heures sur leur écran. Chaque pixel a sa place.</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border shadow-sm">
            <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center text-primary mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Dossiers Complets</h3>
            <p className="text-muted-foreground">Historique médical, antécédents, allergies et constantes vitales accessibles en un clic.</p>
          </div>
          <div className="bg-card p-6 rounded-2xl border shadow-sm">
            <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center text-primary mb-4">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Gain de Temps</h3>
            <p className="text-muted-foreground">Facturation et ordonnances automatisées basées sur les actes de la consultation.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-muted-foreground text-sm border-t">
        © {new Date().getFullYear()} VetCare Pro. Tous droits réservés.
      </footer>
    </div>
  );
}