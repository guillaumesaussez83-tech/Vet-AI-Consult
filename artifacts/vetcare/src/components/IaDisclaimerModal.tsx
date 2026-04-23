import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * F-P1-7 : disclaimer IA obligatoire (déontologie vétérinaire + RGPD).
 *
 * Clé localStorage scopée PAR USER ID Clerk pour que sur un poste partagé
 * en clinique, chaque user voie bien le disclaimer à sa première connexion.
 * Ancienne version utilisait une clé globale → un nouveau user ne le voyait
 * jamais.
 */
const BASE_KEY = "vetoai-ia-disclaimer-v1";

export default function IaDisclaimerModal() {
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const key = `${BASE_KEY}:${user.id}`;
    try {
      const accepted = localStorage.getItem(key);
      if (!accepted) setOpen(true);
    } catch {
      // Safari en mode privé peut throw → on ouvre quand même le modal.
      setOpen(true);
    }
  }, [isLoaded, user]);

  function handleAccept() {
    if (!user) return;
    const key = `${BASE_KEY}:${user.id}`;
    try {
      localStorage.setItem(key, new Date().toISOString());
    } catch {
      // Même logique : fail silencieux. La session reste fonctionnelle.
    }
    setOpen(false);
  }

  if (!isLoaded || !user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleAccept()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Utilisation de l'IA — Important</DialogTitle>
          </div>
          <DialogDescription className="pt-4 text-left space-y-3 text-sm">
            <p>
              VétoAI utilise l'intelligence artificielle pour vous assister dans
              l'élaboration de diagnostics différentiels, ordonnances et résumés.
            </p>
            <p className="font-medium text-gray-900">
              L'IA est un outil d'aide à la décision. Le vétérinaire reste
              seul responsable des actes, diagnostics et prescriptions qu'il
              valide.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>Vérifiez systématiquement les suggestions IA avant validation.</li>
              <li>Les données transmises à l'IA sont anonymisées côté serveur.</li>
              <li>
                Aucune donnée identifiante propriétaire n'est envoyée aux
                prestataires d'IA (Anthropic).
              </li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleAccept} className="w-full">
            J'ai compris et j'accepte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
