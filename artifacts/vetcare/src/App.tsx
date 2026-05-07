// artifacts/vetcare/src/App.tsx
// MODIFIÉ — ajout routes Sprint 7

import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@clerk/clerk-react";
import AppLayout from "./components/AppLayout";

// Pages existantes
import Dashboard from "./pages/dashboard";
import AgendaPage from "./pages/agenda";
import PatientsPage from "./pages/patients";
import ConsultationPage from "./pages/consultation";
import FacturesPage from "./pages/factures";
import StocksPage from "./pages/stocks";
import OrdonnancesPage from "./pages/ordonnances";
import RapportsPage from "./pages/rapports";
import ParametresPage from "./pages/parametres";
import CaissePage from "./pages/caisse";

// Sprint 7 — nouvelles pages
import ProprietairesPage from "./pages/proprietaires";
import ProprietaireDetailPage from "./pages/proprietaire-detail";
import PatientDetailPage from "./pages/patient-detail";
import PermissionsPage from "./pages/permissions";

function PrivateRoute({ component: Component, ...rest }: any) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Component {...rest} />;
}

export default function App() {
  return (
    <Switch>
      <Route path="/sign-in" component={() => <div>Sign in...</div>} />
      <AppLayout>
        <Switch>
          <Route path="/" component={() => <Redirect to="/dashboard" />} />
          <Route path="/dashboard" component={() => <PrivateRoute component={Dashboard} />} />
          <Route path="/agenda" component={() => <PrivateRoute component={AgendaPage} />} />

          {/* Patients */}
          <Route path="/patients" component={() => <PrivateRoute component={PatientsPage} />} />
          <Route path="/patients/:id" component={() => <PrivateRoute component={PatientDetailPage} />} />

          {/* Propriétaires — Sprint 7 */}
          <Route path="/proprietaires" component={() => <PrivateRoute component={ProprietairesPage} />} />
          <Route path="/proprietaires/:id" component={() => <PrivateRoute component={ProprietaireDetailPage} />} />

          {/* Autres pages */}
          <Route path="/consultations/:id" component={() => <PrivateRoute component={ConsultationPage} />} />
          <Route path="/factures" component={() => <PrivateRoute component={FacturesPage} />} />
          <Route path="/stocks" component={() => <PrivateRoute component={StocksPage} />} />
          <Route path="/ordonnances" component={() => <PrivateRoute component={OrdonnancesPage} />} />
          <Route path="/caisse" component={() => <PrivateRoute component={CaissePage} />} />
          <Route path="/rapports" component={() => <PrivateRoute component={RapportsPage} />} />

          {/* Permissions — Sprint 7 */}
          <Route path="/permissions" component={() => <PrivateRoute component={PermissionsPage} />} />

          <Route path="/parametres" component={() => <PrivateRoute component={ParametresPage} />} />
        </Switch>
      </AppLayout>
    </Switch>
  );
}
