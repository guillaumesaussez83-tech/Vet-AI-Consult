import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { AlertCircle, ArrowLeft, Mail, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmt(n: number | string) {
  return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

const BUCKET_COLORS: Record<string, string> = {
  "0-30": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "31-60": "bg-orange-100 text-orange-800 border-orange-300",
  "61-90": "bg-red-100 text-red-800 border-red-300",
  "90+":   "bg-red-200 text-red-900 border-red-400 font-bold",
};

const BUCKET_LABELS: Record<string, string> = {
  "0-30": "< 30 jours",
  "31-60": "31 – 60 j",
  "61-90": "61 – 90 j",
  "90+": "> 90 jours",
};

interface Impaye {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_ttc: number;
  total_paid: number;
  reste_a_payer: number;
  jours_retard: number;
  aging_bucket: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  derniere_relance: string | null;
  nb_relances: number;
}

export default function ImpayesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [relanceDialog, setRelanceDialog] = useState<Impaye | null>(null);
  const [message, setMessage] = useState("");
  const [filterBucket, setFilterBucket] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["impayes"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/comptabilite/impayes`);
      if (!r.ok) throw new Error("Erreur chargement impayés");
      return r.json();
    },
  });

  const impayes: Impaye[] = data?.data?.impayes ?? [];
  const buckets = data?.data?.buckets ?? {};
  const totalImpayes = data?.data?.total_impayes ?? 0;

  const filtered = filterBucket ? impayes.filter(i => i.aging_bucket === filterBucket) : impayes;

  const relanceMutation = useMutation({
    mutationFn: async ({ invoiceId, email, name, msg }: { invoiceId: number; email: string; name: string; msg: string }) => {
      const r = await fetch(`${API_BASE}/api/comptabilite/relances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          channel: "email",
          recipientEmail: email,
          recipientName: name,
          message: msg,
        }),
      });
      if (!r.ok) throw new Error("Erreur relance");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Relance enregistrée", description: "La relance a été tracée." });
      qc.invalidateQueries({ queryKey: ["impayes"] });
      setRelanceDialog(null);
      setMessage("");
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const openRelance = (row: Impaye) => {
    setMessage(
      `Bonjour ${row.owner_name},\n\nNous vous rappelons que la facture ${row.invoice_number} d'un montant de ${fmt(row.reste_a_payer)} est en attente de règlement depuis ${row.jours_retard} jours.\n\nMerci de bien vouloir régulariser cette situation dans les plus brefs délais.\n\nCordialement,\nL'équipe VétoAI`
    );
    setRelanceDialog(row);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/comptabilite">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            Impayés
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {impayes.length} facture{impayes.length > 1 ? "s" : ""} — total {fmt(totalImpayes)}
          </p>
        </div>
      </div>

      {/* Aging buckets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(BUCKET_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterBucket(filterBucket === key ? null : key)}
            className={`border rounded-lg p-3 text-left transition-all ${
              filterBucket === key ? "ring-2 ring-blue-500" : "hover:shadow-sm"
            }`}
          >
            <div className={`inline-flex px-2 py-0.5 rounded text-xs border mb-1 ${BUCKET_COLORS[key]}`}>
              {label}
            </div>
            <div className="text-lg font-bold">{fmt(buckets[key] ?? 0)}</div>
            <div className="text-xs text-muted-foreground">
              {impayes.filter(i => i.aging_bucket === key).length} facture(s)
            </div>
          </button>
        ))}
      </div>

      {filterBucket && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filtre : <Badge variant="outline">{BUCKET_LABELS[filterBucket]}</Badge></span>
          <Button variant="ghost" size="sm" onClick={() => setFilterBucket(null)}>Tout voir</Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {filterBucket ? `Impayés ${BUCKET_LABELS[filterBucket]}` : "Tous les impayés"}
            <span className="ml-2 text-muted-foreground font-normal">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
              <span>Aucun impayé{filterBucket ? ` dans cette tranche` : ""} 🎉</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left p-3 font-medium">Facture</th>
                    <th className="text-left p-3 font-medium">Client</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-right p-3 font-medium">Reste à payer</th>
                    <th className="text-center p-3 font-medium">Ancienneté</th>
                    <th className="text-center p-3 font-medium">Relances</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono font-medium">{row.invoice_number}</td>
                      <td className="p-3">
                        <div>{row.owner_name}</div>
                        {row.owner_email && (
                          <div className="text-xs text-muted-foreground">{row.owner_email}</div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(row.invoice_date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3 text-right font-bold text-red-600">
                        {fmt(row.reste_a_payer)}
                        {Number(row.total_paid) > 0 && (
                          <div className="text-xs text-muted-foreground font-normal">
                            {fmt(row.total_paid)} réglé / {fmt(row.total_ttc)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${BUCKET_COLORS[row.aging_bucket]}`}>
                          {row.jours_retard}j
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {row.nb_relances > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge variant="secondary" className="text-xs">{row.nb_relances}×</Badge>
                            {row.derniere_relance && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(row.derniere_relance).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRelance(row)}
                          disabled={!row.owner_email}
                          title={!row.owner_email ? "Email client non renseigné" : "Envoyer une relance"}
                        >
                          <Mail className="h-3 w-3 mr-1" />
                          Relancer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relance dialog */}
      <Dialog open={!!relanceDialog} onOpenChange={(o) => { if (!o) setRelanceDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Relance — {relanceDialog?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {relanceDialog && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">Client :</span> <strong>{relanceDialog.owner_name}</strong></div>
                <div><span className="text-muted-foreground">Email :</span> {relanceDialog.owner_email}</div>
                <div><span className="text-muted-foreground">Reste à payer :</span> <strong className="text-red-600">{fmt(relanceDialog.reste_a_payer)}</strong></div>
                <div><span className="text-muted-foreground">Retard :</span> {relanceDialog.jours_retard} jours</div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Message de relance</label>
                <Textarea
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Ce message sera tracé dans l'historique. L'envoi email doit être fait manuellement depuis votre messagerie.
                </p>
              </div>

              {relanceDialog.nb_relances > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-2">
                  <Clock className="h-3 w-3 text-yellow-600" />
                  <span>
                    {relanceDialog.nb_relances} relance(s) déjà effectuée(s),
                    dernière le {new Date(relanceDialog.derniere_relance!).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelanceDialog(null)}>Annuler</Button>
            <Button
              onClick={() => relanceMutation.mutate({
                invoiceId: relanceDialog!.id,
                email: relanceDialog!.owner_email,
                name: relanceDialog!.owner_name,
                msg: message,
              })}
              disabled={relanceMutation.isPending}
            >
              <Mail className="h-4 w-4 mr-2" />
              {relanceMutation.isPending ? "Enregistrement…" : "Enregistrer la relance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
