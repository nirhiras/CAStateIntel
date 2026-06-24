"use client";
import { useState, useEffect, use } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Contact { name:string; title:string; email:string; phone:string; organization:string; role_type:string; stage:number; source:string; }
interface AncillaryProc { name:string; procurement_type:string; estimated_value:string; timeline:string; vendor_or_source:string; description:string; justification:string; }
interface Tag { tag:string; category:string; confidence:string; }
interface StageDoc { document_id:string; filename:string; label:string; }

interface S1 { doc_created_date:string; project_planning_start:string; proposed_execution_start:string; dot_dates:{label:string;date:string}[]; general_info_summary:string; stakeholder_summary:string; stakeholders:{name:string;organization:string;role:string;interest:string}[]; business_program_summary:string; justification_summary:string; outcomes_summary:string; outcomes_raw:{outcome:string;metric:string;target:string}[]; complexity_summary:string; complexity_raw:{dimension:string;score:string}[]; funding_summary:string; rom_estimate:{category:string;amount:string}[]; funding_raw:Record<string,string>; submittal_info:Record<string,string>; document:StageDoc|null; }
interface S2 { doc_created_date:string; dot_dates:{label:string;date:string}[]; baseline_summary:string; requirements_summary:string; market_research_summary:string; market_research_raw:Record<string,unknown>; viable_solutions:{name:string;recommended:boolean;summary:string;pros:string[];cons:string[];estimated_cost:string}[]; solution_tags:Tag[]; financial_raw:Record<string,unknown>; financial_analysis:{total?:string;npv?:string;cost_table?:{category:string;year1?:string;total:string}[]}; project_org_summary:string; project_planning_summary:string; assumptions:unknown[]; document:StageDoc|null; }
interface S3 { doc_created_date:string; dot_dates:{label:string;date:string}[]; solution_requirements_summary:string; primary_solicitation_raw:Record<string,string>; ancillary_procurements:AncillaryProc[]; procurements_roadmap:{total_duration?:string;phases?:{phase:string;start_date:string;end_date:string;description:string}[];key_milestones?:{milestone:string;date:string;type:string}[]}; project_planning_raw:Record<string,unknown>; document:StageDoc|null; }
interface S4 { doc_created_date:string; general_info_raw:Record<string,string>; submittal_info:Record<string,unknown>; contract_management:{question:string;answer:string;notes:string}[]; org_readiness:{question:string;answer:string;notes:string}[]; project_readiness:{methodology:string;methodology_description:string;otech_engaged:string}; objectives:{id:string;objective_summary:string;valuation_pct:string;metric:string;baseline:string;target_result:string}[]; schedule_baseline:{proposed_project_start:string;baseline_project_start:string;start_variance:string;proposed_project_end:string;baseline_project_end:string;end_variance:string;variance_reasons:string}; cost_baseline:{cost_rows:{category:string;proposed:string;baseline:string;variance:string}[];bcp_summary:{budget_request_id:string;budget_year:string;requested_amount:string;status:string}[]}; solicitation_results:{selected_vendor:string;contract_number:string;contract_start_date:string;contract_end_date:string;total_contract_cost:string;stage2_solution_selected:string}; risk_register:{risk_id:string;risk:string;probability:string;impact:string;mitigation:string}[]; dot_dates:{label:string;date:string}[]; dot_raw:{form_status:string;form_disposition:string}; document:StageDoc|null; }

interface ProjectData { project:{id:number;project_number:string;name:string;department_name:string;agency_name:string;pal_stage:string;criticality_rating:string;detail_url:string;}; s1:S1|null; s2:S2|null; s3:S3|null; s4:S4|null; contacts:Contact[]; }

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d?:string|null) => d ? new Date(d).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}) : "—";
const TAG_COLORS:Record<string,string> = { vendor:"bg-blue-100 text-blue-800", technology:"bg-purple-100 text-purple-800", approach:"bg-green-100 text-green-800", deployment:"bg-orange-100 text-orange-800" };
const RISK_COLORS:Record<string,string> = { High:"bg-red-100 text-red-800", Medium:"bg-yellow-100 text-yellow-800", Low:"bg-green-100 text-green-800" };

