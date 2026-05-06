import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const VET_COLORS = [
  "#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6",
  "#EC4899","#06B6D4","#84CC16","#F97316","#6366F1",
];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return VET_COLORS[Math.abs(h) % VET_COLORS.length];
}

interface Rdv {
  id: number;
  patientNom?: string;
  proprietaireNom?: string;
  date: string;
  heure: string;
  duree?: number;
  motif?: string;
  status?: string;
  vetUserId?: string;
  vetNom?: string;
}

interface VetUser {
  id: string;
  firstName?: string;
  lastName?: string;
  agendaColor?: string;
}

export default function AgendaCalendarPage() {
  const [hiddenVets, setHiddenVets] = useState<Set<string>>(new Set());

  const { data: rdvData } = useQuery<{ data: Rdv[] }>({
    queryKey: ["rdv-calendar"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/rdv`);
      if (!r.ok) throw new Error("Erreur chargement RDV");
      return r.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: usersData } = useQuery<{ data: VetUser[] }>({
    queryKey: ["admin-users-calendar"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/users`);
      if (!r.ok) return { data: [] };
      return r.json();
    },
    staleTime: 1000 * 60 * 10,
  });

  const vetColorMap = useMemo(() => {
    const map: Record<string, { color: string; nom: string }> = {};
    (usersData?.data ?? []).forEach((u) => {
      const nom = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.id;
      map[u.id] = { color: u.agendaColor ?? hashColor(u.id), nom };
    });
    return map;
  }, [usersData]);

  const events = useMemo(() => {
    return (rdvData?.data ?? [])
      .filter(r => !r.vetUserId || !hiddenVets.has(r.vetUserId))
      .map(r => {
        const start = r.date ? `${r.date.slice(0,10)}T${(r.heure ?? "09:00").slice(0,5)}` : r.date;
        const durationMin = r.duree ?? 30;
        const endDate = new Date(start);
        endDate.setMinutes(endDate.getMinutes() + durationMin);
        const vetInfo = r.vetUserId ? vetColorMap[r.vetUserId] : null;
        return {
          id: String(r.id),
          title: [r.patientNom, r.motif].filter(Boolean).join(" — ") || "RDV",
          start,
          end: endDate.toISOString(),
          backgroundColor: vetInfo?.color ?? "#6366F1",
          borderColor: vetInfo?.color ?? "#6366F1",
          extendedProps: { rdv: r },
        };
      });
  }, [rdvData, vetColorMap, hiddenVets]);

  const vets = useMemo(() => Object.entries(vetColorMap), [vetColorMap]);

  const toggleVet = (id: string) => {
    setHiddenVets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda</h1>
        {vets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {vets.map(([id, { color, nom }]) => (
              <button
                key={id}
                onClick={() => toggleVet(id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border transition-opacity ${hiddenVets.has(id) ? "opacity-40" : "opacity-100"}`}
                style={{ borderColor: color, color }}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {nom}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          locale={frLocale}
          initialView="timeGridWeek"
          firstDay={1}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          height="auto"
          events={events}
          eventClick={({ event }) => {
            const rdv = event.extendedProps.rdv as Rdv;
            alert(`${rdv.patientNom ?? "?"} — ${rdv.proprietaireNom ?? ""}
Motif: ${rdv.motif ?? "-"}
Durée: ${rdv.duree ?? 30} min
Statut: ${rdv.status ?? "-"}`);
          }}
        />
      </div>
    </div>
  );
}
