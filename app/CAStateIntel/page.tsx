'use client';

import { useEffect, useState } from 'react';
import { SmartMultiSelect, buildOptions, FilterPills } from '@/components/castateintel/SmartMultiSelect';

type Project = {
  id: number; project_number: string; name: string;
  pal_stage: string; effective_stage: string;
  criticality_rating: string; status: string;
  department_name: string; agency_name: string;
  doc_count: number; detail_url: string;
  has_s1: boolean; has_s2: boolean; has_s3: boolean;
  s1_extracted: boolean; s2_extracted: boolean; s3_extracted: boolean;
  solution_tags: { tag: string; category: string; confidence: string }[];
};

type Stats = {
  total_projects: number; stage1_count: number; stage2_count: number;
  stage3_count: number; total_documents: number; extracted_docs: number;
};

const STAGE_LABEL: Record<string, string> = {
  'Stage 1': 'S1BA', 'Stage 2': 'S2AA', 'Stage 3': 'S3SA', 'Stage 4': 'S4PRA',
};
const STAGE_PILL: Record<string, string> = {
  'Stage 1': 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  'Stage 2': 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  'Stage 3': 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  'Stage 4': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};
const CRIT_PILL: Record<string, string> = {
  High: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  Medium: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
  Low: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
};
const TAG_PILL: Record<string, string> = {
  vendor: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',
  technology: 'bg-violet-50 text-violet-600 ring-1 ring-violet-200',
  approach: 'bg-teal-50 text-teal-600 ring-1 ring-teal-200',
  deployment: 'bg-orange-50 text-orange-600 ring-1 ring-orange-200',
  industry: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
};
const ANALYSIS_LINK: Record<number, string> = {
  1: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100',
  2: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100',
  3: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100',
  4: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100',
};

