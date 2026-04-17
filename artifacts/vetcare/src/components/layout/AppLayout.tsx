import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { 
  Activity, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  Syringe,
  Menu,
  Euro,
  Bell,
  CalendarDays,
  Package,
  BarChart2,
  Award,
  ClipboardList,
  LayoutDashboard,
  Stethoscope,
  FlaskConical,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const navigation = [
    { name: "Tableau de bord", href: "/dashboard", icon: Activity },
    { name: "Statistiques", href: "/statistiques", icon: BarChart2 },
    { name: "Salle d'attente", href: "/salle-attente", icon: LayoutDashboard },
    { name: "Agenda", href: "/agenda", icon: CalendarDays },
    { name: "Patients", href: "/patients", icon: Users },
    { name: "Consultations", href: "/consultations", icon: Stethoscope },
    { name: "Certificats", href: "/certificats", icon: Award },
    { name: "Facturation", href: "/factures", icon: FileText },
    { name: "Encaissements", href: "/encaissements", icon: Euro },
    { name: "Ordonnances", href: "/ordonnances", icon: ClipboardList },
    { name: "Rappels", href: "/rappels", icon: Bell },
    { name: "Stock", href: "/stock", icon: Package },
    { name: "Stupéfiants", href: "/stupefiants", icon: FlaskConical },
    { name: "Actes & Produits", href: "/actes", icon: Syringe },
    { name: "Paramètres", href: "/parametres", icon: Settings },
  ];

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const currentPath = location === "" ? "/" : location;

  const NavLinks = () => (
    <div className="flex flex-col gap-2 mt-4 px-2">
      {navigation.map((item) => {
        const isActive = currentPath === item.href || (item.href !== "/dashboard" && currentPath.startsWith(item.href));
        return (
          <Link key={item.name} href={item.href}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer text-sm font-medium ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-sidebar border-sidebar-border h-screen sticky top-0 shrink-0">
        <div className="p-5 flex items-center">
          <Logo size={28} />
        </div>
        
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-semibold">
              {user?.firstName?.charAt(0) || "D"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-sidebar-foreground truncate">Dr. {user?.firstName || "Vétérinaire"}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user?.emailAddresses[0]?.emailAddress}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 mt-2"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 max-w-full">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center">
            <Logo size={22} />
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 border-sidebar-border">
              <div className="p-5 flex items-center">
                <Logo size={28} />
              </div>
              <div className="px-3">
                <NavLinks />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <div className={`flex-1 overflow-y-auto ${currentPath === "/salle-attente" ? "" : "p-4 md:p-6"}`}>
          <div className={currentPath === "/salle-attente" ? "h-full" : "max-w-6xl mx-auto w-full"}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}