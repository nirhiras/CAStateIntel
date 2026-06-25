'use client';
import { useEffect, useState } from 'react';
import RvtNav from '@/components/castateintel/RvtNav';

const T = {
  canvas:'#0d0d0d', surface:'#161616', surface2:'#1e1e1e', border:'#2a2a2a',
  accent:'#00d992', accentDim:'rgba(0,217,146,0.12)', accentBdr:'rgba(0,217,146,0.35)',
  ink:'#f0f0f0', mute:'#999', faint:'#444', red:'#ef4444', amber:'#f59e0b',
  font:'"Inter",system-ui,sans-serif', mono:'"SF Mono","Fira Code",monospace',
};

type Proc = {
  id:number; name:string; procurement_type:string; estimated_value:string;
  timeline:string; vendor_or_source:string; description:string; justification:string;
  start_date:string; project_id:number; project_number:string; project_name:string; stage:number;
};

function fmtVal(v:string) {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.]/g,''));
  if (!isNaN(n) && n > 0) return '$'+n.toLocaleString();
  return v;
}
function fmtDate(s:string) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

export default function ProcurementsPage() {
  const [procs, setProcs]     = useState<Proc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [projF, setProjF]     = useState('');
  const [typeF, setTypeF]     = useState('');
  const [view, setView]       = useState<'cards'|'table'>('cards');

  useEffect(() => {
    fetch('/api/castateintel/procurements').then(r=>r.json())
      .then(d=>{ setProcs(Array.isArray(d)?d:d.procurements||[]); setLoading(false); })
      .catch(()=>setLoading(false));
  }, []);

  const allProjs = [...new Set(procs.map(p=>p.project_number).filter(Boolean))].sort();
  const allTypes = [...new Set(procs.map(p=>p.procurement_type).filter(Boolean))].sort();

  const filtered = procs.filter(p=>
    (!search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())) &&
    (!projF || p.project_number === projF) &&
    (!typeF || p.procurement_type === typeF)
  );

  const withDates = filtered.filter(p=>p.start_date||p.timeline).length;

  return (
    <div style={{minHeight:'100vh',background:T.canvas,color:T.ink,fontFamily:T.font}}>
      <RvtNav/>
      {/* Header */}
      <div style={{borderBottom:`1px solid ${T.border}`,padding:'24px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',color:T.accent,fontWeight:600,marginBottom:4}}>Procurements</div>
          <h1 style={{fontSize:24,fontWeight:700,letterSpacing:'-0.5px',color:T.ink,margin:0}}>
            {loading?'Loading…':`${filtered.length} procurements`}
          </h1>
          <div style={{display:'flex',gap:24,marginTop:8}}>
            {[
              {v:procs.length,l:'Total'},
              {v:[...new Set(procs.map(p=>p.project_number))].length,l:'Projects'},
              {v:allTypes.length,l:'Types'},
              {v:withDates,l:'With Dates'},
            ].map(s=>(
              <span key={s.l} style={{fontSize:13,color:T.mute}}>
                <span style={{color:T.ink,fontWeight:700,marginRight:4}}>{s.v}</span>{s.l}
              </span>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {(['cards','table'] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              style={{padding:'7px 14px',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:T.font,
                border:`1px solid ${view===v?T.accentBdr:T.border}`,
                background:view===v?T.accentDim:T.canvas,
                color:view===v?T.accent:T.mute}}>
              {v==='cards'?'⊞ Cards':'☰ Table'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'12px 32px',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{position:'relative'}}>
          <svg style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)'}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.mute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, description…"
            style={{height:36,padding:'0 10px 0 30px',borderRadius:6,border:`1px solid ${T.border}`,background:T.canvas,color:T.ink,fontSize:13,fontFamily:T.font,outline:'none',width:240}}/>
        </div>
        <select value={projF} onChange={e=>setProjF(e.target.value)}
          style={{height:36,padding:'0 10px',borderRadius:6,border:`1px solid ${projF?T.accentBdr:T.border}`,background:projF?T.accentDim:T.canvas,color:projF?T.accent:T.ink,fontSize:13,fontFamily:T.font,cursor:'pointer',outline:'none'}}>
          <option value="">All Projects</option>
          {allProjs.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={typeF} onChange={e=>setTypeF(e.target.value)}
          style={{height:36,padding:'0 10px',borderRadius:6,border:`1px solid ${typeF?T.accentBdr:T.border}`,background:typeF?T.accentDim:T.canvas,color:typeF?T.accent:T.ink,fontSize:13,fontFamily:T.font,cursor:'pointer',outline:'none'}}>
          <option value="">All Types</option>
          {allTypes.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {(search||projF||typeF)&&(
          <button onClick={()=>{setSearch('');setProjF('');setTypeF('');}}
            style={{height:36,padding:'0 10px',borderRadius:6,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.08)',color:T.red,fontSize:13,cursor:'pointer',fontFamily:T.font}}>✕ Clear</button>
        )}
        <span style={{fontSize:13,color:T.mute,marginLeft:'auto'}}><span style={{color:T.ink,fontWeight:700}}>{filtered.length}</span> procurements</span>
      </div>

      {/* Content */}
      <div style={{padding:'24px 32px 64px'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:'80px 0',color:T.mute}}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:'80px 0',color:T.mute}}>No procurements found</div>
        ) : view === 'cards' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(480px,1fr))',gap:16}}>
            {filtered.map(p=>(
              <div key={p.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'20px 24px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <a href={`/CAStateIntel/stage${p.stage}?project=${p.project_number}&tab=overview`}
                    style={{fontSize:13,color:T.accent,textDecoration:'none',fontWeight:500}}>
                    {p.project_number} — {p.project_name}
                  </a>
                  {p.procurement_type && (
                    <span style={{fontSize:11,fontWeight:700,fontFamily:T.mono,padding:'2px 8px',borderRadius:4,background:'rgba(99,102,241,0.15)',color:'#818cf8',border:'1px solid rgba(99,102,241,0.3)',flexShrink:0,marginLeft:8}}>
                      {p.procurement_type}
                    </span>
                  )}
                </div>
                <div style={{fontSize:15,fontWeight:600,color:T.ink,marginBottom:6,lineHeight:1.4}}>{p.name}</div>
                {(p.start_date||p.timeline) && (
                  <div style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:T.accent,background:T.accentDim,border:`1px solid ${T.accentBdr}`,padding:'3px 10px',borderRadius:9999,marginBottom:10}}>
                    📅 {fmtDate(p.start_date) || p.timeline}
                  </div>
                )}
                {p.estimated_value && (
                  <div style={{fontSize:15,fontWeight:700,color:T.amber,marginBottom:8}}>{fmtVal(p.estimated_value)||p.estimated_value}</div>
                )}
                {p.description && (
                  <div style={{fontSize:13,color:T.mute,lineHeight:1.6,marginBottom:10,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                    {p.description}
                  </div>
                )}
                {(p.vendor_or_source||p.justification) && (
                  <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:6,fontSize:12,color:T.faint,lineHeight:1.5}}>
                    {p.vendor_or_source && <div>Vendor: <span style={{color:T.mute}}>{p.vendor_or_source}</span></div>}
                    {p.justification && <div style={{marginTop:4,color:T.faint,fontStyle:'italic'}}>{p.justification}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
                <thead>
                  <tr>
                    {['Project','Name','Type','Value','Start','Vendor'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.mute,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <td style={{padding:'12px 14px',fontSize:12,whiteSpace:'nowrap'}}>
                        <a href={`/CAStateIntel/stage${p.stage}?project=${p.project_number}&tab=overview`} style={{color:T.accent,textDecoration:'none'}}>{p.project_number}</a>
                      </td>
                      <td style={{padding:'12px 14px',fontSize:13,fontWeight:600,color:T.ink,maxWidth:260}}>{p.name}</td>
                      <td style={{padding:'12px 14px',fontSize:12,color:T.mute,whiteSpace:'nowrap'}}>{p.procurement_type||'—'}</td>
                      <td style={{padding:'12px 14px',fontSize:13,fontWeight:600,color:T.amber,whiteSpace:'nowrap'}}>{fmtVal(p.estimated_value)||'—'}</td>
                      <td style={{padding:'12px 14px',fontSize:12,color:T.mute,whiteSpace:'nowrap'}}>{fmtDate(p.start_date)||p.timeline||'—'}</td>
                      <td style={{padding:'12px 14px',fontSize:12,color:T.mute,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.vendor_or_source||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
