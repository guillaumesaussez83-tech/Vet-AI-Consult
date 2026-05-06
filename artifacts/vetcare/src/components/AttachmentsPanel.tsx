import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Trash2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const API = "/api";
const MAX_SIZE_MB = 5;

interface Attachment {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string | null;
  createdAt: string;
}

interface Props { consultationId: number; }

function formatBytes(b: number) {
  if (b < 1024) return b + " o";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " Ko";
  return (b / (1024 * 1024)).toFixed(1) + " Mo";
}

export function AttachmentsPanel({ consultationId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ["attachments", consultationId],
    queryFn: async () => {
      const r = await fetch(`${API}/consultations/${consultationId}/attachments`);
      const d = await r.json();
      return d.data ?? [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const dataBase64 = (reader.result as string).split(",")[1];
            const r = await fetch(`${API}/consultations/${consultationId}/attachments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: file.name,
                mimeType: file.type || "application/octet-stream",
                sizeBytes: file.size,
                dataBase64,
              }),
            });
            if (!r.ok) throw new Error("Upload failed");
            resolve();
          } catch (e) { reject(e); }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attachments", consultationId] });
      toast({ title: "Fichier joint", description: "Pièce jointe ajoutée." });
    },
    onError: () => toast({ title: "Erreur upload", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/consultations/${consultationId}/attachments/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments", consultationId] }),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: `Fichier trop volumineux (max ${MAX_SIZE_MB} Mo)`, variant: "destructive" });
      return;
    }
    uploadMutation.mutate(file);
    e.target.value = "";
  }

  function handleDownload(att: Attachment) {
    window.open(`${API}/consultations/${consultationId}/attachments/${att.id}/download`, "_blank");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Paperclip className="h-4 w-4" />
          <span>Pièces jointes ({attachments.length})</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}>
          <Upload className="h-3 w-3 mr-1" />
          {uploadMutation.isPending ? "Envoi..." : "Joindre"}
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
      </div>
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-xs bg-muted/30">
              <span className="truncate max-w-[160px] font-medium">{att.filename}</span>
              <span className="text-muted-foreground ml-2 shrink-0">{formatBytes(att.sizeBytes)}</span>
              <div className="flex gap-1 ml-2 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDownload(att)}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(att.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
