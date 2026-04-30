import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetFacture } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft, Download, Loader2 } from "lucide-react";
import { formatDateFR } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { unwrapResponse as __unwrapResponse } from "../../lib/queryClient";

const API_BASE = "/api";

interface ParametresClinique {
  nomClinique: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  siteWeb: string | null;
  siret: string | null;
  numeroOrdre: string | null;
  numTVA: string | null;
  horaires: string | null;
  mentionsLegales: string | null;
}

async function fetchClinique(): Promise<ParametresClinique> {
  const r = await fetch(`${API_BASE}/parametres-clinique`);
  if (!r.ok) return {} as ParametresClinique;
  return __unwrapResponse(r);
}

export default function FactureImprimerPage() {
  const [, params] = useRoute("/factures/:id/imprimer");
  const id = parseInt(params?.id ?? "0");
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const downloadPDF = async (numero: string) => {
    setDownloadingPDF(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById("facture-content");
      if (!element) return;
      await html2pdf().set({
        margin: 8,
        filename: `${numero}.pdf`,
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(element).save();
    } finally {
      setDownloadingPDF(false);
    }
  };

  const { data: facture, isLoading } = useGetFacture(id, {
    query: { enabled: !!id, queryKey: ["facture", id] }
  });

  const { data: clinique = {} as ParametresClinique } = useQuery({
    queryKey: ["parametres-clinique"],
    queryFn: fetchClinique,
  });

  if (isLoading) return (
    <div className="max-w-3xl mx-auto p-8 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96" />
    </div>
  );

  if (!facture) return (
    <div className="text-center py-16 text-muted-foreground">Facture non trouvÃ©e</div>
  );

  const patient = facture.consultation?.patient;
  const owner = patient?.owner;
  const facAny = facture as any;
  const lignes = facAny.lignes ?? [];

  const computedHT = lignes.reduce((s: number, l: any) => s + Number(l.montantHT || 0), 0);
  const totalHT = lignes.length > 0 ? computedHT : Number(facAny.montantHT ?? 0);
  const totalTVA = facAny.montantTVA != null ? Number(facAny.montantTVA) : totalHT * 0.20;
  const totalTTC = facAny.montantTTC != null ? Number(facAny.montantTTC) : totalHT + totalTVA;

  const categorieLabel: Record<string, string> = {
    consultation: "Consultations",
    vaccination: "Vaccinations",
    chirurgie: "Chirurgie",
    medicament: "MÃ©dicaments",
    analyse: "Analyses",
    imagerie: "Imagerie",
    autre: "Divers",
  };

  const parCategorie = lignes.reduce((acc: Record<string, number>, l: any) => {
    const cat = l.acte?.categorie ?? "autre";
    acc[cat] = (acc[cat] ?? 0) + Number(l.montantHT || 0);
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadPDF(facture.numero)}
          disabled={downloadingPDF}
        >
          {downloadingPDF
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />GÃ©nÃ©rationâ¦</>
            : <><Download className="mr-1.5 h-3.5 w-3.5" />TÃ©lÃ©charger PDF</>
          }
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Imprimer
        </Button>
      </div>

      <div id="facture-content" className="max-w-3xl mx-auto px-8 py-12">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="text-2xl font-bold text-blue-900">{clinique.nomClinique ?? "Cabinet VÃ©tÃ©rinaire"}</div>
            <div className="text-sm text-gray-500 mt-3">
              {clinique.adresse && <>{clinique.adresse}<br /></>}
              {(clinique.codePostal || clinique.ville) && <>{[clinique.codePostal, clinique.ville].filter(Boolean).join(" ")}<br /></>}
              {clinique.telephone && <>TÃ©l : {clinique.telephone}<br /></>}
              {clinique.email && <>Email : {clinique.email}</>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-800">FACTURE</div>
            <div className="text-lg font-semibold text-blue-800 mt-1">{facture.numero}</div>
            <div className="text-sm text-gray-500 mt-2">
              Date d'Ã©mission : <strong>{formatDateFR(facture.dateEmission)}</strong>
            </div>
            {facture.datePaiement && (
              <div className="text-sm text-gray-500">
                Date de paiement : <strong>{formatDateFR(facture.datePaiement)}</strong>
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
                {facture.statut === "payee" ? "PayÃ©e" : facture.statut === "annulee" ? "AnnulÃ©e" : "En attente"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-400 font-semibold mb-2 tracking-wider">PropriÃ©taire</div>
            {owner ? (
              <>
                <div className="font-semibold text-gray-800">{owner.prenom} {owner.nom}</div>
                {owner.adresse && <div className="text-sm text-gray-600 mt-1">{owner.adresse}</div>}
                {owner.telephone && <div className="text-sm text-gray-600">TÃ©l : {owner.telephone}</div>}
                {owner.email && <div className="text-sm text-gray-600">{owner.email}</div>}
              </>
            ) : (
              <div className="text-sm text-gray-400">Non renseignÃ©</div>
            )}
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-xs uppercase text-gray-400 font-semibold mb-2 tracking-wider">Patient</div>
            {patient ? (
              <>
                <div className="font-semibold text-gray-800">{patient.nom}</div>
                <div className="text-sm text-gray-600">
                  {patient.espece && <span className="capitalize">{patient.espece}</span>}
                  {patient.race && <span> â {patient.race}</span>}
                </div>
                {patient.sexe && <div className="text-sm text-gray-500">{patient.sexe}</div>}
              </>
            ) : (
              <div className="text-sm text-gray-400">Non renseignÃ©</div>
            )}
            {facture.consultation && (
              <div className="text-xs text-gray-400 mt-2">
                Consultation du {formatDateFR(facture.consultation.date)}
                {facture.consultation.veterinaire && ` â Dr. ${facture.consultation.veterinaire}`}
              </div>
            )}
          </div>
        </div>

        <table className="w-full mb-8 text-sm">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="text-left px-3 py-2 rounded-tl-md">Description</th>
              <th className="text-center px-3 py-2">QtÃ©</th>
              <th className="text-right px-3 py-2">PU HT</th>
              <th className="text-right px-3 py-2">PU TTC</th>
              <th className="text-right px-3 py-2">Total HT</th>
              <th className="text-right px-3 py-2 rounded-tr-md">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-400 italic">Aucun acte enregistrÃ©</td>
              </tr>
            ) : (
              lignes.map((ligne: any, idx: number) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{ligne.description || ligne.acte?.nom || "â"}</div>
                    {ligne.acte?.code && <div className="text-xs text-gray-400">{ligne.acte.code}</div>}
                  </td>
                  <td className="text-center px-3 py-2 text-gray-700">{ligne.quantite}</td>
                  <td className="text-right px-3 py-2 text-gray-700">{ligne.prixUnitaire?.toFixed(2)} â¬</td>
                  <td className="text-right px-3 py-2 text-gray-700">{(ligne.prixUnitaire * 1.2)?.toFixed(2)} â¬</td>
                  <td className="text-right px-3 py-2 font-medium text-gray-800">{ligne.montantHT?.toFixed(2)} â¬</td>
                  <td className="text-right px-3 py-2 font-medium text-gray-800">{ligne.montantTTC?.toFixed(2)} â¬</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-72 space-y-1">
            {Object.entries(parCategorie).length > 1 && (
              <div className="mb-3">
                <div className="text-xs uppercase text-gray-400 font-semibold mb-1 tracking-wider">RÃ©capitulatif par catÃ©gorie</div>
                {Object.entries(parCategorie).map(([cat, montant]) => (
                  <div key={cat} className="flex justify-between text-sm text-gray-600 py-0.5">
                    <span>{categorieLabel[cat] ?? cat}</span>
                    <span>{(montant as number).toFixed(2)} â¬ HT</span>
                  </div>
                ))}
                <div className="border-t my-1" />
              </div>
            )}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex justify-between px-3 py-2 text-sm text-gray-600 bg-gray-50">
                <span>Total HT</span>
                <span className="font-medium">{totalHT.toFixed(2)} â¬</span>
              </div>
              <div className="flex justify-between px-3 py-2 text-sm text-gray-600">
                <span>TVA (20 %)</span>
                <span className="font-medium">{totalTVA.toFixed(2)} â¬</span>
              </div>
              <div className="flex justify-between px-3 py-2 text-base font-bold bg-blue-900 text-white">
                <span>Total TTC</span>
                <span>{totalTTC.toFixed(2)} â¬</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 text-xs text-gray-400 space-y-1">
          {(clinique.nomClinique || clinique.siret) && (
            <p>{clinique.nomClinique ?? ""}{clinique.siret ? ` â SIRET : ${clinique.siret}` : ""}</p>
          )}
          {clinique.numeroOrdre && (
            <p>NÂ° Ordre National des VÃ©tÃ©rinaires : {clinique.numeroOrdre}</p>
          )}
          {clinique.numTVA && (
            <p>NÂ° TVA intracommunautaire : {clinique.numTVA} â Code NAF : 7500Z (ActivitÃ©s vÃ©tÃ©rinaires)</p>
          )}
          <p>RÃ¨glement par virement, espÃ¨ces ou carte bancaire. Tout retard de paiement entraÃ®ne des pÃ©nalitÃ©s de 3 fois le taux lÃ©gal.</p>
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
