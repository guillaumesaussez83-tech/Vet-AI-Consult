// AiBudgetWidget -- Sprint 3 stub
// Tracks AI API usage/budget. Full implementation pending.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface AiBudgetWidgetProps {
  className?: string;
}

export default function AiBudgetWidget({ className }: AiBudgetWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Budget IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Suivi de la consommation API IA -- disponible prochainement.
        </p>
      </CardContent>
    </Card>
  );
}
