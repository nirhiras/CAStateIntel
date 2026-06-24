"use client";
// app/CAStateIntel/procurements/page.tsx
// All ancillary procurements across all projects

import { useState, useEffect } from "react";

interface Procurement {
  project_number: string;
  project_name: string;
  name: string;
  description: string;
  procurement_type: string;
  vendor_or_source: string;
  estimated_value: string;
  timeline: string;
  justification: string;
  key_values: Record<string, string>;
}

interface ProjectOption { project_number: string; name: string; }

const TYPE_COLORS: Record<string, string> = {
  "RFP": "bg-blue-100 text-blue-800",
  "IFB": "bg-green-100 text-green-800",
  "RFO": "bg-purple-100 text-purple-800",
  "MSA": "bg-orange-100 text-orange-800",
  "CMAS": "bg-teal-100 text-teal-800",
  "Sole Source": "bg-red-100 text-red-800",
  "WSCA": "bg-yellow-100 text-yellow-800",
};

export default function ProcurementsPage() {
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "cards">("cards");

  useEffect(() => {
    fetch("/api/castateintel/projects")
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : data.projects || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectFilter) params.set("project", projectFilter);
    fetch(`/api/castateintel/procurements?${params}`)
      .then(r => r.json())
      .then(data => { setProcurements(data.procurements || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectFilter]);

  const allTypes = [...new Set(procurements.map(p => p.procurement_type).filter(Boolean))].sort();

  const filtered = procurements.filter(p => {
    if (typeFilter && p.procurement_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![p.name, p.description, p.vendor_or_source, p.project_name].some(v => (v||"").toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalValue = filtered
    .map(p => parseFloat((p.estimated_value || "").replace(/[^0-9.]/g, "")))
    .filter(v => !isNaN(v))
    .reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-violet-900 text-white px-8 py-5">
        <div className="flex items-center gap-3 mb-2">
          <a href="/CAStateIntel" className="text-violet-300 hover:text-white text-sm">← Dashboard</a>
          <span className="text-violet-600">|</span>
          <h1 className="text-xl font-bold">Ancillary Procurements</h1>
        </div>
        <p className="text-violet-300 text-sm">All secondary procurements extracted from Stage 3 Solution Analysis documents</p>
      </div>

      {/* Stats */}
      <div className="bg-white border-b px-8 py-3 flex gap-8">
        <div><div className="text-2xl font-semibold text-gray-900">{filtered.length}</div><div className="text-xs text-gray-500">Procurements</div></div>
        <div><div className="text-2xl font-semibold text-gray-900">{new Set(filtered.map(p => p.project_number)).size}</div><div className="text-xs text-gray-500">Projects</div></div>
        <div><div className="text-2xl font-semibold text-gray-900">{allTypes.length}</div><div className="text-xs text-gray-500">Types</div></div>
        {totalValue > 0 && (
          <div><div className="text-2xl font-semibold text-violet-700">${totalValue.toLocaleString()}</div><div className="text-xs text-gray-500">Total Est. Value</div></div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-8 py-3 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search procurements..." value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-violet-500" />
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.project_number} value={p.project_number}>{p.project_number} — {p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || projectFilter || typeFilter) && (
          <button onClick={() => { setSearch(""); setProjectFilter(""); setTypeFilter(""); }}
            className="text-xs text-red-500 hover:text-red-700 underline">Clear</button>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setView("cards")}
            className={`px-3 py-1.5 rounded text-xs font-medium ${view === "cards" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600"}`}>
            ⊞ Cards
          </button>
          <button onClick={() => setView("table")}
            className={`px-3 py-1.5 rounded text-xs font-medium ${view === "table" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600"}`}>
            ☰ Table
          </button>
          <button onClick={() => {
            const headers = ["Project","Project Name","Procurement","Type","Vendor/Source","Est. Value","Timeline","Description"];
            const rows = filtered.map(p => [p.project_number, p.project_name, p.name, p.procurement_type, p.vendor_or_source, p.estimated_value, p.timeline, p.description]
              .map(v => `"${(v||"").replace(/"/g,'""')}"`).join(","));
            const csv = [headers.join(","), ...rows].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = "procurements.csv"; a.click();
          }} className="px-3 py-1.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
            ↓ CSV
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading procurements...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-lg mb-2">No procurements found</p>
            <p className="text-sm">Extract Stage 3 analysis to populate procurements</p>
          </div>
        ) : view === "cards" ? (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((p, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                    <a href={`/CAStateIntel/stage3?project=${p.project_number}`}
                      className="text-xs text-violet-600 hover:underline mt-0.5 block">
                      {p.project_number} — {p.project_name}
                    </a>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    {p.estimated_value && <div className="font-bold text-violet-700 text-sm">{p.estimated_value}</div>}
                    {p.procurement_type && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-1 inline-block ${TYPE_COLORS[p.procurement_type] || "bg-gray-100 text-gray-600"}`}>
                        {p.procurement_type}
                      </span>
                    )}
                  </div>
                </div>
                {p.description && <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-3">{p.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {p.vendor_or_source && (
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-400 font-medium mb-0.5">Vendor / Source</div>
                      <div className="text-gray-700">{p.vendor_or_source}</div>
                    </div>
                  )}
                  {p.timeline && (
                    <div className="bg-violet-50 rounded p-2">
                      <div className="text-violet-400 font-medium mb-0.5">Timeline</div>
                      <div className="text-violet-700">📅 {p.timeline}</div>
                    </div>
                  )}
                </div>
                {p.justification && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <span className="font-medium">Justification: </span>{p.justification}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-violet-50">
                <tr>
                  {["Project","Procurement","Type","Vendor/Source","Est. Value","Timeline"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-violet-800 border-b border-violet-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-gray-500">{p.project_number}</div>
                      <div className="text-xs text-gray-700 truncate max-w-[140px]">{p.project_name}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 text-xs max-w-[200px]">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[p.procurement_type] || "bg-gray-100 text-gray-600"}`}>
                        {p.procurement_type || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.vendor_or_source || "—"}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-violet-700">{p.estimated_value || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.timeline || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
