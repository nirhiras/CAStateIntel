"use client";
// apps/api/ca-gov-intel/app/CAStateIntel/stage3/page.tsx

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Contact {
  contact_id: string; name: string; title: string; email: string;
  phone: string; organization: string; context: string; role_type: string;
}
interface UrlEntry { url_id: string; url: string; context: string; }
interface Stage3Analysis {
  doc_created_date: string;
  general_info_raw: {project_name?:string;project_number?:string;department?:string;agency?:string;project_manager?:string;selected_solution?:string;key_values?:Record<string,string>};
  submittal_contacts: Contact[];
  solution_requirements_summary: string;
  solution_requirements_raw: {
    functional_requirements?:{id:string;requirement:string;priority:string;source:string}[];
    non_functional_requirements?:{id:string;requirement:string;priority:string;source:string}[];
    outcomes?:{outcome:string;metric:string;target:string}[];
  };
  roadmap_raw: {
    phases?:{phase:string;start_date:string;end_date:string;description:string;deliverables:string[]}[];
    key_milestones?:{milestone:string;date:string;type:string}[];
    total_duration?:string;
  };
  project_planning_raw: {
    schedule?:{task:string;start:string;end:string;owner:string;status:string}[];
    resources?:{role:string;fte:string;duration:string;source:string}[];
  };
  primary_solicitation_raw: {
    solicitation_type?:string;anticipated_release_date?:string;contract_term?:string;
    evaluation_criteria?:{criterion:string;weight:string}[];
    contract_type?:string;estimated_contract_value?:string;key_values?:Record<string,string>;
  };
  ancillary_procurements: {name:string;description:string;procurement_type:string;vendor_or_source:string;estimated_value:string;timeline:string;justification:string;key_values?:Record<string,string>}[];
  dot_dates: {label:string;date:string}[];
}
interface AnalysisResponse {
  project: {project_number:string;name:string;agency:string;department:string};
  document: {filename:string;label:string}|null;
  contacts: Contact[];
  urls: UrlEntry[];
  analysis: Stage3Analysis|null;
  extracted: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 rounded bg-violet-600" />
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ContactsTable({ contacts, label }: { contacts: Contact[]; label?: string }) {
  if (!contacts?.length) return <p className="text-gray-400 text-sm italic">No contacts</p>;
  return (
    <>
      {label && <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">{label}</p>}
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-gray-50">
          {["Name","Title","Organization","Email","Phone","Context"].map(h => (
            <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">{h}</th>
          ))}
        </tr></thead>
        <tbody>{contacts.map((c,i) => (
          <tr key={c.contact_id||i} className={i%2===0?"bg-white":"bg-gray-50/50"}>
            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{c.name||"—"}</td>
            <td className="px-3 py-2 text-gray-600">{c.title||"—"}</td>
            <td className="px-3 py-2 text-gray-600">{c.organization||"—"}</td>
            <td className="px-3 py-2">{c.email?<a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a>:"—"}</td>
            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{c.phone||"—"}</td>
            <td className="px-3 py-2 text-gray-500 text-xs max-w-xs">{c.context||"—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </>
  );
}

function DataTable<T extends Record<string, unknown>>({ data, columns }: { data: T[]; columns: { key: keyof T; label: string }[] }) {
  if (!data?.length) return <p className="text-gray-400 text-sm italic">No data</p>;
  return (
    <table className="w-full text-sm border-collapse">
      <thead><tr className="bg-violet-50">
        {columns.map(c => <th key={String(c.key)} className="text-left px-3 py-2 text-xs font-semibold text-violet-800 border-b border-violet-100">{c.label}</th>)}
      </tr></thead>
      <tbody>{data.map((row,i) => (
        <tr key={i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
          {columns.map(c => <td key={String(c.key)} className="px-3 py-2 text-gray-700 border-b border-gray-100">{String(row[c.key]||"—")}</td>)}
        </tr>
      ))}</tbody>
    </table>
  );
}

export default function Stage3Page() {
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
  },[]);

  const loadData = useCallback(async (pn: string) => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/castateintel/analysis/${pn}/3`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch(e) { setError(String(e)); }
    finally { setLoading(false); }
  },[]);

  useEffect(() => { loadData(selectedProject); },[selectedProject,loadData]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const r = await fetch("/api/castateintel/analysis/extract", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({project_number:selectedProject, stage:3}),
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
    {id:"submittal",label:"Submittal"},{id:"requirements",label:"Requirements"},
    {id:"roadmap",label:"Roadmap"},{id:"planning",label:"Planning"},
    {id:"solicitation",label:"Primary Solicitation"},{id:"ancillary",label:"Ancillary Procurements"},
    {id:"dot",label:"CDT Use Only"},
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/CAStateIntel" className="text-gray-400 hover:text-gray-600 text-sm">← CAStateIntel</a>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800">Stage 3</span>
              <h1 className="text-lg font-bold text-gray-900">Solution Analysis</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
              {projects.map(p => <option key={p.project_number} value={p.project_number}>{p.project_number} — {p.name}</option>)}
            </select>
            {data && !data.extracted && (
              <button onClick={handleExtract} disabled={extracting}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                {extracting?"⟳ Extracting...":"⚡ Extract with AI"}
              </button>
            )}
            {data?.extracted && <span className="text-xs text-green-600">✓ Extracted</span>}
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto px-6 border-t border-gray-100 flex gap-0 overflow-x-auto">
          {navSections.map(s => (
            <button key={s.id} onClick={() => { setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({behavior:"smooth",block:"start"}); }}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeSection===s.id?"border-violet-600 text-violet-700":"border-transparent text-gray-500 hover:text-gray-700"}`}>
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

        {data && !loading && (<>
          {/* Overview */}
          <div id="overview" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{data.project.agency} › {data.project.department}</p>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{data.project.name}</h2>
                <p className="text-sm text-gray-500">Project {data.project.project_number}</p>
                {a?.general_info_raw?.selected_solution && (
                  <p className="text-sm text-violet-700 mt-2 font-medium">Selected Solution: {a.general_info_raw.selected_solution}</p>
                )}
              </div>
              <div className="text-right text-sm text-gray-500">
                {a?.doc_created_date && <p>Created: <strong>{a.doc_created_date}</strong></p>}
                {data.document && <p className="text-xs text-gray-400 mt-1">{data.document.filename}</p>}
              </div>
            </div>
            {a?.primary_solicitation_raw?.estimated_contract_value && (
              <div className="mt-6 grid grid-cols-3 gap-4 pt-5 border-t border-gray-100">
                <div className="bg-violet-50 rounded-lg p-4">
                  <p className="text-xs text-violet-600 font-medium mb-1">Estimated Contract Value</p>
                  <p className="text-lg font-bold text-violet-900">{a.primary_solicitation_raw.estimated_contract_value}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-blue-600 font-medium mb-1">Solicitation Type</p>
                  <p className="text-lg font-bold text-blue-900">{a.primary_solicitation_raw.solicitation_type||"—"}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-green-600 font-medium mb-1">Ancillary Procurements</p>
                  <p className="text-lg font-bold text-green-900">{a.ancillary_procurements?.length||0}</p>
                </div>
              </div>
            )}
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
            {/* General Info */}
            <div id="general" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="General Information">
                {a.general_info_raw && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {["project_name","project_number","department","agency","project_manager","selected_solution"].map(k => (
                      a.general_info_raw[k as keyof typeof a.general_info_raw] && (
                        <div key={k} className="flex gap-2 text-sm">
                          <span className="text-gray-500 font-medium min-w-fit capitalize">{k.replace(/_/g," ")}:</span>
                          <span className="text-gray-800">{String(a.general_info_raw[k as keyof typeof a.general_info_raw])}</span>
                        </div>
                      )
                    ))}
                    {a.general_info_raw.key_values && Object.entries(a.general_info_raw.key_values).map(([k,v]) => (
                      <div key={k} className="flex gap-2 text-sm">
                        <span className="text-gray-500 font-medium min-w-fit">{k}:</span>
                        <span className="text-gray-800">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            {/* Submittal */}
            <div id="submittal" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="Submittal Information">
                <ContactsTable contacts={(a.submittal_contacts||[]) as Contact[]} label="All contacts" />
              </Section>
            </div>

            {/* Requirements */}
            <div id="requirements" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="Detailed Solution Requirements and Outcomes">
                <p className="text-gray-700 leading-relaxed text-sm mb-6">{a.solution_requirements_summary||<span className="text-gray-400 italic">Not extracted</span>}</p>
                {a.solution_requirements_raw?.functional_requirements?.length && (<>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Functional Requirements</p>
                  <DataTable data={a.solution_requirements_raw.functional_requirements} columns={[{key:"id",label:"ID"},{key:"requirement",label:"Requirement"},{key:"priority",label:"Priority"},{key:"source",label:"Source"}]} />
                </>)}
                {a.solution_requirements_raw?.non_functional_requirements?.length && (<>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium mt-6">Non-Functional Requirements</p>
                  <DataTable data={a.solution_requirements_raw.non_functional_requirements} columns={[{key:"id",label:"ID"},{key:"requirement",label:"Requirement"},{key:"priority",label:"Priority"},{key:"source",label:"Source"}]} />
                </>)}
                {a.solution_requirements_raw?.outcomes?.length && (<>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium mt-6">Outcomes</p>
                  <DataTable data={a.solution_requirements_raw.outcomes} columns={[{key:"outcome",label:"Outcome"},{key:"metric",label:"Metric"},{key:"target",label:"Target"}]} />
                </>)}
              </Section>
            </div>

            {/* Roadmap */}
            <div id="roadmap" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="Project and Procurements Roadmap">
                {a.roadmap_raw?.total_duration && <p className="text-sm text-gray-600 mb-4">Total Duration: <strong>{a.roadmap_raw.total_duration}</strong></p>}
                {a.roadmap_raw?.phases?.length && (<>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Phases</p>
                  <div className="space-y-3 mb-6">
                    {a.roadmap_raw.phases.map((ph,i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-sm text-gray-900">{ph.phase}</span>
                          <span className="text-xs text-gray-500">{ph.start_date} → {ph.end_date}</span>
                        </div>
                        <p className="text-sm text-gray-600">{ph.description}</p>
                        {ph.deliverables?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {ph.deliverables.map((d,j) => <span key={j} className="px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded">{d}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>)}
                {a.roadmap_raw?.key_milestones?.length && (<>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Key Milestones</p>
                  <DataTable data={a.roadmap_raw.key_milestones} columns={[{key:"milestone",label:"Milestone"},{key:"date",label:"Date"},{key:"type",label:"Type"}]} />
                </>)}
              </Section>
            </div>

            {/* Planning */}
            <div id="planning" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="Project Planning">
                {a.project_planning_raw?.schedule?.length && (<>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Schedule</p>
                  <DataTable data={a.project_planning_raw.schedule} columns={[{key:"task",label:"Task"},{key:"start",label:"Start"},{key:"end",label:"End"},{key:"owner",label:"Owner"},{key:"status",label:"Status"}]} />
                </>)}
                {a.project_planning_raw?.resources?.length && (<>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium mt-6">Resources</p>
                  <DataTable data={a.project_planning_raw.resources} columns={[{key:"role",label:"Role"},{key:"fte",label:"FTE"},{key:"duration",label:"Duration"},{key:"source",label:"Source"}]} />
                </>)}
              </Section>
            </div>

            {/* Primary Solicitation */}
            <div id="solicitation" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="Primary Solicitation">
                {a.primary_solicitation_raw && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      {a.primary_solicitation_raw.solicitation_type && (
                        <div className="bg-violet-50 rounded-lg p-4">
                          <p className="text-xs text-violet-600 font-medium mb-1">Solicitation Type</p>
                          <p className="font-bold text-violet-900">{a.primary_solicitation_raw.solicitation_type}</p>
                        </div>
                      )}
                      {a.primary_solicitation_raw.anticipated_release_date && (
                        <div className="bg-blue-50 rounded-lg p-4">
                          <p className="text-xs text-blue-600 font-medium mb-1">Anticipated Release</p>
                          <p className="font-bold text-blue-900">{a.primary_solicitation_raw.anticipated_release_date}</p>
                        </div>
                      )}
                      {a.primary_solicitation_raw.estimated_contract_value && (
                        <div className="bg-green-50 rounded-lg p-4">
                          <p className="text-xs text-green-600 font-medium mb-1">Estimated Value</p>
                          <p className="font-bold text-green-900">{a.primary_solicitation_raw.estimated_contract_value}</p>
                        </div>
                      )}
                    </div>
                    {a.primary_solicitation_raw.evaluation_criteria?.length && (<>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Evaluation Criteria</p>
                      <DataTable data={a.primary_solicitation_raw.evaluation_criteria} columns={[{key:"criterion",label:"Criterion"},{key:"weight",label:"Weight"}]} />
                    </>)}
                    {a.primary_solicitation_raw.key_values && Object.keys(a.primary_solicitation_raw.key_values).length > 0 && (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(a.primary_solicitation_raw.key_values).map(([k,v]) => (
                          <div key={k} className="flex gap-2 text-sm">
                            <span className="text-gray-500 font-medium min-w-fit">{k}:</span>
                            <span className="text-gray-800">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Section>
            </div>

            {/* Ancillary Procurements */}
            <div id="ancillary" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="Ancillary Procurements">
                {a.ancillary_procurements?.length ? a.ancillary_procurements.map((proc,i) => (
                  <div key={i} className="mb-6 border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">{proc.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{proc.procurement_type}</p>
                      </div>
                      <div className="text-right">
                        {proc.estimated_value && <p className="font-semibold text-violet-700">{proc.estimated_value}</p>}
                        {proc.timeline && <p className="text-xs text-gray-500">{proc.timeline}</p>}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-4">{proc.description}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {proc.vendor_or_source && (
                        <div><span className="text-gray-500 font-medium">Vendor/Source:</span> <span className="text-gray-800">{proc.vendor_or_source}</span></div>
                      )}
                      {proc.justification && (
                        <div><span className="text-gray-500 font-medium">Justification:</span> <span className="text-gray-800">{proc.justification}</span></div>
                      )}
                    </div>
                    {proc.key_values && Object.keys(proc.key_values).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-x-6 gap-y-1">
                        {Object.entries(proc.key_values).map(([k,v]) => (
                          <div key={k} className="flex gap-2 text-sm">
                            <span className="text-gray-500 font-medium min-w-fit">{k}:</span>
                            <span className="text-gray-800">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )) : <p className="text-gray-400 text-sm italic">No ancillary procurements extracted</p>}
              </Section>
            </div>

            {/* CDT */}
            <div id="dot" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="Department of Technology Use Only">
                {a.dot_dates?.length ? <DataTable data={a.dot_dates} columns={[{key:"label",label:"Field"},{key:"date",label:"Date"}]} /> : <p className="text-gray-400 text-sm italic">No dates extracted</p>}
              </Section>
            </div>
          </>)}
        </>)}
      </div>
    </div>
  );
}