export default function CAStateIntelPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [deptFilters, setDeptFilters] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r => r.json()).then(setStats);
    fetch('/api/castateintel/projects')
      .then(r => r.json())
      .then(data => { setProjects(Array.isArray(data) ? data : data.projects || []); setLoading(false); });
  }, []);

  // ── Derived filter helpers ─────────────────────────────────────────────────
  const getStage = (p: Project) => p.effective_stage || p.pal_stage;
  const getDept  = (p: Project) => p.department_name;
  const getTags  = (p: Project) => (p.solution_tags || []).map(t => t.tag);

  const matchSearch = (p: Project) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.project_number.includes(search);
  const matchStage  = (p: Project) => stageFilters.length === 0 || stageFilters.includes(getStage(p));
  const matchDept   = (p: Project) => deptFilters.length === 0  || deptFilters.includes(getDept(p));
  const matchTag    = (p: Project) => tagFilters.length === 0   || tagFilters.some(tf => getTags(p).includes(tf));

  const filtered = projects.filter(p => matchSearch(p) && matchStage(p) && matchDept(p) && matchTag(p));

  // ── Option lists with counts (each field excludes its own filter) ──────────
  const allStages = ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4'];
  const allDepts  = [...new Set(projects.map(getDept).filter(Boolean))].sort();
  const allTags   = [...new Set(projects.flatMap(getTags))].sort();

  const stageOptions = buildOptions(projects, getStage, [matchSearch, matchDept, matchTag], allStages,
    v => STAGE_LABEL[v] || v);
  const deptOptions  = buildOptions(projects, getDept,  [matchSearch, matchStage, matchTag], allDepts);
  const tagOptions   = buildOptions(projects, getTags,  [matchSearch, matchStage, matchDept], allTags);

  const hasFilters = search || stageFilters.length > 0 || deptFilters.length > 0 || tagFilters.length > 0;
  const clearAll = () => { setSearch(''); setStageFilters([]); setDeptFilters([]); setTagFilters([]); };

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 60%, #312E81 100%)' }} className="px-8 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 text-indigo-200 text-xs font-semibold px-3 py-1.5 rounded-full mb-4 tracking-wide uppercase">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                California Department of Technology
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">PAL Project Tracking</h1>
              <p className="text-slate-400 text-sm mt-1.5">Project Approval Lifecycle — IT project proposals & analysis</p>
            </div>
            {stats && (
              <div className="hidden md:flex items-center gap-6">
                {[{ v: stats.total_projects, l: 'Projects' }, { v: stats.total_documents, l: 'Documents' }, { v: stats.extracted_docs, l: 'Extracted' }].map(s => (
                  <div key={s.l} className="text-right">
                    <div className="text-2xl font-bold text-white">{s.v}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {stats && (
            <div className="flex gap-3 mt-6 flex-wrap">
              {[
                { label: 'Stage 1 — Business Analysis', count: stats.stage1_count, color: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30' },
                { label: 'Stage 2 — Alternative Analysis', count: stats.stage2_count, color: 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30' },
                { label: 'Stage 3 — Solution Analysis', count: stats.stage3_count, color: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30' },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium ${s.color}`}>
                  <span className="font-bold text-sm">{s.count}</span>{s.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Search</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Project name or number…" value={search} onChange={e => setSearch(e.target.value)}
                  className="border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm w-60 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all" />
              </div>
            </div>

            <SmartMultiSelect label="Stage" options={stageOptions} selected={stageFilters} onChange={setStageFilters} placeholder="All Stages" />
            <SmartMultiSelect label="Department" options={deptOptions} selected={deptFilters} onChange={setDeptFilters} placeholder="All Departments" />
            <SmartMultiSelect label="Solution Tag" options={tagOptions} selected={tagFilters} onChange={setTagFilters} placeholder="All Tags" />

            <div className="flex items-end gap-3 pb-0.5">
              {hasFilters && (
                <button onClick={clearAll} className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear all
                </button>
              )}
              <span className="text-sm font-semibold text-slate-500 pb-0.5">{filtered.length} <span className="font-normal text-slate-400">projects</span></span>
            </div>
          </div>

          <FilterPills groups={[
            { values: stageFilters, onRemove: v => setStageFilters(stageFilters.filter(x => x !== v)), getLabel: v => STAGE_LABEL[v] || v, colorClass: 'bg-sky-100 text-sky-700' },
            { values: deptFilters,  onRemove: v => setDeptFilters(deptFilters.filter(x => x !== v)),   colorClass: 'bg-emerald-100 text-emerald-700' },
            { values: tagFilters,   onRemove: v => setTagFilters(tagFilters.filter(x => x !== v)),     colorClass: 'bg-violet-100 text-violet-700', prefix: '🏷' },
          ]} />
        </div>
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/80 border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100" style={{ background: '#F8FAFC' }}>
                  {['Project #','Name','Stage','Criticality','Department','Docs','Analysis','Solution Tags'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">Loading projects…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">No projects match the selected filters</td></tr>
                ) : filtered.map(p => {
                  const tags = p.solution_tags || [];
                  const effStage = p.effective_stage || p.pal_stage;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs text-slate-400 whitespace-nowrap">{p.project_number}</td>
                      <td className="px-5 py-4 font-semibold text-slate-800 max-w-[220px]">
                        <span className="line-clamp-2 leading-snug">{p.name}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${STAGE_PILL[effStage] ?? 'bg-gray-50 text-gray-500 ring-1 ring-gray-200'}`}>
                          {STAGE_LABEL[effStage] || effStage}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {p.criticality_rating && (
                          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${CRIT_PILL[p.criticality_rating] ?? ''}`}>{p.criticality_rating}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-xs leading-snug max-w-[180px]">{p.department_name}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg ring-1 ring-indigo-100">{p.doc_count}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {[1,2,3,4].map(n => {
                            const hasDoc = n===1?p.has_s1:n===2?p.has_s2:n===3?p.has_s3:false;
                            const extracted = n===1?p.s1_extracted:n===2?p.s2_extracted:n===3?p.s3_extracted:false;
                            if (!hasDoc && !extracted) return null;
                            return (
                              <a key={n} href={`/CAStateIntel/stage${n}?project=${p.project_number}`}
                                className={`text-xs px-2 py-0.5 rounded-lg font-semibold transition-colors ${ANALYSIS_LINK[n]} ${!extracted?'opacity-40':''}`}
                                title={extracted?`View Stage ${n} analysis`:`Stage ${n} doc — not yet extracted`}>
                                S{n}
                              </a>
                            );
                          })}
                          {!p.has_s1&&!p.has_s2&&!p.has_s3&&<span className="text-xs text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((t, i) => (
                              <button key={i}
                                onClick={() => setTagFilters(tagFilters.includes(t.tag)?tagFilters.filter(x=>x!==t.tag):[...tagFilters,t.tag])}
                                className={`text-xs px-2 py-0.5 rounded-lg font-medium transition-all ${TAG_PILL[t.category]||'bg-gray-50 text-gray-500 ring-1 ring-gray-200'} ${tagFilters.includes(t.tag)?'ring-2 ring-indigo-400 ring-offset-1':'hover:opacity-75'}`}
                                title={`${tagFilters.includes(t.tag)?'Remove':'Add'} filter: ${t.tag}`}>
                                {t.tag}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">{p.s2_extracted?'No tags':'—'}</span>
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
    </div>
  );
}
