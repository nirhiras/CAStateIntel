'use client';

import { useEffect, useState } from 'react';

type Project = {
  id: number;
  project_number: string;
  name: string;
  pal_stage: string;
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

export default function CAStateIntelPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true')
      .then(r => r.json()).then(setStats);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stageFilter) params.set('stage', stageFilter);
    fetch(`/api/castateintel/projects?${params}`)
      .then(r => r.json())
      .then(data => { setProjects(Array.isArray(data) ? data : data.projects || []); setLoading(false); });
  }, [search, stageFilter]);

  // Collect all unique tags across all projects
  const allTags = [...new Set(
    projects.flatMap(p => (p.solution_tags || []).map(t => t.tag))
  )].sort();

  // Filter by tag client-side
  const filtered = tagFilter
    ? projects.filter(p => (p.solution_tags || []).some(t => t.tag === tagFilter))
    : projects;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white px-8 py-6">
        <h1 className="text-2xl font-semibold">CA State IT Project Intelligence</h1>
        <p className="text-blue-200 text-sm mt-1">PAL project tracking — projecttracking.technology.ca.gov</p>
      </div>

      {/* Analysis Nav */}
      <div className="bg-blue-800 px-8 py-2 flex gap-2 flex-wrap">
        <span className="text-blue-300 text-xs self-center mr-2 font-medium uppercase tracking-wide">Analysis:</span>
        <a href="/CAStateIntel/stage1" className="px-3 py-1.5 rounded text-xs font-medium bg-green-500/20 text-green-200 hover:bg-green-500/40 transition-colors border border-green-500/30">
          Stage 1 — Business Analysis
        </a>
        <a href="/CAStateIntel/stage2" className="px-3 py-1.5 rounded text-xs font-medium bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/40 transition-colors border border-indigo-500/30">
          Stage 2 — Alternative Analysis
        </a>
        <a href="/CAStateIntel/stage3" className="px-3 py-1.5 rounded text-xs font-medium bg-violet-500/20 text-violet-200 hover:bg-violet-500/40 transition-colors border border-violet-500/30">
          Stage 3 — Solution Analysis
        </a>
        <a href="/CAStateIntel/stage4" className="px-3 py-1.5 rounded text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/40 transition-colors border border-amber-500/30">
          Stage 4 — Project Readiness
        </a>
        <div className="ml-auto flex gap-2">
          <a href="/CAStateIntel/contacts" className="px-3 py-1.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/40 transition-colors border border-yellow-500/30">
            👥 All Contacts
          </a>
          <a href="/CAStateIntel/documents" className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-colors">
            Documents
          </a>
          <a href="/CAStateIntel/upload" className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-colors">
            Upload
          </a>
        </div>
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
      <div className="px-8 py-3 flex flex-wrap gap-3 bg-white border-b items-center">
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Stages</option>
          <option value="Stage 3">Stage 3</option>
          <option value="Stage 2">Stage 2</option>
          <option value="Stage 1">Stage 1</option>
        </select>
        <select
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-xs"
        >
          <option value="">All Solution Tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {tagFilter && (
          <button onClick={() => setTagFilter('')} className="text-xs text-red-500 hover:text-red-700 underline">
            Clear tag
          </button>
        )}
        <span className="text-sm text-gray-500 ml-1">{filtered.length} projects</span>
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
              ) : filtered.map(p => {
                const tags = p.solution_tags || [];
                // Determine which stage analysis pages exist
                const stageNums = [1, 2, 3].filter(n => {
                  if (n === 1) return p.has_s1 || p.s1_extracted;
                  if (n === 2) return p.has_s2 || p.s2_extracted;
                  if (n === 3) return p.has_s3 || p.s3_extracted;
                  return false;
                });
                const currentStageNum = p.pal_stage === 'Stage 3' ? 3 : p.pal_stage === 'Stage 2' ? 2 : 1;

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.project_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STAGE_COLORS[p.pal_stage] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.pal_stage}
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
                      {/* Individual S1/S2/S3 links */}
                      <div className="flex gap-1 flex-wrap">
                        {[1, 2, 3, 4].map(n => {
                          const hasDoc = n === 1 ? p.has_s1 : n === 2 ? p.has_s2 : n === 3 ? p.has_s3 : false;
                          const extracted = n === 1 ? p.s1_extracted : n === 2 ? p.s2_extracted : n === 3 ? p.s3_extracted : false;
                          if (!hasDoc && !extracted) return null;
                          return (
                            <a
                              key={n}
                              href={`/CAStateIntel/stage${n}?project=${p.project_number}`}
                              className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${STAGE_LINK_COLORS[n]} ${!extracted ? 'opacity-40' : ''}`}
                              title={extracted ? `View Stage ${n} analysis` : `Stage ${n} doc available — not yet extracted`}
                            >
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
                          {tags.slice(0, 4).map((t, i) => (
                            <button
                              key={i}
                              onClick={() => setTagFilter(t.tag === tagFilter ? '' : t.tag)}
                              className={`text-xs px-1.5 py-0.5 rounded border font-medium transition-colors ${
                                TAG_COLORS[t.category] || 'bg-gray-50 text-gray-600 border-gray-200'
                              } ${tagFilter === t.tag ? 'ring-2 ring-offset-1 ring-blue-400' : 'hover:opacity-80'}`}
                              title={`Filter by: ${t.tag}`}
                            >
                              {t.tag}
                            </button>
                          ))}
                          {tags.length > 4 && (
                            <span className="text-xs text-gray-400">+{tags.length - 4}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">
                          {p.s2_extracted ? 'No tags' : '—'}
                        </span>
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
