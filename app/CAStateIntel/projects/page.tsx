"use client";
// app/CAStateIntel/projects/page.tsx
// All projects in the detailed card layout

import { useState, useEffect } from "react";

interface Project {
  id: number;
  project_number: string;
  name: string;
  department_name: string;
  agency_name: string;
  pal_stage: string;
  criticality_rating: string;
  detail_url: string;
  has_s1: boolean; has_s2: boolean; has_s3: boolean;
  s1_extracted: boolean; s2_extracted: boolean; s3_extracted: boolean;
  solution_tags: { tag: string; category: string }[];
  // Enriched fields from analysis
  total_value?: string;
  execution_start?: string;
  s1_accepted?: string;
  s3_accepted?: string;
  recommended_solution?: string;
  selected_vendor?: string;
  contract_cost?: string;
}

const TAG_COLORS: Record<string, string> = {
  vendor: "bg-blue-100 text-blue-800",
  technology: "bg-purple-100 text-purple-800",
  approach: "bg-green-100 text-green-800",
  deployment: "bg-orange-100 text-orange-800",
};

const STAGE_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-700 border-green-300",
  2: "bg-indigo-100 text-indigo-700 border-indigo-300",
  3: "bg-violet-100 text-violet-700 border-violet-300",
  4: "bg-amber-100 text-amber-700 border-amber-300",
};
const STAGE_ABBREV: Record<number, string> = { 1:"S1BA", 2:"S2AA", 3:"S3SA", 4:"S4PRA" };
const CRIT_COLORS: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-gray-100 text-gray-600",
};
const PAL_STAGE_NUM: Record<string, number> = { "Stage 1":1, "Stage 2":2, "Stage 3":3, "Stage 4":4 };

