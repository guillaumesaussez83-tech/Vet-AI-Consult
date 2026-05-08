import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

type Tab = "infos" | "poids" | "medical" | "rappels" | "ordonnances";

const TABS: { id: Tab; label: string }[] = [
  { id: "infos", label: "Informations" },
  { id: "poids", label: "Courbe de poids" },
  { id: "medical", label: "Historique mÃ©dical" },
  { id: "rappels", label: "Rappels vaccins" },
  { id: "ordonnances", label: "Ordonnances" },
];

const ESPECES_ICONS: Record<string, string> = {
  chien: "ð", chat: "ð", nac: "ð", oiseau: "ð¦", reptile: "ð¦",
};

// Safe JSON array parser — prevents crash on malformed data
function safeParseArray(val: unknown): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string' || !val.trim()) return [];
  try { return JSON.parse(val) as any[]; } catch { return []; }
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("infos");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [weightForm, setWeightForm] = useState({ weight: "", measuredAt: new Date().toISOString().slice(0, 10), notes: "" });

  // Fetch patient
  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const r = await fetch(`/api/patients/${id}`);
      const d = await r.json();
      return d.data;
    },
  });

  // Fetch weight history
  const { data: weights = [] } = useQuery({
    queryKey: ["weight-history", id],
    queryFn: async () => {
      const r = await fetch(`/api/weight-history/${id}`);
      const d = await r.json();
      return d.data || [];
    },
    enabled: activeTab === "poids",
  });

  // Fetch consultations
  const { data: consultations = [] } = useQuery({
    queryKey: ["patient-consultations", id],
    queryFn: async () => {
      const r = await fetch(`/api/consultations?patientId=${id}`);
      const d = await r.json();
      return d.data || [];
    },
    enabled: activeTab === "medical",
  });

  // Fetch vaccins / rappels
  const { data: rappels = [] } = useQuery({
    queryKey: ["patient-rappels", id],
    queryFn: async () => {
      const r = await fetch(`/api/rappels?patientId=${id}`);
      const d = await r.json();
      return d.data || [];
    },
    enabled: activeTab === "rappels",
  });

  // Fetch ordonnances
  const { data: ordonnances = [] } = useQuery({
    queryKey: ["patient-ordonnances", id],
    queryFn: async () => {
      const r = await fetch(`/api/ordonnances?patientId=${id}`);
      const d = await r.json();
      return d.data || [];
    },
    enabled: activeTab === "ordonnances",
  });

  // Update patient
  const updatePatient = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/patients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", id] });
      setEditMode(false);
    },
  });

  // Add weight
  const addWeight = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/weight-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: id, ...data }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-history", id] });
      qc.invalidateQueries({ queryKey: ["patient", id] });
      setShowAddWeight(false);
      setWeightForm({ weight: "", measuredAt: new Date().toISOString().slice(0, 10), notes: "" });
    },
  });

  // Delete weight
  const deleteWeight = useMutation({
    mutationFn: async (wid: number) => {
      await fetch(`/api/weight-history/${wid}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight-history", id] }),
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!patient) return (
    <div className="p-6 text-center text-gray-500">Animal introuvable</div>
  );

  const age = patient.date_naissance
    ? Math.floor((Date.now() - new Date(patient.date_naissance).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  // PrÃ©parer donnÃ©es courbe poids
  const weightData = weights.map((w: any) => ({
    date: new Date(w.measured_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }),
    poids: parseFloat(w.weight),
    motif: w.consultation_motif,
    id: w.id,
  }));

  const weightMin = weightData.length > 0 ? Math.min(...weightData.map((w: any) => w.poids)) : 0;
  const weightMax = weightData.length > 0 ? Math.max(...weightData.map((w: any) => w.poids)) : 10;
  const weightPad = (weightMax - weightMin) * 0.15 || 1;

  const icon = ESPECES_ICONS[(patient.espece || "").toLowerCase()] || "ð¾";

  const vaccinsAVenir = rappels.filter((r: any) => r.statut !== "FAIT" && new Date(r.date_rappel) <= new Date(Date.now() + 60 * 24 * 3600 * 1000));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      {patient.owner_id && (
        <Link href={`/proprietaires/${patient.owner_id}`}>
          <button className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour au propriÃ©taire
          </button>
        </Link>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-3xl">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{patient.nom}</h1>
                {vaccinsAVenir.length > 0 && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {vaccinsAVenir.length} rappel{vaccinsAVenir.length > 1 ? "s" : ""} Ã  venir
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-sm text-gray-500 mt-1">
                <span>{patient.espece} Â· {patient.race}</span>
                {patient.sexe && <span>Â· {patient.sexe === "M" ? "â MÃ¢le" : "â Femelle"}</span>}
                {age !== null && <span>Â· {age} ans</span>}
                {patient.poids && <span>Â· {patient.poids} kg</span>}
              </div>
              {patient.owner_nom && (
                <div className="text-xs text-gray-400 mt-1">
                  PropriÃ©taire : <Link href={`/proprietaires/${patient.owner_id}`}><span className="text-blue-600 hover:underline cursor-pointer">{patient.owner_prenom} {patient.owner_nom}</span></Link>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => { setEditMode(true); setEditData({ ...patient }); }}
            className="text-sm text-blue-600 hover:underline px-3 py-1.5 border border-blue-200 rounded-lg"
          >
            Modifier
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.id
                ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Infos */}
      {activeTab === "infos" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {editMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { k: "nom", l: "Nom" }, { k: "espece", l: "EspÃ¨ce" },
                  { k: "race", l: "Race" }, { k: "sexe", l: "Sexe" },
                  { k: "date_naissance", l: "Date de naissance", type: "date" },
                  { k: "poids", l: "Poids (kg)", type: "number" },
                  { k: "couleur", l: "Couleur/robe" }, { k: "puce", l: "NÂ° puce/tatouage" },
                  { k: "sterilise", l: "StÃ©rilisÃ©(e)" }, { k: "assurance", l: "Assurance" },
                ].map(({ k, l, type }) => (
                  <div key={k}>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{l}</label>
                    <input
                      type={type || "text"}
                      step={type === "number" ? "0.1" : undefined}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editData[k] || ""}
                      onChange={e => setEditData({ ...editData, [k]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">AntÃ©cÃ©dents / Notes</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-20 resize-none"
                  value={editData.antecedents || ""}
                  onChange={e => setEditData({ ...editData, antecedents: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Annuler</button>
                <button
                  onClick={() => updatePatient.mutate(editData)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {updatePatient.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                ["EspÃ¨ce", patient.espece], ["Race", patient.race],
                ["Sexe", patient.sexe === "M" ? "MÃ¢le" : patient.sexe === "F" ? "Femelle" : patient.sexe],
                ["Date de naissance", patient.date_naissance ? new Date(patient.date_naissance).toLocaleDateString("fr-FR") : null],
                ["Ãge", age !== null ? `${age} ans` : null],
                ["Poids actuel", patient.poids ? `${patient.poids} kg` : null],
                ["Couleur/robe", patient.couleur], ["NÂ° puce/tatouage", patient.puce],
                ["StÃ©rilisÃ©(e)", patient.sterilise ? "Oui" : "Non"],
                ["Assurance", patient.assurance],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <span className="text-xs font-semibold text-gray-400 uppercase">{label}</span>
                  <p className="text-sm text-gray-800 mt-0.5">{val || <span className="text-gray-400 italic">Non renseignÃ©</span>}</p>
                </div>
              ))}
              {patient.antecedents && (
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase">AntÃ©cÃ©dents / Notes</span>
                  <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-line">{patient.antecedents}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Poids */}
      {activeTab === "poids" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Suivi pondÃ©ral
              {patient.poids && <span className="text-base font-normal text-gray-500 ml-2">â Actuel : {patient.poids} kg</span>}
            </h2>
            <button
              onClick={() => setShowAddWeight(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Ajouter une pesÃ©e
            </button>
          </div>

          {showAddWeight && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Poids (kg)</label>
                  <input
                    type="number" step="0.1"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={weightForm.weight}
                    onChange={e => setWeightForm({ ...weightForm, weight: e.target.value })}
                    placeholder="ex: 8.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={weightForm.measuredAt}
                    onChange={e => setWeightForm({ ...weightForm, measuredAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Note</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={weightForm.notes}
                    onChange={e => setWeightForm({ ...weightForm, notes: e.target.value })}
                    placeholder="optionnel"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-3">
                <button onClick={() => setShowAddWeight(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
                <button
                  onClick={() => addWeight.mutate(weightForm)}
                  disabled={!weightForm.weight}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addWeight.isPending ? "..." : "Ajouter"}
                </button>
              </div>
            </div>
          )}

          {weightData.length < 2 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 shadow-sm">
              <p className="font-medium">Pas assez de donnÃ©es pour afficher la courbe</p>
              <p className="text-sm mt-1">Ajoutez au moins 2 pesÃ©es</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={weightData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                  <YAxis
                    domain={[weightMin - weightPad, weightMax + weightPad]}
                    tick={{ fontSize: 11 }}
                    unit=" kg"
                    width={60}
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val} kg`, "Poids"]}
                    labelFormatter={(label) => `Date : ${label}`}
                  />
                  <ReferenceLine y={weightMin} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `Min: ${weightMin}kg`, fill: "#ef4444", fontSize: 10 }} />
                  <ReferenceLine y={weightMax} stroke="#22c55e" strokeDasharray="3 3" label={{ value: `Max: ${weightMax}kg`, fill: "#22c55e", fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="poids"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#3b82f6" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tableau pesÃ©es */}
          {weights.length > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Poids</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Contexte</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...weights].reverse().map((w: any) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{new Date(w.measured_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 font-semibold">{parseFloat(w.weight).toFixed(2)} kg</td>
                      <td className="px-4 py-3 text-gray-500">{w.consultation_motif || w.notes || "â"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { if (confirm("Supprimer cette pesÃ©e ?")) deleteWeight.mutate(w.id); }}
                          className="text-gray-300 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Historique mÃ©dical */}
      {activeTab === "medical" && (
        <div className="space-y-3">
          {consultations.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">Aucune consultation enregistrÃ©e</div>
          ) : (
            consultations.map((c: any) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-500">
                        {new Date(c.date_heure || c.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      {c.veterinaire && <span className="text-xs text-blue-600">Â· Dr {c.veterinaire}</span>}
                    </div>
                    <div className="font-semibold text-gray-800">{c.motif}</div>
                    {c.diagnostic && <p className="text-sm text-gray-600 mt-1"><strong>Diagnostic :</strong> {c.diagnostic}</p>}
                    {c.traitement && <p className="text-sm text-gray-600 mt-0.5"><strong>Traitement :</strong> {c.traitement}</p>}
                    {c.notes && <p className="text-sm text-gray-500 mt-1 italic">{c.notes}</p>}
                  </div>
                  {c.poids_mesure && (
                    <div className="text-right ml-4">
                      <div className="text-xs text-gray-400">Poids</div>
                      <div className="font-bold text-gray-700">{c.poids_mesure} kg</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Rappels vaccins */}
      {activeTab === "rappels" && (
        <div className="space-y-3">
          {rappels.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">Aucun rappel enregistrÃ©</div>
          ) : (
            rappels.map((r: any) => {
              const dueDate = new Date(r.date_rappel);
              const isOverdue = dueDate < new Date() && r.statut !== "FAIT";
              const isSoon = !isOverdue && dueDate <= new Date(Date.now() + 30 * 24 * 3600 * 1000) && r.statut !== "FAIT";
              return (
                <div key={r.id} className={`bg-white rounded-xl border p-4 shadow-sm ${
                  isOverdue ? "border-red-200 bg-red-50" : isSoon ? "border-orange-200 bg-orange-50" : "border-gray-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-800">{r.type}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{r.nom_vaccin}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        PrÃ©vu le {dueDate.toLocaleDateString("fr-FR")}
                        {r.last_date && ` Â· Dernier : ${new Date(r.last_date).toLocaleDateString("fr-FR")}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.statut === "FAIT" ? (
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">â Fait</span>
                      ) : isOverdue ? (
                        <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">En retard</span>
                      ) : isSoon ? (
                        <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">BientÃ´t</span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">PlanifiÃ©</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Ordonnances */}
      {activeTab === "ordonnances" && (
        <div className="space-y-3">
          {ordonnances.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">Aucune ordonnance</div>
          ) : (
            ordonnances.map((o: any) => (
              <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800">Ordonnance #{o.numero || o.id}</span>
                      <span className="text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    {o.veterinaire && <div className="text-sm text-gray-500">Dr {o.veterinaire}</div>}
                    {o.lignes && (
                      <div className="mt-2 space-y-1">
                        {safeParseArray(o.lignes).map((l: any, i: number) => (
                          <div key={i} className="text-sm text-gray-700">
                            <span className="font-medium">{l.medicament}</span>
                            {l.posologie && <span className="text-gray-500"> â {l.posologie}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {o.pdf_url && (
                    <a href={o.pdf_url} target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
