import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Building, Shield } from "lucide-react";

export default function ParametresPage() {
  const { user } = useUser();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">Gérez votre compte et les préférences de l'application</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informations du compte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Nom</span>
              <p className="font-medium mt-1">{user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium mt-1">{user?.primaryEmailAddress?.emailAddress || "—"}</p>
            </div>
          </div>
          <Separator />
          <div className="text-sm text-muted-foreground">
            Pour modifier vos informations personnelles, utilisez votre profil Clerk.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Clinique vétérinaire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="bg-muted/30 rounded-lg p-4 text-muted-foreground">
            <p className="font-medium text-foreground mb-1">VetCare Pro</p>
            <p>Logiciel de gestion vétérinaire professionnel</p>
            <p className="mt-2">Version 1.0.0</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Intelligence artificielle
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground">L'intelligence artificielle est intégrée via Claude (Anthropic) et utilisée pour :</p>
          <ul className="space-y-1 text-muted-foreground list-disc list-inside">
            <li>Générer des diagnostics différentiels</li>
            <li>Rédiger des ordonnances automatiques</li>
            <li>Analyser les données cliniques</li>
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary">Claude claude-sonnet-4-6</Badge>
            <span className="text-xs text-muted-foreground">connecté</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
