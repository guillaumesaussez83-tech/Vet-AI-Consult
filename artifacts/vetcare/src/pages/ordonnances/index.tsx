import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { FileText, Printer, Sparkles, Search, Calendar, User } from "lucide-react";
import { formatDateFR } from "@/lib/utils";

const API_BASE = "/api";

interface Ordonnance {
  id: number;
  consultationId: number;
  patientId: number | null;
  veterinaire: string | null;
  contenu: string;
  genereIA: boolean;
  instructionsClient: string | null;
  createdAt: string;
}

async function fetchOrdonnances(search?: string): Promise<Ordonnance[]> {
  const url = `${API_BASE}/ordonnances${search ? `?q=${encodeURIComponent(search)}` : ""}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Erreur serveur");
  return r.json();
}

function sanitizeContenu(raw: string): string {
  if (!raw) return "";
  return raw
    .split("\n")
    .map(line =>
      line
        .replace(/\bnull\b/gi, "")
        .replace(/\bundefined\b/gi, "")
        .replace(/Qté\s*:\s*,/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/,\s*,/g, ",")
        .replace(/^\s*[-–•]\s*$/, "")
        .trim()
    )
    .filter(line => line.length > 0 && line !== "-" && line !== "–")
    .join("\n");
}

export default function OrdonnancesPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ordonnances"],
    queryFn: () => fetchOrdonnances(),
  });

  const filtered = (data ?? []).filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.contenu.toLowerCase().includes(q) ||
      o.veterinaire?.toLowerCase().includes(q) ||
      o.consultationId.toString().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordonnances</h1>
          <p className="text-muted-foreground">Historique des prescriptions médicales</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher par vétérinaire, contenu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="font-medium text-muted-foreground">Aucune ordonnance</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les ordonnances générées depuis les consultations apparaissent ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <Card key={o.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="bg-blue-100 p-2 rounded-lg shrink-0 mt-0.5">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{(o as any).numeroOrdonnance ?? `Ordonnance #${o.id}`}</span>
                        <span className="text-muted-foreground text-xs">Consultation #{o.consultationId}</span>
                        {o.genereIA && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" />
                            IA
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {o.veterinaire && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {o.veterinaire}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateFR(o.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{sanitizeContenu(o.contenu)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/ordonnances/${o.id}/imprimer`}>
                      <Button variant="outline" size="sm">
                        <Printer className="h-3.5 w-3.5 mr-1" />
                        Imprimer
                      </Button>
                    </Link>
                    <Link href={`/consultations/${o.consultationId}`}>
                      <Button variant="ghost" size="sm">
                        Consultation
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
