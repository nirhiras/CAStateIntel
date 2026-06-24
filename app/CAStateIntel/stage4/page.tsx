"use client";
// app/CAStateIntel/stage4/page.tsx
// Stage 4 — Project Readiness and Approval

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Contact {
  contact_id: string; name: string; title: string; email: string;
  phone: string; organization: string; context: string; role_type: string;
  source: string; doc_created_date: string;
}
interface UrlEntry { url_id: string; url: string; context: string; }

interface Stage4Analysis {
  doc_created_date: string;
  general_info_raw: {
    agency_name: string; proposal_name: string; project_number: string;
    s4pra_version: string; cdt_billing_case_number: string; key_values: Record<string,string>;
  };
  submittal_info: { contacts: Contact[]; submission_type: string; conditions_from_stage3: string; key_values: Record<string,string> };
  contract_management: { question: string; answer: string; notes: string }[];
  org_readiness: { question: string; answer: string; status: string; notes: string }[];
  project_readiness: { methodology: string; methodology_description: string; otech_engaged: string; otech_alternative: string; resource_commitments_obtained: string; key_values: Record<string,string> };
  objectives: { id: string; objective_summary: string; full_objective: string; metric: string; baseline: string; target_result: string; valuation_pct: string; change_from_stage1: string }[];
  schedule_baseline: { proposed_project_start: string; baseline_project_start: string; start_variance: string; proposed_project_end: string; baseline_project_end: string; end_variance: string; variance_reasons: string; key_milestones: {milestone:string;date:string;status:string}[] };
  cost_baseline: { cost_rows: {category:string;proposed:string;baseline:string;variance:string}[]; variance_reasons: string; bcp_summary: {budget_request_id:string;budget_year:string;requested_amount:string;status:string;bill_language:string}[] };
  solicitation_results: { stage2_solution_selected: string; selected_vendor: string; contract_number: string; contract_start_date: string; contract_end_date: string; total_contract_cost: string; optional_years_months: string; optional_years_cost: string; total_with_optional: string; project_management_plans: {plan:string;status:string;notes:string}[] };
  risk_register: { risk_id: string; risk: string; probability: string; impact: string; mitigation: string; owner: string }[];
  dot_dates: { label: string; date: string }[];
  dot_raw: { form_status: string; form_disposition: string };
}

