import { useRoute, Link } from "wouter";
import { useGetPatient, useListPatientConsultations, getGetPatientQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Dog, Cat, Rabbit, Bird, Syringe, ShieldCheck, ChevronRight } from "lucide-react";
import { formatDateFR } from "@/lib/utils";
import { PatientTimeline } from "@/components/PatientTimeline";
import { useState } from "react";

const especeIcon: Record<string, React.ElementType> = {
  chien: Dog, chat: Cat, lapin: Rabbit, oiseau: Bird,
};

type Tab = "timeline" | "infos";

export default function PatientDetailPage() {
  const [, params] = useRoute("/patients/:id");
  const id = parseInt(params?.id ?? "0");
  const [activeTab, setActiveTab] = useState<Tab>("timeline");

  const { data: patient, isLoading } = useGetPatient(id, {
    query: { enabled: !!id, queryKey: getGetPatientQueryKey(id) }
  });
  const { data: consultations = [] } = useListPatientConsultations(id, {
    query: { enabled: !!id, queryKey: ["patient-consultations", id] }
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );

  if (!patient) return <div className="text-center py-16 text-muted-foreground">Patient non trouvé</div>;

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
                {patient.race || patient.espece} • {patient.sexe}
                {patient.poids && ` • ${patient.poids} kg`}
                {patient.dateNaissance && ` • Né(e) le ${formatDateFR(patient.dateNaissance)}`}
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

      {/* Alertes médicales */}
      {(patient.allergies || patient.antecedents) && (
        <div className="grid gap-3 md:grid-cols-2">
          {patient.allergies && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <span className="text-destructive font-bold text-sm mt-0.5">⚠</span>
              <div>
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Allergies</p>
                <p className="text-sm text-destructive mt-0.5">{patient.allergies}</p>
              </div>
            </div>
          )}
          {patient.antecedents && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <span className="text-amber-600 font-bold text-sm mt-0.5">📋</span>
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Antécédents</p>
                <p className="text-sm text-amber-800 mt-0.5">{patient.antecedents}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { id: "timeline", label: "Timeline médicale" },
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
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Historique chronologique</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {consultations.length} consultation{consultations.length > 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PatientTimeline patientId={id} consultations={consultations} />
          </CardContent>
        </Card>
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
                <span className="text-muted-foreground">Espèce</span>
                <span className="capitalize">{patient.espece}</span>
                {patient.race && <>
                  <span className="text-muted-foreground">Race</span>
                  <span>{patient.race}</span>
                </>}
                <span className="text-muted-foreground">Sexe</span>
                <span>
                  {patient.sexe}
                  {patient.sterilise && <Badge variant="secondary" className="ml-2 text-xs">Stérilisé(e)</Badge>}
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
              <CardTitle>Propriétaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {patient.owner ? (
                <>
                  <div className="text-xl font-semibold">{patient.owner.prenom} {patient.owner.nom}</div>
                  {patient.owner.telephone && (
                    <a href={`tel:${patient.owner.telephone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                      📞 {patient.owner.telephone}
                    </a>
                  )}
                  {patient.owner.email && (
                    <a href={`mailto:${patient.owner.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                      ✉ {patient.owner.email}
                    </a>
                  )}
                  {patient.owner.adresse && (
                    <p className="text-muted-foreground">📍 {patient.owner.adresse}</p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Aucun propriétaire</p>
              )}
            </CardContent>
          </Card>

          {/* Accès rapides */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Accès rapides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { href: `/consultations?patientId=${id}`, label: "Consultations", count: consultations.length, icon: "🩺" },
                  { href: `/patients/${id}/vaccinations`, label: "Vaccinations", count: null, icon: "💉" },
                  { href: `/ordonnances?patientId=${id}`, label: "Ordonnances", count: null, icon: "📋" },
                  { href: `/consultations/nouvelle?patientId=${id}`, label: "Nouvelle consultation", count: null, icon: "➕" },
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
