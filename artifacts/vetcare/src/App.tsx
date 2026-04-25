import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk, useUser } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import { queryClient, setOn401 } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "./pages/home";
import SignInPage from "./pages/auth/sign-in";
import SignUpPage from "./pages/auth/sign-up";
import Dashboard from "./pages/dashboard";
import PatientsPage from "./pages/patients/index";
import NouveauPatientPage from "./pages/patients/nouveau";
import PatientDetailPage from "./pages/patients/detail";
import ConsultationsPage from "./pages/consultations/index";
import NouvelleConsultationPage from "./pages/consultations/nouvelle";
import ConsultationDetailPage from "./pages/consultations/detail";
import FacturesPage from "./pages/factures/index";
import FactureDetailPage from "./pages/factures/detail";
import FactureImprimerPage from "./pages/factures/imprimer";
import ActesPage from "./pages/actes/index";
import ParametresPage from "./pages/parametres/index";
import EncaissementsPage from "./pages/encaissements/index";
import RappelsPage from "./pages/rappels/index";
import StatistiquesPage from "./pages/statistiques/index";
import StockPage from "./pages/stock/index";
import StupefiantsPage from "./pages/stupefiants/index";
import OrdonnancesPage from "./pages/ordonnances/index";
import OrdonnanceImprimerPage from "./pages/ordonnances/imprimer";
import AgendaPage from "./pages/agenda/index";
import SalleAttentePage from "./pages/salle-attente/index";
import CertificatsPage from "./pages/certificats/index";
import VaccinationsPage from "./pages/vaccinations/index";
import PortailPage from "./pages/portail/index";
import ConfidentialitePage from "./pages/confidentialite";
import LegalPage from "./pages/Legal";
import { AppLayout } from "./components/layout/AppLayout";
import IaDisclaimerModal from "./components/IaDisclaimerModal";
import { CommandPalette } from "./components/CommandPalette";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = `${window.location.origin}/api/__clerk`;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * F-P0-3 : si la clé Clerk manque, on AFFICHE un écran propre au lieu de
 * laisser un throw crasher avant le mount ErrorBoundary.
 */
function MissingConfigScreen({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-bold">Configuration manquante</h1>
        <p className="text-gray-600">{reason}</p>
        <p className="text-sm text-gray-400">
          Si vous êtes administrateur, vérifiez les variables d'environnement du
          déploiement. Sinon, contactez votre support.
        </p>
      </div>
    </div>
  );
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

/**
 * F-P1-4 + F-P2-8 : observe les changements d'identité Clerk pour
 *  1. Purger le cache React Query quand l'user change (sécu multi-tenant
 *     côté navigateur — évite qu'un user qui se logout/login voit les
 *     caches de l'ancien user).
 *  2. Populer Sentry.setUser pour attacher l'user context aux erreurs.
 */
function ClerkSideEffects() {
  const { addListener } = useClerk();
  const { user } = useUser();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user: u }) => {
      const userId = u?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  return null;
}

/**
 * F-P1-3 : handler 401 global branché sur le queryClient.
 * Quand le backend renvoie 401 (token Clerk expiré), on signOut l'utilisateur
 * et on le redirige vers /sign-in. Plus efficace qu'un toast d'erreur perdu.
 */
function On401Redirect() {
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setOn401(() => {
      void signOut(() => setLocation("/sign-in"));
    });
    return () => setOn401(() => {});
  }, [signOut, setLocation]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

/**
 * F-P1-5 : chaque route protégée est wrappée dans un ErrorBoundary local.
 * Un crash d'un composant enfant montre un fallback plus granulaire, sans
 * tuer la nav.
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <ErrorBoundary>
            <IaDisclaimerModal />
            <Component />
          </ErrorBoundary>
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />

      <Route path="/patients/nouveau" component={() => <ProtectedRoute component={NouveauPatientPage} />} />
      <Route path="/patients/:id" component={() => <ProtectedRoute component={PatientDetailPage} />} />
      <Route path="/patients" component={() => <ProtectedRoute component={PatientsPage} />} />

      <Route path="/consultations/nouvelle" component={() => <ProtectedRoute component={NouvelleConsultationPage} />} />
      <Route path="/consultations/:id" component={() => <ProtectedRoute component={ConsultationDetailPage} />} />
      <Route path="/consultations" component={() => <ProtectedRoute component={ConsultationsPage} />} />

      <Route path="/factures/:id/imprimer" component={() => (
        <>
          <Show when="signed-in"><FactureImprimerPage /></Show>
          <Show when="signed-out"><Redirect to="/sign-in" /></Show>
        </>
      )} />
      <Route path="/factures/:id" component={() => <ProtectedRoute component={FactureDetailPage} />} />
      <Route path="/factures" component={() => <ProtectedRoute component={FacturesPage} />} />

      <Route path="/actes" component={() => <ProtectedRoute component={ActesPage} />} />
      <Route path="/encaissements" component={() => <ProtectedRoute component={EncaissementsPage} />} />
      <Route path="/rappels" component={() => <ProtectedRoute component={RappelsPage} />} />
      <Route path="/parametres" component={() => <ProtectedRoute component={ParametresPage} />} />
      <Route path="/statistiques" component={() => <ProtectedRoute component={StatistiquesPage} />} />
      <Route path="/stock" component={() => <ProtectedRoute component={StockPage} />} />
      <Route path="/stupefiants" component={() => <ProtectedRoute component={StupefiantsPage} />} />
      <Route path="/ordonnances/:id/imprimer" component={() => (
        <>
          <Show when="signed-in"><OrdonnanceImprimerPage /></Show>
          <Show when="signed-out"><Redirect to="/sign-in" /></Show>
        </>
      )} />
      <Route path="/ordonnances" component={() => <ProtectedRoute component={OrdonnancesPage} />} />
      <Route path="/salle-attente" component={() => <ProtectedRoute component={SalleAttentePage} />} />
      <Route path="/agenda" component={() => <ProtectedRoute component={AgendaPage} />} />
      <Route path="/certificats" component={() => <ProtectedRoute component={CertificatsPage} />} />
      <Route path="/patients/:id/vaccinations" component={() => <ProtectedRoute component={VaccinationsPage} />} />
      <Route path="/portail/:token" component={PortailPage} />
      <Route path="/confidentialite" component={ConfidentialitePage} />
      <Route path="/legal" component={LegalPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      const editable = (e.target as HTMLElement)?.isContentEditable;
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || editable;

      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        return;
      }
      if (inInput || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "n") { e.preventDefault(); setLocation("/consultations/nouvelle"); }
      else if (e.key === "p") { e.preventDefault(); setLocation("/patients/nouveau"); }
      else if (e.key === "f") { e.preventDefault(); setLocation("/factures"); }
      else if (e.key === "?") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setLocation]);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkSideEffects />
      <On401Redirect />
      <Router />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </ClerkProvider>
  );
}

function App() {
  // F-P0-3 : check config avant de monter quoi que ce soit.
  if (!clerkPubKey) {
    return (
      <MissingConfigScreen reason="La clé Clerk (VITE_CLERK_PUBLISHABLE_KEY) est introuvable." />
    );
  }

  return (
    <ErrorBoundary>
      <TooltipProvider>
        {/* F-P1-1 : QueryClientProvider MONTE AVANT ClerkProvider pour
            survivre aux changements de session et garantir que les toasters
            reçoivent bien leur cache. */}
        <QueryClientProvider client={queryClient}>
          <WouterRouter base={basePath}>
            <ClerkProviderWithRoutes />
          </WouterRouter>
          <Toaster />
        </QueryClientProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
