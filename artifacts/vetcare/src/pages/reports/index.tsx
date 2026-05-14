// artifacts/vetcare/src/pages/reports/index.tsx
// Phase 4 — Rapports mensuels PDF

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";

interface Report {
  id: number;
  reportType: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  pdfSizeKb: number | null;
  generatedAt: string | null;
  generatedBy: string;
  kpiSummary: {
    caTtcTotal: number;
    nbConsultations: number;
    nbNouveauxPatients: number;
  } | null;
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    ready: { bg: "#D4EDDA", color: "#155724", label: "✓ Prêt" },
    generating: { bg: "#FFF3CD", color: "#856404", label: "⏳ Génération…" },
    pending: { bg: "#E2E3E5", color: "#383D41", label: "En attente" },
    error: { bg: "#F8D7DA", color: "#721C24", label: "✗ Erreur" },
  };
  const { bg, color, label } = cfg[status] || cfg.pending;
  return (
    <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
      {label}
    </span>
  );
}

export default function ReportsPage() {
  const { getToken } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
  const defaultLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const [form, setForm] = useState({
    reportType: "monthly",
    periodStart: defaultStart,
    periodEnd: defaultEnd,
    periodLabel: defaultLabel,
  });

  const fetchReports = async () => {
    const token = await getToken();
    const res = await fetch("/api/reports?pageSize=20", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setReports(data.reports || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchReports();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Polling quand un rapport est en génération
  useEffect(() => {
    if (pollingId === null) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const token = await getToken();
      const res = await fetch(`/api/reports/${pollingId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ready" || data.status === "error") {
          setPollingId(null);
          setGenerating(false);
          await fetchReports();
        }
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollingId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur génération");
      }
      const { reportId } = await res.json();
      setPollingId(reportId);
      setShowForm(false);
      await fetchReports();
    } catch (err) {
      setError((err as Error).message);
      setGenerating(false);
    }
  };

  const handleDownload = async (report: Report) => {
    const token = await getToken();
    const res = await fetch(`/api/reports/${report.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VetoAI_Rapport_${report.periodLabel.replace(/\s/g, "_")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>📄 Rapports mensuels</h1>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
            Génération et téléchargement de rapports PDF d'activité
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={generating}
          style={{
            padding: "10px 20px",
            background: "#1E4D8C",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: generating ? "not-allowed" : "pointer",
            fontWeight: 600,
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating ? "⏳ Génération…" : "+ Nouveau rapport"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#FFF0F0", border: "1px solid #E74C3C", borderRadius: 8, padding: 12, marginBottom: 20, color: "#C0392B" }}>
          {error}
        </div>
      )}

      {/* Formulaire génération */}
      {showForm && (
        <div
          style={{
            background: "#F8FBFF",
            border: "1px solid #D0E3FF",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Configurer le rapport</h3>
          <form onSubmit={handleGenerate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Type</label>
                <select
                  value={form.reportType}
                  onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                >
                  <option value="monthly">Mensuel</option>
                  <option value="quarterly">Trimestriel</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Libellé période</label>
                <input
                  type="text"
                  value={form.periodLabel}
                  onChange={(e) => setForm((f) => ({ ...f, periodLabel: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Date début</label>
                <input
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Date fin</label>
                <input
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ padding: "8px 16px", background: "#fff", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}
              >
                Annuler
              </button>
              <button
                type="submit"
                style={{ padding: "8px 20px", background: "#1E4D8C", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
              >
                Générer le rapport
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des rapports */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Chargement…</div>
        ) : reports.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#888" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontWeight: 600 }}>Aucun rapport généré</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Cliquez sur "Nouveau rapport" pour créer votre premier rapport mensuel.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F5F7FA", borderBottom: "1px solid #eee" }}>
                {["Période", "Type", "CA TTC", "Consultations", "Patients", "Statut", "Généré le", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#444", fontSize: 13 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.periodLabel}</td>
                  <td style={{ padding: "12px 16px", color: "#666", fontSize: 13 }}>
                    {r.reportType === "monthly" ? "Mensuel" : "Trimestriel"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {r.kpiSummary ? EUR.format(r.kpiSummary.caTtcTotal) : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {r.kpiSummary?.nbConsultations ?? "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {r.kpiSummary?.nbNouveauxPatients != null ? `+${r.kpiSummary.nbNouveauxPatients}` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={r.status} />
                    {pollingId === r.id && <span style={{ marginLeft: 6, fontSize: 11, color: "#888" }}>actualisation…</span>}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#666", fontSize: 12 }}>
                    {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {r.status === "ready" && (
                      <button
                        onClick={() => handleDownload(r)}
                        style={{
                          padding: "6px 12px",
                          background: "#1E4D8C",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        ⬇ PDF {r.pdfSizeKb ? `(${r.pdfSizeKb}KB)` : ""}
                      </button>
                    )}
                    {r.status === "generating" && (
                      <span style={{ fontSize: 12, color: "#F39C12" }}>⏳ En cours…</span>
                    )}
                    {r.status === "error" && (
                      <span style={{ fontSize: 12, color: "#E74C3C" }}>✗ Erreur</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
