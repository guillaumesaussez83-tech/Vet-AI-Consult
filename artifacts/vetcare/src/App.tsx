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
          <Route path="/dashboard" component={() => <PrivateRoute component={Dashboard} />} />
          <Route path="/agenda" component={() => <PrivateRoute component={AgendaPage} />} />

          {/* Patients */}
          <Route path="/patients" component={() => <PrivateRoute component={PatientsPage} />} />
          <Route path="/patients/:id" component={() => <PrivateRoute component={PatientDetailPage} />} />

          {/* Proprietaires -- Sprint 7 */}
          <Route path="/proprietaires" component={() => <PrivateRoute component={ProprietairesPage} />} />
          <Route path="/proprietaires/:id" component={() => <PrivateRoute component={ProprietaireDetailPage} />} />

          {/* Consultations */}
          <Route path="/consultations" component={() => <PrivateRoute component={ConsultationPage} />} />
          <Route path="/consultations/:id" component={() => <PrivateRoute component={ConsultationPage} />} />

          {/* Facturation */}
          <Route path="/factures" component={() => <PrivateRoute component={FacturesPage} />} />
          <Route path="/encaissements" component={() => <PrivateRoute component={EncaissementsPage} />} />

          {/* Stock & Fournisseurs */}
          <Route path="/stocks" component={() => <PrivateRoute component={StockPage} />} />
          <Route path="/fournisseurs" component={() => <PrivateRoute component={FournisseursPage} />} />

          {/* Ordonnances */}
          <Route path="/ordonnances" component={() => <PrivateRoute component={OrdonnancesPage} />} />

          {/* Equipe & Ventes */}
          <Route path="/equipe" component={() => <PrivateRoute component={EquipePage} />} />
          <Route path="/ventes" component={() => <PrivateRoute component={VentesPage} />} />

          {/* Vaccinations */}
          <Route path="/vaccinations" component={() => <PrivateRoute component={VaccinationsPage} />} />

          {/* Caisse */}
          <Route path="/caisse" component={() => <PrivateRoute component={CaissePage} />} />

          {/* Statistiques */}
          <Route path="/statistiques" component={() => <PrivateRoute component={StatistiquesPage} />} />

          {/* Permissions -- Sprint 7 */}
          <Route path="/permissions" component={() => <PrivateRoute component={PermissionsPage} />} />

          <Route path="/parametres" component={() => <PrivateRoute component={ParametresPage} />} />
          {/* Modules clinique -- audit Phase 0 */}
          <Route path="/actes" component={() => <PrivateRoute component={ActesPage} />} />
          <Route path="/catalogue" component={() => <PrivateRoute component={CataloguePage} />} />
          <Route path="/certificats" component={() => <PrivateRoute component={CertificatsPage} />} />
          <Route path="/comptabilite" component={() => <PrivateRoute component={ComptabilitePage} />} />
          <Route path="/cremation" component={() => <PrivateRoute component={CremationPage} />} />
          <Route path="/portail" component={() => <PrivateRoute component={PortailPage} />} />
          <Route path="/rappels" component={() => <PrivateRoute component={RappelsPage} />} />
          <Route path="/salle-attente" component={() => <PrivateRoute component={SalleAttentePage} />} />
          <Route path="/stupefiants" component={() => <PrivateRoute component={StupefiantsPage} />} />
          <Route path="/admin" component={() => <PrivateRoute component={AdminPage} />} />
        </Switch>
      </AppLayout>
    </Switch>
  );
}
