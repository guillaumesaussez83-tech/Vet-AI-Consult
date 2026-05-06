import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Upload, FileText } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Acte {
  id: number;
  code: string;
  nom: string;
  categorie: string;
  prixDefault: number;
  tvaRate: number;
  description?: string;
  unite: string;
}

export default function CataloguePrixPage() {
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery<{ data: Acte[] }>({
    queryKey: ["actes-catalogue"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/actes`);
      if (!r.ok) throw new Error("Erreur chargement catalogue");
      return r.json();
    },
  });

  const handleExport = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/actes/export-csv`);
      if (!r.ok) throw new Error("Erreur export");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "catalogue-prix.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Catalogue exporté");
    } catch (e) {
      toast.error("Erreur lors de l'export");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const r = await fetch(`${API_BASE}/api/actes/import-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erreur import");
      toast.success(`Import: ${j.inserted} créés, ${j.updated} mis à jour`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erreur import CSV");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const actes = data?.data ?? [];
  const categories = [...new Set(actes.map(a => a.categorie))].sort();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Catalogue des Prix</h1>
          <p className="text-muted-foreground text-sm">{actes.length} actes/produits — Import/export CSV</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-2" />
            {importing ? "Import..." : "Importer CSV"}
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <Card className="text-xs text-muted-foreground px-4 py-2 bg-muted/40 border-dashed">
        <FileText className="h-3.5 w-3.5 inline mr-1" />
        Format CSV attendu: <code>code,nom,categorie,prix_ht,tva_rate,description,unite</code>
      </Card>

      {isLoading && <p className="text-muted-foreground">Chargement...</p>}

      {categories.map(cat => (
        <Card key={cat}>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="secondary">{cat}</Badge>
              <span className="text-sm font-normal text-muted-foreground">
                {actes.filter(a => a.categorie === cat).length} actes
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="text-right w-24">Prix HT</TableHead>
                  <TableHead className="text-right w-20">TVA</TableHead>
                  <TableHead className="text-right w-28">Prix TTC</TableHead>
                  <TableHead className="w-16">Unité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actes.filter(a => a.categorie === cat).map(a => {
                  const ttc = (a.prixDefault * (1 + a.tvaRate / 100)).toFixed(2);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.code}</TableCell>
                      <TableCell>{a.nom}</TableCell>
                      <TableCell className="text-right">{a.prixDefault.toFixed(2)} €</TableCell>
                      <TableCell className="text-right">{a.tvaRate}%</TableCell>
                      <TableCell className="text-right font-medium">{ttc} €</TableCell>
                      <TableCell className="text-muted-foreground">{a.unite}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
