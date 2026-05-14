// artifacts/vetcare/src/pages/analytics/clientele.tsx
// Phase 4 — Statistiques clientèle : top clients, attrition, inactifs

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/react";

interface TopClient {
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  nb_animaux: number;
  nb_consultations: number;
  ca_total: number;
  derniere_visite: string | null;
}

interface PatientInactif {
  id: number;
  name: string;
  espece: string;
  race: string;
  owner_name: string;
  owner_phone: string;
  derniere_consultation: string | null;
}

interface AttritionClient {
  owner_name: string;
  owner_phone: string;
  mois_actifs: number;
  total_visites: number;
  dernier_mois: string;
}

interface EspeceRow {
  espece: string;
  nb: number;
  pct: number;
}

interface Stats {
  totalPatients: number;
  patientsActifsSixMois: number;
  patientsInactifsNb: number;
  tauxRetentionPct: string;
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "Jamais";

function EspeceBar({ data }: { data: EspeceRow[] }) {
  const colors = ["#1E4D8C", "#2ECC71", "#F39C12", "#9B59B6", "#E74C3C", "#3498DB"];
  return (
    <div>
      <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        {data.map((e, i) => (
          <div
            key={e.espece}
            style={{ width: `${e.pct}%`, background: colors[i % colors.length], transition: "width 0.5s" }}
            title={`${e.espece}: ${e.nb} (${e.pct}%)`}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {data.map((e, i) => (
          <div key={e.espece} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length] }} />
            <span>{e.espece}</span>
            <span style={{ color: "#888" }}>({e.nb} · {e.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientelePage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<{
    topClients: TopClient[];
    patientsInactifs: PatientInactif[];
    repartitionEspece: EspeceRow[];
    attritionRisk: AttritionClient[];
    stats: Stats;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"top" | "inactifs" | "attrition" | "especes">("top");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/analytics/clientele?limit=20", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erreur chargement données clientèle");
        setData(await res.json());
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const tabs = [
    { id: "top", label: "🏆 Top clients" },
    { id: "inactifs", label: "😴 Inactifs" },
    { id: "attrition", label: "⚠️ Risque attrition" },
    { id: "especes", label: "🐾 Espèces" },
  ] as const;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>👥 Analyse Clientèle</h1>
        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
          Comportement, rétention et opportunités
        </p>
      </div>

      {error && (
        <div style={{ background: "#FFF0F0", border: "1px solid #E74C3C", borderRadius: 8, padding: 12, marginBottom: 20, color: "#C0392B" }}>
          {error}
        </div>
      )}

      {/* Stats recap */}
      {data && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Total patients", value: data.stats.totalPatients, color: "#1E4D8C" },
            { label: "Actifs (6 mois)", value: data.stats.patientsActifsSixMois, color: "#2ECC71" },
            { label: "Inactifs", value: data.stats.patientsInactifsNb, color: "#E74C3C" },
            { label: "Taux rétention", value: `${data.stats.tauxRetentionPct}%`, color: "#9B59B6" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#fff",
                borderRadius: 10,
                padding: "14px 20px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.07)",
                borderTop: `3px solid ${s.color}`,
                flex: 1,
                minWidth: 130,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", borderBottom: "1px solid #eee" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "12px 20px",
                border: "none",
                background: activeTab === t.id ? "#F0F7FF" : "transparent",
                borderBottom: activeTab === t.id ? "2px solid #1E4D8C" : "2px solid transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? "#1E4D8C" : "#666",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Chargement…</div>
          ) : !data ? null : (
            <>
              {/* Top clients */}
              {activeTab === "top" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F5F7FA" }}>
                      {["Rang", "Propriétaire", "Contact", "Animaux", "Consultations", "CA Total", "Dernière visite"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#444" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.topClients.map((c, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}
                      >
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 16 }}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                          {c.owner_name || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#666" }}>
                          {c.owner_phone || c.owner_email || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {c.nb_animaux}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {c.nb_consultations}
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1E4D8C" }}>
                          {EUR.format(c.ca_total)}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#666" }}>
                          {fmtDate(c.derniere_visite)}
                        </td>
                      </tr>
                    ))}
                    {data.topClients.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#888" }}>
                          Aucune donnée disponible
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* Patients inactifs */}
              {activeTab === "inactifs" && (
                <div>
                  <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
                    Patients sans consultation depuis plus de 6 mois — {data.patientsInactifs.length} identifiés
                  </p>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#F5F7FA" }}>
                        {["Animal", "Espèce", "Propriétaire", "Contact", "Dernière visite"].map((h) => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#444" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.patientsInactifs.map((p, i) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 500 }}>{p.name}</td>
                          <td style={{ padding: "10px 12px", color: "#666" }}>{p.espece} {p.race ? `(${p.race})` : ""}</td>
                          <td style={{ padding: "10px 12px" }}>{p.owner_name || "—"}</td>
                          <td style={{ padding: "10px 12px", color: "#666" }}>{p.owner_phone || "—"}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              background: p.derniere_consultation ? "#FFF3CD" : "#FFF0F0",
                              color: p.derniere_consultation ? "#856404" : "#721C24",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 12,
                            }}>
                              {fmtDate(p.derniere_consultation)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Attrition */}
              {activeTab === "attrition" && (
                <div>
                  <div style={{ background: "#FFF9F0", borderLeft: "4px solid #F39C12", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                    ⚠️ Ces propriétaires ont été actifs (≥ 2 mois) mais n'ont pas consulté depuis plus de 2 mois.
                    Opportunités de relance.
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#F5F7FA" }}>
                        {["Propriétaire", "Contact", "Mois actifs", "Total visites", "Dernier mois"].map((h) => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#444" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.attritionRisk.map((a, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 500 }}>{a.owner_name}</td>
                          <td style={{ padding: "10px 12px", color: "#666" }}>{a.owner_phone || "—"}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>{a.mois_actifs}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>{a.total_visites}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ background: "#FFF3CD", color: "#856404", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                              {a.dernier_mois}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.attritionRisk.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#888" }}>Aucun risque d'attrition détecté 🎉</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Espèces */}
              {activeTab === "especes" && (
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Répartition par espèce</h3>
                  <EspeceBar data={data.repartitionEspece} />
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 20 }}>
                    <thead>
                      <tr style={{ background: "#F5F7FA" }}>
                        {["Espèce", "Nb patients", "Part"].map((h) => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#444" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.repartitionEspece.map((e, i) => (
                        <tr key={e.espece} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "10px 12px" }}>{e.espece}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 500 }}>{e.nb}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div
                                style={{
                                  height: 8,
                                  width: `${Math.min(100, e.pct * 2)}px`,
                                  background: "#1E4D8C",
                                  borderRadius: 4,
                                }}
                              />
                              <span>{e.pct}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
