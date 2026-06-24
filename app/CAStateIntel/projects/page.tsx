'use client';

import { useEffect, useState } from 'react';

type Project = {
  id: number;
  project_number: string;
  name: string;
  pal_stage: string;
  criticality_rating: string;
  department_name: string;
  agency_name: string;
  doc_count: number;
  detail_url: string;
  has_s1: boolean; has_s2: boolean; has_s3: boolean;
  s1_extracted: boolean; s2_extracted: boolean; s3_extracted: boolean;
  solution_tags: { tag: string; category: string }[];
  // enriched
  total_value?: string;
  execution_start?: string;
  s1_accepted?: string;
  recommended_solution?: string;
  selected_vendor?: string;
  contract_cost?: string;
};

type Stats = { total_projects:number; stage1_count:number; stage2_count:number; stage3_count:number; total_documents:number; extracted_docs:number; };

const STAGE_COLORS: Record<string,string> = { 'Stage 3':'bg-orange-100 text-orange-800','Stage 2':'bg-green-100 text-green-800','Stage 1':'bg-blue-100 text-blue-800' };
const CRIT_COLORS: Record<string,string> = { High:'bg-red-100 text-red-700',Medium:'bg-yellow-100 text-yellow-700',Low:'bg-gray-100 text-gray-600' };
const TAG_COLORS: Record<string,string> = { vendor:'bg-blue-50 text-blue-700 border-blue-200',technology:'bg-purple-50 text-purple-700 border-purple-200',approach:'bg-green-50 text-green-700 border-green-200',deployment:'bg-orange-50 text-orange-700 border-orange-200' };
const STAGE_LINK_COLORS: Record<number,string> = { 1:'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200',2:'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200',3:'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200',4:'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' };
const STAGE_ABBREV: Record<number,string> = { 1:'S1BA',2:'S2AA',3:'S3SA',4:'S4PRA' };

const fmt = (d?:string|null) => { if(!d||d==='null')return null; try{return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});}catch{return d;} };

