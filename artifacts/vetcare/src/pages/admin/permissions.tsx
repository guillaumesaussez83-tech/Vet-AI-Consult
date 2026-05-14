import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, UserCog, RefreshCw } from "lucide-react";

const MODULES = ["agenda", "ordonnances", "finances", "patients", "inventaire", "equipe", "ventes"];
const ACTIONS = [
  { key: "canRead", label: "Lecture" },
  { key: "canWrite", label: "Ecriture" },
  { key: "canDelete", label: "Suppression" },
];

interface Permission {
  id: string;
  userId: string;
  module: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export default function AdminPermissionsPage() {
  const { getToken } = useAuth();
  const [searchId, setSearchId] = useState("");
  const [userId, setUserId] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  async function loadPermissions(uid: string) {
    if (!uid.trim()) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/permissions?userId=${encodeURIComponent(uid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPermissions(data.data || []);
      setUserId(uid);
    } catch (e) {
      toast.error("Erreur chargement permissions");
    } finally {
      setLoading(false);
    }
  }

  function getPermForModule(mod: string): Permission | undefined {
    return permissions.find(p => p.module === mod);
  }

  async function togglePerm(mod: string, action: string, value: boolean) {
    const existing = getPermForModule(mod);
    const key = `${mod}-${action}`;
    setSaving(key);
    try {
      const token = await getToken();
      const payload = existing
        ? { ...{ canRead: existing.canRead, canWrite: existing.canWrite, canDelete: existing.canDelete }, [action]: value }
        : { canRead: action === "canRead" ? value : true, canWrite: action === "canWrite" ? value : false, canDelete: action === "canDelete" ? value : false };

      let res: Response;
      if (existing) {
        res = await fetch(`/api/admin/permissions/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId, module: mod, ...payload }),
        });
      }
      const data = await res.json();
      if (data.data) {
        setPermissions(prev => {
          const idx = prev.findIndex(p => p.module === mod);
          if (idx >= 0) { const n = [...prev]; n[idx] = data.data; return n; }
          return [...prev, data.data];
        });
        toast.success("Permission mise a jour");
      }
    } catch {
      toast.error("Erreur sauvegarde");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Permissions Granulaires</h1>
          <p className="text-muted-foreground text-sm">Gerer les droits d&apos;acces par utilisateur et par module</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4" />
            Rechercher un utilisateur
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Clerk User ID (user_xxxxx)"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              className="max-w-sm"
              onKeyDown={e => e.key === "Enter" && loadPermissions(searchId)}
            />
            <Button onClick={() => loadPermissions(searchId)} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Charger"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {userId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Permissions de <Badge variant="outline" className="font-mono text-xs">{userId}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Module</th>
                    {ACTIONS.map(a => (
                      <th key={a.key} className="text-center py-2 px-4 font-medium text-muted-foreground">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => {
                    const perm = getPermForModule(mod);
                    return (
                      <tr key={mod} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-6 font-medium capitalize">{mod}</td>
                        {ACTIONS.map(a => {
                          const val = perm ? (perm as any)[a.key] : (a.key === "canRead");
                          const key = `${mod}-${a.key}`;
                          return (
                            <td key={a.key} className="text-center py-3 px-4">
                              <Switch
                                checked={val}
                                disabled={saving === key}
                                onCheckedChange={v => togglePerm(mod, a.key, v)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
