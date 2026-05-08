// artifacts/vetcare/src/App.tsx
// MODIFIE -- fix imports + ajout routes manquantes (audit Phase 0)

import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@clerk/clerk-react";
import AppLayout from "./components/AppLayout";

// Pages existantes -- imports corriges
import Dashboard from "./pages/dashboard";
import AgendaPage from "./pages/agenda";
import PatientsPage from "./pages/patients";
import ConsultationPage from "./pages/consultations";
import FacturesPage from "./pages/factures";
import StockPage from "./pages/stock";
import OrdonnancesPage from "./pages/ordonnances";
import StatistiquesPage from "./pages/statistiques";
import ParametresPage from "./pages/parametres";
import CaissePage from "./pages/caisse";

// Sprint 7 -- nouvelles pages
import ProprietairesPage from "./pages/proprietaires";
import ProprietaireDetailPage from "./pages/proprietaire-detail";
import PatientDetailPage from "./pages/patient-detail";
import PermissionsPage from "./pages/permissions";

// Pages Phase 2 -- branchees (audit Phase 0)
import EncaissementsPage from "./pages/encaissements";
import EquipePage from "./pages/equipe";
import VentesPage from "./pages/ventes";
import VaccinationsPage from "./pages/vaccinations";
import FournisseursPage from "./pages/fournisseurs";


// Pages orphelines branchees -- audit Phase 0
import ActesPage from "./pages/actes";
import AdminPage from "./pages/admin";
import CataloguePage from "./pages/catalogue";
import CertificatsPage from "./pages/certificats";
import ComptabilitePage from "./pages/comptabilite";
import CremationPage from "./pages/cremation";
import PortailPage from "./pages/portail";
import RappelsPage from "./pages/rappels";
import SalleAttentePage from "./pages/salle-attente";
import StupefiantsPage from "./pages/stupefiants";
import AnalyticsDashboard from "./pages/analytics";
import ClientelePage from "./pages/analytics/clientele";
import GroupePage from "./pages/groupe";
import ReportsPage from "./pages/reports";

function PrivateRoute({ component: Component, ...rest }: any) {
  const { isLoaded, isSignedIn } = useAuth();
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
          <Route path="/dashboard">{() => <PrivateRoute component={Dashboard} />}</Route>
          <Route path="/agenda">{() => <PrivateRoute component={AgendaPage} />}</Route>

          {/* Patients */}
          <Route path="/patients">{() => <PrivateRoute component={PatientsPage} />}</Route>
          <Route path="/patients/:id">{() => <PrivateRoute component={PatientDetailPage} />}</Route>

          {/* Proprietaires -- Sprint 7 */}
          <Route path="/proprietaires">{() => <PrivateRoute component={ProprietairesPage} />}</Route>
          <Route path="/proprietaires/:id">{() => <PrivateRoute component={ProprietaireDetailPage} />}</Route>

          {/* Consultations */}
          <Route path="/consultations">{() => <PrivateRoute component={ConsultationPage} />}</Route>
          <Route path="/consultations/:id">{() => <PrivateRoute component={ConsultationPage} />}</Route>

          {/* Facturation */}
          <Route path="/factures">{() => <PrivateRoute component={FacturesPage} />}</Route>
          <Route path="/encaissements">{() => <PrivateRoute component={EncaissementsPage} />}</Route>

          {/* Stock & Fournisseurs */}
          <Route path="/stocks">{() => <PrivateRoute component={StockPage} />}</Route>
          <Route path="/fournisseurs">{() => <PrivateRoute component={FournisseursPage} />}</Route>

          {/* Ordonnances */}
          <Route path="/ordonnances">{() => <PrivateRoute component={OrdonnancesPage} />}</Route>

          {/* Equipe & Ventes */}
          <Route path="/equipe">{() => <PrivateRoute component={EquipePage} />}</Route>
          <Route path="/ventes">{() => <PrivateRoute component={VentesPage} />}</Route>

          {/* Vaccinations */}
          <Route path="/vaccinations">{() => <PrivateRoute component={VaccinationsPage} />}</Route>

          {/* Caisse */}
          <Route path="/caisse">{() => <PrivateRoute component={CaissePage} />}</Route>

          {/* Statistiques */}
          <Route path="/statistiques">{() => <PrivateRoute component={StatistiquesPage} />}</Route>

          {/* Permissions -- Sprint 7 */}
          <Route path="/permissions">{() => <PrivateRoute component={PermissionsPage} />}</Route>

          <Route path="/parametres">{() => <PrivateRoute component={ParametresPage} />}</Route>
          {/* Modules clinique -- audit Phase 0 */}
          <Route path="/actes">{() => <PrivateRoute component={ActesPage} />}</Route>
          <Route path="/catalogue">{() => <PrivateRoute component={CataloguePage} />}</Route>
          <Route path="/certificats">{() => <PrivateRoute component={CertificatsPage} />}</Route>
          <Route path="/comptabilite">{() => <PrivateRoute component={ComptabilitePage} />}</Route>
          <Route path="/cremation">{() => <PrivateRoute component={CremationPage} />}</Route>
          <Route path="/portail">{() => <PrivateRoute component={PortailPage} />}</Route>
          <Route path="/rappels">{() => <PrivateRoute component={RappelsPage} />}</Route>
          <Route path="/salle-attente">{() => <PrivateRoute component={SalleAttentePage} />}</Route>
          <Route path="/stupefiants">{() => <PrivateRoute component={StupefiantsPage} />}</Route>
          <Route path="/admin">{() => <PrivateRoute component={AdminPage} />}</Route>
        </Switch>
      </AppLayout>
      <Route path="/analytics" component={AnalyticsDashboard} />
  <Route path="/analytics/clientele" component={ClientelePage} />
  <Route path="/groupe" component={GroupePage} />
  <Route path="/reports" component={ReportsPage} />
</Switch>
  );
}
