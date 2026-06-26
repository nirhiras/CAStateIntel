'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

const T = {
  canvas:'#0d0d0d', surface:'#161616', border:'#2a2a2a',
  accent:'#00d992', accentDim:'rgba(0,217,146,0.12)', accentBdr:'rgba(0,217,146,0.35)',
  ink:'#f0f0f0', mute:'#cccccc', faint:'#aaaaaa', amber:'#f59e0b', red:'#ef4444',
  font:'"Inter",system-ui,sans-serif', mono:'"SF Mono","Fira Code",monospace',
};

type Project = {
  id:number; project_number:string; name:string; pal_stage:string; effective_stage:string;
  criticality_rating:string; department_name:string; agency_name:string;
  doc_count:number; has_s1:boolean; has_s2:boolean; has_s3:boolean;
  s1_doc_id:string|null; s2_doc_id:string|null; s3_doc_id:string|null;
};
type Stats = { total_projects:number; stage1_count:number; stage2_count:number; stage3_count:number; total_documents:number; };

const STAGE_LABEL: Record<string,string> = { 'Stage 1':'S1BA','Stage 2':'S2AA','Stage 3':'S3SA','Stage 4':'S4PRA' };
const CRIT_COLOR: Record<string,string> = { High:'#ef4444', Medium:'#f59e0b', Low:'#555' };
const STAGE_DOC_COLOR: Record<number,{bg:string;color:string}> = {
  1:{bg:'rgba(99,102,241,0.15)',color:'#818cf8'},
  2:{bg:'rgba(139,92,246,0.15)',color:'#a78bfa'},
  3:{bg:'rgba(0,217,146,0.15)',color:'#00d992'},
};

const TABS = ['Overview','All Contacts','All PAL Docs','All Ancillary Procurements'] as const;
type Tab = typeof TABS[number];


// ── Lightweight tab content loaders ──────────────────────────────────────────
function ContactsTab() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:'48px 0',color:'#cccccc'}}>
      <div style={{fontSize:32}}>👤</div>
      <div style={{fontSize:15,fontWeight:600,color:'#f0f0f0'}}>All Contacts</div>
      <p style={{fontSize:13,color:'#aaaaaa',textAlign:'center',maxWidth:400}}>
        View all contacts extracted from PAL documents across all projects and stages.
      </p>
      <a href="/CAStateIntel/contacts" style={{padding:'9px 20px',borderRadius:8,background:'rgba(0,217,146,0.12)',border:'1px solid rgba(0,217,146,0.35)',color:'#00d992',textDecoration:'none',fontSize:14,fontWeight:600}}>
        Open Contacts →
      </a>
    </div>
  );
}

function DocumentsTab() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:'48px 0',color:'#cccccc'}}>
      <div style={{fontSize:32}}>📄</div>
      <div style={{fontSize:15,fontWeight:600,color:'#f0f0f0'}}>All PAL Documents</div>
      <p style={{fontSize:13,color:'#aaaaaa',textAlign:'center',maxWidth:400}}>
        Browse and analyze all PAL Stage 1–4 documents uploaded across all projects.
      </p>
      <a href="/CAStateIntel/documents" style={{padding:'9px 20px',borderRadius:8,background:'rgba(0,217,146,0.12)',border:'1px solid rgba(0,217,146,0.35)',color:'#00d992',textDecoration:'none',fontSize:14,fontWeight:600}}>
        Open Documents →
      </a>
    </div>
  );
}

function ProcurementsTab({deptF}:{deptF:string}) {
  const href = `/CAStateIntel/procurements${deptF?`?dept=${encodeURIComponent(deptF)}`:''}`;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:'48px 0',color:'#cccccc'}}>
      <div style={{fontSize:32}}>📋</div>
      <div style={{fontSize:15,fontWeight:600,color:'#f0f0f0'}}>Procurements</div>
      <p style={{fontSize:13,color:'#aaaaaa',textAlign:'center',maxWidth:400}}>
        View all procurement opportunities extracted from Stage 3 Solution Analysis documents.
      </p>
      <a href={href} style={{padding:'9px 20px',borderRadius:8,background:'rgba(0,217,146,0.12)',border:'1px solid rgba(0,217,146,0.35)',color:'#00d992',textDecoration:'none',fontSize:14,fontWeight:600}}>
        Open Procurements →
      </a>
    </div>
  );
}

