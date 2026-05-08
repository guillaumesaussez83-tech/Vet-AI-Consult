// artifacts/vetcare/src/pages/groupe/index.tsx
// Phase 4 — Tableau de bord groupe multi-cliniques (DIRECTION_GROUPE)

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

interface GroupeKpis {
  caTtcMois: number;
  caTtcAn: number;
  variationCAvsMoisPrecedent: string | null;
  nbConsultationsMois: number;
  nbPatientsTotal: number;
  facturesImpayeesNb: number;
  facturesImpayeesMontant: number;
}

interface EvolutionPoint {
  month: string;
  clinic_id: string;
  ca_ttc: number;
}

interface ClinicKpi {
  clinicId: string;
  clinicName: string;
  caTtcMois: number;
  nbConsultations: number;
  caParConsultation: number;
  nbPatientsTotal: number;
  facturesImpayeesNb: number;
  tauxUtilisationIA: number;
  rang: number;
  vsMovenneCAPct: string | null;
}

interface Clinique {
  id: string;
  name: string;
  city: string;
  plan: string;
  kpisMois: { caTtcMois: number; nbConsultations: number; nbPatientsTotal: number };
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function StatBadge({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", borderLeft: `4px solid ${color}`, boxShadow: "0 2px 6px rgba(0,0,0,0.06)", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function GroupeDashboard() {
  const { getToken } = useAuth();
  const [dashboard, setDashboard] = useState<{ nbCliniques: number; kpis: GroupeKpis; evolutionCA: EvolutionPoint[] } | null>(null);
  const [comparatif, setComparatif] = useState<{ comparatif: ClinicKpi[]; moyennes: { caMiddleground: number; nbConsultationsMoyenne: number } } | null>(null);
  const [cliniques, setCliniques] = useState<Clinique[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "comparatif" | "cliniques">("dashboard");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const h = { Authorization: `Bearer ${token}` };

        const [dashRes, compRes, clinRes] = await Promise.all([
          fetch("/api/groupe/dashboard", { headers: h }),
          fetch("/api/groupe/comparatif", { headers: h }),
          fetch("/api/groupe/cliniques", { headers: h }),
        ]);

        if (!dashRes.ok) {
          const err = await dashRes.json();
          throw new Error(err.error || "Accès refusé");
        }

        const [dashData, compData, clinData] = await Promise.all([
          dashRes.json(),
          compRes.json(),
          clinRes.json(),
        ]);

        setDashboard(dashData);
        setComparatif(compData);
        setCliniques(clinData.cliniques || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const now = new Date();
  const monthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const tabs = [
    { id: "dashboard", label: "📊 Vue consolidée" },
    { id: "comparatif", label: "🏆 Comparatif" },
    { id: "cliniques", label: "🏥 Cliniques" },
  ] as const;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🏢 Tableau de bord Groupe</h1>
          {dashboard && (
            <span style={{ background: "#1E4D8C", color: "#fff", fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>
              {dashboard.nbCliniques} clinique{dashboard.nbCliniques > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
          Vue consolidée multi-sites · {monthLabel}
        </p>
      </div>

      {error && (
        <div style={{ background: "#FFF0F0", border: "1px solid #E74C3C", borderRadius: 8, padding: 16, marginBottom: 20, color: "#C0392B" }}>
          <strong>Accès refusé ou erreur :</strong> {error}
          <br />
          <span style={{ fontSize: 12, marginTop: 4, display: "block", color: "#666" }}>
            Ce tableau de bord est réservé au rôle DIRECTION_GROUPE.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #eee" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "12px 22px",
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

        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Chargement…</div>
          ) : (
            <>
              {/* Vue consolidée */}
              {activeTab === "dashboard" && dashboard && (
                <div>
                  {/* KPI Cards */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                    <StatBadge value={EUR.format(dashboard.kpis.caTtcMois)} label={`CA TTC ${monthLabel}`} color="#1E4D8C" />
                    <StatBadge value={EUR.format(dashboard.kpis.caTtcAn)} label="CA TTC Année" color="#2ECC71" />
                    <StatBadge value={String(dashboard.kpis.nbConsultationsMois)} label="Consultations (mois)" color="#F39C12" />
                    <StatBadge value={String(dashboard.kpis.nbPatientsTotal)} label="Patients total" color="#9B59B6" />
                    <StatBadge
                      value={EUR.format(dashboard.kpis.facturesImpayeesMontant)}
                      label={`Impayés (${dashboard.kpis.facturesImpayeesNb} fact.)`}
                      color="#E74C3C"
                    />
                  </div>

                  {/* Variation CA */}
                  {dashboard.kpis.variationCAvsMoisPrecedent && (
                    <div style={{
                      background: parseFloat(dashboard.kpis.variationCAvsMoisPrecedent) >= 0 ? "#F0FFF4" : "#FFF0F0",
                      border: `1px solid ${parseFloat(dashboard.kpis.variationCAvsMoisPrecedent) >= 0 ? "#2ECC71" : "#E74C3C"}`,
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 14,
                      marginBottom: 20,
                    }}>
                      {parseFloat(dashboard.kpis.variationCAvsMoisPrecedent) >= 0 ? "📈" : "📉"}{" "}
                      CA groupe{" "}
                      <strong>
                        {parseFloat(dashboard.kpis.variationCAvsMoisPrecedent) >= 0 ? "+" : ""}{dashboard.kpis.variationCAvsMoisPrecedent}%
                      </strong>{" "}
                      vs mois précédent
                    </div>
                  )}

                  {/* Mini chart CA par clinique */}
                  {dashboard.evolutionCA && dashboard.evolutionCA.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Évolution CA par clinique (12 mois)</h3>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "#F5F7FA" }}>
                              <th style={{ padding: "8px 12px", textAlign: "left" }}>Clinique</th>
                              {Array.from(new Set(dashboard.evolutionCA.map((e) => e.month)))
                                .slice(-6)
                                .map((m) => (
                                  <th key={m} style={{ padding: "8px 10px", textAlign: "right", color: "#666" }}>
                                    {m.slice(5)}
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(new Set(dashboard.evolutionCA.map((e) => e.clinic_id))).map((cid, ri) => {
                              const months = Array.from(new Set(dashboard.evolutionCA.map((e) => e.month))).slice(-6);
                              return (
                                <tr key={cid} style={{ borderBottom: "1px solid #f0f0f0", background: ri % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{cid}</td>
                                  {months.map((m) => {
                                    const row = dashboard.evolutionCA.find((e) => e.clinic_id === cid && e.month === m);
                                    return (
                                      <td key={m} style={{ padding: "8px 10px", textAlign: "right" }}>
                                        {row ? EUR.format(row.ca_ttc) : "—"}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Comparatif */}
              {activeTab === "comparatif" && comparatif && (
                <div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                    <div style={{ background: "#F5F7FA", borderRadius: 8, padding: "10px 16px", fontSize: 13 }}>
                      CA moyen groupe : <strong>{EUR.format(comparatif.moyennes.caMiddleground)}</strong>
                    </div>
                    <div style={{ background: "#F5F7FA", borderRadius: 8, padding: "10px 16px", fontSize: 13 }}>
                      Consultations moy. : <strong>{comparatif.moyennes.nbConsultationsMoyenne}</strong>
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#1E4D8C", color: "#fff" }}>
                        {["Rang", "Clinique", "CA TTC mois", "vs Moyenne", "Consultations", "CA/Consult", "Utilisation IA", "Impayés"].map((h) => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparatif.comparatif.map((c, i) => {
                        const vsMoy = c.vsMovenneCAPct ? parseFloat(c.vsMovenneCAPct) : null;
                        return (
                          <tr
                            key={c.clinicId}
                            style={{
                              borderBottom: "1px solid #f0f0f0",
                              background: i === 0 ? "#FFFDF0" : i % 2 === 0 ? "#fff" : "#FAFAFA",
                            }}
                          >
                            <td style={{ padding: "10px 12px", fontSize: 18 }}>
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${c.rang}`}
                            </td>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{c.clinicName}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1E4D8C" }}>
                              {EUR.format(c.caTtcMois)}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {vsMoy !== null ? (
                                <span
                                  style={{
                                    color: vsMoy >= 0 ? "#27AE60" : "#E74C3C",
                                    fontWeight: 500,
                                  }}
                                >
                                  {vsMoy >= 0 ? "▲" : "▼"} {Math.abs(vsMoy)}%
                                </span>
                              ) : "—"}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "center" }}>{c.nbConsultations}</td>
                            <td style={{ padding: "10px 12px" }}>{EUR.format(c.caParConsultation)}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div
                                  style={{
                                    height: 8,
                                    width: `${Math.min(60, c.tauxUtilisationIA)}px`,
                                    background: c.tauxUtilisationIA > 50 ? "#2ECC71" : c.tauxUtilisationIA > 20 ? "#F39C12" : "#E74C3C",
                                    borderRadius: 4,
                                  }}
                                />
                                <span>{c.tauxUtilisationIA}%</span>
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {c.facturesImpayeesNb > 0 ? (
                                <span style={{ color: "#E74C3C" }}>{c.facturesImpayeesNb}</span>
                              ) : (
                                <span style={{ color: "#2ECC71" }}>✓</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </Tbody>
                  </table>
                </div>
              )}

              {/* Liste cliniques */}
              {activeTab === "cliniques" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                    {cliniques.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          background: "#fff",
                          border: "1px solid #e8e8e8",
                          borderRadius: 10,
                          padding: 18,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                          <span
                            style={{
                              background: c.plan === "enterprise" ? "#1E4D8C" : c.plan === "pro" ? "#2ECC71" : "#E0E0E0",
                              color: c.plan === "starter" ? "#666" : "#fff",
                              fontSize: 10,
                              padding: "2px 8px",
                              borderRadius: 10,
                              textTransform: "uppercase",
                            }}
                          >
                            {c.plan}
                          </span>
                        </div>
                        {c.city && <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>📍 {c.city}</div>}
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1, background: "#F5F7FA", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#1E4D8C" }}>
                              {EUR.format(c.kpisMois.caTtcMois)}
                            </div>
                            <div style={{ fontSize: 10, color: "#888" }}>CA mois</div>
                          </div>
                          <div style={{ flex: 1, background: "#F5F7FA", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{c.kpisMois.nbConsultations}</div>
                            <div style={{ fontSize: 10, color: "#888" }}>Consult.</div>
                          </div>
                          <div style={{ flex: 1, background: "#F5F7FA", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{c.kpisMois.nbPatientsTotal}</div>
                            <div style={{ fontSize: 10, color: "#888" }}>Patients</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {cliniques.length === 0 && (
                      <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "#888" }}>
                        Aucune clinique accessible
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
