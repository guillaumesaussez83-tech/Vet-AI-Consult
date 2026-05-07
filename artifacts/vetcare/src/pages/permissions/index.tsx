import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface UserInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  imageUrl?: string;
}

interface Permission {
  userId: string;
  module: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

const MODULES = [
  { id: "agenda", label: "Agenda", icon: "📅" },
  { id: "patients", label: "Patients", icon: "🐾" },
  { id: "owners", label: "Propriétaires", icon: "👤" },
  { id: "consultations", label: "Consultations", icon: "🩺" },
  { id: "factures", label: "Facturation", icon: "💶" },
  { id: "ordonnances", label: "Ordonnances", icon: "📋" },
  { id: "stocks", label: "Stocks", icon: "📦" },
  { id: "sms", label: "SMS", icon: "📱" },
  { id: "rapports", label: "Rapports", icon: "📊" },
  { id: "permissions", label: "Permissions", icon: "🔐" },
];

const ROLE_PRESETS: Record<string, Record<string, { canRead: boolean; canWrite: boolean; canDelete: boolean }>> = {
  veto: Object.fromEntries(MODULES.map(m => [m.id, { canRead: true, canWrite: true, canDelete: m.id !== "permissions" }])),
  asa: Object.fromEntries(MODULES.filter(m => !["rapports", "permissions"].includes(m.id)).map(m => [m.id, { canRead: true, canWrite: ["agenda", "patients", "owners"].includes(m.id), canDelete: false }])),
  stagiaire: Object.fromEntries(MODULES.map(m => [m.id, { canRead: ["agenda", "patients", "owners"].includes(m.id), canWrite: false, canDelete: false }])),
};

export default function PermissionsPage() {
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch clinic users (from Clerk via backend)
  const { data: users = [], isLoading: usersLoading } = useQuery<UserInfo[]>({
    queryKey: ["clinic-users"],
    queryFn: async () => {
      const r = await fetch("/api/clinic/users");
      const d = await r.json();
      return d.data || [];
    },
  });

  // Fetch permissions for selected user
  const { data: userPerms = [] } = useQuery<Permission[]>({
    queryKey: ["permissions", selectedUser],
    queryFn: async () => {
      const r = await fetch(`/api/permissions/${selectedUser}`);
      const d = await r.json();
      return d.data || [];
    },
    enabled: !!selectedUser,
  });

  // Build local perm map
  const permMap = Object.fromEntries(
    userPerms.map(p => [p.module, { canRead: p.canRead, canWrite: p.canWrite, canDelete: p.canDelete }])
  );

  const [localPerms, setLocalPerms] = useState<Record<string, { canRead: boolean; canWrite: boolean; canDelete: boolean }>>({});

  // When user changes, reset local perms
  const effectivePerms = selectedUser
    ? Object.fromEntries(MODULES.map(m => [m.id, localPerms[m.id] ?? permMap[m.id] ?? { canRead: false, canWrite: false, canDelete: false }]))
    : {};

  // Save all permissions
  const savePerms = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const mod of MODULES) {
        const p = effectivePerms[mod.id];
        const r = await fetch(`/api/permissions/${selectedUser}/${mod.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        results.push(r.json());
      }
      return Promise.all(results);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissions", selectedUser] });
      setLocalPerms({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const applyPreset = (preset: string) => {
    if (ROLE_PRESETS[preset]) {
      setLocalPerms({ ...ROLE_PRESETS[preset] });
    }
  };

  const togglePerm = (module: string, field: "canRead" | "canWrite" | "canDelete") => {
    const current = effectivePerms[module] || { canRead: false, canWrite: false, canDelete: false };
    const updated = { ...current, [field]: !current[field] };
    // Si on décoche canRead, on décoche aussi les autres
    if (field === "canRead" && !updated.canRead) {
      updated.canWrite = false;
      updated.canDelete = false;
    }
    // Si on coche canWrite ou canDelete, on coche aussi canRead
    if ((field === "canWrite" || field === "canDelete") && updated[field]) {
      updated.canRead = true;
    }
    setLocalPerms(prev => ({ ...prev, [module]: updated }));
  };

  const selectedUserInfo = users.find(u => u.id === selectedUser);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des droits</h1>
        <p className="text-gray-500 text-sm mt-1">Configurez les permissions d'accès par module pour chaque membre de la clinique</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: user list */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Équipe</h2>
            </div>
            {usersLoading ? (
              <div className="p-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center">Aucun utilisateur trouvé</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUser(u.id); setLocalPerms({}); }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      selectedUser === u.id ? "bg-blue-50 border-l-2 border-blue-500" : ""
                    }`}
                  >
                    {u.imageUrl ? (
                      <img src={u.imageUrl} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        {u.firstName?.[0]}{u.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-800">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-gray-500">{u.role || u.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: permissions grid */}
        <div className="col-span-2">
          {!selectedUser ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">🔐</div>
              <p className="font-medium">Sélectionnez un utilisateur</p>
              <p className="text-sm mt-1">pour gérer ses permissions</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* User header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedUserInfo?.imageUrl ? (
                    <img src={selectedUserInfo.imageUrl} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      {selectedUserInfo?.firstName?.[0]}{selectedUserInfo?.lastName?.[0]}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-800">{selectedUserInfo?.firstName} {selectedUserInfo?.lastName}</div>
                    <div className="text-xs text-gray-500">{selectedUserInfo?.email}</div>
                  </div>
                </div>
                {/* Presets */}
                <div className="flex gap-2">
                  <span className="text-xs text-gray-500 self-center">Préréglages :</span>
                  {[
                    { key: "veto", label: "Vétérinaire" },
                    { key: "asa", label: "ASA" },
                    { key: "stagiaire", label: "Stagiaire" },
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={() => applyPreset(p.key)}
                      className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions table */}
              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Module</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Lecture</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Écriture</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Suppression</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {MODULES.map(m => {
                      const p = effectivePerms[m.id] || { canRead: false, canWrite: false, canDelete: false };
                      const isDirty = localPerms[m.id] !== undefined;
                      return (
                        <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${isDirty ? "bg-yellow-50" : ""}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span>{m.icon}</span>
                              <span className="font-medium text-gray-700">{m.label}</span>
                              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" title="Modifié" />}
                            </div>
                          </td>
                          <td className="text-center px-4 py-3">
                            <button
                              onClick={() => togglePerm(m.id, "canRead")}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                p.canRead ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300 hover:border-blue-400"
                              }`}
                            >
                              {p.canRead && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="text-center px-4 py-3">
                            <button
                              onClick={() => togglePerm(m.id, "canWrite")}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                p.canWrite ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"
                              }`}
                            >
                              {p.canWrite && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="text-center px-4 py-3">
                            <button
                              onClick={() => togglePerm(m.id, "canDelete")}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                                p.canDelete ? "bg-red-500 border-red-500 text-white" : "border-gray-300 hover:border-red-400"
                              }`}
                            >
                              {p.canDelete && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Save */}
              <div className="px-5 py-4 border-t border-gray-100 flex justify-between items-center">
                {saveSuccess ? (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Permissions enregistrées
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">
                    {Object.keys(localPerms).length > 0
                      ? `${Object.keys(localPerms).length} module(s) modifié(s) — non enregistré`
                      : "Aucune modification en attente"}
                  </span>
                )}
                <button
                  onClick={() => savePerms.mutate()}
                  disabled={savePerms.isPending}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {savePerms.isPending ? "Enregistrement..." : "Enregistrer les permissions"}
                </button>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500" />
              Lecture : peut consulter
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-500" />
              Écriture : peut créer/modifier
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500" />
              Suppression : peut supprimer
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
