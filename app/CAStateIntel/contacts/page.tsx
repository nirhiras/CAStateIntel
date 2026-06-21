"use client";
// app/CAStateIntel/contacts/page.tsx
// Cross-project contacts dashboard with source tracking

import { useState, useEffect, useCallback } from "react";

interface Contact {
  contact_id: string;
  project_id: number;
  project_number: string;
  project_name: string;
  document_id: string;
  stage: number;
  doc_label: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  organization: string;
  context: string;
  source: string;
  role_type: string;
  doc_created_date: string;
}

const ROLE_COLORS: Record<string, string> = {
  sponsor:     "bg-purple-100 text-purple-800",
  stakeholder: "bg-blue-100 text-blue-800",
  approver:    "bg-orange-100 text-orange-800",
  author:      "bg-green-100 text-green-800",
  reviewer:    "bg-teal-100 text-teal-800",
  contact:     "bg-gray-100 text-gray-700",
  other:       "bg-gray-50 text-gray-500",
};

const STAGE_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-indigo-100 text-indigo-800",
  3: "bg-violet-100 text-violet-800",
};

const STAGE_LABELS: Record<number, string> = {
  1: "S1 BA", 2: "S2 AA", 3: "S3 SA",
};

function buildSourceLabel(c: Contact): string {
  // Format: {project_number}-S{stage}{doc_abbrev}-{project_name}
  const stageAbbrev: Record<number, string> = {
    1: "S1BA", 2: "S2AA", 3: "S3SA"
  };
  return `${c.project_number}-${stageAbbrev[c.stage] || `S${c.stage}`}-${c.project_name}`;
}

