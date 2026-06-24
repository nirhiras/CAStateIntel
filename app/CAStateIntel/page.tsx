'use client';

import { useEffect, useState, useRef } from 'react';

type Project = {
  id: number;
  project_number: string;
  name: string;
  pal_stage: string;
  effective_stage: string;
  criticality_rating: string;
  status: string;
  department_name: string;
  agency_name: string;
  doc_count: number;
  detail_url: string;
  has_s1: boolean;
  has_s2: boolean;
  has_s3: boolean;
  s1_extracted: boolean;
  s2_extracted: boolean;
  s3_extracted: boolean;
  solution_tags: { tag: string; category: string; confidence: string }[];
};

type Stats = {
  total_projects: number;
  stage1_count: number;
  stage2_count: number;
  stage3_count: number;
  total_documents: number;
  extracted_docs: number;
};

const STAGE_COLORS: Record<string, string> = {
  'Stage 3': 'bg-orange-100 text-orange-800',
  'Stage 2': 'bg-green-100 text-green-800',
  'Stage 1': 'bg-blue-100 text-blue-800',
};

const CRIT_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-gray-600',
};

const TAG_COLORS: Record<string, string> = {
  vendor:     'bg-blue-50 text-blue-700 border-blue-200',
  technology: 'bg-purple-50 text-purple-700 border-purple-200',
  approach:   'bg-green-50 text-green-700 border-green-200',
  deployment: 'bg-orange-50 text-orange-700 border-orange-200',
  industry:   'bg-gray-50 text-gray-600 border-gray-200',
};

const STAGE_LINK_COLORS: Record<number, string> = {
  1: 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200',
  2: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200',
  3: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200',
  4: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
};

const STAGE_LABEL: Record<string, string> = {
  'Stage 1': 'S1BA', 'Stage 2': 'S2AA', 'Stage 3': 'S3SA', 'Stage 4': 'S4PRA',
};

