'use client';

import RvtNav from "@/components/castateintel/RvtNav";
import { useState, useEffect } from 'react';

interface Procurement {
  project_number: string;
  project_name: string;
  name: string;
  description: string;
  procurement_type: string;
  vendor_or_source: string;
  estimated_value: string;
  proposed_start_date: string;
  proposed_end_date: string;
  duration: string;
  timeline: string;
  solicitation_number: string;
  justification: string;
}

interface ProjectOption { project_number: string; name: string; }

const TYPE_COLORS: Record<string, string> = {
  'RFP': 'bg-blue-100 text-blue-800', 'IFB': 'bg-green-100 text-green-800',
  'RFO': 'bg-purple-100 text-purple-800', 'MSA': 'bg-orange-100 text-orange-800',
  'CMAS': 'bg-teal-100 text-teal-800', 'IT-MSA': 'bg-cyan-100 text-cyan-700',
  'Sole Source': 'bg-red-100 text-red-800', 'WSCA': 'bg-yellow-100 text-yellow-800',
};

const fmt = (d?: string | null) => {
  if (!d || d === 'null') return null;
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
};

function StartDateBadge({ date, timeline }: { date?: string; timeline?: string }) {
  const formatted = fmt(date);
  if (formatted) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400" style={{background:"rgba(0,217,146,0.1)",borderColor:"rgba(0,217,146,0.3)"}}">
        <span>📅</span>
        <span>Starts {formatted}</span>
      </div>
    );
  }
  // Try to extract a date from timeline text
  if (timeline) {
    const yearMatch = timeline.match(/\b(20\d{2})\b/);
    const monthMatch = timeline.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i);
    const display = monthMatch ? monthMatch[0] : yearMatch ? yearMatch[0] : null;
    if (display) {
      return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5">
          <span>📅</span>
          <span>~{display}</span>
        </div>
      );
    }
    // Relative date like "6 months prior..."
    const relMatch = timeline.match(/(\d+\s+months?\s+prior[^.]*)/i);
    if (relMatch) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-violet-500 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1.5">
          <span>📅</span>
          <span>{relMatch[0]}</span>
        </div>
      );
    }
  }
  return null;
}

