// artifacts/vetcare/src/components/AiBudgetWidget.tsx
// Sprint 3 — Widget monitoring budget IA 30 jours
// Affiche : coût moyen/consult (USD), alerte si > $0.15/consult, répartition modèles
// Source : GET /api/ai/budget → vue v_ai_budget_clinic_30d (cost_usd)

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, TrendingUp, Zap, RefreshCw } from "lucide-react";
import type { AiBudgetResult } from "../hooks/use-facturx";

// ── Types internes ─────────────────────────────────────────────────────────────

interface ModelBreakdown {
  model: string;
  nb_appels: number;
  cout_usd: number;
  pct: number;
}

interface BudgetData extends AiBudgetResult {
  models?: ModelBreakdown[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Formate un montant USD — valeurs < 1 $ typiques */
function fmtUsd(n: number, decimals = 4): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

// ── Composant ──────────────────────────────────────────────────────────────────

interface AiBudgetWidgetProps {
  /** Polling automatique toutes les N secondes (défaut: 0 = pas de polling) */
  refreshIntervalSec?: number;
  /** Classe CSS supplémentaire sur le conteneur */
  className?: string;
}

export function AiBudgetWidget({ refreshIntervalSec = 0, className = "" }: AiBudgetWidgetProps) {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/budget", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (refreshIntervalSec > 0) {
      const id = setInterval(load, refreshIntervalSec * 1000);
      return () => clearInterval(id);
    }
  }, [refreshIntervalSec]);

  if (loading && !data) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Chargement budget IA…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-5 ${className}`}>
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
        <button onClick={load} className="mt-2 text-xs text-red-500 underline hover:no-underline">
          Réessayer
        </button>
      </div>
    );
  }

  if (!data) return null;

  const pct = data.seuil_alerte > 0
    ? Math.min(100, (data.cout_moyen_par_consult_usd / data.seuil_alerte) * 100)
    : 0;

  const barColor = data.alerte_budget
    ? "bg-red-500"
    : pct > 70
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${data.alerte_budget ? "border-red-200" : "border-gray-200"} ${className}`}>
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800">Budget IA — 30 jours</h3>
        </div>
        <div className="flex items-center gap-2">
          {data.alerte_budget
            ? <AlertTriangle className="w-5 h-5 text-red-500" />
            : <CheckCircle className="w-5 h-5 text-emerald-500" />}
          <span className={`text-xs font-medium ${data.alerte_budget ? "text-red-600" : "text-emerald-600"}`}>
            {data.alerte_budget ? "Budget dépassé" : "Budget nominal"}
          </span>
          <button
            onClick={load}
            disabled={loading}
            title="Actualiser"
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Métriques */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 px-0">
        <Metric
          label="Coût moyen / consult"
          value={fmtUsd(data.cout_moyen_par_consult_usd)}
          sub={`seuil : ${fmtUsd(data.seuil_alerte, 2)}`}
          highlight={data.alerte_budget}
        />
        <Metric
          label="Coût total 30j"
          value={fmtUsd(data.cout_total_usd, 2)}
          sub={`${fmtNum(data.nb_appels)} appels`}
        />
        <Metric
          label="Consult. avec IA"
          value={fmtNum(data.consults_avec_ia)}
          sub="consultations"
        />
      </div>

      {/* Barre de progression */}
      <div className="px-5 pb-4 pt-1">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>$0</span>
          <span className="font-medium text-gray-600">{Math.round(pct)}% du seuil</span>
          <span>{fmtUsd(data.seuil_alerte, 2)}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Répartition modèles */}
      {data.models && data.models.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Répartition par modèle
          </p>
          <div className="space-y-1.5">
            {data.models.map((m) => (
              <div key={m.model} className="flex items-center gap-2 text-xs">
                <span className="w-36 truncate text-gray-600 font-mono">{m.model}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${m.pct}%` }} />
                </div>
                <span className="w-14 text-right text-gray-500">{fmtUsd(m.cout_usd, 4)}</span>
                <span className="w-10 text-right text-gray-400">{Math.round(m.pct)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerte */}
      {data.alerte_budget && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-2.5">
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Le coût moyen dépasse $0.15/consult. Le routeur bascule automatiquement vers GPT-4o-mini.
          </p>
        </div>
      )}

      {/* Footer */}
      {lastRefresh && (
        <div className="px-5 pb-2 text-right">
          <span className="text-[10px] text-gray-300">
            Mis à jour {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sous-composant Metric ─────────────────────────────────────────────────────

function Metric({ label, value, sub, highlight = false }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${highlight ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default AiBudgetWidget;