export default function ContactsDashboardPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  // Sort
  const [sortField, setSortField] = useState<keyof Contact>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // View
  const [view, setView] = useState<"table" | "cards">("table");
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/castateintel/contacts");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setContacts(data.contacts || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  // Derive filter options
  const roleOptions = [...new Set(contacts.map(c => c.role_type).filter(Boolean))].sort();
  const orgOptions = [...new Set(contacts.map(c => c.organization).filter(Boolean))].sort();
  const projectOptions = [...new Set(contacts.map(c => c.project_number).filter(Boolean))].sort();

  // Filter + search
  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    if (q && ![c.name, c.email, c.title, c.organization, c.phone, c.source].some(
      v => (v || "").toLowerCase().includes(q)
    )) return false;
    if (roleFilter && c.role_type !== roleFilter) return false;
    if (stageFilter && String(c.stage) !== stageFilter) return false;
    if (orgFilter && c.organization !== orgFilter) return false;
    if (projectFilter && c.project_number !== projectFilter) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const av = String(a[sortField] || "").toLowerCase();
    const bv = String(b[sortField] || "").toLowerCase();
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const toggleSort = (field: keyof Contact) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: keyof Contact }) => (
    <span className="ml-1 text-gray-400">
      {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  // Stats
  const stats = {
    total: contacts.length,
    withEmail: contacts.filter(c => c.email).length,
    withPhone: contacts.filter(c => c.phone).length,
    uniqueOrgs: new Set(contacts.map(c => c.organization).filter(Boolean)).size,
    uniqueProjects: new Set(contacts.map(c => c.project_number).filter(Boolean)).size,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a href="/CAStateIntel" className="text-blue-300 hover:text-white text-sm">← CAStateIntel</a>
              <span className="text-blue-600">|</span>
              <h1 className="text-xl font-semibold">Contacts Dashboard</h1>
            </div>
            <p className="text-blue-300 text-sm">All contacts extracted from PAL project documents across all stages</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("table")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${view === "table" ? "bg-white text-blue-900" : "bg-blue-800 text-white hover:bg-blue-700"}`}
            >
              ☰ Table
            </button>
            <button
              onClick={() => setView("cards")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${view === "cards" ? "bg-white text-blue-900" : "bg-blue-800 text-white hover:bg-blue-700"}`}
            >
              ⊞ Cards
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b px-8 py-3 flex gap-8">
        {[
          { label: "Total Contacts", value: stats.total },
          { label: "With Email", value: stats.withEmail },
          { label: "With Phone", value: stats.withPhone },
          { label: "Organizations", value: stats.uniqueOrgs },
          { label: "Projects", value: stats.uniqueProjects },
          { label: "Showing", value: sorted.length },
        ].map(s => (
          <div key={s.label}>
            <div className="text-xl font-semibold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-8 py-3 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name, email, title, org..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Stages</option>
          <option value="1">Stage 1 — Business Analysis</option>
          <option value="2">Stage 2 — Alternative Analysis</option>
          <option value="3">Stage 3 — Solution Analysis</option>
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Roles</option>
          {roleOptions.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Projects</option>
          {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Organizations</option>
          {orgOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {(search || roleFilter || stageFilter || orgFilter || projectFilter) && (
          <button
            onClick={() => { setSearch(""); setRoleFilter(""); setStageFilter(""); setOrgFilter(""); setProjectFilter(""); }}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Clear filters
          </button>
        )}

        {/* Export CSV */}
        <button
          onClick={() => {
            const headers = ["Name","Title","Organization","Email","Phone","Role","Stage","Source","Section","Doc Date","Project"];
            const rows = sorted.map(c => [
              c.name, c.title, c.organization, c.email, c.phone,
              c.role_type, `Stage ${c.stage}`, buildSourceLabel(c),
              c.source, c.doc_created_date, c.project_number
            ].map(v => `"${(v||"").replace(/"/g,'""')}"`).join(","));
            const csv = [headers.join(","), ...rows].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "pal_contacts.csv"; a.click();
          }}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
        >
          ↓ Export CSV
        </button>
      </div>

      {error && <div className="mx-8 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading contacts...</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-lg mb-2">No contacts found</p>
            <p className="text-sm">Run extraction on Stage 1, 2, and 3 pages to populate contacts</p>
          </div>
        ) : view === "table" ? (
          /* TABLE VIEW */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {([
                      ["name", "Name"], ["title", "Title"], ["organization", "Organization"],
                      ["email", "Email"], ["phone", "Phone"], ["role_type", "Role"],
                      ["stage", "Stage"],
                    ] as [keyof Contact, string][]).map(([field, label]) => (
                      <th key={field}
                        onClick={() => toggleSort(field)}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap border-b border-gray-200"
                      >
                        {label}<SortIcon field={field} />
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border-b border-gray-200">Section</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((c, i) => (
                    <tr
                      key={c.contact_id || i}
                      onClick={() => setExpandedContact(expandedContact === c.contact_id ? null : c.contact_id)}
                      className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate">{c.title || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate">{c.organization || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {c.email
                          ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline">{c.email}</a>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{c.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[c.role_type] || ROLE_COLORS.other}`}>
                          {c.role_type || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[c.stage] || "bg-gray-100 text-gray-600"}`}>
                          {STAGE_LABELS[c.stage] || `S${c.stage}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">
                          {buildSourceLabel(c)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{c.source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Expanded row detail */}
            {expandedContact && (() => {
              const c = sorted.find(x => x.contact_id === expandedContact);
              if (!c) return null;
              return (
                <div className="border-t border-blue-100 bg-blue-50/40 px-6 py-4">
                  <div className="grid grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Full Name</p>
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      {c.title && <p className="text-xs text-gray-500 mt-0.5">{c.title}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Contact</p>
                      {c.email && <p className="text-sm text-blue-600"><a href={`mailto:${c.email}`}>{c.email}</a></p>}
                      {c.phone && <p className="text-sm text-gray-700">{c.phone}</p>}
                      {!c.email && !c.phone && <p className="text-sm text-gray-300">No contact info</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Source Document</p>
                      <p className="text-xs font-mono text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded">{buildSourceLabel(c)}</p>
                      {c.doc_created_date && <p className="text-xs text-gray-400 mt-1">Doc date: {new Date(c.doc_created_date).toLocaleDateString("en-US", {year:"numeric",month:"short",day:"numeric"})}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Context</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{c.context || "—"}</p>
                      {c.source && <p className="text-xs text-gray-400 mt-1">Section: {c.source}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href={`/CAStateIntel/stage${c.stage}?project=${c.project_number}`}
                      className="text-xs px-3 py-1 rounded bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600">
                      View Stage {c.stage} Analysis →
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* CARD VIEW */
          <div className="grid grid-cols-3 gap-4">
            {sorted.map((c, i) => (
              <div key={c.contact_id || i} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{c.name || "Unknown"}</h3>
                    {c.title && <p className="text-xs text-gray-500 truncate mt-0.5">{c.title}</p>}
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STAGE_COLORS[c.stage] || "bg-gray-100 text-gray-600"}`}>
                      {STAGE_LABELS[c.stage]}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[c.role_type] || ROLE_COLORS.other}`}>
                      {c.role_type}
                    </span>
                  </div>
                </div>

                {c.organization && (
                  <p className="text-xs text-gray-600 mb-2 truncate">🏢 {c.organization}</p>
                )}

                <div className="space-y-1 mb-3">
                  {c.email && (
                    <p className="text-xs text-blue-600 truncate">
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </p>
                  )}
                  {c.phone && <p className="text-xs text-gray-600">{c.phone}</p>}
                </div>

                {c.context && (
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3">{c.context}</p>
                )}

                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate">
                    {buildSourceLabel(c)}
                  </p>
                  {c.source && <p className="text-xs text-gray-400 mt-1 truncate">{c.source}</p>}
                </div>

                <div className="mt-2">
                  <a href={`/CAStateIntel/stage${c.stage}?project=${c.project_number}`}
                    className="text-xs text-blue-500 hover:underline">
                    View analysis →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
