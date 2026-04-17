import { useRoute, Link } from "wouter";
import { useGetFacture } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft } from "lucide-react";

export default function FactureImprimerPage() {
  const [, params] = useRoute("/factures/:id/imprimer");
  const id = parseInt(params?.id ?? "0");

  const { data: facture, isLoading } = useGetFacture(id, {
    query: { enabled: !!id, queryKey: ["facture", id] }
  });

  if (isLoading) return (
    <div className="max-w-3xl mx-auto p-8 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96" />
    </div>
  );

  if (!facture) return (
    <div className="text-center py-16 text-muted-foreground">Facture non trouvée</div>
  );

  const patient = facture.consultation?.patient;
  const owner = patient?.owner;
  const lignes = (facture as any).lignes ?? [];

  const totalHT = lignes.reduce((s: number, l: any) => s + l.montantHT, 0);
  const totalTVA = totalHT * 0.20;
  const totalTTC = totalHT + totalTVA;

  const categorieLabel: Record<string, string> = {
    consultation: "Consultations",
    vaccination: "Vaccinations",
    chirurgie: "Chirurgie",
    medicament: "Médicaments",
    analyse: "Analyses",
    imagerie: "Imagerie",
    autre: "Divers",
  };

  const parCategorie = lignes.reduce((acc: Record<string, number>, l: any) => {
    const cat = l.acte?.categorie ?? "autre";
    acc[cat] = (acc[cat] ?? 0) + l.montantHT;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-white">
      <div className="no-print fixed top-4 left-4 flex gap-2 z-50 print:hidden">
        <Link href={`/factures/${id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Retour
          </Button>
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Imprimer / PDF
        </Button>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="text-2xl font-bold text-blue-900">VétoAI</div>
            <div className="text-sm text-gray-600 mt-1">Cabinet Vétérinaire</div>
            <div className="text-sm text-gray-500 mt-3">
              12 rue des Lilas, 75011 Paris<br />
              Tél : 01 23 45 67 89<br />
              Email : contact@vetoai.fr<br />
              IBAN : FR76 1234 5678 9012 3456 7890 123
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-800">FACTURE</div>
            <div className="text-lg font-semibold text-blue-800 mt-1">{facture.numero}</div>
            <div className="text-sm text-gray-500 mt-2">
              Date d'émission : <strong>{facture.dateEmission}</strong>
            </div>
            {facture.datePaiement && (
              <div className="text-sm text-gray-500">
                Date de paiement : <strong>{facture.datePaiement}</strong>
              </div>
            )}
            <div className="mt-2">
              <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${
                facture.statut === "payee"
                  ? "bg-green-100 text-green-700"
                  : facture.statut === "annulee"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {facture.statut === "payee" ? "Payée" : facture.statut === "annulee" ? "Annulée" : "En attente"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-400 font-semibold mb-2 tracking-wider">Propriétaire</div>
            {owner ? (
              <>
                <div className="font-semibold text-gray-800">{owner.prenom} {owner.nom}</div>
                {owner.adresse && <div className="text-sm text-gray-600 mt-1">{owner.adresse}</div>}
                {owner.telephone && <div className="text-sm text-gray-600">Tél : {owner.telephone}</div>}
                {owner.email && <div className="text-sm text-gray-600">{owner.email}</div>}
              </>
            ) : (
              <div className="text-sm text-gray-400">Non renseigné</div>
            )}
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-400 font-semibold mb-2 tracking-wider">Patient</div>
            {patient ? (
              <>
                <div className="font-semibold text-gray-800">{patient.nom}</div>
                <div className="text-sm text-gray-600">
                  {patient.espece && <span className="capitalize">{patient.espece}</span>}
                  {patient.race && <span> — {patient.race}</span>}
                </div>
                {patient.sexe && <div className="text-sm text-gray-500">{patient.sexe}</div>}
              </>
            ) : (
              <div className="text-sm text-gray-400">Non renseigné</div>
            )}
            {facture.consultation && (
              <div className="text-xs text-gray-400 mt-2">
                Consultation du {facture.consultation.date}
                {facture.consultation.veterinaire && ` — Dr. ${facture.consultation.veterinaire}`}
              </div>
            )}
          </div>
        </div>

        <table className="w-full mb-8 text-sm">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="text-left px-3 py-2 rounded-tl-md">Description</th>
              <th className="text-center px-3 py-2">Qté</th>
              <th className="text-right px-3 py-2">PU HT</th>
              <th className="text-right px-3 py-2">PU TTC</th>
              <th className="text-right px-3 py-2">Total HT</th>
              <th className="text-right px-3 py-2 rounded-tr-md">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-400 italic">Aucun acte enregistré</td>
              </tr>
            ) : (
              lignes.map((ligne: any, idx: number) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{ligne.description || ligne.acte?.nom || "—"}</div>
                    {ligne.acte?.code && <div className="text-xs text-gray-400">{ligne.acte.code}</div>}
                  </td>
                  <td className="text-center px-3 py-2 text-gray-700">{ligne.quantite}</td>
                  <td className="text-right px-3 py-2 text-gray-700">{ligne.prixUnitaire?.toFixed(2)} €</td>
                  <td className="text-right px-3 py-2 text-gray-700">{(ligne.prixUnitaire * 1.2)?.toFixed(2)} €</td>
                  <td className="text-right px-3 py-2 font-medium text-gray-800">{ligne.montantHT?.toFixed(2)} €</td>
                  <td className="text-right px-3 py-2 font-medium text-gray-800">{ligne.montantTTC?.toFixed(2)} €</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-72 space-y-1">
            {Object.entries(parCategorie).length > 1 && (
              <div className="mb-3">
                <div className="text-xs uppercase text-gray-400 font-semibold mb-1 tracking-wider">Récapitulatif par catégorie</div>
                {Object.entries(parCategorie).map(([cat, montant]) => (
                  <div key={cat} className="flex justify-between text-sm text-gray-600 py-0.5">
                    <span>{categorieLabel[cat] ?? cat}</span>
                    <span>{(montant as number).toFixed(2)} € HT</span>
                  </div>
                ))}
                <div className="border-t my-1" />
              </div>
            )}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex justify-between px-3 py-2 text-sm text-gray-600 bg-gray-50">
                <span>Total HT</span>
                <span className="font-medium">{totalHT.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between px-3 py-2 text-sm text-gray-600">
                <span>TVA (20 %)</span>
                <span className="font-medium">{totalTVA.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between px-3 py-2 text-base font-bold bg-blue-900 text-white">
                <span>Total TTC</span>
                <span>{totalTTC.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 text-xs text-gray-400 space-y-1">
          <p>SELAS VétoAI — SIRET : 123 456 789 00012 — Capital : 10 000 € — RCS Paris B 123 456 789</p>
          <p>N° TVA intracommunautaire : FR12 123456789 — Code NAF : 7500Z (Activités vétérinaires)</p>
          <p>Règlement par virement, espèces ou carte bancaire. Tout retard de paiement entraîne des pénalités de 3 fois le taux légal.</p>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