interface AnalysisResponse {
  project: { project_number: string; name: string };
  document: { id: number; document_id: string; filename: string; label: string } | null;
  contacts: Contact[];
  urls: UrlEntry[];
  analysis: Stage4Analysis | null;
  extracted: boolean;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded bg-amber-500" />
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  if (!contacts?.length) return <p className="text-gray-400 text-sm italic">No contacts</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="bg-gray-50">
          {["Name","Title","Organization","Email","Phone","Doc Date","Source","Context"].map(h => (
            <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {contacts.map((c, i) => (
            <tr key={c.contact_id || i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{c.name||"—"}</td>
              <td className="px-3 py-2 text-gray-600 text-xs">{c.title||"—"}</td>
              <td className="px-3 py-2 text-gray-600 text-xs max-w-[160px] truncate">{c.organization||"—"}</td>
              <td className="px-3 py-2 text-xs">{c.email?<a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a>:"—"}</td>
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{c.phone||"—"}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                {c.doc_created_date ? new Date(c.doc_created_date).toLocaleDateString("en-US",{year:"numeric",month:"short"}) : "—"}
              </td>
              <td className="px-3 py-2 text-gray-400 text-xs">{c.source||"—"}</td>
              <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px]">{c.context||"—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YesNoBadge({ value }: { value: string }) {
  const v = (value || "").toLowerCase();
  const cls = v === "yes" ? "bg-green-100 text-green-800" : v === "no" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{value || "—"}</span>;
}

function DataTable<T extends Record<string, string>>({ data, columns }: { data: T[]; columns: { key: keyof T; label: string }[] }) {
  if (!data?.length) return <p className="text-gray-400 text-sm italic">No data</p>;
  return (
    <table className="w-full text-sm border-collapse">
      <thead><tr className="bg-amber-50">
        {columns.map(c => <th key={String(c.key)} className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100">{c.label}</th>)}
      </tr></thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
            {columns.map(c => <td key={String(c.key)} className="px-3 py-2 text-gray-700 border-b border-gray-100 text-xs">{String(row[c.key]||"—")}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const RISK_COLORS: Record<string, string> = {
  High: "bg-red-100 text-red-800",
  Medium: "bg-yellow-100 text-yellow-800",
  Low: "bg-green-100 text-green-800",
};

export default function Stage4Page() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<{project_number:string;name:string}[]>([]);
  const [selectedProject, setSelectedProject] = useState(searchParams.get("project") || "");
  const [data, setData] = useState<AnalysisResponse|null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [showPdf, setShowPdf] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    fetch("/api/castateintel/projects").then(r=>r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : d.projects || [];
        setProjects(list);
        if (!selectedProject && list.length > 0) setSelectedProject(list[0].project_number);
      }).catch(()=>{});
  }, []);

  const loadData = useCallback(async (pn: string) => {
    if (!pn) return;
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/castateintel/analysis/${pn}/4`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch(e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (selectedProject) loadData(selectedProject); }, [selectedProject, loadData]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const r = await fetch("/api/castateintel/analysis/extract", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({project_number: selectedProject, stage: 4}),
      });
      if (!r.ok) throw new Error(await r.text());
      await loadData(selectedProject);
    } catch(e) { setError(String(e)); }
    finally { setExtracting(false); }
  };

  const a = data?.analysis;
  const contacts = data?.contacts || [];
  const urls = data?.urls || [];

  const navSections = [
    {id:"overview",label:"Overview"},
    {id:"contacts",label:`Contacts (${contacts.length})`},
    {id:"urls",label:`URLs (${urls.length})`},
    {id:"general",label:"General Info"},
    {id:"submittal",label:"Submittal"},
    {id:"contract",label:"Contract Mgmt"},
    {id:"org",label:"Org Readiness"},
    {id:"readiness",label:"Project Readiness"},
    {id:"objectives",label:"Objectives"},
    {id:"schedule",label:"Schedule"},
    {id:"cost",label:"Cost Baseline"},
    {id:"solicitation",label:"Solicitation Results"},
    {id:"risk",label:"Risk Register"},
    {id:"dot",label:"CDT Use Only"},
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/CAStateIntel" className="text-gray-400 hover:text-gray-600 text-sm">← CAStateIntel</a>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Stage 4</span>
              <h1 className="text-lg font-bold text-gray-900">Project Readiness & Approval</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.project_number} value={p.project_number}>{p.project_number} — {p.name}</option>)}
            </select>
            {data && !data.extracted && selectedProject && (
              <button onClick={handleExtract} disabled={extracting}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
                {extracting ? "⟳ Extracting..." : "⚡ Extract with AI"}
              </button>
            )}
            {data?.extracted && <span className="text-xs text-green-600 flex items-center gap-1">✓ Extracted</span>}
          </div>
        </div>
        {/* Section nav */}
        <div className="max-w-screen-2xl mx-auto px-6 border-t border-gray-100 flex gap-0 overflow-x-auto">
          {navSections.map(s => (
            <button key={s.id} onClick={() => { setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({behavior:"smooth",block:"start"}); }}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeSection===s.id?"border-amber-500 text-amber-700":"border-transparent text-gray-500 hover:text-gray-700"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* PDF Overlay */}
      {showPdf && data?.document?.document_id && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-800">📄 {data.document.filename}</span>
                <a href={`/api/castateintel/pdf/${data.document.document_id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Open in new tab ↗</a>
              </div>
              <button onClick={() => setShowPdf(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2">✕</button>
            </div>
            <iframe src={`/api/castateintel/pdf/${data.document.document_id}`} className="flex-1 w-full rounded-b-xl" title="Stage 4 PDF" />
          </div>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {loading && <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>}
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">{error}</div>}

        {data && !loading && (
          <>
            {/* Overview */}
            <div id="overview" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{data.project.name}</h2>
                  <p className="text-sm text-gray-500">Project {data.project.project_number}</p>
                  {a?.general_info_raw?.proposal_name && (
                    <p className="text-sm text-amber-700 mt-1 font-medium">{a.general_info_raw.proposal_name}</p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500 space-y-1">
                  {a?.doc_created_date && <p>Created: <strong>{new Date(a.doc_created_date).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</strong></p>}
                  {a?.general_info_raw?.s4pra_version && <p>Version: <strong>{a.general_info_raw.s4pra_version}</strong></p>}
                  {data.document && (
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <p className="text-xs text-gray-400">{data.document.filename}</p>
                      {data.document.document_id && (
                        <button onClick={() => setShowPdf(p => !p)}
                          className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 font-medium">
                          {showPdf ? "Hide PDF" : "📄 View PDF"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {a && (
                <div className="grid grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100">
                  <div className="bg-amber-50 rounded-lg p-4">
                    <p className="text-xs text-amber-600 font-medium mb-1">Selected Vendor</p>
                    <p className="text-sm font-bold text-amber-900">{a.solicitation_results?.selected_vendor || "—"}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-blue-600 font-medium mb-1">Total Contract Cost</p>
                    <p className="text-sm font-bold text-blue-900">{a.solicitation_results?.total_contract_cost || "—"}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-green-600 font-medium mb-1">Contract Period</p>
                    <p className="text-sm font-bold text-green-900">
                      {a.solicitation_results?.contract_start_date || "—"} → {a.solicitation_results?.contract_end_date || "—"}
                    </p>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-4">
                    <p className="text-xs text-violet-600 font-medium mb-1">Total Project Cost</p>
                    <p className="text-sm font-bold text-violet-900">
                      {a.cost_baseline?.cost_rows?.find(r => r.category?.toLowerCase().includes("total cost"))?.proposed || "—"}
                    </p>
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
            <Section id="contacts" title="All Contacts in Document">
              <ContactsTable contacts={contacts} />
            </Section>

            {/* URLs */}
            <Section id="urls" title="All URLs in Document">
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

            {a && (<>
              {/* General Info */}
              <Section id="general" title="4.1 General Information">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  {[
                    ["Agency / State Entity", a.general_info_raw?.agency_name],
                    ["Proposal Name", a.general_info_raw?.proposal_name],
                    ["Project Number", a.general_info_raw?.project_number],
                    ["S4PRA Version", a.general_info_raw?.s4pra_version],
                    ["CDT Billing Case #", a.general_info_raw?.cdt_billing_case_number],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="flex gap-2 text-sm">
                      <span className="text-gray-500 font-medium min-w-fit">{label}:</span>
                      <span className="text-gray-800">{String(val || "—")}</span>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Submittal */}
              <Section id="submittal" title="4.2 Submittal Information">
                <div className="mb-4 flex gap-4">
                  <div className="text-sm"><span className="text-gray-500 font-medium">Submission Type:</span> <span className="font-semibold text-gray-800 ml-1">{a.submittal_info?.submission_type || "—"}</span></div>
                  {a.submittal_info?.conditions_from_stage3 && (
                    <div className="text-sm"><span className="text-gray-500 font-medium">Stage 3 Conditions:</span> <span className="ml-1 text-gray-700">{a.submittal_info.conditions_from_stage3}</span></div>
                  )}
                </div>
                <ContactsTable contacts={(a.submittal_info?.contacts || []) as Contact[]} />
              </Section>

              {/* Contract Management */}
              <Section id="contract" title="4.3 Contract Management">
                {a.contract_management?.length ? (
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="bg-amber-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100 w-2/3">Question</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100">Answer</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100">Notes</th>
                    </tr></thead>
                    <tbody>
                      {a.contract_management.map((row, i) => (
                        <tr key={i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
                          <td className="px-3 py-2 text-gray-700 border-b border-gray-100">{row.question}</td>
                          <td className="px-3 py-2 border-b border-gray-100"><YesNoBadge value={row.answer} /></td>
                          <td className="px-3 py-2 text-gray-500 text-xs border-b border-gray-100">{row.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-gray-400 text-sm italic">Not extracted</p>}
              </Section>

              {/* Org Readiness */}
              <Section id="org" title="4.4 Organizational Readiness">
                {a.org_readiness?.length ? (
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="bg-amber-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100 w-1/2">Question</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100">Answer</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100">Status</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100">Notes</th>
                    </tr></thead>
                    <tbody>
                      {a.org_readiness.map((row, i) => (
                        <tr key={i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
                          <td className="px-3 py-2 text-gray-700 border-b border-gray-100">{row.question}</td>
                          <td className="px-3 py-2 border-b border-gray-100"><YesNoBadge value={row.answer} /></td>
                          <td className="px-3 py-2 text-gray-500 text-xs border-b border-gray-100">{row.status || "—"}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs border-b border-gray-100 max-w-xs">{row.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-gray-400 text-sm italic">Not extracted</p>}
              </Section>

              {/* Project Readiness */}
              <Section id="readiness" title="4.5 Project Readiness">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 font-medium mb-1">Methodology</p>
                    <p className="text-sm font-bold text-gray-900">{a.project_readiness?.methodology || "—"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 font-medium mb-1">OTech Engaged</p>
                    <YesNoBadge value={a.project_readiness?.otech_engaged || "—"} />
                    {a.project_readiness?.otech_alternative && (
                      <p className="text-xs text-gray-500 mt-1">{a.project_readiness.otech_alternative}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 font-medium mb-1">Resource Commitments</p>
                    <YesNoBadge value={a.project_readiness?.resource_commitments_obtained || "—"} />
                  </div>
                </div>
                {a.project_readiness?.methodology_description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{a.project_readiness.methodology_description}</p>
                )}
              </Section>

              {/* Objectives */}
              <Section id="objectives" title="4.6 Business Objective Valuation">
                {a.objectives?.length ? (
                  <div className="space-y-4">
                    <table className="w-full text-sm border-collapse mb-4">
                      <thead><tr className="bg-amber-50">
                        {["ID","Objective","Metric","Baseline","Target","Valuation","Change from S1"].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {a.objectives.map((obj, i) => (
                          <tr key={i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
                            <td className="px-3 py-2 font-bold text-amber-700 border-b border-gray-100 whitespace-nowrap">{obj.id}</td>
                            <td className="px-3 py-2 text-gray-700 border-b border-gray-100 max-w-[200px] text-xs">{obj.objective_summary}</td>
                            <td className="px-3 py-2 text-gray-600 border-b border-gray-100 text-xs max-w-[160px]">{obj.metric}</td>
                            <td className="px-3 py-2 text-gray-600 border-b border-gray-100 text-xs max-w-[120px]">{obj.baseline}</td>
                            <td className="px-3 py-2 text-gray-600 border-b border-gray-100 text-xs max-w-[120px]">{obj.target_result}</td>
                            <td className="px-3 py-2 font-semibold text-center text-amber-700 border-b border-gray-100">{obj.valuation_pct}</td>
                            <td className="px-3 py-2 text-gray-500 border-b border-gray-100 text-xs whitespace-nowrap">
                              {obj.change_from_stage1 === "No Change" ? (
                                <span className="text-green-600 text-xs">✓ No Change</span>
                              ) : obj.change_from_stage1}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Valuation pie visualization */}
                    <div className="bg-amber-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-amber-800 mb-2">Valuation Distribution</p>
                      <div className="flex flex-wrap gap-2">
                        {a.objectives.map((obj, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-white rounded px-2 py-1 border border-amber-200">
                            <span className="font-bold text-xs text-amber-700">{obj.id}</span>
                            <span className="text-xs text-gray-600">{obj.valuation_pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : <p className="text-gray-400 text-sm italic">Not extracted</p>}
              </Section>

              {/* Schedule */}
              <Section id="schedule" title="4.7 Schedule Baseline">
                {a.schedule_baseline ? (
                  <>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Project Start</p>
                        <table className="w-full text-sm border-collapse">
                          <thead><tr className="bg-gray-50">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">Type</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">Date</th>
                          </tr></thead>
                          <tbody>
                            <tr><td className="px-3 py-2 text-gray-600 border-b">Proposed</td><td className="px-3 py-2 font-medium text-gray-800 border-b">{a.schedule_baseline.proposed_project_start || "—"}</td></tr>
                            <tr><td className="px-3 py-2 text-gray-600 border-b">Baseline</td><td className="px-3 py-2 font-medium text-gray-800 border-b">{a.schedule_baseline.baseline_project_start || "—"}</td></tr>
                            <tr><td className="px-3 py-2 text-gray-500 border-b">Variance</td><td className="px-3 py-2 text-amber-700 font-medium border-b">{a.schedule_baseline.start_variance || "—"}</td></tr>
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Project End</p>
                        <table className="w-full text-sm border-collapse">
                          <thead><tr className="bg-gray-50">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">Type</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">Date</th>
                          </tr></thead>
                          <tbody>
                            <tr><td className="px-3 py-2 text-gray-600 border-b">Proposed</td><td className="px-3 py-2 font-medium text-gray-800 border-b">{a.schedule_baseline.proposed_project_end || "—"}</td></tr>
                            <tr><td className="px-3 py-2 text-gray-600 border-b">Baseline</td><td className="px-3 py-2 font-medium text-gray-800 border-b">{a.schedule_baseline.baseline_project_end || "—"}</td></tr>
                            <tr><td className="px-3 py-2 text-gray-500 border-b">Variance</td><td className="px-3 py-2 text-amber-700 font-medium border-b">{a.schedule_baseline.end_variance || "—"}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {a.schedule_baseline.variance_reasons && (
                      <div className="bg-amber-50 rounded-lg p-3 mb-4 text-sm text-amber-800">
                        <strong>Variance Reason:</strong> {a.schedule_baseline.variance_reasons}
                      </div>
                    )}
                    {a.schedule_baseline.key_milestones?.length > 0 && (
                      <DataTable data={a.schedule_baseline.key_milestones}
                        columns={[{key:"milestone",label:"Milestone"},{key:"date",label:"Date"},{key:"status",label:"Status"}]} />
                    )}
                  </>
                ) : <p className="text-gray-400 text-sm italic">Not extracted</p>}
              </Section>

              {/* Cost Baseline */}
              <Section id="cost" title="4.8 Cost Baseline">
                {a.cost_baseline ? (
                  <>
                    <DataTable data={a.cost_baseline.cost_rows || []}
                      columns={[{key:"category",label:"Cost Category"},{key:"proposed",label:"Proposed (FAW)"},{key:"baseline",label:"Baseline"},{key:"variance",label:"Variance"}]} />
                    {a.cost_baseline.variance_reasons && (
                      <div className="mt-4 bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
                        <strong>Variance Reason:</strong> {a.cost_baseline.variance_reasons}
                      </div>
                    )}
                    {a.cost_baseline.bcp_summary?.length > 0 && (
                      <div className="mt-6">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Budget Change Proposals (BCPs)</p>
                        <DataTable data={a.cost_baseline.bcp_summary}
                          columns={[{key:"budget_request_id",label:"Budget Request ID"},{key:"budget_year",label:"Year"},{key:"requested_amount",label:"Amount"},{key:"status",label:"Status"}]} />
                      </div>
                    )}
                  </>
                ) : <p className="text-gray-400 text-sm italic">Not extracted</p>}
              </Section>

              {/* Solicitation Results */}
              <Section id="solicitation" title="4.9 Primary Solicitation Results">
                {a.solicitation_results ? (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-amber-50 rounded-lg p-4 col-span-1">
                        <p className="text-xs text-amber-600 font-medium mb-1">Selected Vendor</p>
                        <p className="font-bold text-amber-900">{a.solicitation_results.selected_vendor || "—"}</p>
                        <p className="text-xs text-gray-500 mt-1">Contract: {a.solicitation_results.contract_number || "—"}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-xs text-blue-600 font-medium mb-1">Contract Period</p>
                        <p className="font-bold text-blue-900 text-sm">{a.solicitation_results.contract_start_date || "—"}</p>
                        <p className="text-xs text-gray-500">to {a.solicitation_results.contract_end_date || "—"}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-xs text-green-600 font-medium mb-1">Total Contract Cost</p>
                        <p className="font-bold text-green-900">{a.solicitation_results.total_contract_cost || "—"}</p>
                        {a.solicitation_results.total_with_optional && a.solicitation_results.total_with_optional !== "0" && (
                          <p className="text-xs text-gray-500 mt-1">With optional: {a.solicitation_results.total_with_optional}</p>
                        )}
                      </div>
                    </div>
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 font-medium mb-1">Stage 2 Solution Selected:</p>
                      <YesNoBadge value={a.solicitation_results.stage2_solution_selected || "—"} />
                    </div>
                    {a.solicitation_results.project_management_plans?.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Project Management Plans</p>
                        <DataTable data={a.solicitation_results.project_management_plans}
                          columns={[{key:"plan",label:"Plan"},{key:"status",label:"Status"},{key:"notes",label:"Notes"}]} />
                      </div>
                    )}
                  </>
                ) : <p className="text-gray-400 text-sm italic">Not extracted</p>}
              </Section>

              {/* Risk Register */}
              <Section id="risk" title="4.10 Risk Register">
                {a.risk_register?.length ? (
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="bg-amber-50">
                      {["ID","Risk","Probability","Impact","Mitigation","Owner"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-amber-800 border-b border-amber-100">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {a.risk_register.map((row, i) => (
                        <tr key={i} className={i%2===0?"bg-white":"bg-gray-50/40"}>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500 border-b">{row.risk_id||"—"}</td>
                          <td className="px-3 py-2 text-gray-700 border-b text-xs max-w-[200px]">{row.risk}</td>
                          <td className="px-3 py-2 border-b"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${RISK_COLORS[row.probability]||"bg-gray-100 text-gray-600"}`}>{row.probability||"—"}</span></td>
                          <td className="px-3 py-2 border-b"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${RISK_COLORS[row.impact]||"bg-gray-100 text-gray-600"}`}>{row.impact||"—"}</span></td>
                          <td className="px-3 py-2 text-gray-600 border-b text-xs max-w-[200px]">{row.mitigation||"—"}</td>
                          <td className="px-3 py-2 text-gray-500 border-b text-xs">{row.owner||"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-400 text-sm italic">
                    {a ? "Risk register not extracted — may be attached separately per Stage 4 requirements" : "Not extracted"}
                  </p>
                )}
              </Section>

              {/* CDT Use Only */}
              <Section id="dot" title="Department of Technology Use Only">
                <div className="grid grid-cols-2 gap-6">
                  <DataTable data={a.dot_dates || []}
                    columns={[{key:"label",label:"Field"},{key:"date",label:"Date"}]} />
                  {a.dot_raw && (
                    <div className="space-y-3">
                      {[["Form Status", a.dot_raw.form_status],["Form Disposition", a.dot_raw.form_disposition]].map(([label, val]) => val && (
                        <div key={String(label)} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 font-medium">{label}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            </>)}
          </>
        )}
      </div>
    </div>
  );
}
