import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const API_BASE = "/api";

interface Ordonnance {
  id: number;
  consultationId: number;
  patientId: number | null;
  veterinaire: string | null;
  contenu: string;
  numeroOrdonnance: string | null;
  genereIA: boolean;
  instructionsClient: string | null;
  createdAt: string;
}

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

async function fetchOrdonnance(id: number): Promise<Ordonnance> {
  const r = await fetch(`${API_BASE}/ordonnances/${id}`);
  if (!r.ok) throw new Error("Ordonnance non trouvée");
  return r.json();
}

async function fetchClinique(): Promise<ParametresClinique> {
  const r = await fetch(`${API_BASE}/parametres-clinique`);
  if (!r.ok) return {} as ParametresClinique;
  return r.json();
}

async function fetchPatient(id: number) {
  const r = await fetch(`${API_BASE}/patients/${id}`);
  if (!r.ok) return null;
  return r.json();
}

export default function OrdonnanceImprimerPage() {
  const [, params] = useRoute("/ordonnances/:id/imprimer");
  const id = parseInt(params?.id ?? "0");

  const { data: ordonnance, isLoading: loadingOrd } = useQuery({
    queryKey: ["ordonnance", id],
    queryFn: () => fetchOrdonnance(id),
    enabled: !!id,
  });

  const { data: clinique } = useQuery({
    queryKey: ["parametres-clinique"],
    queryFn: fetchClinique,
  });

  const { data: patient } = useQuery({
    queryKey: ["patient", ordonnance?.patientId],
    queryFn: () => fetchPatient(ordonnance!.patientId!),
    enabled: !!ordonnance?.patientId,
  });

  if (loadingOrd) {
    return (
      <div className="max-w-2xl mx-auto p-8 space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!ordonnance) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-muted-foreground">Ordonnance non trouvée</p>
        <Link href="/ordonnances">
          <Button variant="outline" className="mt-4">Retour aux ordonnances</Button>
        </Link>
      </div>
    );
  }

  const dateOrd = new Date(ordonnance.createdAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="flex items-center gap-4 p-4 border-b print:hidden">
        <Link href="/ordonnances">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div className="flex-1" />
        <Button onClick={() => window.print()} size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </Button>
      </div>

      <div className="max-w-2xl mx-auto p-8 print:p-6 font-sans">
        <div className="border rounded-xl print:border print:rounded-none overflow-hidden">
          {/* Header — Clinique */}
          <div className="bg-blue-900 text-white px-8 py-6 print:bg-blue-900 print:text-white">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{clinique?.nomClinique ?? "Clinique Vétérinaire"}</h1>
                {clinique?.adresse && <p className="text-blue-200 text-sm mt-1">{clinique.adresse}</p>}
                {(clinique?.codePostal || clinique?.ville) && (
                  <p className="text-blue-200 text-sm">{[clinique?.codePostal, clinique?.ville].filter(Boolean).join(" ")}</p>
                )}
                {clinique?.telephone && <p className="text-blue-200 text-sm">Tél : {clinique.telephone}</p>}
                {clinique?.email && <p className="text-blue-200 text-sm">{clinique.email}</p>}
              </div>
              <div className="text-right text-blue-200 text-xs space-y-1">
                {clinique?.siret && <p>SIRET : {clinique.siret}</p>}
                {clinique?.numeroOrdre && <p>N° Ordre : {clinique.numeroOrdre}</p>}
                {clinique?.numTVA && <p>TVA : {clinique.numTVA}</p>}
              </div>
            </div>
          </div>

          {/* Ordonnance title */}
          <div className="px-8 py-5 border-b bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-blue-900">ORDONNANCE VETERINAIRE</h2>
                <p className="text-xs text-blue-700 mt-0.5">Prescription médicale — Document officiel</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium">{ordonnance.numeroOrdonnance ?? `N° ${String(ordonnance.id).padStart(5, "0")}`}</p>
                <p className="text-muted-foreground text-xs">{dateOrd}</p>
              </div>
            </div>
          </div>

          {/* Patient + Vétérinaire */}
          <div className="px-8 py-4 border-b grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Patient</p>
              {patient ? (
                <div className="space-y-0.5">
                  <p className="font-semibold">{patient.nom}</p>
                  <p className="text-muted-foreground">{patient.espece}{patient.race ? ` — ${patient.race}` : ""}</p>
                  {patient.sexe && <p className="text-muted-foreground">{patient.sexe}</p>}
                  {patient.poids && <p className="text-muted-foreground">Poids : {patient.poids} kg</p>}
                  {patient.owner && (
                    <p className="text-muted-foreground">
                      Propriétaire : {patient.owner.prenom} {patient.owner.nom}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground italic">Consultation #{ordonnance.consultationId}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Prescripteur</p>
              <p className="font-semibold">{ordonnance.veterinaire ?? clinique?.nomClinique ?? "—"}</p>
              {clinique?.numeroOrdre && <p className="text-muted-foreground text-xs">Ordre : {clinique.numeroOrdre}</p>}
            </div>
          </div>

          {/* Prescription content */}
          <div className="px-8 py-6">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Prescription</p>
            {(() => {
              const lignes = ordonnance.contenu.split("\n").filter(Boolean).map(line => {
                const parts = line.split(" — ");
                const get = (prefix: string) => {
                  const p = parts.find(s => s.startsWith(prefix));
                  return p ? p.slice(prefix.length).trim() : null;
                };
                return {
                  nom: parts[0]?.trim() ?? line,
                  dose: get("Dose :"),
                  voie: get("Voie :"),
                  frequence: get("Fréquence :"),
                  duree: get("Durée :"),
                  qte: get("Qté :"),
                };
              });
              const isStructured = lignes.some(l => l.dose || l.qte);
              if (isStructured) {
                return (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300 text-left">
                        <th className="py-2 pr-3 font-semibold">Médicament</th>
                        <th className="py-2 pr-3 font-semibold">Posologie</th>
                        <th className="py-2 pr-3 font-semibold">Voie</th>
                        <th className="py-2 pr-3 font-semibold">Durée</th>
                        <th className="py-2 text-right font-semibold">Qté</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((l, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2.5 pr-3 font-semibold">{l.nom}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{l.dose ?? "—"}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{l.voie ?? "—"}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{l.duree ?? "—"}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{l.qte ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              }
              return (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground border rounded-lg p-4 bg-gray-50">
                  {ordonnance.contenu}
                </div>
              );
            })()}
          </div>

          {/* Instructions client */}
          {ordonnance.instructionsClient && (
            <div className="px-8 py-5 border-t bg-amber-50">
              <p className="text-xs text-amber-700 font-medium uppercase tracking-wide mb-2">Instructions pour le propriétaire</p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
                {ordonnance.instructionsClient}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-5 border-t bg-muted/30">
            <div className="flex items-end justify-between">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Cette ordonnance est valable 3 mois à compter de la date de prescription.</p>
                <p>Médicaments délivrables sur présentation de cette ordonnance uniquement.</p>
                {clinique?.mentionsLegales && <p className="mt-1">{clinique.mentionsLegales}</p>}
              </div>
              <div className="text-right">
                <div className="h-16 w-36 border border-dashed rounded flex items-center justify-center text-xs text-muted-foreground">
                  Signature &amp; cachet
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