function ProjectCard({ p, tagFilter, setTagFilter }: { p: Project; tagFilter: string; setTagFilter: (t:string)=>void }) {
  const tags = p.solution_tags || [];
  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Card header — same dark blue as dashboard */}
      <div className="bg-blue-900 text-white px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-blue-300 font-mono">{p.project_number}</p>
            <h3 className="text-sm font-bold leading-snug mt-0.5 line-clamp-2">{p.name}</h3>
            <p className="text-xs text-blue-300 mt-0.5 truncate">{p.department_name}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {p.criticality_rating && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRIT_COLORS[p.criticality_rating]||'bg-gray-100 text-gray-600'}`}>{p.criticality_rating}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[p.pal_stage]||'bg-gray-100 text-gray-600'}`}>{p.pal_stage}</span>
          </div>
        </div>
      </div>

      {/* Stage badges row */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5 flex-wrap bg-gray-50">
        {[1,2,3,4].map(n => {
          const hasDoc = n===1?p.has_s1:n===2?p.has_s2:n===3?p.has_s3:false;
          const extracted = n===1?p.s1_extracted:n===2?p.s2_extracted:n===3?p.s3_extracted:false;
          if(!hasDoc&&!extracted) return null;
          return (
            <a key={n} href={`/CAStateIntel/stage${n}?project=${p.project_number}`}
              className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${STAGE_LINK_COLORS[n]} ${!extracted?'opacity-40':''}`}
              title={extracted?`View ${STAGE_ABBREV[n]} analysis`:`Doc available, not extracted`}>
              {STAGE_ABBREV[n]}{extracted?' ✓':' ·'}
            </a>
          );
        })}
        <a href={`/CAStateIntel/project/${p.project_number}`} className="ml-auto text-xs text-blue-600 hover:underline font-medium whitespace-nowrap">
          Full Analysis →
        </a>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 space-y-3">
        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><span className="text-gray-400 block">Total Value</span><span className={`font-medium ${p.total_value?'text-gray-800':'text-gray-300'}`}>{p.total_value||'—'}</span></div>
          <div><span className="text-gray-400 block">Execution Start</span><span className={`font-medium ${p.execution_start?'text-gray-800':'text-gray-300'}`}>{fmt(p.execution_start)||'—'}</span></div>
          <div><span className="text-gray-400 block">S1 Accepted</span><span className={`font-medium ${p.s1_accepted?'text-gray-800':'text-gray-300'}`}>{fmt(p.s1_accepted)||'—'}</span></div>
        </div>

        {/* Solution tags */}
        {tags.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Solution Tags</p>
            <div className="flex flex-wrap gap-1">
              {tags.slice(0,5).map((t,i) => (
                <button key={i} onClick={()=>setTagFilter(t.tag===tagFilter?'':t.tag)}
                  className={`text-xs px-1.5 py-0.5 rounded border font-medium transition-colors ${TAG_COLORS[t.category]||'bg-gray-50 text-gray-600 border-gray-200'} ${tagFilter===t.tag?'ring-2 ring-offset-1 ring-blue-400':''}`}>
                  {t.tag}
                </button>
              ))}
              {tags.length > 5 && <span className="text-xs text-gray-400 self-center">+{tags.length-5}</span>}
            </div>
          </div>
        )}

        {/* Recommended solution */}
        {p.recommended_solution && (
          <div><p className="text-xs text-gray-400 mb-0.5">Recommended Solution</p><p className="text-xs font-semibold text-indigo-800">{p.recommended_solution}</p></div>
        )}

        {/* Vendor block */}
        {p.selected_vendor && (
          <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 mt-1">
            <div><p className="text-xs text-amber-600 font-medium">Selected Vendor</p><p className="text-xs font-bold text-amber-900">{p.selected_vendor}</p></div>
            {p.contract_cost && <div className="text-right"><p className="text-xs text-amber-600">Contract</p><p className="text-xs font-bold text-amber-900">{p.contract_cost}</p></div>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-gray-400">{p.doc_count} doc{p.doc_count!==1?'s':''}</span>
        {p.detail_url && <a href={p.detail_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-gray-400 hover:text-gray-600">CDT ↗</a>}
      </div>
    </div>
  );
}

export default function ProjectsListingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [enriched, setEnriched] = useState<Record<string,Partial<Project>>>({});
  const [stats, setStats] = useState<Stats|null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [critFilter, setCritFilter] = useState('');
  const [sort, setSort] = useState('project_number');

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r=>r.json()).then(setStats);
    fetch('/api/castateintel/projects').then(r=>r.json()).then(data => {
      const list = Array.isArray(data)?data:data.projects||[];
      setProjects(list); setLoading(false);
      enrichAll(list);
    }).catch(()=>setLoading(false));
  }, []);

  const enrichAll = async (list: Project[]) => {
    const updates: Record<string,Partial<Project>> = {};
    await Promise.all(list.filter(p=>p.s1_extracted||p.s2_extracted).slice(0,40).map(async p => {
      try {
        const [r1,r2,,r4] = await Promise.all([
          p.s1_extracted?fetch(`/api/castateintel/analysis/${p.project_number}/1`).then(r=>r.json()):null,
          p.s2_extracted?fetch(`/api/castateintel/analysis/${p.project_number}/2`).then(r=>r.json()):null,
          null,
          fetch(`/api/castateintel/analysis/${p.project_number}/4`).then(r=>r.json()).catch(()=>null),
        ]);
        const u: Partial<Project> = {};
        if(r1?.extracted){ u.total_value=r1.analysis?.funding_raw?.total_estimate; u.execution_start=r1.analysis?.proposed_execution_start; u.s1_accepted=r1.analysis?.dot_dates?.find((d:any)=>d.label?.toLowerCase().includes('accept'))?.date; }
        if(r2?.extracted){ const rec=r2.analysis?.viable_solutions?.find((v:any)=>v.recommended)||r2.analysis?.viable_solutions?.[0]; if(rec)u.recommended_solution=rec.name; }
        if(r4?.extracted){ u.selected_vendor=r4.analysis?.solicitation_results?.selected_vendor; u.contract_cost=r4.analysis?.solicitation_results?.total_contract_cost; }
        updates[p.project_number]=u;
      } catch {}
    }));
    setEnriched(updates);
  };

  const merged = projects.map(p=>({...p,...(enriched[p.project_number]||{})}));
  const allTags = [...new Set(projects.flatMap(p=>(p.solution_tags||[]).map(t=>t.tag)))].sort();
  const allDepts = [...new Set(projects.map(p=>p.department_name).filter(Boolean))].sort();

  const filtered = merged.filter(p => {
    if(search){ const q=search.toLowerCase(); if(!`${p.project_number} ${p.name}`.toLowerCase().includes(q))return false; }
    if(stageFilter&&p.pal_stage!==stageFilter)return false;
    if(critFilter&&p.criticality_rating!==critFilter)return false;
    if(deptFilter&&p.department_name!==deptFilter)return false;
    if(tagFilter&&!(p.solution_tags||[]).some(t=>t.tag===tagFilter))return false;
    return true;
  }).sort((a,b)=>{
    if(sort==='project_number')return a.project_number.localeCompare(b.project_number);
    if(sort==='name')return a.name.localeCompare(b.name);
    if(sort==='stage'){const m={'Stage 3':3,'Stage 2':2,'Stage 1':1};return (m[b.pal_stage as keyof typeof m]||0)-(m[a.pal_stage as keyof typeof m]||0);}
    return 0;
  });

  const anyFilter = !!(search||stageFilter||critFilter||deptFilter||tagFilter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — identical to dashboard */}
      <div className="bg-blue-900 text-white px-8 py-6">
        <h1 className="text-2xl font-semibold">CA State IT Project Intelligence</h1>
        <p className="text-blue-200 text-sm mt-1">PAL project tracking — projecttracking.technology.ca.gov</p>
      </div>

      {/* Nav bar — identical to dashboard */}
      <div className="bg-blue-800 px-8 py-2 flex gap-2 flex-wrap items-center">
        <span className="text-blue-300 text-xs self-center mr-2 font-medium uppercase tracking-wide">Analysis:</span>
        {[1,2,3,4].map(n=>(
          <a key={n} href={`/CAStateIntel/stage${n}`} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${[,'bg-green-500/20 text-green-200 hover:bg-green-500/40 border-green-500/30','bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/40 border-indigo-500/30','bg-violet-500/20 text-violet-200 hover:bg-violet-500/40 border-violet-500/30','bg-amber-500/20 text-amber-200 hover:bg-amber-500/40 border-amber-500/30'][n]}`}>
            Stage {n} — {['','Business Analysis','Alternative Analysis','Solution Analysis','Project Readiness'][n]}
          </a>
        ))}
        <div className="ml-auto flex gap-2">
          <a href="/CAStateIntel/contacts" className="px-3 py-1.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/40 border border-yellow-500/30">👥 All Contacts</a>
          <a href="/CAStateIntel" className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white hover:bg-white/20 border border-white/20">☰ Table View</a>
          <a href="/CAStateIntel/documents" className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20">Documents</a>
          <a href="/CAStateIntel/upload" className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20">Upload</a>
        </div>
      </div>

      {/* Stats bar — identical to dashboard */}
      {stats && (
        <div className="bg-white border-b px-8 py-4 flex gap-8">
          {[{label:'Total Projects',value:stats.total_projects},{label:'Stage 3',value:stats.stage3_count},{label:'Stage 2',value:stats.stage2_count},{label:'Stage 1',value:stats.stage1_count},{label:'PDF Documents',value:stats.total_documents},{label:'Text Extracted',value:stats.extracted_docs}].map(s=>(
            <div key={s.label}><div className="text-2xl font-medium text-gray-900">{s.value}</div><div className="text-xs text-gray-500">{s.label}</div></div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white border-b px-8 py-3 flex flex-wrap gap-3 items-center">
        {/* Project # / Title search */}
        <input type="text" placeholder="Project # or title..." value={search} onChange={e=>setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />

        {/* Department */}
        <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]">
          <option value="">All Departments</option>
          {allDepts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>

        {/* Stage */}
        <select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Stages</option>
          <option value="Stage 1">Stage 1</option>
          <option value="Stage 2">Stage 2</option>
          <option value="Stage 3">Stage 3</option>
        </select>

        {/* Criticality */}
        <select value={critFilter} onChange={e=>setCritFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Criticality</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {/* Solution Tag */}
        <select value={tagFilter} onChange={e=>setTagFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]">
          <option value="">All Solution Tags</option>
          {allTags.map(t=><option key={t} value={t}>{t}</option>)}
        </select>

        {/* Sort */}
        <select value={sort} onChange={e=>setSort(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="project_number">Sort: Project #</option>
          <option value="name">Sort: Name A–Z</option>
          <option value="stage">Sort: Stage</option>
        </select>

        {anyFilter && <button onClick={()=>{setSearch('');setStageFilter('');setCritFilter('');setDeptFilter('');setTagFilter('');}} className="text-xs text-red-500 hover:text-red-700 underline">Clear</button>}

        <span className="text-sm text-gray-500">{filtered.length} projects</span>
      </div>

      {/* Grid */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading projects...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400"><p>No projects match your filters</p></div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {filtered.map(p => <ProjectCard key={p.id} p={p} tagFilter={tagFilter} setTagFilter={setTagFilter} />)}
          </div>
        )}
      </div>
    </div>
  );
}