function PALInner() {
  const searchParams = useSearchParams();
  const initTab = (searchParams.get('tab') as Tab) || 'Overview';
  const initDept = searchParams.get('dept') || '';

  const [tab, setTab]         = useState<Tab>(initTab);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats]     = useState<Stats|null>(null);
  const [search, setSearch]   = useState('');
  const [stageF, setStageF]   = useState('');
  const [deptF, setDeptF]     = useState(initDept);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r=>r.json()).then(setStats);
    const params = new URLSearchParams();
    if (deptF) params.set('department', deptF);
    fetch(`/api/castateintel/projects?${params}`).then(r=>r.json())
      .then(d=>{ setProjects(Array.isArray(d)?d:d.projects||[]); setLoading(false); });
  }, [deptF]);

  const allDepts = [...new Set(projects.map((p:any)=>p.department_name).filter(Boolean))].sort();

  const filtered = projects.filter(p=>
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.project_number.includes(search)) &&
    (!stageF || (p.effective_stage||p.pal_stage) === stageF)
  );

  const effStage = (p:Project) => p.effective_stage || p.pal_stage;

  return (
    <div style={{minHeight:'100vh',background:T.canvas,color:T.ink,fontFamily:T.font}}>
      

      {/* Header */}
      <div style={{padding:'32px 40px 0',borderBottom:`1px solid ${T.border}`}}>
        <div style={{maxWidth:1300,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:24,flexWrap:'wrap',paddingBottom:0}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:T.accent,marginBottom:6}}>PAL Projects</div>
              <h1 style={{fontSize:30,fontWeight:800,letterSpacing:'-0.5px',color:T.ink,margin:0}}>
                {deptF ? deptF : 'All Departments'}
              </h1>
              {deptF && (
                <button onClick={()=>setDeptF('')} style={{marginTop:6,fontSize:12,color:T.faint,background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:4}}>
                  ← All departments
                </button>
              )}
            </div>
            <div style={{display:'flex',gap:10,alignItems:'flex-start',paddingBottom:16}}>
              <a href="/CAStateIntel/upload" style={{padding:'8px 18px',borderRadius:8,background:'#00d992',color:'#0d0d0d',textDecoration:'none',fontSize:13,fontWeight:700,flexShrink:0,alignSelf:'flex-end',marginBottom:4}}>+ Upload PDF</a>
            </div>
            {stats && (
              <div style={{display:'flex',gap:8,paddingBottom:16}}>
                {[
                  {v:stats.total_projects,l:'Projects'},
                  {v:stats.stage3_count,l:'Stage 3',c:T.accent},
                  {v:stats.stage2_count,l:'Stage 2',c:'#a78bfa'},
                  {v:stats.stage1_count,l:'Stage 1',c:'#818cf8'},
                ].map(s=>(
                  <div key={s.l} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 16px',textAlign:'center',minWidth:72}}>
                    <div style={{fontSize:22,fontWeight:800,color:s.c||T.ink}}>{s.v}</div>
                    <div style={{fontSize:11,color:T.mute,marginTop:1}}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-tabs */}
          <div style={{display:'flex',gap:0,marginTop:16}}>
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                padding:'10px 20px', fontSize:13, fontWeight:tab===t?700:400, cursor:'pointer',
                color:tab===t?T.accent:T.mute, background:'transparent', border:'none',
                borderBottom:tab===t?`2px solid ${T.accent}`:'2px solid transparent',
                fontFamily:T.font, transition:'all 0.1s',
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{padding:'24px 40px 64px'}}>
        <div style={{maxWidth:1300,margin:'0 auto'}}>

          {tab==='Overview' && (
            <>
              {/* Filters */}
              <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
                <div style={{position:'relative'}}>
                  <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.mute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Project name or number…"
                    style={{height:36,padding:'0 12px 0 30px',borderRadius:6,border:`1px solid ${T.border}`,background:T.surface,color:T.ink,fontSize:13,fontFamily:T.font,outline:'none',width:240}}/>
                </div>
                <select value={stageF} onChange={e=>setStageF(e.target.value)}
                  style={{height:36,padding:'0 10px',borderRadius:6,border:`1px solid ${stageF?T.accentBdr:T.border}`,background:stageF?T.accentDim:T.surface,color:stageF?T.accent:T.ink,fontSize:13,fontFamily:T.font,cursor:'pointer',outline:'none'}}>
                  <option value="">All Stages</option>
                  {['Stage 1','Stage 2','Stage 3','Stage 4'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <select value={deptF} onChange={e=>setDeptF(e.target.value)}
                  style={{height:36,padding:'0 10px',borderRadius:6,border:`1px solid ${deptF?T.accentBdr:T.border}`,background:deptF?T.accentDim:T.surface,color:deptF?T.accent:T.ink,fontSize:13,fontFamily:T.font,cursor:'pointer',outline:'none',maxWidth:280}}>
                  <option value="">All Departments</option>
                  {allDepts.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
                {(search||stageF||deptF)&&(
                  <button onClick={()=>{setSearch('');setStageF('');setDeptF('');}}
                    style={{height:36,padding:'0 12px',borderRadius:6,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.08)',color:T.red,fontSize:13,cursor:'pointer',fontFamily:T.font}}>✕ Clear</button>
                )}
                <span style={{fontSize:13,color:T.mute,marginLeft:'auto'}}><b style={{color:T.ink}}>{filtered.length}</b> projects</span>
              </div>

              {/* Projects table */}
              {loading ? (
                <div style={{textAlign:'center',padding:'60px 0',color:T.mute}}>Loading…</div>
              ) : (
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        {['#','Project Name','Stage','Crit.','Department','Docs'].map(h=>(
                          <th key={h} style={{padding:'11px 16px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.mute,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length===0 ? (
                        <tr><td colSpan={6} style={{padding:48,textAlign:'center',color:T.mute}}>No projects found</td></tr>
                      ) : filtered.map(p=>{
                        const es = effStage(p);
                        return (
                          <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`}}
                            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(0,217,146,0.03)'}
                            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                            <td style={{padding:'13px 16px',fontFamily:T.mono,fontSize:12,whiteSpace:'nowrap'}}>
                              <a href={`/CAStateIntel/stage1?project=${p.project_number}&tab=overview`} style={{color:T.accent,textDecoration:'none',fontWeight:700}}>{p.project_number}</a>
                            </td>
                            <td style={{padding:'13px 16px',fontWeight:600,minWidth:300}}>
                              <a href={`/CAStateIntel/stage1?project=${p.project_number}&tab=overview`} style={{fontSize:14,lineHeight:1.4,color:T.ink,textDecoration:'none'}}
                                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.accent}
                                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.ink}>{p.name}</a>
                            </td>
                            <td style={{padding:'13px 16px'}}>
                              <span style={{fontSize:11,fontWeight:700,fontFamily:T.mono,padding:'3px 8px',borderRadius:5,background:T.accentDim,color:T.accent,border:`1px solid ${T.accentBdr}`}}>{STAGE_LABEL[es]||es}</span>
                            </td>
                            <td style={{padding:'13px 16px'}}>
                              {p.criticality_rating && <span style={{fontSize:12,fontWeight:600,color:CRIT_COLOR[p.criticality_rating]||T.mute}}>{p.criticality_rating}</span>}
                            </td>
                            <td style={{padding:'13px 16px',fontSize:13,color:T.mute,maxWidth:200}}>
                              <span style={{overflow:'hidden',textOverflow:'ellipsis',display:'block',whiteSpace:'nowrap'}}>{p.department_name}</span>
                            </td>
                            <td style={{padding:'13px 16px'}}>
                              <div style={{display:'flex',gap:4}}>
                                {([1,2,3] as const).map(n=>{
                                  const docId = n===1?p.s1_doc_id:n===2?p.s2_doc_id:p.s3_doc_id;
                                  if (!docId) return null;
                                  const sc = STAGE_DOC_COLOR[n];
                                  return <a key={n} href={`/api/castateintel/pdf/${docId}`} target="_blank" rel="noreferrer"
                                    style={{fontSize:11,fontWeight:700,fontFamily:T.mono,padding:'2px 7px',borderRadius:4,background:sc.bg,color:sc.color,border:`1px solid ${sc.color}44`,textDecoration:'none'}}>S{n}</a>;
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab==='All Contacts' && <ContactsTab/>}
          {tab==='All PAL Docs' && <DocumentsTab/>}
          {tab==='All Ancillary Procurements' && <ProcurementsTab deptF={deptF}/>}

        </div>
      </div>
    </div>
  );
}

export default function PALPage() {
  return <Suspense fallback={<div style={{height:'100vh',background:'#0d0d0d',display:'flex',alignItems:'center',justifyContent:'center',color:'#aaa'}}>Loading…</div>}><PALInner/></Suspense>;
}
