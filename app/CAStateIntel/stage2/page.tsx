"use client";
// apps/api/ca-gov-intel/app/CAStateIntel/stage2/page.tsx

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Contact {
  contact_id: string; name: string; title: string; email: string;
  phone: string; organization: string; context: string; role_type: string;
}
interface UrlEntry { url_id: string; url: string; context: string; }
interface Stage2Analysis {
  doc_created_date: string;
  general_info_raw: Record<string,string>;
  submittal_contacts: Contact[];
  baseline_summary: string;
  baseline_raw: { systems?: {system_name:string;purpose:string;status:string}[] };
  requirements_summary: string;
  requirements_raw: {id:string;description:string;priority:string;category:string}[];
  assumptions: {id:string;assumption:string;description:string;impact:string}[];
  constraints_raw: {constraint:string;description:string;impact:string}[];
  dependencies_summary: string;
  dependencies_raw: {dependency:string;type:string;owner:string;impact:string}[];
  market_research_summary: string;
  market_research_raw: {vendors_identified?:{vendor:string;solution:string;notes:string}[]};
  viable_solutions: {name:string;summary:string;pros:string[];cons:string[];estimated_cost:string;recommended:boolean}[];
  project_org_summary: string;
  project_org_raw: {roles?:{role:string;responsibilities:string;fte:string}[]};
  project_planning_summary: string;
  project_planning_raw: {milestones?:{milestone:string;date:string;owner:string}[]};
  data_migration_summary: string;
  data_migration_raw: {activities?:{activity:string;description:string;complexity:string}[]};
  financial_analysis: {summary?:string;cost_table?:{category:string;year1:string;year2:string;year3:string;total:string}[];npv?:string;roi?:string;payback_period?:string};
  dot_dates: {label:string;date:string}[];
}
interface AnalysisResponse {
  project: {project_number:string;name:string;agency:string;department:string};
  document: {filename:string;label:string}|null;
  contacts: Contact[];
  urls: UrlEntry[];
  analysis: Stage2Analysis|null;
  extracted: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 rounded bg-indigo-600" />
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ContactsTable({ contacts, label }: { contacts: Contact[]; label?: string }) {
  if (!contacts?.length) return <p className="text-gray-400 text-sm italic">No contacts in this section</p>;
  return (
    <>
      {label && <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">{label}</p>}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {["Name","Title","Organization","Email","Phone","Context"].map(h => (
              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((c,i) => (
            <tr key={c.contact_id||i} className={i%2===0?"bg-white":"bg-gray-50/50"}>
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{c.name||"—"}</td>
              <td className="px-3 py-2 text-gray-600">{c.title||"—"}</td>
              <td className="px-3 py-2 text-gray-600">{c.organization||"—"}</td>
              <td className="px-3 py-2">{c.email?<a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a>:"—"}</td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{c.phone||"—"}</td>
              <td className="px-3 py-2 text-gray-500 text-xs max-w-xs">{c.context||"—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function DataTable<T extends Record<string, unknown>>({ data, columns }: { data: T[]; columns: { key: keyof T; label: string }[] }) {
  if (!data?.length) return <p className="text-gray-400 text-sm italic">No data</p>;
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-indigo-50">
          {columns.map(c => (
            <th key={String(c.key)} className="text-left px-3 py-2 text-xs font-semibold text-indigo-800 border-b border-indigo-100">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
            {columns.map(c => (
              <td key={String(c.key)} className="px-3 py-2 text-gray-700 border-b border-gray-100">{String(row[c.key]||"—")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Stage2Page() {
  const [projects, setProjects] = useState<{project_number:string;name:string}[]>([]);
  const searchParams = useSearchParams();
  const [selectedProject, setSelectedProject] = useState(searchParams.get("project") || "4265-081");
  const [data, setData] = useState<AnalysisResponse|null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [showPdf, setShowPdf] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    fetch("/api/castateintel/projects").then(r=>r.json()).then(d=>setProjects(d.projects||[])).catch(()=>{});
  }, []);

  const loadData = useCallback(async (pn: string) => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/castateintel/analysis/${pn}/2`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch(e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(selectedProject); }, [selectedProject, loadData]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const r = await fetch("/api/castateintel/analysis/extract", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({project_number: selectedProject, stage: 2}),
      });
      if (!r.ok) throw new Error(await r.text());
      await loadData(selectedProject);
    } catch(e) { setError(String(e)); }
    finally { setExtracting(false); }
  };

  const a = data?.analysis;
  const contacts = data?.contacts||[];
  const urls = data?.urls||[];

  const navSections = [
    {id:"overview",label:"Overview"},{id:"contacts",label:`Contacts (${contacts.length})`},
    {id:"urls",label:`URLs (${urls.length})`},{id:"general",label:"General Info"},
    {id:"submittal",label:"Submittal"},{id:"baseline",label:"Baseline"},
    {id:"requirements",label:"Requirements"},{id:"assumptions",label:"Assumptions"},
    {id:"dependencies",label:"Dependencies"},{id:"market",label:"Market Research"},
    {id:"solutions",label:"Viable Solutions"},{id:"org",label:"Project Org"},
    {id:"planning",label:"Planning"},{id:"migration",label:"Data Migration"},
    {id:"financial",label:"Financial"},{id:"dot",label:"CDT Use Only"},
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/CAStateIntel" className="text-gray-400 hover:text-gray-600 text-sm">← CAStateIntel</a>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">Stage 2</span>
              <h1 className="text-lg font-bold text-gray-900">Alternative Analysis</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {projects.map(p => <option key={p.project_number} value={p.project_number}>{p.project_number} — {p.name}</option>)}
            </select>
            {data && !data.extracted && (
              <button onClick={handleExtract} disabled={extracting}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {extracting ? "⟳ Extracting..." : "⚡ Extract with AI"}
              </button>
            )}
            {data?.extracted && <span className="text-xs text-green-600">✓ Extracted</span>}
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto px-6 border-t border-gray-100 flex gap-0 overflow-x-auto">
          {navSections.map(s => (
            <button key={s.id} onClick={() => { setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({behavior:"smooth",block:"start"}); }}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeSection===s.id?"border-indigo-600 text-indigo-700":"border-transparent text-gray-500 hover:text-gray-700"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* PDF Viewer Panel */}
        {showPdf && data?.document?.document_id && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-800">📄 {data.document.filename}</span>
                  <a
                    href={`/api/castateintel/pdf/${data.document.document_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open in new tab ↗
                  </a>
                </div>
                <button
                  onClick={() => setShowPdf(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
                >
                  ✕
                </button>
              </div>
              <iframe
                src={`/api/castateintel/pdf/${data.document.document_id}`}
                className="flex-1 w-full rounded-b-xl"
                title={data.document.filename}
              />
            </div>
          </div>
        )}
        {loading && <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>}
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">{error}</div>}
        {data && !loading && (
          <>
            {/* Overview */}
            <div id="overview" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{data.project.agency} › {data.project.department}</p>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{data.project.name}</h2>
                  <p className="text-sm text-gray-500">Project {data.project.project_number}</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  {a?.doc_created_date && <p>Created: <strong>{a.doc_created_date}</strong></p>}
                  {data.document && <p className="text-xs text-gray-400 mt-1">{data.document.filename}</p>}
                </div>
              </div>
              {!data.extracted && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  Document found but analysis not yet extracted. Click <strong>⚡ Extract with AI</strong> to analyze.
                </div>
              )}
            </div>

            {/* Contacts */}
            <div id="contacts" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="All Contacts in Document"><ContactsTable contacts={contacts} /></Section>
            </div>

            {/* URLs */}
            <div id="urls" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="All URLs in Document">
                {!urls.length ? <p className="text-gray-400 text-sm italic">No URLs extracted</p> : (
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">URL</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">Context</th>
                    </tr></thead>
                    <tbody>{urls.map((u,i) => (
                      <tr key={u.url_id||i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
                        <td className="px-3 py-2"><a href={u.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all text-xs">{u.url}</a></td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{u.context}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </Section>
            </div>

            {a && (<>
              {/* General */}
              <div id="general" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="General Information">
                  {a.general_info_raw && <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {Object.entries(a.general_info_raw).filter(([,v])=>v).map(([k,v])=>(
                      <div key={k} className="flex gap-2 text-sm"><span className="text-gray-500 font-medium min-w-fit">{k}:</span><span className="text-gray-800">{v}</span></div>
                    ))}
                  </div>}
                </Section>
              </div>

              {/* Submittal */}
              <div id="submittal" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Submittal Information">
                  <ContactsTable contacts={(a.submittal_contacts||[]) as Contact[]} label="All contacts" />
                </Section>
              </div>

              {/* Baseline */}
              <div id="baseline" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Baseline Processes and Systems">
                  <p className="text-gray-700 leading-relaxed text-sm mb-6">{a.baseline_summary||<span className="text-gray-400 italic">Not extracted</span>}</p>
                  {a.baseline_raw?.systems?.length && (
                    <DataTable data={a.baseline_raw.systems} columns={[{key:"system_name",label:"System"},{key:"purpose",label:"Purpose"},{key:"status",label:"Status"}]} />
                  )}
                </Section>
              </div>

              {/* Requirements */}
              <div id="requirements" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Requirements and Outcomes">
                  <p className="text-gray-700 leading-relaxed text-sm mb-6">{a.requirements_summary}</p>
                  {a.requirements_raw?.length > 0 && (
                    <DataTable data={a.requirements_raw} columns={[{key:"id",label:"ID"},{key:"description",label:"Requirement"},{key:"priority",label:"Priority"},{key:"category",label:"Category"}]} />
                  )}
                </Section>
              </div>

              {/* Assumptions */}
              <div id="assumptions" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Assumptions and Constraints">
                  {a.assumptions?.length > 0 && (<>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Assumptions</p>
                    <DataTable data={a.assumptions} columns={[{key:"id",label:"ID"},{key:"assumption",label:"Assumption"},{key:"description",label:"Description"},{key:"impact",label:"Impact"}]} />
                  </>)}
                  {a.constraints_raw?.length > 0 && (<>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium mt-6">Constraints</p>
                    <DataTable data={a.constraints_raw} columns={[{key:"constraint",label:"Constraint"},{key:"description",label:"Description"},{key:"impact",label:"Impact"}]} />
                  </>)}
                </Section>
              </div>

              {/* Dependencies */}
              <div id="dependencies" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Dependencies">
                  <p className="text-gray-700 leading-relaxed text-sm mb-6">{a.dependencies_summary}</p>
                  {a.dependencies_raw?.length > 0 && (
                    <DataTable data={a.dependencies_raw} columns={[{key:"dependency",label:"Dependency"},{key:"type",label:"Type"},{key:"owner",label:"Owner"},{key:"impact",label:"Impact"}]} />
                  )}
                </Section>
              </div>

              {/* Market Research */}
              <div id="market" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Market Research">
                  <p className="text-gray-700 leading-relaxed text-sm mb-6">{a.market_research_summary}</p>
                  {a.market_research_raw?.vendors_identified?.length && (
                    <DataTable data={a.market_research_raw.vendors_identified} columns={[{key:"vendor",label:"Vendor"},{key:"solution",label:"Solution"},{key:"notes",label:"Notes"}]} />
                  )}
                </Section>
              </div>

              {/* Viable Solutions */}
              <div id="solutions" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Viable Alternative Solutions">
                  {a.viable_solutions?.length > 0 ? a.viable_solutions.map((sol, i) => (
                    <div key={i} className="mb-8 border border-gray-200 rounded-xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-bold text-gray-900">{sol.name}</span>
                        {sol.recommended && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Recommended</span>}
                        {sol.estimated_cost && <span className="text-xs text-gray-500">{sol.estimated_cost}</span>}
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed mb-4">{sol.summary}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">Pros</p>
                          <ul className="space-y-1">{sol.pros?.map((p,j) => <li key={j} className="text-sm text-gray-600 flex gap-2"><span className="text-green-500 mt-0.5">+</span>{p}</li>)}</ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">Cons</p>
                          <ul className="space-y-1">{sol.cons?.map((c,j) => <li key={j} className="text-sm text-gray-600 flex gap-2"><span className="text-red-400 mt-0.5">−</span>{c}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                  )) : <p className="text-gray-400 text-sm italic">No solutions extracted</p>}
                </Section>
              </div>

              {/* Org */}
              <div id="org" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Project Organization">
                  <p className="text-gray-700 leading-relaxed text-sm mb-6">{a.project_org_summary}</p>
                  {a.project_org_raw?.roles?.length && (
                    <DataTable data={a.project_org_raw.roles} columns={[{key:"role",label:"Role"},{key:"responsibilities",label:"Responsibilities"},{key:"fte",label:"FTE"}]} />
                  )}
                </Section>
              </div>

              {/* Planning */}
              <div id="planning" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Project Planning">
                  <p className="text-gray-700 leading-relaxed text-sm mb-6">{a.project_planning_summary}</p>
                  {a.project_planning_raw?.milestones?.length && (
                    <DataTable data={a.project_planning_raw.milestones} columns={[{key:"milestone",label:"Milestone"},{key:"date",label:"Date"},{key:"owner",label:"Owner"}]} />
                  )}
                </Section>
              </div>

              {/* Data Migration */}
              <div id="migration" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Data Cleansing, Conversion, and Migration">
                  <p className="text-gray-700 leading-relaxed text-sm mb-6">{a.data_migration_summary}</p>
                  {a.data_migration_raw?.activities?.length && (
                    <DataTable data={a.data_migration_raw.activities} columns={[{key:"activity",label:"Activity"},{key:"description",label:"Description"},{key:"complexity",label:"Complexity"}]} />
                  )}
                </Section>
              </div>

              {/* Financial */}
              <div id="financial" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Financial Analysis Worksheets">
                  {a.financial_analysis?.summary && <p className="text-gray-700 text-sm mb-6">{a.financial_analysis.summary}</p>}
                  {a.financial_analysis?.cost_table?.length && (<>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Cost Table</p>
                    <DataTable data={a.financial_analysis.cost_table} columns={[{key:"category",label:"Category"},{key:"year1",label:"Year 1"},{key:"year2",label:"Year 2"},{key:"year3",label:"Year 3"},{key:"total",label:"Total"}]} />
                  </>)}
                  {(a.financial_analysis?.npv||a.financial_analysis?.roi) && (
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      {a.financial_analysis.npv && <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 mb-1">NPV</p><p className="font-bold text-gray-900">{a.financial_analysis.npv}</p></div>}
                      {a.financial_analysis.roi && <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 mb-1">ROI</p><p className="font-bold text-gray-900">{a.financial_analysis.roi}</p></div>}
                      {a.financial_analysis.payback_period && <div className="bg-gray-50 rounded-lg p-4 text-center"><p className="text-xs text-gray-500 mb-1">Payback Period</p><p className="font-bold text-gray-900">{a.financial_analysis.payback_period}</p></div>}
                    </div>
                  )}
                </Section>
              </div>

              {/* CDT */}
              <div id="dot" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                <Section title="Department of Technology Use Only">
                  {a.dot_dates?.length ? <DataTable data={a.dot_dates} columns={[{key:"label",label:"Field"},{key:"date",label:"Date"}]} /> : <p className="text-gray-400 text-sm italic">No dates extracted</p>}
                </Section>
              </div>
            </>)}
          </>
        )}
      </div>
    </div>
  );
}
