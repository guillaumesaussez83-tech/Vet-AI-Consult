// artifacts/vetcare/src/hooks/use-facturx.ts
// Sprint 3 — Hook React pour les opérations Factur-X
// Encapsule les 4 appels API : generate, downloadXml, downloadPdf, fetchBudget

import { useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FacturXGenerateResult {
  ok: boolean;
  factureId: number;
  facturxVersion: string;
  generatedAt: string;
  xmlLength: number;
}

export interface AiBudgetResult {
  clinicId: string;
  nb_appels: number;
  consults_avec_ia: number;
  /** Coût total en USD sur 30 jours (ai_usage_logs.cost_usd) */
  cout_total_usd: number;
  /** Coût moyen par consultation en USD */
  cout_moyen_par_consult_usd: number;
  latence_moyenne_ms: number | null;
  nb_appels_sonnet: number;
  nb_appels_mini: number;
  alerte_budget: boolean;
  /** Seuil d'alerte = 0.15 USD/consult */
  seuil_alerte: number;
  message?: string;
}

type FacturXOp = "generate" | "downloadXml" | "downloadPdf" | "budget";

interface FacturXState {
  loading: boolean;
  op: FacturXOp | null;
  error: string | null;
  generatedAt: string | null;
  hasXml: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFacturX(
  factureId: number,
  options?: { initialHasXml?: boolean; initialGeneratedAt?: string }
) {
  const [state, setState] = useState<FacturXState>({
    loading: false,
    op: null,
    error: null,
    generatedAt: options?.initialGeneratedAt ?? null,
    hasXml: options?.initialHasXml ?? false,
  });

  function setLoading(op: FacturXOp) {
    setState((s) => ({ ...s, loading: true, op, error: null }));
  }

  function setError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    setState((s) => ({ ...s, loading: false, op: null, error: message }));
  }

  function setDone(patch?: Partial<FacturXState>) {
    setState((s) => ({ ...s, loading: false, op: null, error: null, ...patch }));
  }

  function triggerDownload(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── generate ─────────────────────────────────────────────────────────────
  const generate = useCallback(async (): Promise<FacturXGenerateResult | null> => {
    setLoading("generate");
    try {
      const res = await fetch(`/api/facturx/${factureId}/generate-xml`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const result: FacturXGenerateResult = await res.json();
      setDone({ hasXml: true, generatedAt: result.generatedAt });
      return result;
    } catch (err) {
      setError(err);
      return null;
    }
  }, [factureId]);

  // ── downloadXml ──────────────────────────────────────────────────────────
  const downloadXml = useCallback(async (): Promise<void> => {
    if (!state.hasXml) {
      const result = await generate();
      if (!result) return;
    }
    setLoading("downloadXml");
    try {
      triggerDownload(`/api/facturx/${factureId}/facturx.xml`, `facture-${factureId}.xml`);
      setDone();
    } catch (err) {
      setError(err);
    }
  }, [factureId, state.hasXml, generate]);

  // ── downloadPdf ──────────────────────────────────────────────────────────
  const downloadPdf = useCallback(async (): Promise<void> => {
    setLoading("downloadPdf");
    try {
      triggerDownload(`/api/facturx/${factureId}/facturx.pdf`, `facture-${factureId}.pdf`);
      setDone();
    } catch (err) {
      setError(err);
    }
  }, [factureId]);

  // ── fetchBudget ──────────────────────────────────────────────────────────
  const fetchBudget = useCallback(async (): Promise<AiBudgetResult | null> => {
    setLoading("budget");
    try {
      const res = await fetch("/api/ai/budget", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AiBudgetResult = await res.json();
      setDone();
      return data;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  return {
    loading: state.loading,
    op: state.op,
    error: state.error,
    hasXml: state.hasXml,
    generatedAt: state.generatedAt,
    generate,
    downloadXml,
    downloadPdf,
    fetchBudget,
    clearError: () => setState((s) => ({ ...s, error: null })),
  };
}
