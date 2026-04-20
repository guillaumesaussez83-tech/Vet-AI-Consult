import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Stethoscope, Syringe, FileText, Receipt, Scissors,
  ChevronRight, AlertCircle,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";

const API_BASE = "/api";

type EventType = "consultation" | "vaccination" | "ordonnance" | "facture" | "chirurgie";

interface TimelineEvent {
  id: number;
  type: EventType;
  date: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  link?: string;
}

const EVENT_CONFIG: Record<EventType, {
  icon: React.ElementType;
  color: string;
  dot: string;
  label: string;
}> = {
  consultation: {
    icon: Stethoscope,
    color: "text-blue-600",
    dot: "bg-blue-500",
    label: "Consultation",
  },
  vaccination: {
    icon: Syringe,
    color: "text-green-600",
    dot: "bg-green-500",
    label: "Vaccination",
  },
  ordonnance: {
    icon: FileText,
    color: "text-purple-600",
    dot: "bg-purple-500",
    label: "Ordonnance",
  },
  facture: {
    icon: Receipt,
    color: "text-amber-600",
    dot: "bg-amber-500",
    label: "Facture",
  },
  chirurgie: {
    icon: Scissors,
    color: "text-red-600",
    dot: "bg-red-500",
    label: "Chirurgie",
  },
};

const STATUT_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  en_cours: { label: "En cours", variant: "default" },
  terminee: { label: "Terminée", variant: "outline" },
  planifiee: { label: "Planifiée", variant: "secondary" },
  payee: { label: "Payée", variant: "outline" },
  en_attente: { label: "En attente", variant: "secondary" },
  annulee: { label: "Annulée", variant: "destructive" },
};

function parseDate(d: string | undefined | null): Date | null {
  if (!d) return null;
  const parsed = parseISO(d);
  return isValid(parsed) ? parsed : null;
}

function formatDate(d: string | null | undefined): string {
  const parsed = parseDate(d);
  if (!parsed) return "—";
  return format(parsed, "d MMM yyyy", { locale: fr });
}

interface Props {
  patientId: number;
  consultations: any[];
}

export function PatientTimeline({ patientId, consultations }: Props) {
  const { data: vaccinations = [], isLoading: vacLoading } = useQuery<any[]>({
    queryKey: ["vaccinations", patientId],
    queryFn: () => fetch(`${API_BASE}/vaccinations/patient/${patientId}`).then(r => r.json()),
    enabled: !!patientId,
  });

  const { data: ordonnances = [], isLoading: ordLoading } = useQuery<any[]>({
    queryKey: ["ordonnances-patient", patientId],
    queryFn: () => fetch(`${API_BASE}/ordonnances?patientId=${patientId}`).then(r => r.json()),
    enabled: !!patientId,
  });

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    // Consultations
    for (const c of consultations ?? []) {
      const isChirurgie =
        (c.motif ?? "").toLowerCase().includes("chirurgie") ||
        (c.motif ?? "").toLowerCase().includes("opération") ||
        (c.motif ?? "").toLowerCase().includes("chirurgical");

      list.push({
        id: c.id,
        type: isChirurgie ? "chirurgie" : "consultation",
        date: c.date,
        label: c.motif ?? "Consultation",
        sublabel: c.veterinaire ? `Dr. ${c.veterinaire}` : undefined,
        badge: STATUT_BADGE[c.statut]?.label,
        badgeVariant: STATUT_BADGE[c.statut]?.variant,
        link: `/consultations/${c.id}`,
      });
    }

    // Vaccinations
    for (const v of vaccinations) {
      list.push({
        id: v.id,
        type: "vaccination",
        date: v.dateInjection ?? v.date,
        label: v.nomVaccin ?? v.type_vaccin ?? "Vaccination",
        sublabel: v.fabricant ? `Lot ${v.lotNumero ?? "—"} • ${v.fabricant}` : undefined,
        badge: v.dateRappel ? `Rappel ${formatDate(v.dateRappel)}` : undefined,
        badgeVariant: "secondary",
        link: `/patients/${patientId}/vaccinations`,
      });
    }

    // Ordonnances
    for (const o of ordonnances) {
      list.push({
        id: o.id,
        type: "ordonnance",
        date: o.createdAt,
        label: o.numeroOrdonnance ?? `Ordonnance #${o.id}`,
        sublabel: o.veterinaire ? `Dr. ${o.veterinaire}` : undefined,
        badge: o.genereIA ? "IA" : undefined,
        badgeVariant: "secondary",
        link: `/ordonnances/${o.id}/imprimer`,
      });
    }

    // Trier par date décroissante
    list.sort((a, b) => {
      const da = parseDate(a.date);
      const db_ = parseDate(b.date);
      if (!da && !db_) return 0;
      if (!da) return 1;
      if (!db_) return -1;
      return db_.getTime() - da.getTime();
    });

    return list;
  }, [consultations, vaccinations, ordonnances, patientId]);

  // Grouper par année
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      const parsed = parseDate(ev.date);
      const year = parsed ? format(parsed, "yyyy") : "Inconnu";
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(ev);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [events]);

  const isLoading = vacLoading || ordLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="w-0.5 h-10" />
            </div>
            <div className="flex-1 pb-4">
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Aucun événement enregistré</p>
        <p className="text-sm mt-1">Les consultations, vaccinations et ordonnances apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.entries(EVENT_CONFIG) as [EventType, typeof EVENT_CONFIG[EventType]][]).map(([type, cfg]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            <span>{cfg.label}</span>
          </div>
        ))}
      </div>

      {grouped.map(([year, yearEvents]) => (
        <div key={year}>
          {/* Year divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-sm font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {year}
            </div>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{yearEvents.length} événement{yearEvents.length > 1 ? "s" : ""}</span>
          </div>

          {/* Events */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-1">
              {yearEvents.map((ev, idx) => {
                const cfg = EVENT_CONFIG[ev.type];
                const Icon = cfg.icon;
                const isLast = idx === yearEvents.length - 1;
                const parsedDate = parseDate(ev.date);

                const content = (
                  <div
                    className={`flex gap-4 group relative ${ev.link ? "cursor-pointer" : ""}`}
                  >
                    {/* Dot + Icon */}
                    <div className="flex flex-col items-center relative z-10">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 border-background shadow-sm ${cfg.dot} bg-opacity-15`}
                        style={{ backgroundColor: `color-mix(in srgb, currentColor 15%, transparent)` }}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${cfg.dot} bg-opacity-20`}>
                          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        </div>
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-transparent mt-1" style={{ minHeight: "1rem" }} />}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 pb-5 ${ev.link ? "group-hover:opacity-80 transition-opacity" : ""}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{ev.label}</span>
                            {ev.badge && (
                              <Badge variant={ev.badgeVariant ?? "outline"} className="text-[10px] px-1.5 py-0">
                                {ev.badge}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>{parsedDate ? format(parsedDate, "d MMMM yyyy", { locale: fr }) : "—"}</span>
                            {ev.sublabel && (
                              <>
                                <span className="opacity-40">•</span>
                                <span>{ev.sublabel}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {ev.link && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div key={`${ev.type}-${ev.id}`}>
                    {ev.link ? (
                      <Link href={ev.link}>{content}</Link>
                    ) : (
                      content
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
