import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function IaDisclaimerModal() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const key = `ia_disclaimer_accepted_${user.id}`;
    const accepted = localStorage.getItem(key);
    if (!accepted) {
      setOpen(true);
    }
  }, [user?.id]);

  const handleAccept = () => {
    if (!user?.id) return;
    const key = `ia_disclaimer_accepted_${user.id}`;
    localStorage.setItem(key, new Date().toISOString());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            Aide à la décision clinique — Information importante
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Les suggestions diagnostiques et les ordonnances générées par l'intelligence artificielle sont
            des <strong className="text-foreground">outils d'aide à la décision</strong>.
          </p>
          <p>
            Elles <strong className="text-foreground">ne remplacent en aucun cas</strong> le jugement clinique du
            vétérinaire et doivent être systématiquement vérifiées et validées par un professionnel qualifié.
          </p>
          <p>
            En continuant, vous acceptez d'assumer la <strong className="text-foreground">responsabilité
            professionnelle</strong> de toute décision clinique prise dans le cadre de votre exercice.
          </p>
          <p className="text-xs border-t pt-3">
            Cette information est affichée conformément aux recommandations de l'Ordre National des Vétérinaires
            concernant l'usage des outils d'intelligence artificielle en médecine vétérinaire.
          </p>
        </div>
        <Button className="w-full mt-2" onClick={handleAccept}>
          Je comprends et j'accepte
        </Button>
      </DialogContent>
    </Dialog>
  );
}
