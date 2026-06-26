'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const T = {
  canvas:'#0d0d0d', surface:'#161616', border:'#2a2a2a',
  accent:'#00d992', accentDim:'rgba(0,217,146,0.12)', accentBdr:'rgba(0,217,146,0.35)',
  ink:'#f0f0f0', mute:'#cccccc', faint:'#555555', amber:'#f59e0b', red:'#ef4444',
  font:'"Inter",system-ui,sans-serif', mono:'"SF Mono","Fira Code",monospace',
  navBg:'#0f172a',
};

type Dept = {
  department_name:string; agency_name:string;
  project_count:number; stage1:number; stage2:number; stage3:number;
  doc_count:number; criticality_high:number;
};
type Stats = { total_projects:number; stage1_count:number; stage2_count:number; stage3_count:number; total_documents:number; };

function StagePill({label,count,bg,color}:{label:string;count:number;bg:string;color:string}) {
  if (!count) return null;
  return <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:bg,color,fontFamily:T.mono}}>{label}×{count}</span>;
}

export default function DashboardPage() {
  const [depts, setDepts]     = useState<Dept[]>([]);
  const [stats, setStats]     = useState<Stats|null>(null);
  const [search, setSearch]   = useState('');
  const [sortCol, setSortCol] = useState<'name'|'projects'|'docs'>('projects');
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r=>r.json()).then(setStats);
    fetch('/api/castateintel/departments').then(r=>r.json())
      .then(d=>{ setDepts(Array.isArray(d)?d:[]); setLoading(false); })
      .catch(()=>setLoading(false));
  }, []);

  const filtered = depts.filter(d =>
    !search ||
    d.department_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.agency_name?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a,b) => {
    let av:any, bv:any;
    if (sortCol==='name')     { av=a.department_name; bv=b.department_name; }
    else if (sortCol==='projects') { av=a.project_count; bv=b.project_count; }
    else                      { av=a.doc_count; bv=b.doc_count; }
    if (typeof av==='string') return sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);
    return sortDir==='asc'?av-bv:bv-av;
  });

  const toggleSort = (col: typeof sortCol) => {
    if (col===sortCol) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({col}:{col:typeof sortCol}) => sortCol!==col ? null : (
    <span style={{marginLeft:4,opacity:0.7}}>{sortDir==='asc'?'↑':'↓'}</span>
  );

  const TH = ({label,col,align='left'}:{label:string;col:typeof sortCol;align?:string}) => (
    <th onClick={()=>toggleSort(col)} style={{
      padding:'12px 16px', textAlign:align as any, fontSize:11, fontWeight:700,
      letterSpacing:'0.1em', textTransform:'uppercase', color:sortCol===col?T.accent:T.mute,
      background:'#111', borderBottom:`2px solid ${T.border}`, cursor:'pointer', whiteSpace:'nowrap',
      userSelect:'none',
    }}>
      {label}<SortIcon col={col}/>
    </th>
  );

  return (
    <div style={{minHeight:'100vh',background:T.canvas,color:T.ink,fontFamily:T.font}}>
      

      {/* Hero */}
      <div style={{padding:'40px 40px 28px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{maxWidth:1300,margin:'0 auto',display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:32,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:T.accent,marginBottom:8}}>Dashboard</div>
            <h1 style={{fontSize:36,fontWeight:800,letterSpacing:'-0.5px',color:T.ink,margin:0}}>California State Departments</h1>
            <p style={{fontSize:14,color:T.mute,marginTop:8}}>All departments with active PAL IT project proposals</p>
          </div>
          {stats && (
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {[
                {v:stats.total_projects,l:'Projects',sub:'total'},
                {v:stats.total_documents,l:'Documents',sub:'uploaded'},
                {v:stats.stage3_count,l:'Stage 3',sub:'S3SA'},
                {v:stats.stage2_count,l:'Stage 2',sub:'S2AA'},
                {v:stats.stage1_count,l:'Stage 1',sub:'S1BA'},
              ].map(s=>(
                <div key={s.l} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 18px',textAlign:'center',minWidth:84}}>
                  <div style={{fontSize:26,fontWeight:800,letterSpacing:'-1px',color:T.ink}}>{s.v}</div>
                  <div style={{fontSize:11,color:T.mute,marginTop:2}}>{s.l}</div>
                  <div style={{fontSize:10,color:T.accent,fontWeight:700,fontFamily:T.mono,marginTop:2}}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'10px 40px'}}>
        <div style={{maxWidth:1300,margin:'0 auto',display:'flex',gap:12,alignItems:'center'}}>
          <div style={{position:'relative',maxWidth:360,flex:1}}>
            <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.mute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search departments or agencies…"
              style={{height:36,padding:'0 12px 0 30px',borderRadius:6,border:`1px solid ${T.border}`,background:T.canvas,color:T.ink,fontSize:13,fontFamily:T.font,outline:'none',width:'100%'}}/>
          </div>
          <span style={{fontSize:13,color:T.mute,marginLeft:'auto'}}>
            <b style={{color:T.ink}}>{sorted.length}</b> departments
          </span>
        </div>
      </div>

      {/* Table */}
      <div style={{padding:'28px 40px 80px'}}>
        <div style={{maxWidth:1300,margin:'0 auto'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'60px 0',color:T.mute}}>Loading…</div>
          ) : (
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    <TH label="Department Name" col="name"/>
                    <th style={{padding:'12px 16px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.mute,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>
                      Agency
                    </th>
                    <TH label="PAL Docs" col="projects" align="center"/>
                    <th style={{padding:'12px 16px',textAlign:'center',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.mute,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>
                      BCP Docs
                    </th>
                    <th style={{padding:'12px 16px',textAlign:'center',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.mute,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>
                      Contract Award Data
                    </th>
                    <th style={{padding:'12px 16px',textAlign:'center',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.mute,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>
                      Stages
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((d,i)=>(
                    <tr key={i}
                      style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.surface:'#1a1a1a'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(0,217,146,0.04)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=i%2===0?T.surface:'#1a1a1a'}>
                      {/* Department name */}
                      <td style={{padding:'14px 16px',minWidth:240}}>
                        <Link href={`/CAStateIntel/procurements?dept=${encodeURIComponent(d.department_name)}`}
                          style={{textDecoration:'none'}}>
                          <div style={{fontSize:14,fontWeight:600,color:T.ink,lineHeight:1.35,cursor:'pointer'}}
                            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.accent}
                            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.ink}>
                            {d.department_name}
                          </div>
                        </Link>
                        {d.criticality_high>0 && (
                          <span style={{fontSize:10,color:'#ef4444',fontWeight:600,marginTop:2,display:'block'}}>⚠ {d.criticality_high} High criticality</span>
                        )}
                      </td>
                      {/* Agency */}
                      <td style={{padding:'14px 16px',fontSize:12,color:T.mute,maxWidth:200}}>
                        {d.agency_name||'—'}
                      </td>
                      {/* PAL Docs */}
                      <td style={{padding:'14px 16px',textAlign:'center'}}>
                        <Link href={`/CAStateIntel/procurements?dept=${encodeURIComponent(d.department_name)}`}
                          style={{textDecoration:'none',display:'inline-flex',flexDirection:'column',alignItems:'center',gap:4}}>
                          <span style={{fontSize:20,fontWeight:800,color:T.ink}}>{d.project_count}</span>
                          <span style={{fontSize:10,color:T.accent,fontWeight:600}}>projects</span>
                        </Link>
                      </td>
                      {/* BCP Docs — coming soon */}
                      <td style={{padding:'14px 16px',textAlign:'center'}}>
                        <Link href="/CAStateIntel/bcp" style={{textDecoration:'none'}}>
                          <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:'rgba(255,255,255,0.05)',color:T.faint,border:`1px solid ${T.border}`,cursor:'pointer'}}>
                            Coming Soon
                          </span>
                        </Link>
                      </td>
                      {/* Contract Award — coming soon */}
                      <td style={{padding:'14px 16px',textAlign:'center'}}>
                        <Link href="/CAStateIntel/contracts" style={{textDecoration:'none'}}>
                          <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:'rgba(255,255,255,0.05)',color:T.faint,border:`1px solid ${T.border}`,cursor:'pointer'}}>
                            Coming Soon
                          </span>
                        </Link>
                      </td>
                      {/* Stage breakdown */}
                      <td style={{padding:'14px 16px'}}>
                        <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'wrap'}}>
                          <StagePill label="S3" count={d.stage3} bg="rgba(0,217,146,0.15)" color={T.accent}/>
                          <StagePill label="S2" count={d.stage2} bg="rgba(139,92,246,0.15)" color="#a78bfa"/>
                          <StagePill label="S1" count={d.stage1} bg="rgba(99,102,241,0.15)" color="#818cf8"/>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