function Badge({ label, color="bg-gray-100 text-gray-600" }:{ label:string; color?:string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}
function YN({ v }:{ v:string }) {
  const lv = (v||"").toLowerCase();
  return <Badge label={v||"—"} color={lv==="yes"?"bg-green-100 text-green-800":lv==="no"?"bg-red-100 text-red-700":"bg-gray-100 text-gray-500"} />;
}
function KV({ label, value, accent=false }:{ label:string; value?:string|null; accent?:boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm mt-0.5 ${accent?"font-bold text-blue-900":"text-gray-800"} ${!value?"text-gray-300":""}`}>{value||"—"}</span>
    </div>
  );
}
function SectionHead({ title }:{ title:string }) {
  return <div className="flex items-center gap-2 mb-4"><div className="w-1 h-5 rounded bg-blue-500"/><h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h3></div>;
}
function Card({ children, className="" }:{ children:React.ReactNode; className?:string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>{children}</div>;
}
function Table({ headers, rows }:{ headers:string[]; rows:(string|React.ReactNode)[][] }) {
  if (!rows.length) return <p className="text-xs text-gray-400 italic">No data</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead><tr>{headers.map(h=><th key={h} className="text-left px-3 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row,i)=><tr key={i} className={i%2===0?"bg-white":"bg-gray-50/40"}>{row.map((cell,j)=><td key={j} className="px-3 py-2 border-b border-gray-100 align-top">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function PdfBtn({ doc, stage }:{ doc:StageDoc|null|undefined; stage:number }) {
  const cls = ["","text-green-700 border-green-200 bg-green-50","text-indigo-700 border-indigo-200 bg-indigo-50","text-violet-700 border-violet-200 bg-violet-50","text-amber-700 border-amber-200 bg-amber-50"];
  if (!doc?.document_id) return null;
  return <a href={`/api/castateintel/pdf/${doc.document_id}`} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border font-medium ${cls[stage]||cls[1]}`}>📄 PDF</a>;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"overview", label:"Overview" },
  { id:"s1", label:"Stage 1 — Business Analysis" },
  { id:"s2", label:"Stage 2 — Alternatives" },
  { id:"s3", label:"Stage 3 — Solution" },
  { id:"s4", label:"Stage 4 — Readiness" },
  { id:"procurements", label:"Procurements" },
  { id:"contacts", label:"Contacts" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProjectSummaryPage({ params }:{ params:Promise<{projectNumber:string}> }) {
  const { projectNumber } = use(params);
  const [data, setData] = useState<ProjectData|null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [pdfModal, setPdfModal] = useState<{url:string;title:string}|null>(null);

  useEffect(()=>{
    if (!projectNumber) return;
    Promise.all([
      fetch(`/api/castateintel/analysis/${projectNumber}/1`).then(r=>r.json()),
      fetch(`/api/castateintel/analysis/${projectNumber}/2`).then(r=>r.json()),
      fetch(`/api/castateintel/analysis/${projectNumber}/3`).then(r=>r.json()),
      fetch(`/api/castateintel/analysis/${projectNumber}/4`).then(r=>r.json()),
      fetch(`/api/castateintel/contacts?project=${projectNumber}`).then(r=>r.json()),
    ]).then(([r1,r2,r3,r4,rc])=>{
      setData({
        project: r1.project||r2.project||r3.project||r4.project,
        s1: r1.extracted ? {...r1.analysis, document:r1.document} : null,
        s2: r2.extracted ? {...r2.analysis, document:r2.document} : null,
        s3: r3.extracted ? {...r3.analysis, document:r3.document} : null,
        s4: r4.extracted ? {...r4.analysis, document:r4.document} : null,
        contacts: rc.contacts||[],
      });
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[projectNumber]);

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
  if (!data) return null;
  const { project, s1, s2, s3, s4, contacts } = data;
  const tags = s2?.solution_tags||[];
  const recommended = s2?.viable_solutions?.find(v=>v.recommended)||s2?.viable_solutions?.[0];
  const ancillary = s3?.ancillary_procurements||[];

  // Financials
  const totalVal = s1?.funding_raw?.total_estimate || s4?.solicitation_results?.total_contract_cost || "—";
  const oneTime = s2?.financial_analysis?.cost_table?.find(r=>r.category?.toLowerCase().includes("one"))?.total || "—";
  const ongoing = s2?.financial_analysis?.cost_table?.find(r=>r.category?.toLowerCase().includes("continu")||r.category?.toLowerCase().includes("ongoing"))?.total || "—";
  const duration = s3?.procurements_roadmap?.total_duration || "—";

  // Stage availability
  const stageInfo = [
    { num:1, label:"S1BA", has:!!s1, doc:s1?.document, color:"green" },
    { num:2, label:"S2AA", has:!!s2, doc:s2?.document, color:"indigo" },
    { num:3, label:"S3SA", has:!!s3, doc:s3?.document, color:"violet" },
    { num:4, label:"S4PRA", has:!!s4, doc:s4?.document, color:"amber" },
  ];
  const stageColors:Record<string,string> = {
    green:"bg-green-100 text-green-700 border-green-300",
    indigo:"bg-indigo-100 text-indigo-700 border-indigo-300",
    violet:"bg-violet-100 text-violet-700 border-violet-300",
    amber:"bg-amber-100 text-amber-700 border-amber-300",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PDF Modal */}
      {pdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold text-gray-800">📄 {pdfModal.title}</span>
              <button onClick={()=>setPdfModal(null)} className="text-gray-400 hover:text-gray-700 text-xl font-bold px-2">✕</button>
            </div>
            <iframe src={pdfModal.url} className="flex-1 w-full" title="PDF Viewer"/>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-blue-900 text-white px-6 py-4 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3 mb-1 text-sm">
            <a href="/CAStateIntel" className="text-blue-300 hover:text-white">← Dashboard</a>
            <span className="text-blue-600">|</span>
            <span className="text-blue-300">Project Analysis</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold leading-tight">{project?.project_number} — {project?.name}</h1>
              <p className="text-blue-200 text-sm mt-0.5">{project?.department_name}{project?.agency_name?` · ${project.agency_name}`:""}</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end mt-1">
              {stageInfo.map(s=>(
                <button key={s.num} onClick={()=>{setTab(`s${s.num}`);}}
                  className={`text-xs px-3 py-1 rounded border font-semibold transition-all ${s.has?stageColors[s.color]:"bg-white/10 text-white/40 border-white/20"}`}>
                  {s.label} {s.has?"✓":"—"}
                </button>
              ))}
              {project?.detail_url && (
                <a href={project.detail_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1 rounded border font-medium bg-white/10 text-white hover:bg-white/20 border-white/20">CDT ↗</a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-[88px] z-10">
        <div className="max-w-screen-xl mx-auto flex overflow-x-auto">
          {TABS.map(t=>{
            const hasData = t.id==="s1"?!!s1:t.id==="s2"?!!s2:t.id==="s3"?!!s3:t.id==="s4"?!!s4:
              t.id==="procurements"?ancillary.length>0:t.id==="contacts"?contacts.length>0:true;
            return (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
                  ${tab===t.id?"border-blue-600 text-blue-700":"border-transparent text-gray-500 hover:text-gray-700"}
                  ${!hasData&&t.id!=="overview"?"opacity-40":""}`}>
                {t.label}
                {t.id==="contacts"&&contacts.length>0&&<span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{contacts.length}</span>}
                {t.id==="procurements"&&ancillary.length>0&&<span className="ml-1 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{ancillary.length}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6">

        {/* ── OVERVIEW TAB ── */}
        {tab==="overview" && (
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label:"Total Project Value", value:totalVal, accent:true },
                { label:"One Time Cost", value:oneTime },
                { label:"Continuing Cost", value:ongoing },
                { label:"Project Duration", value:duration },
              ].map(c=>(
                <Card key={c.label} className="flex flex-col">
                  <span className="text-xs text-gray-400 font-medium mb-1">{c.label}</span>
                  <span className={`text-lg font-bold ${c.accent?"text-blue-900":"text-gray-800"} ${c.value==="—"?"text-gray-300 font-normal text-sm":""}`}>{c.value}</span>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-5">
              {/* Stage Status */}
              <Card>
                <SectionHead title="Analysis Status"/>
                <div className="space-y-3">
                  {stageInfo.map(s=>(
                    <div key={s.num} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${s.has?"bg-green-500":"bg-gray-200"}`}/>
                        <span className="text-sm text-gray-700">Stage {s.num} — {["","Business Analysis","Alternative Analysis","Solution Analysis","Project Readiness"][s.num]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.has
                          ? <><button onClick={()=>setTab(`s${s.num}`)} className={`text-xs px-2 py-0.5 rounded border font-medium ${stageColors[s.color]}`}>View</button>
                             {s.doc && <button onClick={()=>s.doc&&setPdfModal({url:`/api/castateintel/pdf/${s.doc.document_id}`,title:s.doc.filename})} className="text-xs text-gray-400 hover:text-gray-600">📄</button>}</>
                          : <span className="text-xs text-gray-400">Not extracted</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Solution Tags */}
              <Card>
                <SectionHead title="Solution Tags"/>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t,i)=>(
                      <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${TAG_COLORS[t.category]||"bg-gray-100 text-gray-600"}`}>
                        {t.tag}
                      </span>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400">Extract Stage 2 to see solution tags</p>}
              </Card>

              {/* Key Dates */}
              <Card>
                <SectionHead title="Key Dates"/>
                <div className="space-y-2">
                  {[
                    ["S1 — Planning Start", s1?.project_planning_start],
                    ["S1 — Execution Start", s1?.proposed_execution_start],
                    ["S1 — Form Accepted", s1?.dot_dates?.find(d=>d.label?.toLowerCase().includes("accept"))?.date],
                    ["S3 — Form Accepted", s3?.dot_dates?.find(d=>d.label?.toLowerCase().includes("accept"))?.date],
                    ["S4 — Contract Start", s4?.solicitation_results?.contract_start_date],
                    ["S4 — Contract End", s4?.solicitation_results?.contract_end_date],
                  ].map(([label,val])=>(
                    <div key={String(label)} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className={`font-medium ${val?"text-gray-800":"text-gray-300"}`}>{fmt(val as string)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Recommended solution + vendor */}
            {(recommended || s4?.solicitation_results?.selected_vendor) && (
              <div className="grid grid-cols-2 gap-5">
                {recommended && (
                  <Card>
                    <SectionHead title="Recommended Solution (S2)"/>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-indigo-900 text-sm">{recommended.name}</h4>
                      {recommended.estimated_cost && <Badge label={recommended.estimated_cost} color="bg-indigo-50 text-indigo-700"/>}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{recommended.summary}</p>
                    {recommended.pros?.length>0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {recommended.pros.slice(0,3).map((p,i)=><Badge key={i} label={`✓ ${p}`} color="bg-green-50 text-green-700"/>)}
                      </div>
                    )}
                  </Card>
                )}
                {s4?.solicitation_results?.selected_vendor && (
                  <Card>
                    <SectionHead title="Selected Vendor (S4)"/>
                    <div className="space-y-2">
                      <KV label="Vendor" value={s4.solicitation_results.selected_vendor} accent/>
                      <KV label="Contract #" value={s4.solicitation_results.contract_number}/>
                      <KV label="Total Contract Cost" value={s4.solicitation_results.total_contract_cost}/>
                      <KV label="Contract Period" value={`${fmt(s4.solicitation_results.contract_start_date)} → ${fmt(s4.solicitation_results.contract_end_date)}`}/>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STAGE 1 TAB ── */}
        {tab==="s1" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge label="Stage 1 — Business Analysis" color="bg-green-100 text-green-800"/>
                {s1?.doc_created_date && <span className="text-xs text-gray-400">Created {fmt(s1.doc_created_date)}</span>}
              </div>
              <PdfBtn doc={s1?.document} stage={1}/>
            </div>
            {!s1 ? <Card><p className="text-gray-400">Not yet extracted. Upload a Stage 1 PDF to analyze.</p></Card> : (
              <>
                <div className="grid grid-cols-2 gap-5">
                  <Card><SectionHead title="General Summary"/><p className="text-sm text-gray-700 leading-relaxed">{s1.general_info_summary||"—"}</p></Card>
                  <Card><SectionHead title="Business Program"/><p className="text-sm text-gray-700 leading-relaxed">{s1.business_program_summary||"—"}</p></Card>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <Card><SectionHead title="Project Justification"/><p className="text-sm text-gray-700 leading-relaxed">{s1.justification_summary||"—"}</p></Card>
                  <Card><SectionHead title="Business Outcomes"/>
                    {s1.outcomes_raw?.length>0
                      ? <Table headers={["Outcome","Metric","Target"]} rows={s1.outcomes_raw.map(o=>[o.outcome,o.metric,o.target])}/>
                      : <p className="text-sm text-gray-700">{s1.outcomes_summary||"—"}</p>}
                  </Card>
                </div>
                <div className="grid grid-cols-3 gap-5">
                  <Card><SectionHead title="Complexity Assessment"/>
                    {s1.complexity_raw?.length>0
                      ? <Table headers={["Dimension","Score"]} rows={s1.complexity_raw.map(c=>[c.dimension,c.score])}/>
                      : <p className="text-sm text-gray-700">{s1.complexity_summary||"—"}</p>}
                  </Card>
                  <Card><SectionHead title="Funding (ROM)"/>
                    {s1.rom_estimate?.length>0
                      ? <Table headers={["Category","Amount"]} rows={s1.rom_estimate.map(r=>[r.category,r.amount])}/>
                      : <p className="text-sm text-gray-700">{s1.funding_summary||"—"}</p>}
                  </Card>
                  <Card><SectionHead title="CDT Dates"/>
                    {s1.dot_dates?.length>0
                      ? <div className="space-y-1">{s1.dot_dates.map((d,i)=><div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{d.label}</span><span className="font-medium text-gray-800">{fmt(d.date)}</span></div>)}</div>
                      : <p className="text-xs text-gray-400">—</p>}
                  </Card>
                </div>
                <Card><SectionHead title="Stakeholders"/>
                  {s1.stakeholders?.length>0
                    ? <Table headers={["Name","Organization","Role","Interest"]} rows={s1.stakeholders.map(s=>[s.name,s.organization,s.role,s.interest])}/>
                    : <p className="text-sm text-gray-700">{s1.stakeholder_summary||"—"}</p>}
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── STAGE 2 TAB ── */}
        {tab==="s2" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge label="Stage 2 — Alternative Analysis" color="bg-indigo-100 text-indigo-800"/>
                {s2?.doc_created_date && <span className="text-xs text-gray-400">Created {fmt(s2.doc_created_date)}</span>}
              </div>
              <PdfBtn doc={s2?.document} stage={2}/>
            </div>
            {!s2 ? <Card><p className="text-gray-400">Not yet extracted.</p></Card> : (
              <>
                <div className="grid grid-cols-2 gap-5">
                  <Card><SectionHead title="Baseline / Current State"/><p className="text-sm text-gray-700 leading-relaxed">{s2.baseline_summary||"—"}</p></Card>
                  <Card><SectionHead title="Requirements"/><p className="text-sm text-gray-700 leading-relaxed">{s2.requirements_summary||"—"}</p></Card>
                </div>
                <Card><SectionHead title="Market Research"/><p className="text-sm text-gray-700 leading-relaxed">{s2.market_research_summary||"—"}</p></Card>
                <Card><SectionHead title="Viable Solutions"/>
                  <div className="grid grid-cols-1 gap-4">
                    {s2.viable_solutions?.map((sol,i)=>(
                      <div key={i} className={`rounded-lg p-4 border-2 ${sol.recommended?"border-indigo-400 bg-indigo-50":"border-gray-200 bg-white"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-sm text-gray-900">{sol.name}</h4>
                          <div className="flex items-center gap-2">
                            {sol.estimated_cost && <Badge label={sol.estimated_cost} color="bg-gray-100 text-gray-700"/>}
                            {sol.recommended && <Badge label="✓ Recommended" color="bg-indigo-100 text-indigo-800"/>}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed mb-3">{sol.summary}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {sol.pros?.length>0 && <div><p className="text-xs font-semibold text-green-700 mb-1">Pros</p>{sol.pros.map((p,j)=><p key={j} className="text-xs text-gray-600">✓ {p}</p>)}</div>}
                          {sol.cons?.length>0 && <div><p className="text-xs font-semibold text-red-600 mb-1">Cons</p>{sol.cons.map((c,j)=><p key={j} className="text-xs text-gray-600">✗ {c}</p>)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <div className="grid grid-cols-2 gap-5">
                  <Card><SectionHead title="Financial Analysis"/>
                    {s2.financial_analysis?.cost_table?.length
                      ? <Table headers={["Category","Total"]} rows={s2.financial_analysis.cost_table.map(r=>[r.category,r.total])}/>
                      : <p className="text-xs text-gray-400">—</p>}
                    {s2.financial_analysis?.npv && <div className="mt-3 text-xs"><span className="text-gray-500">NPV:</span> <span className="font-semibold">{s2.financial_analysis.npv}</span></div>}
                  </Card>
                  <Card><SectionHead title="CDT Dates"/>
                    {s2.dot_dates?.length>0
                      ? <div className="space-y-1">{s2.dot_dates.map((d,i)=><div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{d.label}</span><span className="font-medium">{fmt(d.date)}</span></div>)}</div>
                      : <p className="text-xs text-gray-400">—</p>}
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STAGE 3 TAB ── */}
        {tab==="s3" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge label="Stage 3 — Solution Analysis" color="bg-violet-100 text-violet-800"/>
                {s3?.doc_created_date && <span className="text-xs text-gray-400">Created {fmt(s3.doc_created_date)}</span>}
              </div>
              <PdfBtn doc={s3?.document} stage={3}/>
            </div>
            {!s3 ? <Card><p className="text-gray-400">Not yet extracted.</p></Card> : (
              <>
                <Card><SectionHead title="Solution Requirements"/><p className="text-sm text-gray-700 leading-relaxed">{s3.solution_requirements_summary||"—"}</p></Card>
                <div className="grid grid-cols-2 gap-5">
                  <Card><SectionHead title="Primary Solicitation"/>
                    <div className="space-y-2">
                      {Object.entries(s3.primary_solicitation_raw||{}).filter(([,v])=>v&&v!=="null").map(([k,v])=>(
                        <div key={k} className="flex justify-between text-xs"><span className="text-gray-500 capitalize">{k.replace(/_/g," ")}</span><span className="font-medium text-gray-800">{String(v)}</span></div>
                      ))}
                    </div>
                  </Card>
                  <Card><SectionHead title="CDT Dates"/>
                    {s3.dot_dates?.length>0
                      ? <div className="space-y-1">{s3.dot_dates.map((d,i)=><div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{d.label}</span><span className="font-medium">{fmt(d.date)}</span></div>)}</div>
                      : <p className="text-xs text-gray-400">—</p>}
                  </Card>
                </div>
                {(s3.procurements_roadmap?.phases?.length||0)>0 && (
                  <Card><SectionHead title="Project Roadmap"/>
                    <Table headers={["Phase","Start","End","Description"]} rows={(s3.procurements_roadmap?.phases||[]).map(p=>[p.phase,fmt(p.start_date),fmt(p.end_date),p.description])}/>
                  </Card>
                )}
                {(s3.procurements_roadmap?.key_milestones?.length||0)>0 && (
                  <Card><SectionHead title="Key Milestones"/>
                    <Table headers={["Milestone","Date","Type"]} rows={(s3.procurements_roadmap?.key_milestones||[]).map(m=>[m.milestone,fmt(m.date),m.type])}/>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STAGE 4 TAB ── */}
        {tab==="s4" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge label="Stage 4 — Project Readiness & Approval" color="bg-amber-100 text-amber-800"/>
                {s4?.doc_created_date && <span className="text-xs text-gray-400">Created {fmt(s4.doc_created_date)}</span>}
              </div>
              <PdfBtn doc={s4?.document} stage={4}/>
            </div>
            {!s4 ? <Card><p className="text-gray-400">Not yet extracted.</p></Card> : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card><KV label="Selected Vendor" value={s4.solicitation_results?.selected_vendor} accent/></Card>
                  <Card><KV label="Total Contract Cost" value={s4.solicitation_results?.total_contract_cost} accent/></Card>
                  <Card><KV label="Contract Period" value={`${fmt(s4.solicitation_results?.contract_start_date)} → ${fmt(s4.solicitation_results?.contract_end_date)}`}/></Card>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <Card><SectionHead title="Schedule Baseline"/>
                    <Table headers={["","Proposed","Baseline","Variance"]} rows={[
                      ["Start",fmt(s4.schedule_baseline?.proposed_project_start),fmt(s4.schedule_baseline?.baseline_project_start),s4.schedule_baseline?.start_variance||"—"],
                      ["End",fmt(s4.schedule_baseline?.proposed_project_end),fmt(s4.schedule_baseline?.baseline_project_end),s4.schedule_baseline?.end_variance||"—"],
                    ]}/>
                    {s4.schedule_baseline?.variance_reasons && <p className="text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded">{s4.schedule_baseline.variance_reasons}</p>}
                  </Card>
                  <Card><SectionHead title="Cost Baseline"/>
                    {s4.cost_baseline?.cost_rows?.length>0
                      ? <Table headers={["Category","Proposed","Baseline","Variance"]} rows={s4.cost_baseline.cost_rows.map(r=>[r.category,r.proposed,r.baseline,r.variance])}/>
                      : <p className="text-xs text-gray-400">—</p>}
                  </Card>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <Card><SectionHead title="Contract Management"/>
                    <Table headers={["Question","Answer"]} rows={(s4.contract_management||[]).map(r=>[r.question,<YN key={r.question} v={r.answer}/>])}/>
                  </Card>
                  <Card><SectionHead title="Organizational Readiness"/>
                    <Table headers={["Question","Answer"]} rows={(s4.org_readiness||[]).map(r=>[r.question,<YN key={r.question} v={r.answer}/>])}/>
                  </Card>
                </div>
                {s4.objectives?.length>0 && (
                  <Card><SectionHead title="Business Objectives"/>
                    <Table headers={["ID","Objective","Metric","Target","Valuation"]} rows={s4.objectives.map(o=>[<strong key={o.id} className="text-amber-700">{o.id}</strong>,o.objective_summary,o.metric,o.target_result,o.valuation_pct])}/>
                  </Card>
                )}
                {s4.risk_register?.length>0 && (
                  <Card><SectionHead title="Risk Register"/>
                    <Table headers={["Risk","Probability","Impact","Mitigation"]} rows={s4.risk_register.map(r=>[r.risk,<Badge key={r.risk_id} label={r.probability||"—"} color={RISK_COLORS[r.probability]||"bg-gray-100 text-gray-600"}/>,<Badge key={r.risk_id+"i"} label={r.impact||"—"} color={RISK_COLORS[r.impact]||"bg-gray-100 text-gray-600"}/>,r.mitigation])}/>
                  </Card>
                )}
                <div className="grid grid-cols-2 gap-5">
                  <Card><SectionHead title="Project Readiness"/>
                    <div className="space-y-2">
                      <KV label="Methodology" value={s4.project_readiness?.methodology}/>
                      <KV label="OTech Engaged" value={s4.project_readiness?.otech_engaged}/>
                      {s4.project_readiness?.methodology_description && <p className="text-xs text-gray-600 mt-2 leading-relaxed">{s4.project_readiness.methodology_description}</p>}
                    </div>
                  </Card>
                  <Card><SectionHead title="CDT Use Only"/>
                    {s4.dot_dates?.length>0
                      ? <div className="space-y-1">{s4.dot_dates.map((d,i)=><div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{d.label}</span><span className="font-medium">{fmt(d.date)}</span></div>)}</div>
                      : <p className="text-xs text-gray-400">—</p>}
                    {s4.dot_raw && <div className="mt-3 space-y-1">
                      {s4.dot_raw.form_status && <div className="flex justify-between text-xs"><span className="text-gray-500">Form Status</span><Badge label={s4.dot_raw.form_status} color="bg-blue-50 text-blue-700"/></div>}
                      {s4.dot_raw.form_disposition && <div className="flex justify-between text-xs"><span className="text-gray-500">Disposition</span><Badge label={s4.dot_raw.form_disposition} color="bg-green-50 text-green-700"/></div>}
                    </div>}
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PROCUREMENTS TAB ── */}
        {tab==="procurements" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <Badge label={`${ancillary.length} Ancillary Procurements`} color="bg-violet-100 text-violet-800"/>
              <a href={`/CAStateIntel/procurements?project=${projectNumber}`} className="text-xs text-violet-600 hover:underline">View all procurements →</a>
            </div>
            {!s3 ? <Card><p className="text-gray-400">Not yet extracted. Upload a Stage 3 PDF to analyze.</p></Card> : (
              <>
                {s3.primary_solicitation_raw && (
                  <Card>
                    <SectionHead title="Primary Solicitation"/>
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(s3.primary_solicitation_raw).filter(([,v])=>v&&v!=="null").map(([k,v])=>(
                        <KV key={k} label={k.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())} value={String(v)}/>
                      ))}
                    </div>
                  </Card>
                )}
                {ancillary.length===0
                  ? <Card><p className="text-gray-400 text-sm">No ancillary procurements in Stage 3.</p></Card>
                  : <div className="grid grid-cols-2 gap-4">
                    {ancillary.map((ap,i)=>(
                      <Card key={i}>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm text-gray-900">{ap.name}</h4>
                          {ap.estimated_value && <Badge label={ap.estimated_value} color="bg-violet-50 text-violet-700"/>}
                        </div>
                        {ap.procurement_type && <Badge label={ap.procurement_type} color="bg-gray-100 text-gray-600"/>}
                        {ap.timeline && <p className="text-xs text-violet-700 mt-2">📅 {ap.timeline}</p>}
                        {ap.vendor_or_source && <p className="text-xs text-gray-500 mt-1">Vendor: {ap.vendor_or_source}</p>}
                        {ap.description && <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-3">{ap.description}</p>}
                        {ap.justification && <p className="text-xs text-gray-500 mt-2 italic">{ap.justification}</p>}
                      </Card>
                    ))}
                  </div>
                }
              </>
            )}
          </div>
        )}

        {/* ── CONTACTS TAB ── */}
        {tab==="contacts" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge label={`${contacts.length} contacts across all stages`} color="bg-blue-100 text-blue-800"/>
              <a href="/CAStateIntel/contacts" className="text-xs text-blue-600 hover:underline">View all contacts →</a>
            </div>
            {contacts.length===0
              ? <Card><p className="text-gray-400">No contacts extracted yet.</p></Card>
              : <div className="grid grid-cols-3 gap-4">
                {contacts.map((c,i)=>(
                  <Card key={i} className="flex flex-col gap-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{c.name}</p>
                        {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                        {c.organization && <p className="text-xs text-gray-400">{c.organization}</p>}
                      </div>
                      <Badge label={`S${c.stage}`} color={["","bg-green-100 text-green-700","bg-indigo-100 text-indigo-700","bg-violet-100 text-violet-700","bg-amber-100 text-amber-700"][c.stage]||"bg-gray-100 text-gray-600"}/>
                    </div>
                    {c.email && <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline truncate">{c.email}</a>}
                    {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                    {c.role_type && <Badge label={c.role_type} color="bg-gray-50 text-gray-500"/>}
                  </Card>
                ))}
              </div>
            }
          </div>
        )}

      </div>
    </div>
  );
}
