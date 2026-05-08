import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface Owner {
  id: number;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  ville?: string;
  no_show_count?: number;
  created_at: string;
}

const fetchOwners = async (search: string): Promise<Owner[]> => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const r = await fetch(`/api/owners?${params}`);
  const d = await r.json();
  return d.data || [];
};

export default function ProprietairesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["owners", debouncedSearch],
    queryFn: () => fetchOwners(debouncedSearch),
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PropriÃ©taires</h1>
          <p className="text-gray-500 text-sm mt-1">{owners.length} rÃ©sultat{owners.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/proprietaires/nouveau">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau propriÃ©taire
          </button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher par nom, prÃ©nom, email ou tÃ©lÃ©phone..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : owners.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5M12 12a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
          <p className="font-medium">Aucun propriÃ©taire trouvÃ©</p>
          {search && <p className="text-sm mt-1">Essayez un autre terme de recherche</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nom</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">TÃ©lÃ©phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ville</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">No-show</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Depuis</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {owners.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/proprietaires/${o.id}`}>
                      <span className="font-medium text-blue-700 hover:underline cursor-pointer">
                        {o.nom} {o.prenom}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.telephone || "â"}</td>
                  <td className="px-4 py-3 text-gray-600">{o.email || "â"}</td>
                  <td className="px-4 py-3 text-gray-600">{o.ville || "â"}</td>
                  <td className="px-4 py-3">
                    {(o.no_show_count ?? 0) > 0 ? (
                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {o.no_show_count}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(o.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/proprietaires/${o.id}`}>
                      <button className="text-gray-400 hover:text-blue-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
