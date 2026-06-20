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

export default function CAStateIntelPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
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
      .then(data => { setProjects(data); setLoading(false); });
  }, [search, stageFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white px-8 py-6">
        <h1 className="text-2xl font-semibold">CA State IT Project Intelligence</h1>
        <p className="text-blue-200 text-sm mt-1">PAL project tracking — projecttracking.technology.ca.gov</p>
      </div>
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
      <div className="px-8 py-4 flex gap-4 bg-white border-b">
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Stages</option>
          <option value="Stage 3">Stage 3</option>
          <option value="Stage 2">Stage 2</option>
          <option value="Stage 1">Stage 1</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{projects.length} projects</span>
      </div>
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
                <th className="px-4 py-3 text-left">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : projects.map(p => (
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
                    <a href={p.detail_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">View ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
