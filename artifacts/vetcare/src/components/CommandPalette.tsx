import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, Dog, User, Stethoscope, ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { unwrapResponse as __unwrapResponse } from "../lib/queryClient";

interface SearchResult {
  patients: { id: number; nom: string; espece: string | null; race: string | null }[];
  owners: { id: number; nom: string; prenom: string | null; telephone: string | null; email: string | null }[];
  consultations: { id: number; motif: string | null; date: string; statut: string; patientId: number | null; diagnostic: string | null }[];
}

const ESPECE_EMOJI: Record<string, string> = {
  chien: "🐕", chat: "🐈", lapin: "🐇", oiseau: "🐦",
  reptile: "🦎", cochon_inde: "🐹", furet: "🐾", autre: "🐾",
};

const STATUT_LABEL: Record<string, string> = {
  en_cours: "En cours", terminee: "Terminée", planifiee: "Planifiée",
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Flatten results for keyboard navigation
  const flat: { type: "patient" | "owner" | "consultation"; id: number; label: string; sub: string; href: string }[] = [];
  if (results) {
    results.patients.forEach(p => flat.push({
      type: "patient", id: p.id,
      label: p.nom,
      sub: [ESPECE_EMOJI[p.espece ?? ""] ?? "🐾", p.espece, p.race].filter(Boolean).join(" "),
      href: `/patients/${p.id}`,
    }));
    results.owners.forEach(o => flat.push({
      type: "owner", id: o.id,
      label: `${o.prenom ?? ""} ${o.nom}`.trim(),
      sub: o.telephone ?? o.email ?? "Propriétaire",
      href: `/patients?owner=${o.id}`,
    }));
    results.consultations.forEach(c => flat.push({
      type: "consultation", id: c.id,
      label: c.motif ?? c.diagnostic ?? `Consultation #${c.id}`,
      sub: format(new Date(c.date), "dd MMM yyyy", { locale: fr }),
      href: `/consultations/${c.id}`,
    }));
  }

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: SearchResult = await __unwrapResponse(res);
      setResults(data);
      setSelected(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query) { setResults(null); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(() => search(query), 300);
  }, [query, search]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigateTo = useCallback((href: string) => {
    onOpenChange(false);
    navigate(href);
  }, [navigate, onOpenChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && flat[selected]) {
      navigateTo(flat[selected].href);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  const totalCount = flat.length;
  const isEmpty = query.length >= 2 && !loading && totalCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl overflow-hidden gap-0" aria-describedby={undefined}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          {loading
            ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
            : <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher patients, propriétaires, consultations…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex text-xs font-mono bg-muted border rounded px-1.5 py-0.5 text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {!query && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Tapez au moins 2 caractères pour rechercher</p>
              <p className="text-xs mt-1 opacity-60">Patients • Propriétaires • Consultations</p>
            </div>
          )}

          {isEmpty && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun résultat pour <strong>« {query} »</strong>
            </div>
          )}

          {results && totalCount > 0 && (
            <div className="py-1">
              {/* Patients */}
              {results.patients.length > 0 && (
                <Section label="Patients" icon={<Dog className="h-3.5 w-3.5" />}>
                  {results.patients.map(p => {
                    const idx = flat.findIndex(f => f.type === "patient" && f.id === p.id);
                    return (
                      <ResultRow
                        key={`p-${p.id}`}
                        icon={<span className="text-base">{ESPECE_EMOJI[p.espece ?? ""] ?? "🐾"}</span>}
                        label={highlight(p.nom, query)}
                        sub={[p.espece, p.race].filter(Boolean).join(" • ")}
                        selected={selected === idx}
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => navigateTo(`/patients/${p.id}`)}
                      />
                    );
                  })}
                </Section>
              )}

              {/* Propriétaires */}
              {results.owners.length > 0 && (
                <Section label="Propriétaires" icon={<User className="h-3.5 w-3.5" />}>
                  {results.owners.map(o => {
                    const label = `${o.prenom ?? ""} ${o.nom}`.trim();
                    const idx = flat.findIndex(f => f.type === "owner" && f.id === o.id);
                    return (
                      <ResultRow
                        key={`o-${o.id}`}
                        icon={<User className="h-4 w-4 text-muted-foreground" />}
                        label={highlight(label, query)}
                        sub={o.telephone ?? o.email ?? ""}
                        selected={selected === idx}
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => navigateTo(`/patients?owner=${o.id}`)}
                      />
                    );
                  })}
                </Section>
              )}

              {/* Consultations */}
              {results.consultations.length > 0 && (
                <Section label="Consultations" icon={<Stethoscope className="h-3.5 w-3.5" />}>
                  {results.consultations.map(c => {
                    const idx = flat.findIndex(f => f.type === "consultation" && f.id === c.id);
                    return (
                      <ResultRow
                        key={`c-${c.id}`}
                        icon={<Stethoscope className="h-4 w-4 text-muted-foreground" />}
                        label={highlight(c.motif ?? c.diagnostic ?? `Consultation #${c.id}`, query)}
                        sub={format(new Date(c.date), "dd MMM yyyy", { locale: fr })}
                        badge={STATUT_LABEL[c.statut] ?? c.statut}
                        selected={selected === idx}
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => navigateTo(`/consultations/${c.id}`)}
                      />
                    );
                  })}
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
          <span className="flex items-center gap-3">
            <span><kbd className="font-mono bg-background border rounded px-1">↑↓</kbd> naviguer</span>
            <span><kbd className="font-mono bg-background border rounded px-1">↵</kbd> ouvrir</span>
          </span>
          {totalCount > 0 && <span>{totalCount} résultat{totalCount > 1 ? "s" : ""}</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  icon, label, sub, badge, selected, onClick, onMouseEnter,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  sub?: string;
  badge?: string;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        selected ? "bg-primary/10" : "hover:bg-muted/60"
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md bg-muted">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
      {badge && <Badge variant="outline" className="text-xs flex-shrink-0">{badge}</Badge>}
      {selected && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
    </button>
  );
}
