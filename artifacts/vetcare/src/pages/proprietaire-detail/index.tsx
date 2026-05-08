import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import ReactMarkdown from "react-markdown";
type Tab = "infos" | "animaux" | "finances" | "courriers" | "rgpd";

const TABS: { id: Tab; label: string }[] = [
  { id: "infos", label: "Informations" },
  { id: "animaux", label: "Animaux" },
  { id: "finances", label: "Historique financier" },
  { id: "courriers", label: "Courriers" },
  { id: "rgpd", label: "RGPD" },
];

const LETTER_TYPES = ["RELANCE", "CONVOCATION", "INFORMATION", "BILAN", "AUTRE"];
const LETTER_TYPE_LABELS: Record<string, string> = {
  RELANCE: "Relance", CONVOCATION: "Convocation", INFORMATION: "Information",
  BILAN: "Bilan", AUTRE: "Autre",
};

export default function ProprietaireDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("infos");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [showNewLetter, setShowNewLetter] = useState(false);
  const [letterForm, setLetterForm] = useState({ type: "INFORMATION", subject: "", content: "", patientId: "", sendNow: false });

  // Fetch owner
  const { data: owner, isLoading } = useQuery({
    queryKey: ["owner", id],
    queryFn: async () => {
      const r = await fetch(`/api/owners/${id}`);
      const d = await r.json();
      return d.data;
    },
  });

  // Fetch patients
  const { data: patients = [] } = useQuery({
    queryKey: ["owner-patients", id],
    queryFn: async () => {
      const r = await fetch(`/api/owners/${id}/patients`);
      const d = await r.json();
      return d.data || [];
    },
  });

  // Fetch finances (factures)
  const { data: factures = [] } = useQuery({
    queryKey: ["owner-factures", id],
    queryFn: async () => {
      const r = await fetch(`/api/factures?ownerId=${id}`);
      const d = await r.json();
      return d.data || [];
    },
    enabled: activeTab === "finances",
  });

  // Fetch courriers
  const { data: courriers = [] } = useQuery({
    queryKey: ["owner-courriers", id],
    queryFn: async () => {
      const r = await fetch(`/api/client-letters?ownerId=${id}`);
      const d = await r.json();
      return d.data || [];
    },
    enabled: activeTab === "courriers",
  });

  // Fetch RDV no-show count
  const { data: rdvStats } = useQuery({
    queryKey: ["owner-rdv-stats", id],
    queryFn: async () => {
      const r = await fetch(`/api/rendez-vous?ownerId=${id}&limit=200`);
      const d = await r.json();
      const all = d.data || [];
      return {
        total: all.length,
        noShow: all.filter((r: any) => r.statut === "NO_SHOW").length,
        annule: all.filter((r: any) => r.statut === "ANNULE").length,
      };
    },
  });

  // Update owner
  const updateOwner = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/owners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", id] });
      setEditMode(false);
    },
  });

  // Create courrier
  const createLetter = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/client-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: id, ...data }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-courriers", id] });
      setShowNewLetter(false);
      setLetterForm({ type: "INFORMATION", subject: "", content: "", patientId: "", sendNow: false });
    },
  });

  // Delete courrier
  const deleteLetter = useMutation({
    mutationFn: async (lid: number) => {
      await fetch(`/api/client-letters/${lid}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-courriers", id] }),
  });

  // RGPD — anonymize (soft delete)
  const anonymizeOwner = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/owners/${id}/anonymize`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner", id] }),
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!owner) return (
    <div className="p-6 text-center text-gray-500">Propriétaire introuvable</div>
  );

  const totalFactures = factures.reduce((s: number, f: any) => s + (parseFloat(f.montant_ttc) || 0), 0);
  const totalRegle = factures.filter((f: any) => f.statut === "PAYE").reduce((s: number, f: any) => s + (parseFloat(f.montant_ttc) || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/proprietaires">
        <button className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour à la liste
        </button>
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
              {owner.prenom?.[0]}{owner.nom?.[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{owner.prenom} {owner.nom}</h1>
              <div className="flex gap-4 text-sm text-gray-500 mt-1">
                {owner.telephone && <span>📞 {owner.telephone}</span>}
                {owner.email && <span>✉️ {owner.email}</span>}
                {owner.ville && <span>📍 {owner.ville}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {(rdvStats?.noShow ?? 0) > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {rdvStats?.noShow} no-show
              </span>
            )}
            <button
              onClick={() => { setEditMode(true); setEditData({ ...owner }); }}
              className="text-sm text-blue-600 hover:underline px-3 py-1.5 border border-blue-200 rounded-lg"
            >
              Modifier
            </button>
          </div>
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
                {["nom", "prenom", "email", "telephone", "adresse", "ville", "code_postal", "pays"].map(f => (
                  <div key={f}>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{f.replace("_", " ")}</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editData[f] || ""}
                      onChange={e => setEditData({ ...editData, [f]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                <button
                  onClick={() => updateOwner.mutate(editData)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {updateOwner.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                ["Nom", owner.nom], ["Prénom", owner.prenom],
                ["Email", owner.email], ["Téléphone", owner.telephone],
                ["Adresse", owner.adresse], ["Ville", owner.ville],
                ["Code postal", owner.code_postal], ["Pays", owner.pays],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <span className="text-xs font-semibold text-gray-400 uppercase">{label}</span>
                  <p className="text-sm text-gray-800 mt-0.5">{val || <span className="text-gray-400 italic">Non renseigné</span>}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stats RDV */}
          {rdvStats && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Historique rendez-vous</h3>
              <div className="flex gap-4">
                <div className="text-center bg-gray-50 rounded-lg px-4 py-3 flex-1">
                  <div className="text-2xl font-bold text-gray-800">{rdvStats.total}</div>
                  <div className="text-xs text-gray-500">Total RDV</div>
                </div>
                <div className="text-center bg-red-50 rounded-lg px-4 py-3 flex-1">
                  <div className="text-2xl font-bold text-red-600">{rdvStats.noShow}</div>
                  <div className="text-xs text-gray-500">No-show</div>
                </div>
                <div className="text-center bg-orange-50 rounded-lg px-4 py-3 flex-1">
                  <div className="text-2xl font-bold text-orange-600">{rdvStats.annule}</div>
                  <div className="text-xs text-gray-500">Annulés</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Animaux */}
      {activeTab === "animaux" && (
        <div className="space-y-3">
          {patients.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              <p className="font-medium">Aucun animal enregistré</p>
            </div>
          ) : (
            patients.map((p: any) => (
              <Link key={p.id} href={`/patients/${p.id}`}>
                <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors cursor-pointer flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                      {p.nom?.[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{p.nom}</div>
                      <div className="text-xs text-gray-500">{p.espece} · {p.race} · {p.sexe}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    {p.poids && <span>{p.poids} kg</span>}
                    {p.date_naissance && (
                      <span>{Math.floor((Date.now() - new Date(p.date_naissance).getTime()) / (365.25 * 24 * 3600 * 1000))} ans</span>
                    )}
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Tab: Finances */}
      {activeTab === "finances" && (
        <div>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-gray-800">{totalFactures.toFixed(2)} €</div>
              <div className="text-xs text-gray-500 mt-1">Total facturé</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-green-600">{totalRegle.toFixed(2)} €</div>
              <div className="text-xs text-gray-500 mt-1">Réglé</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-red-600">{(totalFactures - totalRegle).toFixed(2)} €</div>
              <div className="text-xs text-gray-500 mt-1">Solde dû</div>
            </div>
          </div>

          {/* Table factures */}
          {factures.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">Aucune facture</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">N°</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Animal</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Montant TTC</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {factures.map((f: any) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{f.numero || f.id}</td>
                      <td className="px-4 py-3">{new Date(f.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3">{f.patient_nom || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{parseFloat(f.montant_ttc || 0).toFixed(2)} €</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          f.statut === "PAYE" ? "bg-green-100 text-green-700" :
                          f.statut === "IMPAYE" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {f.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Courriers */}
      {activeTab === "courriers" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Courriers clients</h2>
            <button
              onClick={() => setShowNewLetter(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Nouveau courrier
            </button>
          </div>

          {/* New letter form */}
          {showNewLetter && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
              <h3 className="font-semibold text-gray-800 mb-4">Rédiger un courrier</h3>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
                  <select
                    value={letterForm.type}
                    onChange={e => setLetterForm({ ...letterForm, type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {LETTER_TYPES.map(t => <option key={t} value={t}>{LETTER_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Animal concerné</label>
                  <select
                    value={letterForm.patientId}
                    onChange={e => setLetterForm({ ...letterForm, patientId: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Tous les animaux</option>
                    {patients.map((p: any) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Objet</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={letterForm.subject}
                  onChange={e => setLetterForm({ ...letterForm, subject: e.target.value })}
                  placeholder="Objet du courrier"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Contenu</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-28 resize-none"
                  value={letterForm.content}
                  onChange={e => setLetterForm({ ...letterForm, content: e.target.value })}
                  placeholder="Contenu du courrier..."
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={letterForm.sendNow}
                    onChange={e => setLetterForm({ ...letterForm, sendNow: e.target.checked })}
                    className="rounded"
                  />
                  Marquer comme envoyé maintenant
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setShowNewLetter(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                  <button
                    onClick={() => createLetter.mutate(letterForm)}
                    disabled={!letterForm.subject || !letterForm.content}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createLetter.isPending ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {courriers.length === 0 && !showNewLetter ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">Aucun courrier</div>
          ) : (
            <div className="space-y-3">
              {courriers.map((c: any) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded">
                          {LETTER_TYPE_LABELS[c.type] || c.type}
                        </span>
                        {c.sent_at ? (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">Envoyé</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded">Brouillon</span>
                        )}
                        {c.patient_nom && <span className="text-xs text-gray-500">— {c.patient_nom}</span>}
                      </div>
                      <div className="font-semibold text-gray-800">{c.subject}</div>
                      <div className="text-sm text-gray-600 mt-1 whitespace-pre-line line-clamp-2"><ReactMarkdown>{c.content}</ReactMarkdown></div>
                      <div className="text-xs text-gray-400 mt-2">{new Date(c.created_at).toLocaleDateString("fr-FR")}</div>
                    </div>
                    <button
                      onClick={() => { if (confirm("Supprimer ce courrier ?")) deleteLetter.mutate(c.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-4"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: RGPD */}
      {activeTab === "rgpd" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Données personnelles (RGPD)</h2>

          <div className="space-y-4 text-sm text-gray-600">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-800 mb-1">Droit à l'information</p>
              <p>Les données de {owner.prenom} {owner.nom} sont conservées pour la gestion des soins vétérinaires et la facturation, conformément à l'article 13 du RGPD.</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <p><strong>Données collectées :</strong> Nom, prénom, coordonnées, historique des soins, facturation</p>
              <p><strong>Base légale :</strong> Exécution du contrat de soins vétérinaires</p>
              <p><strong>Durée de conservation :</strong> 5 ans après le dernier contact</p>
              <p><strong>Date de création :</strong> {new Date(owner.created_at).toLocaleDateString("fr-FR")}</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-700 mb-3">Export des données (droit d'accès)</p>
              <button
                onClick={async () => {
                  const data = {
                    proprietaire: owner,
                    animaux: patients,
                    courriers: courriers,
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `donnees-${owner.nom}-${owner.prenom}.json`;
                  a.click();
                }}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900"
              >
                📥 Exporter mes données (JSON)
              </button>
            </div>

            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <p className="font-semibold text-red-700 mb-1">Droit à l'effacement (droit à l'oubli)</p>
              <p className="text-red-600 mb-3 text-xs">
                Cette action anonymise les données personnelles du propriétaire. Les dossiers médicaux des animaux sont conservés pour des raisons légales.
                Cette opération est <strong>irréversible</strong>.
              </p>
              <button
                onClick={() => {
                  if (confirm("Êtes-vous certain de vouloir anonymiser les données de ce propriétaire ? Cette action est irréversible.")) {
                    anonymizeOwner.mutate();
                  }
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
              >
                🗑️ Anonymiser les données
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
