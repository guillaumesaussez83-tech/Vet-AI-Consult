// artifacts/vetcare/src/App.tsx
// MODIFIE -- fix imports + ajout routes manquantes (audit Phase 0)


import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
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
