'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ── Design tokens (all inline — no CSS dependency) ────────────────────────────
const T = {
  canvas:   '#0d0d0d',
  surface:  '#161616',
  border:   '#2a2a2a',
  accent:   '#00d992',
  accentDim:'rgba(0,217,146,0.12)',
  accentBdr:'rgba(0,217,146,0.35)',
  ink:      '#f0f0f0',
  mute:     '#cccccc',
  faint:    '#aaaaaa',
  red:      '#ef4444',
  amber:    '#f59e0b',
  font:     '"Inter", system-ui, sans-serif',
  mono:     '"SF Mono", "Fira Code", monospace',
};

// ── Shared Nav ────────────────────────────────────────────────────────────────
function Nav() {
  const path = usePathname();
  const links = [
    { label: 'Dashboard',    href: '/CAStateIntel' },
    { label: 'Contacts',     href: '/CAStateIntel/contacts' },
    { label: 'Documents',    href: '/CAStateIntel/documents' },
    { label: 'Procurements', href: '/CAStateIntel/procurements' },
  ];
  return (
    <nav style={{ position:'sticky', top:0, zIndex:100, background:T.canvas, borderBottom:`1px solid ${T.border}`, height:56, display:'flex', alignItems:'center', padding:'0 32px', gap:0 }}>
      <Link href="/CAStateIntel" style={{ display:'flex', alignItems:'center', gap:8, marginRight:36, textDecoration:'none' }}>
        <div style={{ width:28, height:28, borderRadius:6, background:T.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2h6a3 3 0 010 6H5l4 4" stroke="#0d0d0d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span style={{ color:T.ink, fontWeight:600, fontSize:15, fontFamily:T.font }}>CA State Intel</span>
      </Link>
      <div style={{ display:'flex', gap:2, flex:1 }}>
        {links.map(l => {
          const active = path === l.href || (l.href !== '/CAStateIntel' && path.startsWith(l.href));
          return (
            <Link key={l.href} href={l.href} style={{ padding:'6px 12px', borderRadius:6, fontSize:14, fontFamily:T.font, fontWeight: active ? 600 : 400, color: active ? T.accent : T.mute, background: active ? T.accentDim : 'transparent', textDecoration:'none', transition:'all 0.12s' }}>
              {l.label}
            </Link>
          );
        })}
      </div>
      <Link href="/CAStateIntel/upload" style={{ padding:'7px 16px', borderRadius:6, fontSize:13, fontWeight:600, background:T.accent, color:T.canvas, textDecoration:'none', fontFamily:T.font }}>
        + Upload PDF
      </Link>
    </nav>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Project = {
  id: number; project_number: string; name: string;
  pal_stage: string; effective_stage: string; criticality_rating: string;
  department_name: string; doc_count: number;
  has_s1: boolean; has_s2: boolean; has_s3: boolean;
  s1_extracted: boolean; s2_extracted: boolean; s3_extracted: boolean;
  s1_doc_id: string|null; s2_doc_id: string|null; s3_doc_id: string|null;
  solution_tags: { tag: string; category: string; confidence: string }[];
};

type Stats = { total_projects:number; stage1_count:number; stage2_count:number; stage3_count:number; total_documents:number; };

const STAGE_LABEL: Record<string,string> = { 'Stage 1':'S1BA','Stage 2':'S2AA','Stage 3':'S3SA','Stage 4':'S4PRA' };

// ── Filter dropdown ───────────────────────────────────────────────────────────
type Opt = { value: string; count: number };
function Dropdown({ label, options, selected, onChange }: { label:string; options:Opt[]; selected:string[]; onChange:(v:string[])=>void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e:MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = options.filter(o => (o.value||'').toLowerCase().includes(q.toLowerCase()));
  const toggle = (v:string) => onChange(selected.includes(v) ? selected.filter(x=>x!==v) : [...selected,v]);
  const display = selected.length === 0 ? `All ${label}` : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div style={{ fontSize:11, color:T.ink, fontFamily:T.font, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>{label}</div>
      <button onClick={() => setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:8, height:40, padding:'0 12px', borderRadius:6, border:`1px solid ${selected.length>0?T.accentBdr:T.border}`, background: selected.length>0?T.accentDim:T.surface, color: selected.length>0?T.accent:T.ink, fontSize:13, fontFamily:T.font, cursor:'pointer', minWidth:130, fontWeight: selected.length>0?600:400 }}>
        <span style={{ flex:1, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{display}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open?'rotate(180deg)':'none', transition:'transform 0.15s', flexShrink:0 }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, marginTop:4, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', zIndex:50, minWidth:200, maxHeight:300, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {options.length > 8 && <div style={{ padding:8, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…" style={{ width:'100%', padding:'5px 8px', borderRadius:6, background:T.canvas, border:`1px solid ${T.border}`, color:T.ink, fontSize:13, fontFamily:T.font, outline:'none' }}/>
          </div>}
          <div style={{ overflowY:'auto' }}>
            {selected.length>0 && <button onClick={()=>{onChange([]);setQ('');}} style={{ width:'100%', padding:'8px 12px', textAlign:'right', fontSize:12, color:T.accent, background:'none', border:'none', cursor:'pointer', fontFamily:T.font }}>Clear all</button>}
            {filtered.map(opt => {
              const sel = selected.includes(opt.value);
              const unavail = opt.count===0&&!sel;
              return (
                <button key={opt.value} onClick={()=>!unavail&&toggle(opt.value)} disabled={unavail} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', background:sel?T.accentDim:'transparent', border:'none', color:unavail?T.faint:sel?T.accent:T.ink, fontSize:13, fontFamily:T.font, cursor:unavail?'not-allowed':'pointer', opacity:unavail?0.4:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:14, height:14, borderRadius:3, border:`1px solid ${sel?T.accent:T.faint}`, background:sel?T.accent:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {sel && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke={T.canvas} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{opt.value}</span>
                  </div>
                  <span style={{ fontSize:11, fontFamily:T.mono, color:T.ink, flexShrink:0, marginLeft:8 }}>{opt.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function CAStateIntelPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats]       = useState<Stats|null>(null);
  const [search, setSearch]     = useState('');
  const [stageF, setStageF]     = useState<string[]>([]);
  const [deptF,  setDeptF]      = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r=>r.json()).then(setStats);
    fetch('/api/castateintel/projects').then(r=>r.json()).then(d=>{setProjects(Array.isArray(d)?d:d.projects||[]);setLoading(false);});
  }, []);

  const effStage = (p:Project) => p.effective_stage||p.pal_stage;

  const filtered = projects.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.project_number.includes(search)) &&
    (stageF.length===0 || stageF.includes(effStage(p))) &&
    (deptF.length===0  || deptF.includes(p.department_name))
  );

  const allStages = ['Stage 1','Stage 2','Stage 3','Stage 4'];
  const allDepts  = [...new Set(projects.map(p=>p.department_name).filter(Boolean))].sort();

  const stageOpts = allStages.map(v=>({value:v,count:projects.filter(p=>(!search||p.name.toLowerCase().includes(search.toLowerCase())||p.project_number.includes(search))&&(deptF.length===0||deptF.includes(p.department_name))&&effStage(p)===v).length}));
  const deptOpts  = allDepts.map(v=>({value:v,count:projects.filter(p=>(!search||p.name.toLowerCase().includes(search.toLowerCase())||p.project_number.includes(search))&&(stageF.length===0||stageF.includes(effStage(p)))&&p.department_name===v).length}));

  const hasFilters = search||stageF.length>0||deptF.length>0;
  const CRIT_COLOR: Record<string,string> = { High:T.red, Medium:T.amber, Low:T.faint };

  return (
    <div style={{ minHeight:'100vh', background:T.canvas, color:T.ink, fontFamily:T.font }}>
      <Nav />

      {/* ── Hero ── */}
      <div style={{ padding:'64px 32px 48px', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:32, flexWrap:'wrap' }}>
          <div>
            <h1 style={{ fontSize:52, fontWeight:700, lineHeight:1.0, letterSpacing:'-1.5px', color:T.ink, margin:0 }}>PAL Project<br/>Tracking</h1>
            <p style={{ fontSize:16, color:T.ink, marginTop:12, lineHeight:1.6 }}>Project Approval Lifecycle — IT proposals &amp; analysis<br/>across California state agencies.</p>
          </div>
          {stats && (
            <div style={{ display:'flex', gap:8 }}>
              {[
                { v:stats.total_projects, l:'Projects' },
                { v:stats.total_documents, l:'Documents' },
                { v:stats.stage3_count, l:'Stage 3', sub:'S3SA' },
                { v:stats.stage2_count, l:'Stage 2', sub:'S2AA' },
                { v:stats.stage1_count, l:'Stage 1', sub:'S1BA' },
              ].map(s=>(
                <div key={s.l} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:'16px 20px', textAlign:'center', minWidth:90 }}>
                  <div style={{ fontSize:30, fontWeight:700, letterSpacing:'-1px', color:T.ink }}>{s.v}</div>
                  <div style={{ fontSize:12, color:T.ink, marginTop:2 }}>{s.l}</div>
                  {'sub' in s && <div style={{ fontSize:10, color:T.accent, fontWeight:600, fontFamily:T.mono, marginTop:2 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:'16px 32px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <div style={{ fontSize:11, color:T.ink, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>Search</div>
              <div style={{ position:'relative' }}>
                <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.mute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Project name or number…" style={{ height:40, padding:'0 12px 0 32px', borderRadius:6, border:`1px solid ${T.border}`, background:T.canvas, color:T.ink, fontSize:13, fontFamily:T.font, outline:'none', width:220 }}/>
              </div>
            </div>
            <Dropdown label="Stage"      options={stageOpts} selected={stageF} onChange={setStageF}/>
            <Dropdown label="Department" options={deptOpts}  selected={deptF}  onChange={setDeptF}/>

            <div style={{ marginLeft:'auto', display:'flex', alignItems:'flex-end', gap:12 }}>
              {hasFilters && <button onClick={()=>{setSearch('');setStageF([]);setDeptF([]);}} style={{ height:40, padding:'0 14px', borderRadius:6, border:`1px solid rgba(239,68,68,0.4)`, background:'rgba(239,68,68,0.08)', color:T.red, fontSize:13, fontFamily:T.font, cursor:'pointer' }}>✕ Clear</button>}
              <div style={{ fontSize:13, color:T.ink, paddingBottom:10 }}><span style={{ color:T.ink, fontWeight:700 }}>{filtered.length}</span> projects</div>
            </div>
          </div>
          {hasFilters && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
              {stageF.map(s=><span key={s} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:9999, background:T.accentDim, border:`1px solid ${T.accentBdr}`, color:T.accent, fontSize:12, fontWeight:600 }}>{STAGE_LABEL[s]||s}<button onClick={()=>setStageF(stageF.filter(x=>x!==s))} style={{ background:'none', border:'none', color:T.accent, cursor:'pointer', fontSize:11, padding:0 }}>✕</button></span>)}
              {deptF.map(d=><span key={d} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:9999, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', color:'#818cf8', fontSize:12 }}>{d}<button onClick={()=>setDeptF(deptF.filter(x=>x!==d))} style={{ background:'none', border:'none', color:'#818cf8', cursor:'pointer', fontSize:11, padding:0 }}>✕</button></span>)}

            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ padding:'24px 32px 64px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden', boxShadow:'0 0 0 1px rgba(255,255,255,0.03)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['#','Project Name','Stage','Crit.','Department','Docs'].map(h=>(
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:T.ink, background:'#111', borderBottom:`2px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding:48, textAlign:'center', color:T.ink, fontSize:14 }}>Loading projects…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding:48, textAlign:'center', color:T.ink, fontSize:14 }}>No projects match the selected filters</td></tr>
                ) : filtered.map(p => {
                  const es = effStage(p);
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}`, cursor:'default' }}
                        onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background='rgba(0,217,146,0.03)'; }}
                        onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; }}>
                        <td style={{ padding:'14px 16px', fontFamily:T.mono, fontSize:12, whiteSpace:'nowrap' }}><a href={`/CAStateIntel/stage1?project=${p.project_number}&tab=overview`} style={{ color:T.accent, textDecoration:'none', fontWeight:700 }}>{p.project_number}</a></td>
                        <td style={{ padding:'14px 16px', fontWeight:600, minWidth:320 }}><a href={`/CAStateIntel/stage1?project=${p.project_number}&tab=overview`} style={{ fontSize:14, lineHeight:1.4, color:T.ink, textDecoration:'none', display:'block' }} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.accent} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.ink}>{p.name}</a></td>
                        <td style={{ padding:'14px 16px' }}>
                          <span style={{ fontSize:11, fontWeight:700, fontFamily:T.mono, padding:'3px 8px', borderRadius:5, background:T.accentDim, color:T.accent, border:`1px solid ${T.accentBdr}` }}>{STAGE_LABEL[es]||es}</span>
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          {p.criticality_rating && <span style={{ fontSize:12, fontWeight:600, color:CRIT_COLOR[p.criticality_rating]||T.mute }}>{p.criticality_rating}</span>}
                        </td>
                        <td style={{ padding:'14px 16px', fontSize:13, color:T.ink, maxWidth:180 }}>
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', display:'block', whiteSpace:'nowrap' }}>{p.department_name}</span>
                        </td>
                        <td style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            {([1,2,3] as const).map(n=>{
                              const docId = n===1?p.s1_doc_id:n===2?p.s2_doc_id:p.s3_doc_id;
                              const has   = n===1?p.has_s1:n===2?p.has_s2:p.has_s3;
                              if (!has && !docId) return null;
                              return docId ? (
                                <a key={n} href={`/api/castateintel/pdf/${docId}`} target="_blank" rel="noreferrer"
                                  style={{ fontSize:11, fontWeight:700, fontFamily:T.mono, padding:'2px 7px', borderRadius:4, background:T.accentDim, color:T.accent, border:`1px solid ${T.accentBdr}`, textDecoration:'none' }}>
                                  S{n}
                                </a>
                              ) : <span key={n} style={{ fontSize:11, fontFamily:T.mono, padding:'2px 7px', borderRadius:4, background:'transparent', color:T.faint, border:`1px solid ${T.border}` }}>S{n}</span>;
                            })}
                          </div>
                        </td>

                      </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
