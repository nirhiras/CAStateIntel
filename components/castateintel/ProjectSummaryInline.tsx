"use client";
// components/castateintel/ProjectSummaryInline.tsx
// Full project summary — used by stage pages and project/[projectNumber] page

import { useState, useEffect, useCallback } from "react";
import RvtNav from "@/components/castateintel/RvtNav";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Contact { name:string;title:string;email:string;phone:string;organization:string;role_type:string;stage:number;source:string; }
interface AncillaryProc { name:string;procurement_type:string;estimated_value:string;timeline:string;vendor_or_source:string;description:string;justification:string; }
interface Tag { tag:string;category:string;confidence:string; }
interface StageDoc { document_id:string;filename:string;label:string; }
interface DotDate { label:string;date:string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d?:string|null) => { if(!d||d==="null")return null; try{return new Date(d).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});}catch{return d;} };
const TAG_COLORS:Record<string,string> = { vendor:"",technology:"",approach:"",deployment:"" }; // unused — tags use inline styles now
const RISK_COLORS:Record<string,string> = { High:"",Medium:"",Low:"" }; // unused
const STAGE_COLORS:Record<number,string> = { 1:"",2:"",3:"",4:"" }; // unused
const STAGE_ABBREV:Record<number,string> = { 1:"S1BA",2:"S2AA",3:"S3SA",4:"S4PRA" };
const CRIT_COLORS:Record<string,string> = { High:"",Medium:"",Low:"" }; // unused

