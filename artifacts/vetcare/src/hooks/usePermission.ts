import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL || "";
export type PermAction = "read" | "write" | "delete";
export type PermModule = "agenda" | "ordonnances" | "finances" | "patients" | "inventaire";

interface PermRow { id: string; userId: string; module: string; canRead: boolean; canWrite: boolean; canDelete: boolean; }

const ROLE_DEFAULTS: Record<string, Record<PermAction, boolean>> = {
  ADMIN:       { read: true,  write: true,  delete: true  },
  VETERINAIRE: { read: true,  write: true,  delete: false },
  ASSISTANT:   { read: true,  write: false, delete: false },
};
const ASSISTANT_BLOCKED: PermModule[] = ["finances"];

export function usePermission(module: PermModule, action: PermAction): boolean {
  const { userId, sessionClaims, getToken } = useAuth();
  const role = ((sessionClaims as any)?.metadata?.role || "ASSISTANT").toUpperCase();

  const { data: perms } = useQuery<PermRow[]>({
    queryKey: ["permissions", userId],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${API}/api/admin/permissions?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const row = perms?.find(p => p.module === module);
  if (row) {
    if (action === "read")   return row.canRead;
    if (action === "write")  return row.canWrite;
    if (action === "delete") return row.canDelete;
  }

  // Fallback to role defaults
  if (role === "ASSISTANT" && ASSISTANT_BLOCKED.includes(module)) return false;
  const defaults = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.ASSISTANT;
  return defaults[action] ?? false;
}
