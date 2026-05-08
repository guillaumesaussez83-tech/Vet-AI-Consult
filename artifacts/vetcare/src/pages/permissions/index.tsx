import { useState, useEffect } from "react";
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
  { id: "agenda", label: "Agenda", icon: "ï¿½ï¿½" },
  { id: "patients", label: "Patients", icon: "ï¿½î§" },
  { id: "owners", label: "Propriçtaires", icon: "ï¿½îª" },
  { id: "consultations", label: "Consultations", icon: "ï¿½å¾" },
  { id: "factures", label: "Facturation", icon: "ï¿½î" },
  { id: "ordonnances", label: "Ordonnances", icon: "ï¿½ï¿½" },
  { id: "stocks", label: "Stocks", icon: "ï¿½î¦" tï¿½(Âî½î»»îÂïèïî¼ï¿½îªï¿½ï­5Lïî»»ï¯è²Âïº~Nï¿½î½ï¿½(Âî½î»»îÂïïè¬å¥·ï¿½ï¿½ï¿½ï¿½åÂï©ïè¬å¥·ï¿½ï¿½ï¿½èï¿½ïº~N(ï¿½ç¾º(Âî½î»»îÂï¿îç­è¿æ«åïî¼ï¿½îªï¿½ï¡îç­è¿æ«åïî»»ï¯è²Âïº~R@ï¿½ç¾º)tï¿½()ï¯å¶ï¿½I=1}AIMQLï¿½Iï¿½è¤îè¿ç®ï¿½ï¿½Iï¿½è¤îè¿ç®ï¿½ï¿½ï¿½ï¿½éï¿½îï¿½è¸ï¿½ïï¿½ï¿½éç®ï¿½ï¿½ï»è£ï¿½è³ï¿½ïî«îîï¿½è¸ï¿½ïî½çÂï¿½ï¿½(Âî¼¯îæ½¸ï¿½=ï§ï¿½é¿î¨·è¥å¡¾ç®îï¿½5=U1Lå±ïâÂéî»¥æ¶ï¿½ï¿½ï¿½ï¿½éï¿½îî¼§å°¥îï¿½ï]ç®ï¿½ï¿½æ¸ï¿½ï¿½ï¿½ï¿½î«îîî¼é¦´ï¿½ï¡ï¿½ï¿îç­è¿æ«åï¿½é°ä¸­ï¿½(Âï¿½ï¿½ï¿½=ï§ï¿½é¿î¨·è¥å¡¾ç®îï¿½5=U1Lï¿½å¼ï¿½ï«ï¿½éÂïïïè¬å¥·ï¿½ï¿½ï¿îç­è¿æ«åïé¦´ï¿½æï¿½æ´æ¶ï¿½ä¸­å±ïâÂéî»¥æ¶ï¿½ï¿½ï¿½ï¿½éï¿½îî¼§å°¥îï¿½ï]ç®ï¿½ï¿½lï¿½ï¿½ï¿½ï¿½ï¿½ï¿ïï¿½å¡¾ï¿½ï¿½ï»æ®îï¿½té¦´ï¿½æï¿½æ´æ¶ï¿½ä»ï¿½ïî«îîï¿½ï»ï¿½î½tä¸­ï¿½(Âî¼£ï¿½î²ï¯ï¿½ï¿½=ï§ï¿½é¿î¨·è¥å¡¾ç®îï¿½5=U1Lå±ïâÂéî»¥æ¶ï¿½ï¿½ï¿½ï¿½éï¿½îî»¤ï¿½ï¿½ï¿½ï¿½ï¿½ï¿ïï¿½å¡¾ï¿½ï¿½ï»æ®î±s"].includes(m.id), canWrite: false, canDelete: false }])),
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
  useEffect(() => {
    setLocalPerms({});
  }, [selectedUser]);

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
    // Si on dçcoche canRead, on dçcoche aussi les autres
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
        <p className="text-gray-500 text-sm mt-1">Configurez les permissions d'accç¡s par module pour chaque membre de la clinique</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: user list */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">ï¿½quipe</h2>
            </div>
            {usersLoading ? (
              <div className="p-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center">Aucun utilisateur trouvç</div>
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
              <div className="text-4xl mb-3">ï¿½ï¿½</div>
              <p className="font-medium">Sçlectionnez un utilisateur</p>
              <p className="text-sm mt-1">pour gçrer ses permissions</p>
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
                  <span className="text-xs text-gray-500 self-center">Prçrçglages :</span>
                  {[
                    { key: "veto", label: "Vçtçrinaire" },
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
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">ï¿½criture</th>
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
                              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" title="Modifiç" />}
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
                    Permissions enregistrçes
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">
                    {Object.keys(localPerms).length > 0
                      ? `${Object.keys(localPerms).length} module(s) modifiç(s) ï¿½ï¿½ non enregistrç`
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
              ï¿½criture : peut crçer/modifier
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
