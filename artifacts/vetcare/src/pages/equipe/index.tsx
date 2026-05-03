import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Plus, Pencil, UserX, UserCheck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Select natif utilisé à la place de Radix (fix removeChild crash)
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Assistant = {
  id: number;
  clinicId: string;
  clerkUserId?: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  role: string;
  initiales?: string;
  actif: boolean;
  createdAt: string;
};

type AssistantForm = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: string;
  initiales: string;
};

const EMPTY_FORM: AssistantForm = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  role: "assistante",
  initiales: "",
};

const ROLES = ["assistante", "vétérinaire", "stagiaire", "admin", "autre"];

export default function EquipePage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assistant | null>(null);
  const [form, setForm] = useState<AssistantForm>(EMPTY_FORM);
  const [showAll, setShowAll] = useState(false);

  async function authFetch(path: string, init?: RequestInit) {
    const token = await getToken();
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  const endpoint = showAll ? "/api/equipe/all" : "/api/equipe";

  const { data: assistants = [], isLoading } = useQuery<Assistant[]>({
    queryKey: ["equipe", showAll],
    queryFn: async () => {
      const res = await authFetch(endpoint);
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const createAssistant = useMutation({
    mutationFn: async (payload: AssistantForm) => {
      const res = await authFetch("/api/equipe", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erreur création");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe"] });
      setOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Membre ajouté" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'ajouter le membre", variant: "destructive" }),
  });

  const updateAssistant = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: AssistantForm }) => {
      const res = await authFetch(`/api/equipe/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erreur mise à jour");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe"] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({ title: "Membre mis à jour" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" }),
  });

  const toggleActif = useMutation({
    mutationFn: async ({ id, actif }: { id: number; actif: boolean }) => {
      if (!actif) {
        await authFetch(`/api/equipe/${id}`, { method: "DELETE" });
      } else {
        await authFetch(`/api/equipe/${id}`, {
          method: "PUT",
          body: JSON.stringify({ actif: true }),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(a: Assistant) {
    setEditing(a);
    setForm({
      nom: a.nom,
      prenom: a.prenom,
      email: a.email ?? "",
      telephone: a.telephone ?? "",
      role: a.role,
      initiales: a.initiales ?? "",
    });
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.nom || !form.prenom) return;
    if (editing) {
      updateAssistant.mutate({ id: editing.id, payload: form });
    } else {
      createAssistant.mutate(form);
    }
  }

  const isPending = createAssistant.isPending || updateAssistant.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <UserCog className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Équipe</h1>
          <p className="text-muted-foreground text-sm">Gestion des assistants et collaborateurs</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Chargement..." : `${assistants.length} membre(s)`}
          </p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />
            Voir inactifs
          </label>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un membre
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assistants.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Aucun membre dans l'équipe
          </div>
        )}
        {assistants.map((a) => (
          <div
            key={a.id}
            className={`border rounded-lg p-4 space-y-3 ${!a.actif ? "opacity-60 bg-muted/20" : "bg-card"}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {a.initiales || `${a.prenom[0]}${a.nom[0]}`}
                </div>
                <div>
                  <p className="font-semibold">{a.prenom} {a.nom}</p>
                  <Badge variant="outline" className="text-xs">{a.role}</Badge>
                </div>
              </div>
              {!a.actif && (
                <Badge variant="secondary" className="text-xs">Inactif</Badge>
              )}
            </div>

            {(a.email || a.telephone) && (
              <div className="text-sm text-muted-foreground space-y-1">
                {a.email && <p>{a.email}</p>}
                {a.telephone && <p>{a.telephone}</p>}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(a)}>
                <Pencil className="h-3 w-3 mr-1" />
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleActif.mutate({ id: a.id, actif: !a.actif })}
              >
                {a.actif ? (
                  <UserX className="h-3 w-3" />
                ) : (
                  <UserCheck className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le membre" : "Ajouter un membre"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prénom *</Label>
                <Input
                  value={form.prenom}
                  onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                  placeholder="Prénom"
                />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  placeholder="Nom"
                />
              </div>
            </div>

            <div>
              <Label>Rôle</Label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border border-input bg-background px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Initiales</Label>
              <Input
                value={form.initiales}
                onChange={(e) => setForm((f) => ({ ...f, initiales: e.target.value.toUpperCase().slice(0, 3) }))}
                placeholder="Ex: ABD"
                maxLength={3}
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemple.fr"
              />
            </div>

            <div>
              <Label>Téléphone</Label>
              <Input
                value={form.telephone}
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                placeholder="06 xx xx xx xx"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={isPending || !form.nom || !form.prenom}>
              {isPending ? "Enregistrement..." : editing ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