export default function ProcurementsPage() {
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r => r.json()).then(setStats);
    fetch('/api/castateintel/projects').then(r => r.json()).then(data => setProjects(Array.isArray(data) ? data : data.projects || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectFilter) params.set('project', projectFilter);
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
      if (![p.name, p.description, p.vendor_or_source, p.project_name, p.project_number].some(v => (v || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Count procurements with start dates
  const withDates = filtered.filter(p => p.proposed_start_date || (p.timeline && /20\d{2}/.test(p.timeline))).length;

  const exportCSV = () => {
    const headers = ['Project', 'Project Name', 'Procurement', 'Type', 'Vendor', 'Est. Value', 'Start Date', 'Duration', 'Timeline'];
    const rows = filtered.map(p => [p.project_number, p.project_name, p.name, p.procurement_type, p.vendor_or_source, p.estimated_value, p.proposed_start_date || '', p.duration || '', p.timeline]
      .map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'procurements.csv'; a.click();
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--vg-canvas)",color:"var(--vg-body)"}}>
      <RvtNav />
      {/* Header — matches dashboard */}
      <div style={{background:"var(--vg-canvas-soft)"}} className="text-white px-8 py-6">
        <h1 className="text-2xl font-semibold">CA State IT Project Intelligence</h1>
        <p className="text-blue-200 text-sm mt-1">PAL project tracking — projecttracking.technology.ca.gov</p>
      </div>

      {/* Nav — matches dashboard */}
      <div className="bg-blue-800 px-8 py-2 flex gap-2 flex-wrap items-center">
        <span className="text-blue-300 text-xs self-center mr-2 font-medium uppercase tracking-wide">Analysis:</span>
        {[1,2,3,4].map(n=>(
          <a key={n} href={`/CAStateIntel/stage${n}`} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${[,'bg-green-500/20 text-green-200 hover:bg-green-500/40 border-green-500/30','bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/40 border-indigo-500/30','bg-violet-500/20 text-violet-200 hover:bg-violet-500/40 border-violet-500/30','bg-amber-500/20 text-amber-200 hover:bg-amber-500/40 border-amber-500/30'][n]}`}>
            Stage {n} — {['','Business Analysis','Alternative Analysis','Solution Analysis','Project Readiness'][n]}
          </a>
        ))}
        <div className="ml-auto flex gap-2">
          <a href="/CAStateIntel/contacts" className="px-3 py-1.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/40 border border-yellow-500/30">👥 All Contacts</a>
          <a href="/CAStateIntel/projects" className="px-3 py-1.5 rounded text-xs font-medium bg-blue-400/20 text-blue-200 hover:bg-blue-400/40 border border-blue-400/30">⊞ Card View</a>
          <a href="/CAStateIntel" className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20">Dashboard</a>
          <a href="/CAStateIntel/upload" className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20">Upload</a>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="border-b px-8 py-4 flex gap-8">
          <div><div className="text-2xl font-medium text-white">{filtered.length}</div><div className="text-xs text-gray-500">Procurements</div></div>
          <div><div className="text-2xl font-medium text-white">{new Set(filtered.map(p => p.project_number)).size}</div><div className="text-xs text-gray-500">Projects</div></div>
          <div><div className="text-2xl font-medium text-white">{allTypes.length}</div><div className="text-xs text-gray-500">Types</div></div>
          <div><div className="text-2xl font-medium text-violet-700">{withDates}</div><div className="text-xs text-gray-500">With Start Dates</div></div>
        </div>
      )}

      {/* Filters */}
      <div className="border-b px-8 py-3 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search procurements..." value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-violet-500" />
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 max-w-xs">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.project_number} value={p.project_number}>{p.project_number} — {p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || projectFilter || typeFilter) && (
          <button onClick={() => { setSearch(''); setProjectFilter(''); setTypeFilter(''); }} className="text-xs text-red-500 hover:text-red-700 underline">Clear</button>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setView('cards')} className={`px-3 py-1.5 rounded text-xs font-medium ${view === 'cards' ? 'bg-violet-100 text-violet-700' : 'bg-zinc-800 text-gray-400'}`}>⊞ Cards</button>
          <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded text-xs font-medium ${view === 'table' ? 'bg-violet-100 text-violet-700' : 'bg-zinc-800 text-gray-400'}`}>☰ Table</button>
          <button onClick={exportCSV} className="px-3 py-1.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">↓ CSV</button>
        </div>
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p>No procurements found</p>
            <p className="text-sm mt-1">Extract Stage 3 analysis to populate</p>
          </div>
        ) : view === 'cards' ? (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((p, i) => (
              <div key={i} className="rounded-xl border border-zinc-700 p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm leading-snug">{p.name}</h3>
                    <a href={`/CAStateIntel/project/${p.project_number}?tab=procurements`}
                      className="text-xs text-violet-600 hover:underline mt-0.5 block">
                      {p.project_number} — {p.project_name}
                    </a>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {p.procurement_type && (
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[p.procurement_type] || 'bg-zinc-800 text-gray-400'}`}>
                        {p.procurement_type}
                      </span>
                    )}
                    {p.estimated_value && (
                      <span className="text-xs font-bold text-violet-700">{p.estimated_value}</span>
                    )}
                  </div>
                </div>

                {/* Start date — prominent */}
                <StartDateBadge date={p.proposed_start_date} timeline={p.timeline} />

                {/* Duration + end date */}
                {(p.duration || p.proposed_end_date) && (
                  <div className="flex gap-4 text-xs">
                    {p.duration && <div><span className="text-gray-400">Duration: </span><span className="font-medium text-gray-300">{p.duration}</span></div>}
                    {p.proposed_end_date && <div><span className="text-gray-400">End: </span><span className="font-medium text-gray-300">{fmt(p.proposed_end_date) || p.proposed_end_date}</span></div>}
                  </div>
                )}

                {/* Description */}
                {p.description && <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{p.description}</p>}

                {/* Bottom row */}
                <div className="flex flex-wrap gap-3 text-xs mt-auto pt-2 border-t border-zinc-800">
                  {p.vendor_or_source && <div><span className="text-gray-400">Vendor: </span><span className="text-gray-300">{p.vendor_or_source}</span></div>}
                  {p.solicitation_number && <div><span className="text-gray-400">Solicitation: </span><span className="text-gray-300 font-mono">{p.solicitation_number}</span></div>}
                </div>

                {/* Justification */}
                {p.justification && (
                  <p className="text-xs text-gray-500 italic border-t border-zinc-800 pt-2">{p.justification}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Table view */
          <div className="rounded-xl border border-zinc-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-violet-50">
                <tr>
                  {['Project', 'Procurement', 'Type', 'Proposed Start', 'Duration', 'Est. Value', 'Vendor'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-violet-800 border-b border-violet-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((p, i) => {
                  const startFmt = fmt(p.proposed_start_date);
                  const timelineDate = !startFmt && p.timeline ? (p.timeline.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i)?.[0] || p.timeline.match(/\b(20\d{2})\b/)?.[0]) : null;
                  return (
                    <tr key={i} className="hover:bg-zinc-900">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-gray-500">{p.project_number}</div>
                        <div className="text-xs text-gray-300 truncate max-w-[130px]">{p.project_name}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-white text-xs max-w-[200px]">{p.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[p.procurement_type] || 'bg-zinc-800 text-gray-400'}`}>
                          {p.procurement_type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {startFmt
                          ? <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded">📅 {startFmt}</span>
                          : timelineDate
                          ? <span className="text-xs text-violet-500">~{timelineDate}</span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{p.duration || '—'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-violet-700">{p.estimated_value || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{p.vendor_or_source || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