function fmt(d?: string | null) {
  if (!d || d === "null") return null;
  try { return new Date(d).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" }); }
  catch { return d; }
}

function KV({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-medium ${value ? "text-gray-800" : "text-gray-300"}`}>{value || "—"}</span>
    </div>
  );
}

function StageBadge({ num, extracted }: { num: number; extracted: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${STAGE_COLORS[num]} ${!extracted ? "opacity-30" : ""}`}>
      {STAGE_ABBREV[num]} {extracted ? "✓" : "—"}
    </span>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const palStageNum = PAL_STAGE_NUM[project.pal_stage] || 1;
  const tags = project.solution_tags || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
      {/* Card header */}
      <div className="bg-blue-900 text-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-blue-300 font-mono">{project.project_number}</p>
            <h3 className="text-sm font-bold leading-tight mt-0.5 line-clamp-2">{project.name}</h3>
            <p className="text-xs text-blue-300 mt-0.5 truncate">{project.department_name}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRIT_COLORS[project.criticality_rating] || "bg-gray-100 text-gray-600"}`}>
              {project.criticality_rating || "—"}
            </span>
            <span className="text-xs text-blue-300">{project.pal_stage}</span>
          </div>
        </div>
      </div>

      {/* Stage badges */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
        {[1,2,3,4].map(n => {
          const hasDoc = n===1?project.has_s1:n===2?project.has_s2:n===3?project.has_s3:false;
          const extracted = n===1?project.s1_extracted:n===2?project.s2_extracted:n===3?project.s3_extracted:false;
          if (!hasDoc && !extracted) return null;
          return <StageBadge key={n} num={n} extracted={extracted} />;
        })}
        <a href={`/CAStateIntel/project/${project.project_number}`}
          className="ml-auto text-xs text-blue-600 hover:underline font-medium">
          Full Analysis →
        </a>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Financial row */}
        <div className="grid grid-cols-3 gap-3">
          <KV label="Total Value" value={project.total_value} />
          <KV label="Execution Start" value={fmt(project.execution_start)} />
          <KV label="S1 Accepted" value={fmt(project.s1_accepted)} />
        </div>

        {/* Solution tags */}
        {tags.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Solution Tags</p>
            <div className="flex flex-wrap gap-1">
              {tags.slice(0,5).map((t,i) => (
                <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[t.category] || "bg-gray-100 text-gray-600"}`}>
                  {t.tag}
                </span>
              ))}
              {tags.length > 5 && <span className="text-xs text-gray-400">+{tags.length-5}</span>}
            </div>
          </div>
        )}

        {/* Recommended solution */}
        {project.recommended_solution && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Recommended Solution</p>
            <p className="text-xs font-semibold text-indigo-800">{project.recommended_solution}</p>
          </div>
        )}

        {/* Vendor (if S4 extracted) */}
        {project.selected_vendor && (
          <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
            <div>
              <p className="text-xs text-amber-600 font-medium">Selected Vendor</p>
              <p className="text-xs font-bold text-amber-900">{project.selected_vendor}</p>
            </div>
            {project.contract_cost && (
              <div className="text-right">
                <p className="text-xs text-amber-600">Contract</p>
                <p className="text-xs font-bold text-amber-900">{project.contract_cost}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex gap-2 flex-wrap">
        {[1,2,3,4].filter(n => n===1?project.s1_extracted:n===2?project.s2_extracted:n===3?project.s3_extracted:false).map(n => (
          <a key={n} href={`/CAStateIntel/stage${n}?project=${project.project_number}`}
            className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${STAGE_COLORS[n]}`}>
            {STAGE_ABBREV[n]}
          </a>
        ))}
        {project.detail_url && (
          <a href={project.detail_url} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs text-gray-400 hover:text-gray-600">CDT ↗</a>
        )}
      </div>
    </div>
  );
}

export default function ProjectsListingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [enriched, setEnriched] = useState<Record<string, Partial<Project>>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [critFilter, setCritFilter] = useState("");
  const [sort, setSort] = useState("project_number");

  useEffect(() => {
    fetch("/api/castateintel/projects")
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.projects || [];
        setProjects(list);
        setLoading(false);
        // Enrich with analysis data in background
        enrichProjects(list);
      })
      .catch(() => setLoading(false));
  }, []);

  const enrichProjects = async (list: Project[]) => {
    // Fetch analysis data for extracted projects in batches
    const extracted = list.filter(p => p.s1_extracted || p.s2_extracted);
    const updates: Record<string, Partial<Project>> = {};
    await Promise.all(extracted.slice(0, 30).map(async p => {
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          p.s1_extracted ? fetch(`/api/castateintel/analysis/${p.project_number}/1`).then(r=>r.json()) : null,
          p.s2_extracted ? fetch(`/api/castateintel/analysis/${p.project_number}/2`).then(r=>r.json()) : null,
          p.s3_extracted ? fetch(`/api/castateintel/analysis/${p.project_number}/3`).then(r=>r.json()) : null,
          fetch(`/api/castateintel/analysis/${p.project_number}/4`).then(r=>r.json()).catch(()=>null),
        ]);
        const update: Partial<Project> = {};
        if (r1?.extracted) {
          update.total_value = r1.analysis?.funding_raw?.total_estimate;
          update.execution_start = r1.analysis?.proposed_execution_start;
          update.s1_accepted = r1.analysis?.dot_dates?.find((d: {label:string;date:string}) =>
            d.label?.toLowerCase().includes("accept"))?.date;
        }
        if (r2?.extracted) {
          const rec = r2.analysis?.viable_solutions?.find((v: {recommended:boolean;name:string}) => v.recommended)
            || r2.analysis?.viable_solutions?.[0];
          if (rec) update.recommended_solution = rec.name;
        }
        if (r4?.extracted) {
          update.selected_vendor = r4.analysis?.solicitation_results?.selected_vendor;
          update.contract_cost = r4.analysis?.solicitation_results?.total_contract_cost;
        }
        updates[p.project_number] = update;
      } catch {}
    }));
    setEnriched(updates);
  };

  // Merge enriched data
  const merged = projects.map(p => ({
    ...p,
    ...(enriched[p.project_number] || {}),
  }));

  // All unique tags
  const allTags = [...new Set(projects.flatMap(p => (p.solution_tags||[]).map(t => t.tag)))].sort();

  // Filter + sort
  const filtered = merged
    .filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${p.project_number} ${p.name} ${p.department_name}`.toLowerCase().includes(q)) return false;
      }
      if (stageFilter && p.pal_stage !== stageFilter) return false;
      if (critFilter && p.criticality_rating !== critFilter) return false;
      if (tagFilter && !(p.solution_tags||[]).some(t => t.tag === tagFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "project_number") return a.project_number.localeCompare(b.project_number);
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "stage") return (PAL_STAGE_NUM[b.pal_stage]||0) - (PAL_STAGE_NUM[a.pal_stage]||0);
      return 0;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white px-8 py-5">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a href="/CAStateIntel" className="text-blue-300 hover:text-white text-sm">← Dashboard</a>
            </div>
            <h1 className="text-2xl font-bold">All Projects</h1>
            <p className="text-blue-300 text-sm mt-0.5">CA State IT PAL projects — detailed analysis view</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{filtered.length}</p>
            <p className="text-blue-300 text-sm">of {projects.length} projects</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-8 py-3">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap gap-3 items-center">
          <input type="text" placeholder="Search projects..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Stages</option>
            <option value="Stage 1">Stage 1</option>
            <option value="Stage 2">Stage 2</option>
            <option value="Stage 3">Stage 3</option>
          </select>

          <select value={critFilter} onChange={e => setCritFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Criticality</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs">
            <option value="">All Solution Tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={sort} onChange={e => setSort(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="project_number">Sort: Project #</option>
            <option value="name">Sort: Name</option>
            <option value="stage">Sort: Stage</option>
          </select>

          {(search || stageFilter || critFilter || tagFilter) && (
            <button onClick={() => { setSearch(""); setStageFilter(""); setCritFilter(""); setTagFilter(""); }}
              className="text-xs text-red-500 hover:text-red-700 underline">Clear filters</button>
          )}

          <a href="/CAStateIntel" className="ml-auto text-xs text-gray-500 hover:text-gray-700">
            ← Table view
          </a>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-screen-2xl mx-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading projects...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p className="text-lg">No projects match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
