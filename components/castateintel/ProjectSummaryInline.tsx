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
const TAG_COLORS:Record<string,string> = { vendor:"bg-blue-100 text-blue-800",technology:"bg-purple-100 text-purple-800",approach:"bg-green-100 text-green-800",deployment:"bg-orange-100 text-orange-800" };
const RISK_COLORS:Record<string,string> = { High:"bg-red-100 text-red-800",Medium:"bg-yellow-100 text-yellow-800",Low:"bg-green-100 text-green-800" };
const STAGE_COLORS:Record<number,string> = { 1:"bg-sky-100 text-sky-700 border-sky-300",2:"bg-indigo-100 text-indigo-700 border-indigo-300",3:"bg-violet-100 text-violet-700 border-violet-300",4:"bg-amber-100 text-amber-700 border-amber-300" };
const STAGE_ABBREV:Record<number,string> = { 1:"S1BA",2:"S2AA",3:"S3SA",4:"S4PRA" };
const CRIT_COLORS:Record<string,string> = { High:"bg-red-100 text-red-700",Medium:"bg-yellow-100 text-yellow-700",Low:"bg-gray-100 text-gray-600" };

function Badge({label,color="bg-gray-100 text-gray-600"}:{label:string;color?:string}){return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;}
function YN({v}:{v:string}){const lv=(v||"").toLowerCase();return <Badge label={v||"—"} color={lv==="yes"?"bg-green-100 text-green-800":lv==="no"?"bg-red-100 text-red-700":"bg-gray-100 text-gray-500"}/>;}
function KV({label,value,accent=false}:{label:string;value?:string|null;accent?:boolean}){return(<div className="flex flex-col"><span className="text-xs font-medium mb-1 block" style={{color:"rgba(255,255,255,0.45)"}}>{label}</span><span className={`text-sm mt-0.5 ${accent?"font-bold":"" } ${!value?"text-xs font-normal":""}`} style={{color:value?(accent?"#9da2fb":"rgba(255,255,255,0.85)"):"rgba(255,255,255,0.25)"}}>{value||"—"}</span></div>);}
function SHead({title}:{title:string}){return <div className="flex items-center gap-2 mb-5"><div className="w-1 h-5 rounded" style={{background:"#494fdf"}}/><h3 className="text-sm font-bold uppercase tracking-wide" style={{color:"rgba(255,255,255,0.7)"}}>{title}</h3></div>;}
function Card({children,className=""}:{children:React.ReactNode;className?:string}){return <div className={`rounded-2xl border p-7 ${className}`} style={{background:"#16181a",borderColor:"rgba(255,255,255,0.08)"}}>{children}</div>;}
function Tbl({headers,rows}:{headers:string[];rows:(string|React.ReactNode)[][]}){
  if(!rows.length)return <p className="text-xs italic" style={{color:"rgba(255,255,255,0.3)"}}>No data</p>;
  return(<div className="overflow-x-auto"><table className="w-full text-xs border-collapse">
    <thead><tr>{headers.map(h=><th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.45)"}}>{h}</th>)}</tr></thead>
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
      <div style={{background:"var(--vg-canvas-soft)", borderBottom:"1px solid var(--vg-hairline)", padding:"16px 40px"}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
          <a href="/CAStateIntel" style={{color:"var(--vg-primary)", fontSize:13, textDecoration:"none", fontWeight:500}}>← Dashboard</a>
          <span style={{color:"var(--vg-hairline-soft)"}}>·</span>
          <a href="/CAStateIntel" style={{color:"var(--vg-mute)", fontSize:13, textDecoration:"none"}}>All Projects</a>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
          <div style={{flex:1, minWidth:0}}>
            <h1 style={{fontSize:18, fontWeight:600, color:"var(--vg-ink-strong)", letterSpacing:"-0.3px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {p?.project_number?`${p.project_number} — ${p.name}`:"Select a project"}
            </h1>
            {p&&<p style={{fontSize:13, color:"var(--vg-mute)", marginTop:2}}>{p.department_name}{p.agency_name&&p.agency_name!==p.department_name?` · ${p.agency_name}`:""}</p>}
          </div>
          {p&&(
            <div style={{display:"flex", gap:6, flexShrink:0}}>
              {([{stage:1,label:"S1BA"},{stage:2,label:"S2AA"},{stage:3,label:"S3SA"},{stage:4,label:"S4PRA"}] as {stage:number;label:string}[]).map(({stage:s,label})=>{
                const hasIt = s===1?!!s1:s===2?!!s2:s===3?!!s3:!!s4;
                return(<button key={s} onClick={()=>setTab(`s${s}`)}
                  style={{padding:"4px 10px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer",
                    border:"1px solid",
                    borderColor: tab===`s${s}` ? "var(--vg-primary)" : hasIt ? "var(--vg-hairline)" : "rgba(61,58,57,0.3)",
                    background: tab===`s${s}` ? "rgba(0,217,146,0.12)" : "transparent",
                    color: tab===`s${s}` ? "var(--vg-primary)" : hasIt ? "var(--vg-ink)" : "var(--vg-mute)",
                    opacity: hasIt ? 1 : 0.4,
                  }}>
                  {label}{hasIt?" ✓":"—"}
                </button>);
              })}
            </div>
          )}
          {selectedDoc&&<button onClick={()=>window.open(`/api/castateintel/pdf/${selectedDoc.document_id}`,"_blank")} style={{padding:"6px 14px", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer", background:"transparent", border:"1px solid var(--vg-hairline)", color:"var(--vg-ink)"}}>📄 View PDF</button>}
        </div>
      </div>
      
