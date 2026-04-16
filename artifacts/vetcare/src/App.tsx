import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk } from "@clerk/react";
import { useEffect, useRef } from "react";
import { queryClient } from "./lib/queryClient";
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
import OrdonnancesPage from "./pages/ordonnances/index";
import OrdonnanceImprimerPage from "./pages/ordonnances/imprimer";
import AgendaPage from "./pages/agenda/index";
import SalleAttentePage from "./pages/salle-attente/index";
import CertificatsPage from "./pages/certificats/index";
import VaccinationsPage from "./pages/vaccinations/index";
import PortailPage from "./pages/portail/index";
import { AppLayout } from "./components/layout/AppLayout";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
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

      <Route component={NotFound} />
    </Switch>
  );
}

import { useLocation, Router as WouterRouter } from "wouter";

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Router />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
