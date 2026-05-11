import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { supabase } from "../../lib/supabase";

interface UserInfo {
  id: string;
  clerk_user_id: string;
  full_name: string;
  role: string;
  clinic_id: string;
}

interface Permission {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

const MODULES = [
  { id: "agenda", label: "Agenda" },
  { id: "patients", label: "Patients" },
  { id: "owners", label: "Proprietaires" },
  { id: "consultations", label: "Consultations" },
  { id: "factures", label: "Facturation" },
  { id: "ordonnances", label: "Ordonnances" },
  { id: "stocks", label: "Stocks" },
  { id: "equipe", label: "Equipe" },
  { id: "ventes", label: "Ventes" },
];

const ROLE_PRESETS = {
  veto: Object.fromEntries(
    MODULES.map(m => [m.id, { canRead: true, canWrite: true, canDelete: false }])
  ),
  asa: Object.fromEntries(
    MODULES.map(m => [
      m.id,
      { canRead: true, canWrite: !["factures", "stocks"].includes(m.id), canDelete: false },
    ])
  ),
  stagiaire: Object.fromEntries(
    MODULES.map(m => [
      m.id,
      {
        canRead: ["agenda", "patients", "consultations"].includes(m.id),
        canWrite: false,
        canDelete: false,
      },
    ])
  ),
};

export default function PermissionsPage() {
  const { user } = useUser();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadPermissions(selectedUser);
    }
  }, [selectedUser]);

  async function loadUsers() {
    const { data, error } = await supabase
      .from("users")
      .select("id, clerk_user_id, full_name, role, clinic_id")
      .order("full_name");
    if (!error && data) setUsers(data);
  }

  async function loadPermissions(clerkUserId: string) {
    const { data } = await supabase
      .from("user_permissions")
      .select("module, can_read, can_write, can_delete")
      .eq("clerk_user_id", clerkUserId);

    const perms: Record<string, Permission> = {};
    MODULES.forEach(m => {
      perms[m.id] = { canRead: false, canWrite: false, canDelete: false };
    });
    if (data) {
      data.forEach((row: any) => {
        perms[row.module] = {
          canRead: row.can_read,
          canWrite: row.can_write,
          canDelete: row.can_delete,
        };
      });
    }
    setPermissions(perms);
  }

  async function savePermissions() {
    if (!selectedUser) return;
    setSaving(true);
    setMessage("");

    const rows = MODULES.map(m => ({
      clerk_user_id: selectedUser,
      module: m.id,
      can_read: permissions[m.id]?.canRead ?? false,
      can_write: permissions[m.id]?.canWrite ?? false,
      can_delete: permissions[m.id]?.canDelete ?? false,
    }));

    const { error } = await supabase
      .from("user_permissions")
      .upsert(rows, { onConflict: "clerk_user_id,module" });

    setSaving(false);
    setMessage(error ? "Erreur lors de la sauvegarde." : "Permissions sauvegardees.");
    setTimeout(() => setMessage(""), 3000);
  }

  function applyPreset(role: keyof typeof ROLE_PRESETS) {
    setPermissions(ROLE_PRESETS[role]);
  }

  function togglePerm(moduleId: string, field: keyof Permission) {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [field]: !prev[moduleId]?.[field],
      },
    }));
  }

  const filteredUsers = users.filter(
    u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.clerk_user_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestion des permissions</h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher un utilisateur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <span className="text-sm font-medium self-center">Utilisateur:</span>
        <select
          value={selectedUser}
          onChange={e => setSelectedUser(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">-- Choisir --</option>
          {filteredUsers.map(u => (
            <option key={u.clerk_user_id} value={u.clerk_user_id}>
              {u.full_name} ({u.role})
            </option>
          ))}
        </select>
      </div>

      {selectedUser && (
        <>
          <div className="mb-4 flex gap-2">
            <span className="text-sm font-medium self-center">Preset:</span>
            <button
              onClick={() => applyPreset("veto")}
              className="px-3 py-1 bg-blue-100 rounded text-sm"
            >
              Veterinaire
            </button>
            <button
              onClick={() => applyPreset("asa")}
              className="px-3 py-1 bg-green-100 rounded text-sm"
            >
              ASA
            </button>
            <button
              onClick={() => applyPreset("stagiaire")}
              className="px-3 py-1 bg-yellow-100 rounded text-sm"
            >
              Stagiaire
            </button>
          </div>

          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border">Module</th>
                <th className="p-2 border">Lecture</th>
                <th className="p-2 border">Ecriture</th>
                <th className="p-2 border">Suppression</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="p-2 border font-medium">{m.label}</td>
                  <td className="p-2 border text-center">
                    <input
                      type="checkbox"
                      checked={permissions[m.id]?.canRead ?? false}
                      onChange={() => togglePerm(m.id, "canRead")}
                    />
                  </td>
                  <td className="p-2 border text-center">
                    <input
                      type="checkbox"
                      checked={permissions[m.id]?.canWrite ?? false}
                      onChange={() => togglePerm(m.id, "canWrite")}
                    />
                  </td>
                  <td className="p-2 border text-center">
                    <input
                      type="checkbox"
                      checked={permissions[m.id]?.canDelete ?? false}
                      onChange={() => togglePerm(m.id, "canDelete")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center gap-4">
            <button
              onClick={savePermissions}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
            {message && <span className="text-sm text-green-600">{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}
