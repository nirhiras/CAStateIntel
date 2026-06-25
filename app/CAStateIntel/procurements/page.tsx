'use client';
import { useEffect, useState, useMemo } from 'react';

const T = {
  canvas:'#0d0d0d', surface:'#161616', surface2:'#1e1e1e', border:'#2a2a2a',
  accent:'#00d992', accentDim:'rgba(0,217,146,0.12)', accentBdr:'rgba(0,217,146,0.35)',
  ink:'#f0f0f0', mute:'#cccccc', faint:'#aaaaaa', red:'#ef4444', amber:'#f59e0b',
  font:'"Inter",system-ui,sans-serif', mono:'"SF Mono","Fira Code",monospace',
};

type Proc = {
  id:number; name:string; procurement_type:string; estimated_value:string;
  timeline:string; vendor_or_source:string; description:string; justification:string;
  proposed_start_date:string; proposed_end_date:string; duration:string;
  solicitation_number:string; project_id:number; project_number:string; project_name:string; department_name:string; stage:number;
  source_doc_id:string; source_filename:string;
};

function fmtVal(v:string) {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.]/g,''));
  if (!isNaN(n) && n > 0) return '$'+n.toLocaleString();
  return v;
}
function fmtDate(s:string) {
  if (!s || s==='null') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function fmtDateShort(s:string) {
  if (!s || s==='null') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US',{month:'short',year:'numeric'});
}
function parseDate(s:string): Date|null {
  if (!s || s==='null') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const TYPE_STYLE: Record<string,{bg:string;color:string;border:string}> = {
  'RFO/MSA': {bg:'rgba(99,102,241,0.15)',color:'#818cf8',border:'rgba(99,102,241,0.3)'},
  'RFP':     {bg:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'rgba(245,158,11,0.3)'},
  'CMAS':    {bg:'rgba(0,217,146,0.15)', color:'#00d992',border:'rgba(0,217,146,0.3)'},
  'IFB':     {bg:'rgba(236,72,153,0.15)',color:'#f472b6',border:'rgba(236,72,153,0.3)'},
};

function TypeBadge({type}:{type:string}) {
  const s = TYPE_STYLE[type] || {bg:'rgba(255,255,255,0.08)',color:'#aaa',border:'rgba(255,255,255,0.15)'};
  return <span style={{fontSize:11,fontWeight:700,fontFamily:T.mono,padding:'2px 8px',borderRadius:4,background:s.bg,color:s.color,border:`1px solid ${s.border}`,flexShrink:0,whiteSpace:'nowrap'}}>{type}</span>;
}

function DateBar({start,end,timeline}:{start:string;end:string;timeline:string}) {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (!s && !e && !timeline) return null;
  return (
    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:10}}>
      {s && (
        <div style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,color:'#34d399',background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.3)',padding:'4px 10px',borderRadius:6}}>
          <span style={{fontSize:10,opacity:0.7,textTransform:'uppercase',letterSpacing:'0.05em'}}>Start</span>
          <span>{s}</span>
        </div>
      )}
      {e && (
        <div style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,color:'#f87171',background:'rgba(248,113,113,0.12)',border:'1px solid rgba(248,113,113,0.3)',padding:'4px 10px',borderRadius:6}}>
          <span style={{fontSize:10,opacity:0.7,textTransform:'uppercase',letterSpacing:'0.05em'}}>End</span>
          <span>{e}</span>
        </div>
      )}
      {!s && !e && timeline && (
        <div style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:600,color:T.accent,background:T.accentDim,border:`1px solid ${T.accentBdr}`,padding:'4px 10px',borderRadius:6}}>
          📅 {timeline.length > 40 ? timeline.slice(0,40)+'…' : timeline}
        </div>
      )}
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({procs}:{procs:Proc[]}) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay(); // 0=Sun
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build map: day → list of procs starting or ending that day
  const dayMap = useMemo(() => {
    const m: Record<number, {proc:Proc;type:'start'|'end'|'both'}[]> = {};
    for (const p of procs) {
      const s = parseDate(p.proposed_start_date);
      const e = parseDate(p.proposed_end_date);
      const addDay = (d:Date, type:'start'|'end') => {
        if (d.getFullYear()===year && d.getMonth()===month) {
          const day = d.getDate();
          if (!m[day]) m[day] = [];
          const existing = m[day].find(x=>x.proc.name===p.name);
          if (existing) existing.type = 'both';
          else m[day].push({proc:p,type});
        }
      };
      if (s) addDay(s,'start');
      if (e) addDay(e,'end');
    }
    return m;
  }, [procs, year, month]);

  // Sidebar: procs with dates in this month
  const monthProcs = useMemo(() => procs.filter(p => {
    const s = parseDate(p.proposed_start_date);
    const e = parseDate(p.proposed_end_date);
    const inMonth = (d:Date|null) => d && d.getFullYear()===year && d.getMonth()===month;
    return inMonth(s) || inMonth(e);
  }), [procs, year, month]);

  const [hoveredDay, setHoveredDay] = useState<number|null>(null);

  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{display:'flex',gap:20,alignItems:'flex-start'}}>
      {/* Calendar grid */}
      <div style={{flex:1,minWidth:0}}>
        {/* Month nav */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <button onClick={()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);}}
            style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${T.border}`,background:T.surface,color:T.ink,fontSize:14,cursor:'pointer'}}>‹</button>
          <span style={{fontSize:18,fontWeight:700,color:T.ink,minWidth:160,textAlign:'center'}}>{MONTHS[month]} {year}</span>
          <button onClick={()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);}}
            style={{padding:'6px 12px',borderRadius:6,border:`1px solid ${T.border}`,background:T.surface,color:T.ink,fontSize:14,cursor:'pointer'}}>›</button>
          <button onClick={()=>{setYear(today.getFullYear());setMonth(today.getMonth());}}
            style={{marginLeft:8,padding:'5px 12px',borderRadius:6,border:`1px solid ${T.accentBdr}`,background:T.accentDim,color:T.accent,fontSize:12,fontWeight:600,cursor:'pointer'}}>Today</button>
        </div>
        {/* Day headers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:2}}>
          {DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:11,fontWeight:700,color:T.faint,padding:'4px 0',letterSpacing:'0.08em'}}>{d}</div>)}
        </div>
        {/* Day cells */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
          {cells.map((day,i)=>{
            const events = day ? (dayMap[day]||[]) : [];
            const isToday = day && year===today.getFullYear() && month===today.getMonth() && day===today.getDate();
            const hasStart = events.some(e=>e.type==='start'||e.type==='both');
            const hasEnd   = events.some(e=>e.type==='end'||e.type==='both');
            const isHovered = day === hoveredDay;
            return (
              <div key={i}
                onMouseEnter={()=>day&&events.length>0?setHoveredDay(day):null}
                onMouseLeave={()=>setHoveredDay(null)}
                style={{
                  minHeight:72, borderRadius:6, padding:'6px 8px',
                  background: isHovered ? 'rgba(0,217,146,0.08)' : day ? T.surface : 'transparent',
                  border: isToday ? `1px solid ${T.accentBdr}` : `1px solid ${day?T.border:'transparent'}`,
                  cursor: events.length>0 ? 'pointer' : 'default',
                  position:'relative',
                }}>
                {day && (
                  <>
                    <div style={{fontSize:12,fontWeight:isToday?700:400,color:isToday?T.accent:T.mute,marginBottom:4}}>{day}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:2}}>
                      {events.slice(0,2).map((ev,j)=>(
                        <div key={j} style={{
                          fontSize:10,lineHeight:1.3,padding:'2px 4px',borderRadius:3,
                          background: ev.type==='start' ? 'rgba(52,211,153,0.2)' : ev.type==='end' ? 'rgba(248,113,113,0.2)' : 'rgba(99,102,241,0.2)',
                          color: ev.type==='start' ? '#34d399' : ev.type==='end' ? '#f87171' : '#818cf8',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                          borderLeft: `2px solid ${ev.type==='start'?'#34d399':ev.type==='end'?'#f87171':'#818cf8'}`,
                        }}>
                          {ev.type==='start'?'▶ ':ev.type==='end'?'■ ':'↔ '}{ev.proc.name.length>18?ev.proc.name.slice(0,18)+'…':ev.proc.name}
                        </div>
                      ))}
                      {events.length>2 && <div style={{fontSize:9,color:T.faint}}>+{events.length-2} more</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{display:'flex',gap:16,marginTop:12,fontSize:11,color:T.faint}}>
          {[{color:'#34d399',label:'Start date'},
            {color:'#f87171',label:'End date'},
            {color:'#818cf8',label:'Start & End'}].map(({color,label})=>(
            <div key={label} style={{display:'flex',alignItems:'center',gap:5}}>
              <div style={{width:10,height:10,borderRadius:2,background:color,opacity:0.8}}/>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar: this month's procurements */}
      <div style={{width:300,flexShrink:0}}>
        <div style={{fontSize:11,fontWeight:700,color:T.faint,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:10}}>
          {MONTHS[month]} {year} — {monthProcs.length} procurement{monthProcs.length!==1?'s':''}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:600,overflowY:'auto'}}>
          {monthProcs.length===0 ? (
            <div style={{fontSize:13,color:T.faint,padding:'20px 0',textAlign:'center'}}>No procurements this month</div>
          ) : monthProcs.map((p,i)=>(
            <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'12px 14px'}}>
              <div style={{fontSize:11,color:T.accent,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.project_number}</div>
              <div style={{fontSize:12,fontWeight:600,color:T.ink,marginBottom:6,lineHeight:1.4}}>{p.name}</div>
              <DateBar start={p.proposed_start_date} end={p.proposed_end_date} timeline={p.timeline}/>
              {p.estimated_value && <div style={{fontSize:12,fontWeight:700,color:T.amber}}>{fmtVal(p.estimated_value)||p.estimated_value}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProcurementsPage() {
  const [procs, setProcs]   = useState<Proc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [projF,  setProjF]    = useState('');
  const [typeF,  setTypeF]    = useState('');
  const [view,   setView]     = useState<'cards'|'table'|'calendar'>('cards');
  const [yearF,  setYearF]    = useState('');

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
    (!typeF || p.procurement_type === typeF) &&
    (!yearF || p.proposed_start_date?.startsWith(yearF) || p.proposed_end_date?.startsWith(yearF))
  );

  const withDates = procs.filter(p=>p.proposed_start_date||p.proposed_end_date||p.timeline).length;

  const VIEWS = [
    {id:'cards',    label:'⊞ Cards'},
    {id:'table',    label:'☰ Table'},
    {id:'calendar', label:'📅 Calendar'},
  ] as const;

  return (
    <div style={{minHeight:'100vh',background:T.canvas,color:T.ink,fontFamily:T.font}}>
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
        <div style={{display:'flex',gap:6}}>
          {VIEWS.map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)}
              style={{padding:'7px 14px',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:T.font,
                border:`1px solid ${view===v.id?T.accentBdr:T.border}`,
                background:view===v.id?T.accentDim:T.canvas,
                color:view===v.id?T.accent:T.mute}}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters — hidden in calendar view */}
      {view !== 'calendar' && (
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
          <select value={yearF} onChange={e=>setYearF(e.target.value)}
          style={{height:36,padding:'0 10px',borderRadius:6,border:`1px solid ${yearF?T.accentBdr:T.border}`,background:yearF?T.accentDim:T.canvas,color:yearF?T.accent:T.ink,fontSize:13,fontFamily:T.font,cursor:'pointer',outline:'none'}}>
          <option value="">All Years</option>
          {['2019','2020','2021','2022','2023','2024','2025','2026'].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        {(search||projF||typeF||yearF)&&(
            <button onClick={()=>{setSearch('');setProjF('');setTypeF('');}}
              style={{height:36,padding:'0 10px',borderRadius:6,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.08)',color:T.red,fontSize:13,cursor:'pointer',fontFamily:T.font}}>✕ Clear</button>
          )}
          <span style={{fontSize:13,color:T.ink,marginLeft:'auto'}}><span style={{color:T.ink,fontWeight:700}}>{filtered.length}</span> procurements</span>
        </div>
      )}

      {/* Content */}
      <div style={{padding:'24px 32px 64px'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:'80px 0',color:T.mute}}>Loading…</div>
        ) : view === 'calendar' ? (
          <CalendarView procs={procs}/>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:'80px 0',color:T.mute}}>No procurements found</div>
        ) : view === 'cards' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(480px,1fr))',gap:16}}>
            {filtered.map((p,i)=>(
              <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'20px 24px'}}>
                {/* Top row: project + type badge */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <a href={`/CAStateIntel/stage${p.stage||3}?project=${p.project_number}&tab=overview`}
                    style={{fontSize:12,color:T.accent,textDecoration:'none',fontWeight:500}}>
                    {p.project_number} — {p.project_name}
                  </a>
                  {p.procurement_type && <TypeBadge type={p.procurement_type}/>}
                </div>
                {/* Name */}
                <div style={{fontSize:15,fontWeight:700,color:T.ink,marginBottom:10,lineHeight:1.4}}>{p.name}</div>
                {/* DATE BAR — prominent */}
                <DateBar start={p.proposed_start_date} end={p.proposed_end_date} timeline={p.timeline}/>
                {/* Value + duration row */}
                <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
                  {p.estimated_value && (
                    <div style={{fontSize:16,fontWeight:700,color:T.amber}}>{fmtVal(p.estimated_value)||p.estimated_value}</div>
                  )}
                  {p.duration && (
                    <div style={{fontSize:12,color:T.faint,display:'flex',alignItems:'center',gap:4}}>
                      <span style={{opacity:0.5}}>⏱</span>{p.duration}
                    </div>
                  )}
                  {p.solicitation_number && (
                    <div style={{fontSize:11,color:T.faint,fontFamily:T.mono}}>Sol# {p.solicitation_number}</div>
                  )}
                </div>
                {/* Description */}
                {p.description && (
                  <div style={{fontSize:13,color:T.mute,lineHeight:1.6,marginBottom:8,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                    {p.description}
                  </div>
                )}
                {/* Footer */}
                {(p.vendor_or_source||p.justification||p.source_doc_id) && (
                  <div style={{borderTop:`1px solid ${T.border}`,paddingTop:8,marginTop:4,fontSize:12,lineHeight:1.5}}>
                    {p.vendor_or_source && <div style={{color:T.faint}}>Vendor: <span style={{color:T.ink}}>{p.vendor_or_source}</span></div>}
                    {p.justification && <div style={{marginTop:3,color:T.faint,fontStyle:'italic',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{p.justification}</div>}
                    {p.source_doc_id && (
                      <div style={{marginTop:8}}>
                        <a href={`/api/castateintel/pdf/${p.source_doc_id}`} target="_blank" rel="noreferrer"
                          style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:T.accent,textDecoration:'none',padding:'4px 10px',borderRadius:6,border:`1px solid ${T.accentBdr}`,background:T.accentDim}}>
                          📄 View Source PDF
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Table view
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:1000}}>
                <thead>
                  <tr>
                    {['Project','Name','Type','Value','Start','End','Duration'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.ink,background:'#111',borderBottom:`2px solid ${T.border}`,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <td style={{padding:'12px 14px',fontSize:12,whiteSpace:'nowrap'}}>
                        <a href={`/CAStateIntel/stage${p.stage||3}?project=${p.project_number}&tab=overview`} style={{color:T.accent,textDecoration:'none'}}>{p.project_number}</a>
                      </td>
                      <td style={{padding:'12px 14px',fontSize:13,fontWeight:600,color:T.ink,maxWidth:280,lineHeight:1.4}}>{p.name}</td>
                      <td style={{padding:'10px 14px'}}>{p.procurement_type?<TypeBadge type={p.procurement_type}/>:<span style={{color:T.faint}}>—</span>}</td>
                      <td style={{padding:'12px 14px',fontSize:13,fontWeight:700,color:T.amber,whiteSpace:'nowrap'}}>{fmtVal(p.estimated_value)||'—'}</td>
                      <td style={{padding:'12px 14px',fontSize:12,fontWeight:600,color:'#34d399',whiteSpace:'nowrap'}}>{fmtDate(p.proposed_start_date)||<span style={{color:T.faint}}>—</span>}</td>
                      <td style={{padding:'12px 14px',fontSize:12,fontWeight:600,color:'#f87171',whiteSpace:'nowrap'}}>{fmtDate(p.proposed_end_date)||<span style={{color:T.faint}}>—</span>}</td>
                      <td style={{padding:'12px 14px',fontSize:12,color:T.mute}}>{p.duration||'—'}</td>
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