// ── Multi-select dropdown component ──────────────────────────────────────────
function MultiSelect({
  label, options, selected, onChange, placeholder = 'All',
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  };

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm bg-white min-w-[160px] text-left focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            selected.length > 0 ? 'border-blue-400 text-blue-700 font-medium' : 'border-gray-300 text-gray-700'
          }`}
        >
          <span className="truncate max-w-[180px]">{displayText}</span>
          <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[220px] max-h-72 overflow-y-auto">
            <div className="p-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">{options.length} options</span>
              {selected.length > 0 && (
                <button onClick={() => onChange([])} className="text-xs text-red-500 hover:text-red-700 font-medium">
                  Clear
                </button>
              )}
            </div>
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-50 transition-colors ${
                  selected.includes(opt) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                  selected.includes(opt) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
                }`}>
                  {selected.includes(opt) ? '✓' : ''}
                </span>
                <span className="truncate">{opt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CAStateIntelPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [deptFilters, setDeptFilters] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r => r.json()).then(setStats);
    fetch('/api/castateintel/projects?departments=true').then(r => r.json()).then(setDepartments);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch('/api/castateintel/projects')
      .then(r => r.json())
      .then(data => { setProjects(Array.isArray(data) ? data : data.projects || []); setLoading(false); });
  }, []);

  // All unique tags from loaded projects
  const allTags = [...new Set(
    projects.flatMap(p => (p.solution_tags || []).map(t => t.tag))
  )].sort();

  // Client-side multi-filter
  const filtered = projects.filter(p => {
    const stage = p.effective_stage || p.pal_stage;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.project_number.includes(search)) return false;
    if (stageFilters.length > 0 && !stageFilters.includes(stage)) return false;
    if (deptFilters.length > 0 && !deptFilters.includes(p.department_name)) return false;
    if (tagFilters.length > 0 && !tagFilters.every(tf => (p.solution_tags || []).some(t => t.tag === tf))) return false;
    return true;
  });

  const hasFilters = search || stageFilters.length > 0 || deptFilters.length > 0 || tagFilters.length > 0;
  const clearAll = () => { setSearch(''); setStageFilters([]); setDeptFilters([]); setTagFilters([]); };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white px-8 py-6">
        <h1 className="text-2xl font-semibold">PAL Project Tracking</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-white border-b px-8 py-4 flex gap-8">
          {[
            { label: 'Total Projects', value: stats.total_projects },
            { label: 'Stage 3', value: stats.stage3_count },
            { label: 'Stage 2', value: stats.stage2_count },
            { label: 'Stage 1', value: stats.stage1_count },
            { label: 'PDF Documents', value: stats.total_documents },
            { label: 'Text Extracted', value: stats.extracted_docs },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl font-medium text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="px-8 py-4 bg-white border-b">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search</label>
            <input
              type="text"
              placeholder="Project name or number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <MultiSelect
            label="Stage"
            options={['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4']}
            selected={stageFilters}
            onChange={setStageFilters}
            placeholder="All Stages"
          />

          <MultiSelect
            label="Department"
            options={departments}
            selected={deptFilters}
            onChange={setDeptFilters}
            placeholder="All Departments"
          />

          <MultiSelect
            label="Solution Tag"
            options={allTags}
            selected={tagFilters}
            onChange={setTagFilters}
            placeholder="All Tags"
          />

          <div className="flex items-end gap-3 pb-0.5">
            {hasFilters && (
              <button
                onClick={clearAll}
                className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                ✕ Clear all
              </button>
            )}
            <span className="text-sm text-gray-500 font-medium">{filtered.length} projects</span>
          </div>
        </div>

        {/* Active filter pills */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            {search && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                Search: "{search}"
                <button onClick={() => setSearch('')} className="ml-1 text-gray-400 hover:text-gray-700">✕</button>
              </span>
            )}
            {stageFilters.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {STAGE_LABEL[s] || s}
                <button onClick={() => setStageFilters(stageFilters.filter(x => x !== s))} className="ml-1 text-blue-400 hover:text-blue-700">✕</button>
              </span>
            ))}
            {deptFilters.map(d => (
              <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                {d}
                <button onClick={() => setDeptFilters(deptFilters.filter(x => x !== d))} className="ml-1 text-emerald-400 hover:text-emerald-700">✕</button>
              </span>
            ))}
            {tagFilters.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                🏷 {t}
                <button onClick={() => setTagFilters(tagFilters.filter(x => x !== t))} className="ml-1 text-purple-400 hover:text-purple-700">✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Project #</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Criticality</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Docs</th>
                <th className="px-4 py-3 text-left">Analysis</th>
                <th className="px-4 py-3 text-left">Solution Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No projects match the selected filters</td></tr>
              ) : filtered.map(p => {
                const tags = p.solution_tags || [];
                const effStage = p.effective_stage || p.pal_stage;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.project_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STAGE_COLORS[effStage] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STAGE_LABEL[effStage] || effStage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${CRIT_COLORS[p.criticality_rating] ?? ''}`}>
                        {p.criticality_rating}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.department_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">{p.doc_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {[1, 2, 3, 4].map(n => {
                          const hasDoc = n === 1 ? p.has_s1 : n === 2 ? p.has_s2 : n === 3 ? p.has_s3 : false;
                          const extracted = n === 1 ? p.s1_extracted : n === 2 ? p.s2_extracted : n === 3 ? p.s3_extracted : false;
                          if (!hasDoc && !extracted) return null;
                          return (
                            <a key={n} href={`/CAStateIntel/stage${n}?project=${p.project_number}`}
                              className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${STAGE_LINK_COLORS[n]} ${!extracted ? 'opacity-40' : ''}`}
                              title={extracted ? `View Stage ${n} analysis` : `Stage ${n} doc available — not yet extracted`}>
                              S{n}{extracted ? '' : ' ·'}
                            </a>
                          );
                        })}
                        {!p.has_s1 && !p.has_s2 && !p.has_s3 && (
                          <span className="text-xs text-gray-300">No docs</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((t, i) => (
                            <button
                              key={i}
                              onClick={() => setTagFilters(
                                tagFilters.includes(t.tag)
                                  ? tagFilters.filter(x => x !== t.tag)
                                  : [...tagFilters, t.tag]
                              )}
                              className={`text-xs px-1.5 py-0.5 rounded border font-medium transition-colors ${
                                TAG_COLORS[t.category] || 'bg-gray-50 text-gray-600 border-gray-200'
                              } ${tagFilters.includes(t.tag) ? 'ring-2 ring-offset-1 ring-blue-400' : 'hover:opacity-80'}`}
                              title={`${tagFilters.includes(t.tag) ? 'Remove' : 'Add'} filter: ${t.tag}`}
                            >
                              {t.tag}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">{p.s2_extracted ? 'No tags' : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
