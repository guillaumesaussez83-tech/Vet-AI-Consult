import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/,"");

interface Contraindication {
  id: string;
  severity: "CRITIQUE" | "MODERE" | "INFO";
  description: string;
  molecules: string[];
  especes?: string[];
}

interface Props {
  ordonnanceId: number;
  medicaments: string[];
  espece?: string;
}

const severityConfig = {
  CRITIQUE: { icon: AlertCircle, className: "border-red-400 bg-red-50", badgeVariant: "destructive" as const, label: "CRITIQUE" },
  MODERE:   { icon: AlertTriangle, className: "border-orange-400 bg-orange-50", badgeVariant: "secondary" as const, label: "MODERE" },
  INFO:     { icon: Info, className: "border-blue-400 bg-blue-50", badgeVariant: "outline" as const, label: "INFO" },
};

export function ContraindicationsAlert({ ordonnanceId, medicaments, espece }: Props) {
  const { data, isLoading } = useQuery<{ data: Contraindication[] }>({
    queryKey: ["ci", ordonnanceId, medicaments.join(","), espece],
    queryFn: async () => {
      const resp = await fetch(`${API_BASE}/api/ordonnances/${ordonnanceId}/check-contraindications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicaments, espece }),
      });
      if (!resp.ok) throw new Error("Erreur CI");
      return resp.json();
    },
    enabled: medicaments.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || !data?.data?.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {data.data.map((w) => {
        const cfg = severityConfig[w.severity] ?? severityConfig.INFO;
        const Icon = cfg.icon;
        return (
          <Alert key={w.id} className={`py-2 ${cfg.className}`}>
            <Icon className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="flex items-start gap-2">
              <Badge variant={cfg.badgeVariant} className="text-xs shrink-0 mt-0.5">{cfg.label}</Badge>
              <span className="text-sm">{w.description}</span>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
