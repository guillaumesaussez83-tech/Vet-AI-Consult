import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export type UrgenceVitaleItem = {
  signal: string;
  niveau: string;
  declencheurs?: string[];
  causeMortelle: string;
  actionImmediate?: string;
};

/**
 * Bannière bloquante d'urgence vitale cardio « à ne jamais rater » détectée par l'IA.
 * Modale non fermable autrement que par l'accusé de réception explicite (Escape
 * neutralisé) → force le choix actif du vétérinaire.
 *
 * Composant PARTAGÉ entre le parcours « nouvelle consultation » (nouvelle.tsx, flux
 * streamé) et la fiche consultation (detail.tsx, flux synchrone), pour garantir une
 * détection d'urgence cohérente sur les deux écrans. Ne rend rien si aucune urgence.
 */
export function UrgencesVitalesBanner({
  urgences,
  onAcknowledge,
}: {
  urgences: UrgenceVitaleItem[] | null | undefined;
  onAcknowledge: () => void;
}) {
  if (!urgences || urgences.length === 0) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent
        className="max-w-2xl border-2 border-red-600"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-6 w-6 flex-shrink-0" />
            Urgence vitale à ne jamais rater
          </AlertDialogTitle>
          <AlertDialogDescription>
            L'analyse a détecté {urgences.length} signal(aux) d'urgence cardio
            potentiellement vitale. À vérifier immédiatement avant de poursuivre.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto py-2">
          {urgences.map((u, i) => (
            <div key={i} className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-red-800">{u.signal}</span>
                <Badge
                  variant={
                    String(u.niveau ?? "").toLowerCase().includes("forte")
                      ? "destructive"
                      : "default"
                  }
                >
                  {u.niveau}
                </Badge>
              </div>
              {Array.isArray(u.declencheurs) && u.declencheurs.length > 0 && (
                <div className="mt-1 text-sm text-red-700">
                  <span className="font-semibold">Déclencheurs détectés : </span>
                  {u.declencheurs.join(" ; ")}
                </div>
              )}
              <div className="mt-1 text-sm text-red-900">
                <span className="font-semibold">Cause mortelle : </span>
                {u.causeMortelle}
              </div>
              {u.actionImmediate && (
                <div className="mt-1 text-sm text-red-900">
                  <span className="font-semibold">Action immédiate : </span>
                  {u.actionImmediate}
                </div>
              )}
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={onAcknowledge}
          >
            J'ai pris connaissance
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default UrgencesVitalesBanner;
