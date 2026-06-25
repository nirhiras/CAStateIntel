'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import RvtNav from '@/components/castateintel/RvtNav';

const T = {
  canvas:'#0d0d0d', surface:'#161616', border:'#2a2a2a',
  accent:'#00d992', accentDim:'rgba(0,217,146,0.12)', accentBdr:'rgba(0,217,146,0.35)',
  ink:'#f0f0f0', mute:'#cccccc', faint:'#aaaaaa', amber:'#f59e0b', red:'#ef4444',
  font:'"Inter",system-ui,sans-serif', mono:'"SF Mono","Fira Code",monospace',
  navBg: '#0f172a',
};

type Dept = {
  department_name: string; agency_name: string;
  project_count: number; stage1: number; stage2: number; stage3: number;
  doc_count: number; criticality_high: number;
};
type Stats = { total_projects:number; stage1_count:number; stage2_count:number; stage3_count:number; total_documents:number; };

const CRIT: Record<string,string> = { High:'#ef4444', Medium:'#f59e0b', Low:'#aaaaaa' };

export default function DashboardPage() {
  const [depts, setDepts]   = useState<Dept[]>([]);
  const [stats, setStats]   = useState<Stats|null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r=>r.json()).then(setStats);
    fetch('/api/castateintel/departments').then(r=>r.json())
      .then(d=>{ setDepts(Array.isArray(d)?d:[]); setLoading(false); })
      .catch(()=>setLoading(false));
  }, []);

  const filtered = depts.filter(d =>
    !search || d.department_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.agency_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{minHeight:'100vh',background:T.canvas,color:T.ink,fontFamily:T.font}}>
      <RvtNav/>
      {/* Hero */}
      <div style={{padding:'48px 40px 32px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{maxWidth:1300,margin:'0 auto',display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:32,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:T.accent,marginBottom:8}}>Dashboard</div>
            <h1 style={{fontSize:40,fontWeight:800,letterSpacing:'-1px',color:T.ink,margin:0,lineHeight:1.1}}>California State<br/>Departments</h1>
            <p style={{fontSize:15,color:T.mute,marginTop:10,lineHeight:1.6}}>All departments with active PAL IT project proposals</p>
          </div>
          {stats && (
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {[
                {v:stats.total_projects,l:'Projects',sub:'total'},
                {v:stats.total_documents,l:'Documents',sub:'uploaded'},
                {v:stats.stage3_count,l:'Stage 3',sub:'S3SA'},
                {v:stats.stage2_count,l:'Stage 2',sub:'S2AA'},
                {v:stats.stage1_count,l:'Stage 1',sub:'S1BA'},
              ].map(s=>(
                <div key={s.l} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 20px',textAlign:'center',minWidth:90}}>
                  <div style={{fontSize:28,fontWeight:800,letterSpacing:'-1px',color:T.ink}}>{s.v}</div>
                  <div style={{fontSize:12,color:T.mute,marginTop:2}}>{s.l}</div>
                  <div style={{fontSize:10,color:T.accent,fontWeight:700,fontFamily:T.mono,marginTop:2}}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'12px 40px',display:'flex',gap:12,alignItems:'center'}}>
        <div style={{maxWidth:1300,width:'100%',margin:'0 auto',display:'flex',gap:12,alignItems:'center'}}>
          <div style={{position:'relative',flex:1,maxWidth:340}}>
            <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.mute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search departments or agencies…"
              style={{height:36,padding:'0 12px 0 30px',borderRadius:6,border:`1px solid ${T.border}`,background:T.canvas,color:T.ink,fontSize:13,fontFamily:T.font,outline:'none',width:'100%'}}/>
          </div>
          <span style={{fontSize:13,color:T.mute,marginLeft:'auto'}}><b style={{color:T.ink}}>{filtered.length}</b> departments</span>
        </div>
      </div>

      {/* Dept grid */}
      <div style={{padding:'32px 40px 80px'}}>
        <div style={{maxWidth:1300,margin:'0 auto'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:'80px 0',color:T.mute}}>Loading departments…</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'80px 0',color:T.mute}}>No departments found</div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:14}}>
              {filtered.map((d,i)=>(
                <Link key={i} href={`/CAStateIntel/procurements?dept=${encodeURIComponent(d.department_name)}`}
                  style={{textDecoration:'none'}}>
                  <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'20px 22px',transition:'all 0.12s',cursor:'pointer'}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor=T.accentBdr}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor=T.border}>
                    {/* Agency label */}
                    {d.agency_name && (
                      <div style={{fontSize:11,color:T.faint,fontWeight:500,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.08em'}}>{d.agency_name}</div>
                    )}
                    {/* Dept name */}
                    <div style={{fontSize:15,fontWeight:700,color:T.ink,lineHeight:1.35,marginBottom:12}}>{d.department_name}</div>
                    {/* Stats row */}
                    <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                        <span style={{fontSize:20,fontWeight:800,color:T.ink}}>{d.project_count}</span>
                        <span style={{fontSize:11,color:T.faint}}>project{d.project_count!==1?'s':''}</span>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        {d.stage3>0 && <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'rgba(0,217,146,0.15)',color:T.accent,fontFamily:T.mono}}>S3×{d.stage3}</span>}
                        {d.stage2>0 && <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'rgba(139,92,246,0.15)',color:'#a78bfa',fontFamily:T.mono}}>S2×{d.stage2}</span>}
                        {d.stage1>0 && <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'rgba(99,102,241,0.15)',color:'#818cf8',fontFamily:T.mono}}>S1×{d.stage1}</span>}
                      </div>
                      {d.criticality_high > 0 && (
                        <span style={{fontSize:11,color:'#ef4444',fontWeight:600,marginLeft:'auto'}}>⚠ {d.criticality_high} High</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
