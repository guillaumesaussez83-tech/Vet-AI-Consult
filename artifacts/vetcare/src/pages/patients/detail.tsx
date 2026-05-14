import { useRoute, Link } from "wouter";
import { useGetPatient, useListPatientConsultations, getGetPatientQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Dog, Cat, Rabbit, Bird, Syringe, ShieldCheck, ShieldAlert, ChevronRight, FileText, Loader2, Check, Download, Heart } from "lucide-react";
import { formatDateFR } from "@/lib/utils";
import { PatientTimeline } from "@/components/PatientTimeline";
import { WeightChart } from "@/components/WeightChart";
import { PorteeForm } from "@/components/PorteeForm";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const especeIcon: Record<string, React.ElementType> = {
  chien: Dog, chat: Cat, lapin: Rabbit, oiseau: Bird,
};

type Tab = "timeline" | "infos";

export default function PatientDetailPage() {
  const [showPorteeForm, setShowPorteeForm] = useState(false);
  const [, params] = useRoute("/patients/:id");
  const id = parseInt(params?.id ?? "0");
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [rgpdLoading, setRgpdLoading] = useState<"generate" | "confirm" | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: patient, isLoading } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });
  const { data: consultations = [] } = useListPatientConsultations(id, {
    query: { enabled: !!id, queryKey: ["patient-consultations", id] }
  });

  async function handleGenerateRgpd(ownerId: number, ownerNom: string) {
    setRgpdLoading("generate");
    try {
      const r = await fetch(`/api/owners/${ownerId}/rgpd/generate`, { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consentement-rgpd-${ownerNom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ownerId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Formulaire RGPD gÃ©nÃ©rÃ©", description: "Le PDF a Ã©tÃ© tÃ©lÃ©chargÃ© pour impression et signature." });
      queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(id) });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de gÃ©nÃ©rer le formulaire RGPD.", variant: "destructive" });
    } finally {
      setRgpdLoading(null);
    }
  }

  async function handleConfirmRgpd(ownerId: number) {
    setRgpdLoading("confirm");
    try {
      const r = await fetch(`/api/owners/${ownerId}/rgpd/confirm`, { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: "Consentement enregistrÃ©", description: "Le consentement RGPD a Ã©tÃ© marquÃ© comme obtenu." });
      queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible d'enregistrer le consentement.", variant: "destructive" });
    } finally {
      setRgpdLoading(null);
    }
  }

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );

  if (!patient) return <div className="text-center py-16 text-muted-foreground">Patient non trouvÃ©</div>;

  const Icon = especeIcon[patient.espece] ?? Dog;
  const p = patient as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/patients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2.5 ${p.agressif ? "bg-red-100" : "bg-primary/10"}`}>
              <Icon className={`h-6 w-6 ${p.agressif ? "text-red-600" : "text-primary"}`} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{patient.nom}</h1>
                {p.agressif && (
                  <span className="inline-flex items-center bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-lg tracking-wide shadow">
                    AGRESSIF
                  </span>
                )}
                {p.consentementRgpd && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" /> RGPD
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">
                {patient.race || patient.espece} â¢ {patient.sexe}
                {patient.poids && ` â¢ ${patient.poids} kg`}
                {patient.dateNaissance && ` â¢ NÃ©(e) le ${formatDateFR(patient.dateNaissance)}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/patients/${patient.id}/vaccinations`}>
            <Button variant="outline" size="sm">
              <Syringe className="mr-2 h-4 w-4" />
              Vaccinations
            </Button>
          </Link>
          <Link href={`/consultations/nouvelle?patientId=${patient.id}`}>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle consultation
            </Button>
          </Link>
        </div>
      </div>

      {/* Alertes mÃ©dicales */}
      {(patient.allergies || patient.antecedents) && (
        <div className="grid gap-3 md:grid-cols-2">
          {patient.allergies && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <span className="text-destructive font-bold text-sm mt-0.5">â </span>
              <div>
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Allergies</p>
                <p className="text-sm text-destructive mt-0.5">{patient.allergies}</p>
              </div>
            </div>
          )}
          {patient.antecedents && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <span className="text-amber-600 font-bold text-sm mt-0.5">ð</span>
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">AntÃ©cÃ©dents</p>
                <p className="text-sm text-amber-800 mt-0.5">{patient.antecedents}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { id: "timeline", label: "Timeline mÃ©dicale" },
          { id: "infos", label: "Informations" },
        ] as { id: Tab; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Timeline */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          {/* Graphique poids */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                ð Ãvolution du poids
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WeightChart consultations={consultations} />
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Historique chronologique</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {consultations.length} consultation{consultations.length > 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <PatientTimeline patientId={id} consultations={consultations} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Informations */}
      {activeTab === "infos" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations du patient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <span className="text-muted-foreground">EspÃ¨ce</span>
                <span className="capitalize">{patient.espece}</span>
                {patient.race && <>
                  <span className="text-muted-foreground">Race</span>
                  <span>{patient.race}</span>
                </>}
                <span className="text-muted-foreground">Sexe</span>
                <span>
                  {patient.sexe}
                  {patient.sterilise && <Badge variant="secondary" className="ml-2 text-xs">StÃ©rilisÃ©(e)</Badge>}
                </span>
                {patient.dateNaissance && <>
                  <span className="text-muted-foreground">Naissance</span>
                  <span>{formatDateFR(patient.dateNaissance)}</span>
                </>}
                {patient.poids && <>
                  <span className="text-muted-foreground">Poids</span>
                  <span>{patient.poids} kg</span>
                </>}
                {patient.couleur && <>
                  <span className="text-muted-foreground">Couleur / Robe</span>
                  <span>{patient.couleur}</span>
                </>}
              </div>

              {(p.puce || p.passeport || p.assurance) && (
                <div className="border-t pt-3 space-y-1.5">
                  {p.puce && (
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-24 shrink-0">Puce</span>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{p.puce}</span>
                    </div>
                  )}
                  {p.passeport && (
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-24 shrink-0">Passeport</span>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{p.passeport}</span>
                    </div>
                  )}
                  {p.assurance && (
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-24 shrink-0">Assurance</span>
                      <span className="text-green-700 font-medium">{p.assuranceNom || "Oui"}</span>
                    </div>
                  )}
                </div>
              )}

              {p.consentementRgpd && (
                <div className="border-t pt-3 flex items-center gap-2 text-xs text-green-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Consentement RGPD recueilli
                  {p.dateConsentement && ` le ${new Date(p.dateConsentement).toLocaleDateString("fr-FR")}`}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>PropriÃ©taire</span>
                {patient.owner && ((patient.owner as any).rgpdAccepted ? (
                  <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                    <ShieldCheck className="h-3 w-3" /> RGPD signÃ©
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                    <ShieldAlert className="h-3 w-3" /> RGPD Ã  recueillir
                  </Badge>
                ))}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {patient.owner ? (
                <>
                  <div className="text-xl font-semibold">{patient.owner.prenom} {patient.owner.nom}</div>
                  {patient.owner.telephone && (
                    <a href={`tel:${patient.owner.telephone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                      ð {patient.owner.telephone}
                    </a>
                  )}
                  {patient.owner.email && (
                    <a href={`mailto:${patient.owner.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                      â {patient.owner.email}
                    </a>
                  )}
                  {patient.owner.adresse && (
                    <p className="text-muted-foreground">ð {patient.owner.adresse}</p>
                  )}

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Consentement RGPD
                    </div>
                    {(patient.owner as any).rgpdAccepted ? (
                      <p className="text-xs text-green-700 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Recueilli
                        {(patient.owner as any).rgpdAcceptedAt && (
                          <> le {new Date((patient.owner as any).rgpdAcceptedAt).toLocaleDateString("fr-FR")}</>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Non recueilli â Ã  imprimer et faire signer
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateRgpd(patient.owner!.id, patient.owner!.nom)}
                        disabled={rgpdLoading !== null}
                      >
                        {rgpdLoading === "generate" ? (
                          <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />GÃ©nÃ©rationâ¦</>
                        ) : (
                          <><Download className="mr-2 h-3.5 w-3.5" />GÃ©nÃ©rer formulaire RGPD</>
                        )}
                      </Button>
                      {!(patient.owner as any).rgpdAccepted && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmRgpd(patient.owner!.id)}
                          disabled={rgpdLoading !== null}
                        >
                          {rgpdLoading === "confirm" ? (
                            <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Enregistrementâ¦</>
                          ) : (
                            <><Check className="mr-2 h-3.5 w-3.5" />Marquer comme obtenu</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Aucun propriÃ©taire</p>
              )}
            </CardContent>
          </Card>

                   {/* Portées & Reproducteurs */}
          <Card className="col-span-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-500" />
                Portées &amp; Reproducteurs
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowPorteeForm(v => !v)}>
                {showPorteeForm ? "Annuler" : "Enregistrer une portée"}
              </Button>
            </CardHeader>
            {showPorteeForm && (
              <CardContent>
                <PorteeForm motherPatient={patient as any} onSuccess={() => setShowPorteeForm(false)} />
              </CardContent>
            )}
          </Card>

 {/* AccÃ¨s rapides */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">AccÃ¨s rapides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { href: `/consultations?patientId=${id}`, label: "Consultations", count: consultations.length, icon: "ð©º" },
                  { href: `/patients/${id}/vaccinations`, label: "Vaccinations", count: null, icon: "ð" },
                  { href: `/ordonnances?patientId=${id}`, label: "Ordonnances", count: null, icon: "ð" },
                  { href: `/consultations/nouvelle?patientId=${id}`, label: "Nouvelle consultation", count: null, icon: "â" },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors group">
                      <div className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.count !== null && (
                          <Badge variant="secondary" className="text-xs">{item.count}</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
