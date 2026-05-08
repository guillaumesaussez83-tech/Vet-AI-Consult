// artifacts/vetcare/src/pages/analytics/index.tsx
// Phase 4 — Dashboard Analytics IA

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "wouter";
import { useAuth } from "@clerk/clerk-react";

interface KPIs {
  caJour: number;
  caMois: number;
  caAn: number;
  variationCAvsMoisPrecedent: string | null;
  consultationsJour: number;
  consultationsMois: number;
  nouveauxPatientsMois: number;
  totalPatientsActifs: number;
  facturesImpayeesNb: number;
  facturesImpayeesMontant: number;
  tauxUtilisationIA: number;
  generatedAt: string;
}

interface EvolutionPoint {
  month: string;
  ca_ttc: number;
  nb_factures: number;
}

interface ForecastPoint {
  month: string;
  caForecast: number;
  confidenceMin: number;
  confidenceMax: number;
}

interface Insight {
  title: string;
  message: string;
  priority: "high" | "medium" | "low";
  type: "positive" | "warning" | "info";
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtEur = (n: number) => EUR.format(n);
const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

function KpiCard({
  label,
  value,
  sub,
  trend,
  color = "#1E4D8C",
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: string | null;
  color?: string;
  loading?: boolean;
}) {
  const trendNum = trend ? parseFloat(trend) : null;
  const trendColor =
    trendNum === null ? "#666" : trendNum >= 0 ? "#2ECC71" : "#E74C3C";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        borderTop: `4px solid ${color}`,
        minWidth: 160,
        flex: 1,
      }}
    >
      <div style={{ color: "#666", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: 32, background: "#f0f0f0", borderRadius: 4, animation: "pulse 1.5s infinite" }} />
      ) : (
        <>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1a1a" }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{sub}</div>}
          {trend !== undefined && (
            <div style={{ fontSize: 12, color: trendColor, marginTop: 4 }}>
              {trendNum !== null ? `${trendNum >= 0 ? "▲" : "▼"} ${Math.abs(trendNum)}% vs mois préc.` : "—"}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const colors = {
    positive: { bg: "#F0FFF4", border: "#2ECC71", icon: "✅" },
    warning: { bg: "#FFF9F0", border: "#F39C12", icon: "⚠️" },
    info: { bg: "#F0F8FF", border: "#3498DB", icon: "💡" },
  };
  const { bg, border, icon } = colors[insight.type] || colors.info;

  return (
    <div
      style={{
        background: bg,
        borderLeft: `4px solid ${border}`,
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 10,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        {icon} {insight.title}
      </div>
      <div style={{ fontSize: 13, color: "#444" }}>{insight.message}</div>
    </div>
  );
}

function SimpleBarChart({
  data,
  forecast,
}: {
  data: EvolutionPoint[];
  forecast: ForecastPoint[];
}) {
  if (!data.length) return <div style={{ color: "#888", padding: 20 }}>Données insuffisantes</div>;

  const allValues = [
    ...data.map((d) => d.ca_ttc),
    ...forecast.map((f) => f.caForecast),
  ];
  const maxVal = Math.max(...allValues) * 1.1 || 1;
  const combined = [
    ...data.map((d) => ({ month: d.month, value: d.ca_ttc, isForecast: false })),
    ...forecast.map((f) => ({ month: f.month, value: f.caForecast, isForecast: true })),
  ];
  const barW = Math.max(20, Math.floor(560 / combined.length) - 4);
  const chartH = 160;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={Math.max(600, combined.length * (barW + 4) + 60)} height={chartH + 50}>
        {combined.map((item, i) => {
          const h = Math.max(2, (item.value / maxVal) * chartH);
          const x = 30 + i * (barW + 4);
          const y = chartH - h;
          const shortMonth = item.month.slice(5);
          return (
            <g key={item.month}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={item.isForecast ? "#BDD7F5" : "#1E4D8C"}
                rx={3}
                opacity={item.isForecast ? 0.7 : 1}
              />
              {item.isForecast && (
                <rect x={x} y={y} width={barW} height={h} fill="url(#hatch)" rx={3} />
              )}
              <text
                x={x + barW / 2}
                y={chartH + 15}
                textAnchor="middle"
                fontSize={9}
                fill="#888"
              >
                {shortMonth}
              </text>
              {item.value > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 3}
                  textAnchor="middle"
                  fontSize={8}
                  fill={item.isForecast ? "#3498DB" : "#1E4D8C"}
                >
                  {Math.round(item.value / 1000)}k
                </text>
              )}
            </g>
          );
        })}
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} stroke="#3498DB" strokeWidth={2} />
          </pattern>
        </defs>
      2 <line x1={30} y1={0} x2={30} y2={chartH} stroke="#ddd" />
        <line x1={30} y1={chartH} x2={combined.length * (barW + 4) + 34} y2={chartH} stroke="#ddd" />
      </svg>
      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
        <span style={{ background: "#1E4D8C", color: "#fff", padding: "1px 8px", borderRadius: 3, marginRight: 8 }}>Réalisé</span>
        <span style={{ background: "#BDD7F5", color: "#1E4D8C", padding: "1px 8px", borderRadius: 3 }}>Prévision IA</span>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { getToken } = useAuth();
  const [navigate] = useNavigate();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [evolution, setEvolution] = useState<EvolutionPoint[]>([]);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [kpisRes, evolutionRes, forecastRes] = await Promise.all([
        fetch("/api/analytics/kpis", { headers }),
        fetch("/api/analytics/evolution", { headers }),
        fetch("/api/analytics/forecast", { headers }),
      ]);

      if (!kpisRes.ok) throw new Error("Erreur chargement KPIs");

      const [kpisData, evolData, forecastData] = await Promise.all([
        kpisRes.json(),
        evolutionRes.json(),
        forecastRes.json(),
      ]);

      setKpis(kpisData);
      setEvolution(evolData.data || []);
      setForecast(forecastData.forecasts || []);
      setLoading(false);

      // Insights IA en parallèle (plus lent)
      setInsightsLoading(true);
      fetch("/api/analytics/insights", { headers })
        .then((r) => r.json())
        .then((d) => { setInsights(d.insights || []); setInsightsLoading(false); })
        .catch(() => setInsightsLoading(false));
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const now = new Date();
  const monthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#1a1a1a" }}>
            📊 Analytics
          </h1>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
            Tableau de bord — {monthLabel}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("/analytics/clientele")}
            style={{
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            👥 Clientèle
          </button>
          <button
            onClick={fetchAll}
            style={{
              padding: "8px 16px",
              background: "#1E4D8C",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ↻ Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FFF0F0", border: "1px solid #E74C3C", borderRadius: 8, padding: 12, marginBottom: 20, color: "#C0392B" }}>
          {error}
        </div>
      )}

      {/* KPI Cards — CA */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <KpiCard label="CA Aujourd'hui" value={fmtEur(kpis?.caJour || 0)} color="#1E4D8C" loading={loading} />
        <KpiCard
          label="CA Mois en cours"
          value={fmtEur(kpis?.caMois || 0)}
          trend={kpis?.variationCAvsMoisPrecedent}
          color="#2ECC71"
          loading={loading}
        />
        <KpiCard label="CA Année" value={fmtEur(kpis?.caAn || 0)} color="#9B59B6" loading={loading} />
        <KpiCard
          label="Impayés"
          value={fmtEur(kpis?.facturesImpayeesMontant || 0)}
          sub={kpis ? `${kpis.facturesImpayeesNb} facture(s)` : undefined}
          color="#E74C3C"
          loading={loading}
        />
      </div>

      {/* KPI Cards — Activité */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <KpiCard label="Consultations (jour)" value={String(kpis?.consultationsJour || 0)} color="#3498DB" loading={loading} />
        <KpiCard label="Consultations (mois)" value={String(kpis?.consultationsMois || 0)} color="#1ABC9C" loading={loading} />
        <KpiCard label="Nouveaux patients" value={String(kpis?.nouveauxPatientsMois || 0)} sub="ce mois" color="#F39C12" loading={loading} />
        <KpiCard
          label="Utilisation IA"
          value={`${kpis?.tauxUtilisationIA || 0}%`}
          sub="des consultations"
          color="#8E44AD"
          loading={loading}
        />
      </div>

      {/* Graphique CA + Prévisions */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          Évolution CA & Prévisions IA
        </h2>
        <SimpleBarChart data={evolution} forecast={forecast} />
        {forecast.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
            {forecast.map((f) => (
              <div
                key={f.month}
                style={{
                  background: "#F0F8FF",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                }}
              >
                <strong>{f.month}</strong> → {fmtEur(f.caForecast)}
                <span style={{ color: "#888", fontSize: 11, marginLeft: 6 }}>
                  ± {fmtEur(f.caForecast - f.confidenceMin)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insights IA */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          🤖 Insights IA
          {insightsLoading && (
            <span style={{ fontSize: 12, color: "#888", marginLeft: 12, fontWeight: 400 }}>
              Analyse en cours…
            </span>
          )}
        </h2>
        {insightsLoading ? (
          <div style={{ color: "#888", padding: 16 }}>Génération des insights par l'IA…</div>
        ) : insights.length === 0 ? (
          <div style={{ color: "#888", padding: 8 }}>Aucun insight disponible pour le moment.</div>
        ) : (
          insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
      `}</style>
    </div>
  );
}