function Badge({label,color="#333",textColor="#ccc"}:{label:string;color?:string;textColor?:string}){return <span style={{fontSize:11,padding:"2px 8px",borderRadius:9999,fontWeight:600,background:color,color:textColor,border:`1px solid ${textColor}33`}}>{label}</span>;}
function YN({v}:{v:string}){const lv=(v||"").toLowerCase();const bg=lv==="yes"?"rgba(0,217,146,0.15)":lv==="no"?"rgba(239,68,68,0.15)":"rgba(255,255,255,0.08)";const tc=lv==="yes"?"#00d992":lv==="no"?"#ef4444":"#aaa";return <Badge label={v||"—"} color={bg} textColor={tc}/>;}
function KV({label,value,accent=false}:{label:string;value?:string|null;accent?:boolean}){return(<div className="flex flex-col"><span className="text-xs font-medium mb-1 block" style={{color:"#ccc"}}>{label}</span><span className={`text-sm mt-0.5 ${accent?"font-bold":"" } ${!value?"text-xs font-normal":""}`} style={{color:value?(accent?"#9da2fb":"rgba(255,255,255,0.85)"):"rgba(255,255,255,0.25)"}}>{value||"—"}</span></div>);}
function SHead({title}:{title:string}){return <div className="flex items-center gap-2 mb-5"><div className="w-1 h-5 rounded" style={{background:"#494fdf"}}/><h3 className="text-sm font-bold uppercase tracking-wide" style={{color:"#f0f0f0"}}>{title}</h3></div>;}
function Card({children,className=""}:{children:React.ReactNode;className?:string}){return <div className={`rounded-2xl border p-7 ${className}`} style={{background:"#16181a",borderColor:"rgba(255,255,255,0.08)"}}>{children}</div>;}
function Tbl({headers,rows}:{headers:string[];rows:(string|React.ReactNode)[][]}){
  if(!rows.length)return <p className="text-xs italic" style={{color:"#999"}}>No data</p>;
  return(<div className="overflow-x-auto"><table className="w-full text-xs border-collapse">
    <thead><tr>{headers.map(h=><th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.08)",color:"#ccc"}}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((row,i)=><tr key={i} style={{background:i%2===0?"transparent":"rgba(255,255,255,0.02)"}}>{row.map((cell,j)=><td key={j} className="px-4 py-3 align-top" style={{borderBottom:"1px solid rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.75)"}}>{cell}</td>)}</tr>)}</tbody>
  </table></div>);
}
function PdfBtn({doc,stage,onView}:{doc:StageDoc|null|undefined;stage:number;onView:(url:string,title:string)=>void}){
  const cls=["","text-green-700 border-green-200 bg-green-50","text-indigo-700 border-indigo-200 bg-indigo-50","text-violet-700 border-violet-200 bg-violet-50","text-amber-700 border-amber-200 bg-amber-50"];
  if(!doc?.document_id)return null;
  return <button onClick={()=>onView(`/api/castateintel/pdf/${doc.document_id}`,doc.filename)} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border font-medium ${cls[stage]||cls[1]}`}>📄 View PDF</button>;
}

const TABS = [
  {id:"overview",label:"Overview"},
  {id:"s1",label:"Stage 1"},
  {id:"s2",label:"Stage 2"},
  {id:"s3",label:"Stage 3"},
  {id:"s4",label:"Stage 4"},
  {id:"procurements",label:"Procurements"},
  {id:"contacts",label:"Contacts"},
];

interface Props { defaultTab?: string; defaultProject?: string; }

export default function ProjectSummaryInline({ defaultTab="overview", defaultProject="" }: Props) {
  const [projects, setProjects] = useState<{project_number:string;name:string}[]>([]);
  const [projectNumber, setProjectNumber] = useState(defaultProject);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(defaultTab);
  const [pdfModal, setPdfModal] = useState<{url:string;title:string}|null>(null);
  const [extracting, setExtracting] = useState(false);

  useEffect(()=>{
    fetch("/api/castateintel/projects").then(r=>r.json()).then(d=>{
      const list=Array.isArray(d)?d:d.projects||[];
      setProjects(list);
      if(!projectNumber&&list.length>0) setProjectNumber(list[0].project_number);
    });
  },[]);

  const loadProject = useCallback(async(pn:string)=>{
    if(!pn)return;
    setLoading(true);setData(null);
    try{
      const [r1,r2,r3,r4,rc]=await Promise.all([
        fetch(`/api/castateintel/analysis/${pn}/1`).then(r=>r.json()),
        fetch(`/api/castateintel/analysis/${pn}/2`).then(r=>r.json()),
        fetch(`/api/castateintel/analysis/${pn}/3`).then(r=>r.json()),
        fetch(`/api/castateintel/analysis/${pn}/4`).then(r=>r.json()),
        fetch(`/api/castateintel/contacts?project=${pn}`).then(r=>r.json()),
      ]);
      setData({
        project:r1.project||r2.project||r3.project||r4.project,
        s1:r1.extracted?{...r1.analysis,document:r1.document}:null,
        s2:r2.extracted?{...r2.analysis,document:r2.document}:null,
        s3:r3.extracted?{...r3.analysis,document:r3.document}:null,
        s4:r4.extracted?{...r4.analysis,document:r4.document}:null,
        contacts:rc.contacts||[],
      });
    }catch{}
    setLoading(false);
  },[]);

  useEffect(()=>{if(projectNumber)loadProject(projectNumber);},[projectNumber,loadProject]);

  const handleExtract = async()=>{
    setExtracting(true);
    const stageNum = tab==="s1"?1:tab==="s2"?2:tab==="s3"?3:tab==="s4"?4:null;
    try{
      await fetch("/api/castateintel/analysis/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({project_number:projectNumber,stage:stageNum})});
      await loadProject(projectNumber);
    }catch{}
    setExtracting(false);
  };

  const p=data?.project; const s1=data?.s1; const s2=data?.s2; const s3=data?.s3; const s4=data?.s4; const contacts=data?.contacts||[];
  const tags=s2?.solution_tags||[]; const ancillary=s3?.ancillary_procurements||[];
  const recommended=s2?.viable_solutions?.find((v:any)=>v.recommended)||s2?.viable_solutions?.[0];
  const totalVal=s1?.funding_raw?.total_estimate||s4?.solicitation_results?.total_contract_cost||"—";
  const oneTime=s2?.financial_analysis?.cost_table?.find((r:any)=>r.category?.toLowerCase().includes("one"))?.total||"—";
  const ongoing=s2?.financial_analysis?.cost_table?.find((r:any)=>r.category?.toLowerCase().includes("continu")||r.category?.toLowerCase().includes("ongoing"))?.total||"—";
  const duration=s3?.procurements_roadmap?.total_duration||"—";
  const stageInfo=[{num:1,has:!!s1,doc:s1?.document},{num:2,has:!!s2,doc:s2?.document},{num:3,has:!!s3,doc:s3?.document},{num:4,has:!!s4,doc:s4?.document}];
  const currentStageNum=tab==="s1"?1:tab==="s2"?2:tab==="s3"?3:tab==="s4"?4:null;
  const currentStageExtracted=currentStageNum?stageInfo[currentStageNum-1]?.has:false;

  return(
    <div className="psi-dark" style={{minHeight:"100vh",background:"#000000",color:"#ffffff"}}>
      <RvtNav />
      {/* PDF Modal */}
      {pdfModal&&(<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><div className="rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col"><div className="flex items-center justify-between px-4 py-3 border-b"><span className="text-sm font-semibold">{pdfModal.title}</span><button onClick={()=>setPdfModal(null)} className="text-xl text-gray-400 hover:text-gray-700 px-2">✕</button></div><iframe src={pdfModal.url} className="flex-1 w-full"/></div></div>)}

      {/* Header */}
      <div style={{background:"var(--vg-canvas-soft)",borderBottom:"1px solid var(--vg-hairline)",padding:"12px 40px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <a href="/CAStateIntel" style={{color:"var(--vg-primary)",fontSize:13,textDecoration:"none",fontWeight:500}}>← Dashboard</a>
          <span style={{color:"var(--vg-mute)"}}>·</span>
          <span style={{fontSize:13,color:"var(--vg-mute)"}}>{p?.project_number||"Select a project"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <h1 style={{fontSize:17,fontWeight:600,color:"var(--vg-ink-strong)",letterSpacing:"-0.3px",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {p?`${p.project_number} — ${p.name}`:""}
          </h1>
          {p&&<div style={{display:"flex",gap:6,flexShrink:0}}>
            {([{s:1,l:"S1BA"},{s:2,l:"S2AA"},{s:3,l:"S3SA"},{s:4,l:"S4PRA"}] as {s:number;l:string}[]).map(({s,l})=>{
              const has=s===1?!!s1:s===2?!!s2:s===3?!!s3:!!s4;
              return <button key={s} onClick={()=>setTab(`s${s}`)} style={{padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:"1px solid",borderColor:tab===`s${s}`?"var(--vg-primary)":has?"var(--vg-hairline)":"rgba(61,58,57,0.3)",background:tab===`s${s}`?"rgba(0,217,146,0.12)":"transparent",color:tab===`s${s}`?"var(--vg-primary)":has?"var(--vg-ink)":"var(--vg-mute)",opacity:has?1:0.4}}>{l}{has?" ✓":"—"}</button>;
            })}
          </div>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-white/10 sticky top-[108px] z-10" style={{background:"#16181a"}}>
        <div className="flex overflow-x-auto">
          {TABS.map(t=>{
            const count=t.id==="contacts"?contacts.length:t.id==="procurements"?ancillary.length:0;
            return(<button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
                ${tab===t.id?"border-indigo-500 text-white":"border-transparent"}`} style={tab===t.id?{color:"#ffffff"}:{color:"#ccc"}}>
              {t.label}{count>0&&<span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{background:"rgba(73,79,223,0.2)",color:"#9da2fb"}}>{count}</span>}
            </button>);
          })}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-10 py-10">
        {loading&&<div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>}
        {!loading&&!data&&projectNumber&&<Card><p className="text-gray-400">No analysis data found for this project.</p></Card>}
        {!loading&&!projectNumber&&<Card className="text-center py-12"><p className="text-gray-400 text-lg">Select a project from the dropdown above</p></Card>}

        {!loading&&data&&(<>
          {/* ── OVERVIEW ── */}
          {tab==="overview"&&(<div className="space-y-7">
            <div className="grid grid-cols-4 gap-6">
              {[{label:"Total Project Value",value:totalVal,accent:true},{label:"One Time Cost",value:oneTime},{label:"Continuing Cost",value:ongoing},{label:"Project Duration",value:duration}].map(c=>(
                <Card key={c.label} className="flex flex-col"><span className="text-xs text-gray-400 font-medium mb-1">{c.label}</span><span className={`text-lg font-bold ${c.accent?"text-blue-900":"text-gray-800"} ${c.value==="—"?"text-gray-300 font-normal text-sm":""}`}>{c.value}</span></Card>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-6">
              <Card><SHead title="Analysis Status"/>
                <div className="space-y-4">{stageInfo.map(s=>(
                  <div key={s.num} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${s.has?"bg-green-500":"bg-gray-200"}`}/><span className="text-sm text-gray-700">Stage {s.num} — {["","Business Analysis","Alternative Analysis","Solution Analysis","Project Readiness"][s.num]}</span></div>
                    <div className="flex items-center gap-2">
                      {s.has?<><button onClick={()=>setTab(`s${s.num}`)} className={`text-xs px-2 py-0.5 rounded border font-medium ${STAGE_COLORS[s.num]}`}>View</button>{s.doc&&<button onClick={()=>s.doc&&setPdfModal({url:`/api/castateintel/pdf/${s.doc.document_id}`,title:s.doc.filename})} className="text-xs text-gray-400 hover:text-gray-600">📄</button>}</>
                      :<span className="text-xs text-gray-400">Not extracted</span>}
                    </div>
                  </div>
                ))}</div>
              </Card>
              <Card><SHead title="Solution Tags"/>
                {tags.length>0?<div className="flex flex-wrap gap-2">{tags.map((t:Tag,i:number)=><span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${TAG_COLORS[t.category]||"bg-gray-100 text-gray-600"}`}>{t.tag}</span>)}</div>
                :<p className="text-sm text-gray-400">Extract Stage 2 to see solution tags</p>}
              </Card>
              <Card><SHead title="Key Dates"/>
                <div className="space-y-3">{[
                  ["S1 — Execution Start",s1?.proposed_execution_start],
                  ["S1 — Form Accepted",s1?.dot_dates?.find((d:DotDate)=>d.label?.toLowerCase().includes("accept"))?.date],
                  ["S3 — Form Accepted",s3?.dot_dates?.find((d:DotDate)=>d.label?.toLowerCase().includes("accept"))?.date],
                  ["S4 — Contract Start",s4?.solicitation_results?.contract_start_date],
                  ["S4 — Contract End",s4?.solicitation_results?.contract_end_date],
                ].map(([label,val])=>(
                  <div key={String(label)} className="flex items-center justify-between text-xs"><span className="text-gray-500">{label}</span><span className={`font-medium ${val?"text-gray-800":"text-gray-300"}`}>{fmt(val as string)||"—"}</span></div>
                ))}</div>
              </Card>
            </div>
            {(recommended||s4?.solicitation_results?.selected_vendor)&&(
              <div className="grid grid-cols-2 gap-6">
                {recommended&&<Card><SHead title="Recommended Solution (S2)"/>
                  <div className="flex items-start justify-between mb-2"><h4 className="font-bold text-indigo-900 text-sm">{recommended.name}</h4>{recommended.estimated_cost&&<Badge label={recommended.estimated_cost} color="bg-indigo-50 text-indigo-700"/>}</div>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{recommended.summary}</p>
                </Card>}
                {s4?.solicitation_results?.selected_vendor&&<Card><SHead title="Selected Vendor (S4)"/>
                  <div className="space-y-3"><KV label="Vendor" value={s4.solicitation_results.selected_vendor} accent/><KV label="Contract #" value={s4.solicitation_results.contract_number}/><KV label="Total Contract Cost" value={s4.solicitation_results.total_contract_cost}/><KV label="Period" value={`${fmt(s4.solicitation_results.contract_start_date)} → ${fmt(s4.solicitation_results.contract_end_date)}`}/></div>
                </Card>}
              </div>
            )}
          </div>)}

          {/* ── STAGE 1 ── */}
          {tab==="s1"&&(<div className="space-y-7">
            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Badge label="Stage 1 — Business Analysis" color="bg-green-100 text-green-800"/>{s1?.doc_created_date&&<span className="text-xs text-gray-400">Created {fmt(s1.doc_created_date)}</span>}</div><PdfBtn doc={s1?.document} stage={1} onView={(u,t)=>setPdfModal({url:u,title:t})}/></div>
            {!s1?<Card><p className="text-gray-400">Not yet extracted.</p></Card>:(<>
              <div className="grid grid-cols-2 gap-6"><Card><SHead title="General Summary"/><p className="text-sm text-gray-700 leading-relaxed">{s1.general_info_summary||"—"}</p></Card><Card><SHead title="Business Program"/><p className="text-sm text-gray-700 leading-relaxed">{s1.business_program_summary||"—"}</p></Card></div>
              <div className="grid grid-cols-2 gap-6"><Card><SHead title="Project Justification"/><p className="text-sm text-gray-700 leading-relaxed">{s1.justification_summary||"—"}</p></Card><Card><SHead title="Business Outcomes"/>{s1.outcomes_raw?.length>0?<Tbl headers={["Outcome","Metric","Target"]} rows={s1.outcomes_raw.map((o:any)=>[o.outcome,o.metric,o.target])}/>:<p className="text-sm text-gray-700">{s1.outcomes_summary||"—"}</p>}</Card></div>
              <div className="grid grid-cols-3 gap-6">
                <Card><SHead title="Complexity"/>{s1.complexity_raw?.length>0?<Tbl headers={["Dimension","Score"]} rows={s1.complexity_raw.map((c:any)=>[c.dimension,c.score])}/>:<p className="text-sm text-gray-700">{s1.complexity_summary||"—"}</p>}</Card>
                <Card><SHead title="Funding (ROM)"/>{s1.rom_estimate?.length>0?<Tbl headers={["Category","Amount"]} rows={s1.rom_estimate.map((r:any)=>[r.category,r.amount])}/>:<p className="text-sm text-gray-700">{s1.funding_summary||"—"}</p>}</Card>
                <Card><SHead title="CDT Dates"/>{s1.dot_dates?.length>0?<div className="space-y-2">{s1.dot_dates.map((d:DotDate,i:number)=><div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{d.label}</span><span className="font-medium">{fmt(d.date)||d.date}</span></div>)}</div>:<p className="text-xs text-gray-400">—</p>}</Card>
              </div>
              {s1.stakeholders?.length>0&&<Card><SHead title="Stakeholders"/><Tbl headers={["Name","Organization","Role","Interest"]} rows={s1.stakeholders.map((s:any)=>[s.name,s.organization,s.role,s.interest])}/></Card>}
            </>)}
          </div>)}

          {/* ── STAGE 2 ── */}
          {tab==="s2"&&(<div className="space-y-7">
            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Badge label="Stage 2 — Alternative Analysis" color="bg-indigo-100 text-indigo-800"/>{s2?.doc_created_date&&<span className="text-xs text-gray-400">Created {fmt(s2.doc_created_date)}</span>}</div><PdfBtn doc={s2?.document} stage={2} onView={(u,t)=>setPdfModal({url:u,title:t})}/></div>
            {!s2?<Card><p className="text-gray-400">Not yet extracted.</p></Card>:(<>
              <div className="grid grid-cols-2 gap-6"><Card><SHead title="Baseline / Current State"/><p className="text-sm text-gray-700 leading-relaxed">{s2.baseline_summary||"—"}</p></Card><Card><SHead title="Requirements"/><p className="text-sm text-gray-700 leading-relaxed">{s2.requirements_summary||"—"}</p></Card></div>
              <Card><SHead title="Market Research"/><p className="text-sm text-gray-700 leading-relaxed">{s2.market_research_summary||"—"}</p></Card>
              <Card><SHead title="Viable Solutions"/><div className="space-y-4">{s2.viable_solutions?.map((sol:any,i:number)=>(
                <div key={i} className={`rounded-lg p-4 border-2 ${sol.recommended?"border-indigo-400 bg-indigo-50":"border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2"><h4 className="font-bold text-sm">{sol.name}</h4><div className="flex gap-2">{sol.estimated_cost&&<Badge label={sol.estimated_cost} color="bg-gray-100 text-gray-700"/>}{sol.recommended&&<Badge label="✓ Recommended" color="bg-indigo-100 text-indigo-800"/>}</div></div>
                  <p className="text-xs text-gray-600 leading-relaxed mb-2">{sol.summary}</p>
                  <div className="grid grid-cols-2 gap-3">{sol.pros?.length>0&&<div><p className="text-xs font-semibold text-green-700 mb-1">Pros</p>{sol.pros.map((p:string,j:number)=><p key={j} className="text-xs text-gray-600">✓ {p}</p>)}</div>}{sol.cons?.length>0&&<div><p className="text-xs font-semibold text-red-600 mb-1">Cons</p>{sol.cons.map((c:string,j:number)=><p key={j} className="text-xs text-gray-600">✗ {c}</p>)}</div>}</div>
                </div>
              ))}</div></Card>
              <div className="grid grid-cols-2 gap-6">
                <Card><SHead title="Financial Analysis"/>{s2.financial_analysis?.cost_table?.length?<Tbl headers={["Category","Total"]} rows={s2.financial_analysis.cost_table.map((r:any)=>[r.category,r.total])}/>:<p className="text-xs text-gray-400">—</p>}{s2.financial_analysis?.npv&&<div className="mt-3 text-xs"><span className="text-gray-500">NPV:</span> <span className="font-semibold">{s2.financial_analysis.npv}</span></div>}</Card>
                <Card><SHead title="CDT Dates"/>{s2.dot_dates?.length>0?<div className="space-y-2">{s2.dot_dates.map((d:DotDate,i:number)=><div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{d.label}</span><span className="font-medium">{fmt(d.date)||d.date}</span></div>)}</div>:<p className="text-xs text-gray-400">—</p>}</Card>
              </div>
            </>)}
          </div>)}

          {/* ── STAGE 3 ── */}
          {tab==="s3"&&(<div className="space-y-7">
            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Badge label="Stage 3 — Solution Analysis" color="bg-violet-100 text-violet-800"/>{s3?.doc_created_date&&<span className="text-xs text-gray-400">Created {fmt(s3.doc_created_date)}</span>}</div><PdfBtn doc={s3?.document} stage={3} onView={(u,t)=>setPdfModal({url:u,title:t})}/></div>
            {!s3?<Card><p className="text-gray-400">Not yet extracted.</p></Card>:(<>
              <Card><SHead title="Solution Requirements"/><p className="text-sm text-gray-700 leading-relaxed">{s3.solution_requirements_summary||"—"}</p></Card>
              <div className="grid grid-cols-2 gap-6">
                <Card><SHead title="Primary Solicitation"/><div className="space-y-3">{Object.entries(s3.primary_solicitation_raw||{}).filter(([,v])=>v&&v!=="null").map(([k,v])=><div key={k} className="flex justify-between text-xs"><span className="text-gray-500 capitalize">{k.replace(/_/g," ")}</span><span className="font-medium">{String(v)}</span></div>)}</div></Card>
                <Card><SHead title="CDT Dates"/>{s3.dot_dates?.length>0?<div className="space-y-2">{s3.dot_dates.map((d:DotDate,i:number)=><div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{d.label}</span><span className="font-medium">{fmt(d.date)||d.date}</span></div>)}</div>:<p className="text-xs text-gray-400">—</p>}</Card>
              </div>
              {s3.procurements_roadmap?.phases?.length>0&&<Card><SHead title="Roadmap"/><Tbl headers={["Phase","Start","End","Description"]} rows={s3.procurements_roadmap.phases.map((p:any)=>[p.phase,fmt(p.start_date)||p.start_date,fmt(p.end_date)||p.end_date,p.description])}/></Card>}
              {s3.procurements_roadmap?.key_milestones?.length>0&&<Card><SHead title="Key Milestones"/><Tbl headers={["Milestone","Date","Type"]} rows={s3.procurements_roadmap.key_milestones.map((m:any)=>[m.milestone,fmt(m.date)||m.date,m.type])}/></Card>}
            </>)}
          </div>)}

          {/* ── STAGE 4 ── */}
          {tab==="s4"&&(<div className="space-y-7">
            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Badge label="Stage 4 — Project Readiness" color="bg-amber-100 text-amber-800"/>{s4?.doc_created_date&&<span className="text-xs text-gray-400">Created {fmt(s4.doc_created_date)}</span>}</div><PdfBtn doc={s4?.document} stage={4} onView={(u,t)=>setPdfModal({url:u,title:t})}/></div>
            {!s4?<Card><p className="text-gray-400">Not yet extracted.</p></Card>:(<>
              <div className="grid grid-cols-3 gap-6"><Card><KV label="Selected Vendor" value={s4.solicitation_results?.selected_vendor} accent/></Card><Card><KV label="Total Contract Cost" value={s4.solicitation_results?.total_contract_cost} accent/></Card><Card><KV label="Contract Period" value={`${fmt(s4.solicitation_results?.contract_start_date)||"—"} → ${fmt(s4.solicitation_results?.contract_end_date)||"—"}`}/></Card></div>
              <div className="grid grid-cols-2 gap-6">
                <Card><SHead title="Schedule Baseline"/><Tbl headers={["","Proposed","Baseline","Variance"]} rows={[["Start",fmt(s4.schedule_baseline?.proposed_project_start)||"—",fmt(s4.schedule_baseline?.baseline_project_start)||"—",s4.schedule_baseline?.start_variance||"—"],["End",fmt(s4.schedule_baseline?.proposed_project_end)||"—",fmt(s4.schedule_baseline?.baseline_project_end)||"—",s4.schedule_baseline?.end_variance||"—"]]}/>{s4.schedule_baseline?.variance_reasons&&<p className="text-xs text-amber-700 mt-2 bg-amber-50 p-2 rounded">{s4.schedule_baseline.variance_reasons}</p>}</Card>
                <Card><SHead title="Cost Baseline"/>{s4.cost_baseline?.cost_rows?.length>0?<Tbl headers={["Category","Proposed","Baseline","Variance"]} rows={s4.cost_baseline.cost_rows.map((r:any)=>[r.category,r.proposed,r.baseline,r.variance])}/>:<p className="text-xs text-gray-400">—</p>}</Card>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <Card><SHead title="Contract Management"/><Tbl headers={["Question","Answer"]} rows={(s4.contract_management||[]).map((r:any)=>[r.question,<YN key={r.question} v={r.answer}/>])}/></Card>
                <Card><SHead title="Organizational Readiness"/><Tbl headers={["Question","Answer"]} rows={(s4.org_readiness||[]).map((r:any)=>[r.question,<YN key={r.question} v={r.answer}/>])}/></Card>
              </div>
              {s4.objectives?.length>0&&<Card><SHead title="Business Objectives"/><Tbl headers={["ID","Objective","Metric","Target","Valuation"]} rows={s4.objectives.map((o:any)=>[<strong key={o.id} className="text-amber-700">{o.id}</strong>,o.objective_summary,o.metric,o.target_result,o.valuation_pct])}/></Card>}
              {s4.risk_register?.length>0&&<Card><SHead title="Risk Register"/><Tbl headers={["Risk","Probability","Impact","Mitigation"]} rows={s4.risk_register.map((r:any)=>[r.risk,<Badge key={r.risk_id} label={r.probability||"—"} color={RISK_COLORS[r.probability]||"bg-gray-100 text-gray-600"}/>,<Badge key={r.risk_id+"i"} label={r.impact||"—"} color={RISK_COLORS[r.impact]||"bg-gray-100 text-gray-600"}/>,r.mitigation])}/></Card>}
              <div className="grid grid-cols-2 gap-6">
                <Card><SHead title="Project Readiness"/><div className="space-y-3"><KV label="Methodology" value={s4.project_readiness?.methodology}/><KV label="OTech Engaged" value={s4.project_readiness?.otech_engaged}/>{s4.project_readiness?.methodology_description&&<p className="text-xs mt-3 leading-relaxed" style={{color:"#e0e0e0"}}>{s4.project_readiness.methodology_description}</p>}</div></Card>
                <Card><SHead title="CDT Use Only"/>{s4.dot_dates?.length>0&&<div className="space-y-1 mb-3">{s4.dot_dates.map((d:DotDate,i:number)=><div key={i} className="flex justify-between text-xs"><span className="text-gray-500">{d.label}</span><span className="font-medium">{fmt(d.date)||d.date}</span></div>)}</div>}{s4.dot_raw&&<div className="space-y-2">{s4.dot_raw.form_status&&<div className="flex justify-between text-xs"><span className="text-gray-500">Form Status</span><Badge label={s4.dot_raw.form_status} color="bg-indigo-100 text-indigo-700"/></div>}{s4.dot_raw.form_disposition&&<div className="flex justify-between text-xs"><span className="text-gray-500">Disposition</span><Badge label={s4.dot_raw.form_disposition} color="bg-green-50 text-green-700"/></div>}</div>}</Card>
              </div>
            </>)}
          </div>)}

          {/* ── PROCUREMENTS ── */}
          {tab==="procurements"&&(<div className="space-y-7">
            {!s3?<Card><p className="text-gray-400">Not yet extracted.</p></Card>:(<>
              {s3.primary_solicitation_raw&&<Card><SHead title="Primary Solicitation"/><div className="grid grid-cols-3 gap-6">{Object.entries(s3.primary_solicitation_raw).filter(([,v])=>v&&v!=="null").map(([k,v])=><KV key={k} label={k.replace(/_/g," ").replace(/\b\w/g,(l:string)=>l.toUpperCase())} value={String(v)}/>)}</div></Card>}
              {ancillary.length===0?<Card><p className="text-gray-400">No ancillary procurements.</p></Card>
              :<div className="grid grid-cols-2 gap-6">{ancillary.map((ap:AncillaryProc,i:number)=>(
                <Card key={i}><div className="flex items-start justify-between mb-2"><h4 className="font-semibold text-sm">{ap.name}</h4>{ap.estimated_value&&<Badge label={ap.estimated_value} color="bg-violet-50 text-violet-700"/>}</div>
                  {ap.procurement_type&&<Badge label={ap.procurement_type} color="bg-gray-100 text-gray-600"/>}
                  {ap.timeline&&<p className="text-xs text-violet-700 mt-2">📅 {ap.timeline}</p>}
                  {ap.vendor_or_source&&<p className="text-xs text-gray-500 mt-1">Vendor: {ap.vendor_or_source}</p>}
                  {ap.description&&<p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-3">{ap.description}</p>}
                </Card>
              ))}</div>}
            </>)}
          </div>)}

          {/* ── CONTACTS ── */}
          {tab==="contacts"&&(<div>
            {contacts.length===0
              ?<Card><p style={{color:"#bbb",padding:"24px 16px"}}>No contacts extracted yet.</p></Card>
              :<div style={{overflowX:"auto",borderRadius:10,border:"1px solid #2a2a2a",background:"#161616"}}>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{borderBottom:"2px solid #2a2a2a",background:"#111",textAlign:"left"}}>
                      <th style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>Name</th>
                      <th style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>Title</th>
                      <th style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>Organization</th>
                      <th style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>Email</th>
                      <th style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>Phone</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c:Contact,i:number)=>(
                      <tr key={i} className="border-b transition-colors" style={{borderColor:"rgba(255,255,255,0.05)",background:i%2===0?"transparent":"rgba(255,255,255,0.02)"}}>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{color:"rgba(255,255,255,0.9)"}}>{c.name||"—"}</td>
                        <td className="px-4 py-3 text-xs max-w-[220px]" style={{color:"#e0e0e0"}}>{c.title||"—"}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{color:"#d8d8d8"}}>{c.organization||"—"}</td>
                        <td className="px-4 py-3 text-xs">
                          {c.email?<a href={`mailto:${c.email}`} style={{color:"#9da2fb",textDecoration:"none"}} className="hover:underline">{c.email}</a>:<span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{color:"#d8d8d8"}}>{c.phone||"—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STAGE_COLORS[c.stage]||"bg-gray-100 text-gray-600"}`}>S{c.stage}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 bg-gray-50">{contacts.length} contact{contacts.length!==1?"s":""} total</div>
              </div>}
          </div>)}
        </>)}
      </div>
    </div>
  );
}
