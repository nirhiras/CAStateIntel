'use client';
import { useEffect, useState, useCallback } from 'react';
import RvtNav from '@/components/castateintel/RvtNav';

const T = {
  canvas:'#0d0d0d', surface:'#161616', surface2:'#1e1e1e',
  border:'#2a2a2a', accent:'#00d992', accentDim:'rgba(0,217,146,0.12)',
  accentBdr:'rgba(0,217,146,0.35)', ink:'#f0f0f0', mute:'#888', faint:'#444',
  red:'#ef4444', redDim:'rgba(239,68,68,0.1)', amber:'#f59e0b',
  font:'"Inter",system-ui,sans-serif', mono:'"SF Mono","Fira Code",monospace',
};

const STAGE_COLOR: Record<number,{bg:string;text:string;label:string}> = {
  1:{bg:'rgba(99,102,241,0.15)',text:'#818cf8',label:'S1BA'},
  2:{bg:'rgba(139,92,246,0.15)',text:'#a78bfa',label:'S2AA'},
  3:{bg:'rgba(0,217,146,0.15)',text:'#00d992',label:'S3SA'},
  4:{bg:'rgba(245,158,11,0.15)',text:'#f59e0b',label:'S4PRA'},
  0:{bg:'rgba(107,114,128,0.15)',text:'#9ca3af',label:'OTHER'},
};

type Doc = {
  id: number; document_id: string; filename: string; label: string;
  stage: number; sub_label: string; doc_type: string; short_description: string;
  project_number: string; project_name: string; department_name: string;
  content_text: string; downloaded_at: string;
  contact_count: number; procurement_count: number;
  solution_tags: string[] | string;
};

function parseTags(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p.filter(Boolean) : []; }
  catch { return []; }
}

function fmtDate(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function fmtChars(n: number) {
  if (!n) return '—';
  return n >= 1000 ? `${(n/1000).toFixed(0)}k chars` : `${n} chars`;
}

export default function DocumentsPage() {
  const [docs, setDocs]       = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch]   = useState('');
  const [deptF, setDeptF]     = useState('');
  const [stageF, setStageF]   = useState('');
  const [tagF, setTagF]       = useState('');
  const [bulkMsg, setBulkMsg] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/castateintel/documents')
      .then(r => r.json())
      .then(d => { setDocs(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const allDepts = [...new Set(docs.map(d => d.department_name).filter(Boolean))].sort();
  const allTags  = [...new Set(docs.flatMap(d => parseTags(d.solution_tags)))].sort();

  const filtered = docs.filter(d => {
    const tags = parseTags(d.solution_tags);
    return (
      (!search || d.filename?.toLowerCase().includes(search.toLowerCase()) ||
       d.project_number?.includes(search) || d.project_name?.toLowerCase().includes(search.toLowerCase())) &&
      (!deptF  || d.department_name === deptF) &&
      (!stageF || String(d.stage) === stageF) &&
      (!tagF   || tags.includes(tagF))
    );
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.map(d => d.document_id)));
  const clearSel  = () => setSelected(new Set());

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} document${selected.size>1?'s':''}? This also removes their contacts and analysis.`)) return;
    setBulkRunning(true); setBulkMsg('Deleting…');
    let done = 0;
    for (const docId of selected) {
      try {
        await fetch('/api/castateintel/upload', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({document_id: docId}) });
        done++;
      } catch {}
    }
    setBulkMsg(`✓ Deleted ${done} document${done>1?'s':''}`);
    setBulkRunning(false); clearSel(); load();
  };

  const bulkReanalyze = async () => {
    if (!selected.size) return;
    setBulkRunning(true); setBulkMsg('Queuing re-analysis…');
    const selectedDocs = docs.filter(d => selected.has(d.document_id));
    const projectNums = [...new Set(selectedDocs.map(d => d.project_number))];
    let done = 0;
    for (const pn of projectNums) {
      try {
        await fetch('/api/castateintel/analysis/extract', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({project_number: pn}),
        });
        done++;
      } catch {}
    }
    setBulkMsg(`✓ Re-analysis queued for ${done} project${done>1?'s':''}`);
    setBulkRunning(false);
  };

  const exportCSV = () => {
    const rows = filtered.map(d => [
      d.project_number, d.project_name, d.department_name,
      STAGE_COLOR[d.stage]?.label || d.label,
      d.filename, fmtDate(d.downloaded_at),
      d.contact_count, d.procurement_count,
      parseTags(d.solution_tags).join('; '),
    ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const csv = ['Project #,Project Name,Department,Stage,Filename,Date,Contacts,Procurements,Tags', ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'pal_documents.csv'; a.click();
  };

  const Btn = ({onClick,children,variant='outline',disabled=false}:{onClick:()=>void;children:React.ReactNode;variant?:string;disabled?:boolean}) => {
    const styles: Record<string,object> = {
      outline: {background:'transparent',border:`1px solid ${T.border}`,color:T.ink},
      green:   {background:T.accent,border:`1px solid ${T.accent}`,color:T.canvas,fontWeight:600},
      red:     {background:T.redDim,border:`1px solid rgba(239,68,68,0.4)`,color:T.red},
      amber:   {background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.35)',color:T.amber},
    };
    return (
      <button onClick={onClick} disabled={disabled}
        style={{ padding:'6px 12px', borderRadius:6, fontSize:13, fontFamily:T.font, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.4:1, display:'flex', alignItems:'center', gap:6, ...styles[variant] }}>
        {children}
      </button>
    );
  };

  return (
    <div style={{ minHeight:'100vh', background:T.canvas, color:T.ink, fontFamily:T.font }}>
      <RvtNav />

      {/* ── Header ── */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:'24px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase', color:T.accent, fontWeight:600, marginBottom:4 }}>PAL Documents</div>
          <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.5px', color:T.ink, margin:0 }}>
            {loading ? 'Loading…' : `${filtered.length} of ${docs.length} documents`}
          </h1>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn onClick={exportCSV} variant="outline">⬇ Export CSV</Btn>
          <a href="/CAStateIntel/upload" style={{ padding:'6px 14px', borderRadius:6, fontSize:13, fontWeight:600, background:T.accent, color:T.canvas, textDecoration:'none' }}>+ Upload PDF</a>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:'12px 32px', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        {/* Search */}
        <div style={{ position:'relative' }}>
          <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.mute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search filename, project…"
            style={{ height:36, padding:'0 10px 0 30px', borderRadius:6, border:`1px solid ${T.border}`, background:T.canvas, color:T.ink, fontSize:13, fontFamily:T.font, outline:'none', width:220 }}/>
        </div>

        {/* Department */}
        <select value={deptF} onChange={e=>setDeptF(e.target.value)}
          style={{ height:36, padding:'0 10px', borderRadius:6, border:`1px solid ${deptF?T.accentBdr:T.border}`, background:deptF?T.accentDim:T.canvas, color:deptF?T.accent:T.ink, fontSize:13, fontFamily:T.font, cursor:'pointer', outline:'none' }}>
          <option value="">All Departments</option>
          {allDepts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>

        {/* Stage */}
        <select value={stageF} onChange={e=>setStageF(e.target.value)}
          style={{ height:36, padding:'0 10px', borderRadius:6, border:`1px solid ${stageF?T.accentBdr:T.border}`, background:stageF?T.accentDim:T.canvas, color:stageF?T.accent:T.ink, fontSize:13, fontFamily:T.font, cursor:'pointer', outline:'none' }}>
          <option value="">All Stages</option>
          {[1,2,3,4].map(s=><option key={s} value={String(s)}>{STAGE_COLOR[s].label}</option>)}
        </select>

        {/* Tag */}
        <select value={tagF} onChange={e=>setTagF(e.target.value)}
          style={{ height:36, padding:'0 10px', borderRadius:6, border:`1px solid ${tagF?T.accentBdr:T.border}`, background:tagF?T.accentDim:T.canvas, color:tagF?T.accent:T.ink, fontSize:13, fontFamily:T.font, cursor:'pointer', outline:'none', maxWidth:180 }}>
          <option value="">All Tags</option>
          {allTags.map(t=><option key={t} value={t}>{t}</option>)}
        </select>

        {(search||deptF||stageF||tagF) && (
          <button onClick={()=>{setSearch('');setDeptF('');setStageF('');setTagF('');}}
            style={{ height:36, padding:'0 10px', borderRadius:6, border:`1px solid rgba(239,68,68,0.3)`, background:T.redDim, color:T.red, fontSize:13, fontFamily:T.font, cursor:'pointer' }}>
            ✕ Clear
          </button>
        )}

        {/* Divider */}
        <div style={{ width:1, height:24, background:T.border, margin:'0 4px' }}/>

        {/* Selection controls */}
        <span style={{ fontSize:13, color:T.mute }}>
          {selected.size > 0 ? <><span style={{ color:T.ink, fontWeight:600 }}>{selected.size}</span> selected</> : 'Select docs for bulk actions'}
        </span>
        {selected.size === 0
          ? <Btn onClick={selectAll} variant="outline">Select all {filtered.length}</Btn>
          : <Btn onClick={clearSel}  variant="outline">Clear selection</Btn>
        }

        {/* Bulk actions */}
        {selected.size > 0 && <>
          <Btn onClick={bulkReanalyze} variant="amber" disabled={bulkRunning}>⚡ Re-analyze {selected.size}</Btn>
          <Btn onClick={bulkDelete}    variant="red"   disabled={bulkRunning}>🗑 Delete {selected.size}</Btn>
        </>}

        {bulkMsg && <span style={{ fontSize:13, color:T.accent }}>{bulkMsg}</span>}
      </div>

      {/* ── Document list ── */}
      <div style={{ padding:'24px 32px 64px', maxWidth:1400, margin:'0 auto' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:T.mute }}>Loading documents…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:T.mute }}>No documents found</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(doc => {
              const isSel  = selected.has(doc.document_id);
              const sc     = STAGE_COLOR[doc.stage] || STAGE_COLOR[0];
              const tags   = parseTags(doc.solution_tags);
              const chars  = doc.content_text?.length || 0;
              const isExtracted = chars > 100;
              const stageNum = doc.stage || 0;

              return (
                <div key={doc.document_id}
                  style={{ background: isSel ? 'rgba(0,217,146,0.04)' : T.surface, border:`1px solid ${isSel ? T.accentBdr : T.border}`, borderRadius:8, padding:'16px 20px', display:'flex', gap:16, alignItems:'flex-start', transition:'all 0.1s' }}>

                  {/* Checkbox */}
                  <div style={{ paddingTop:2, flexShrink:0 }}>
                    <div onClick={()=>toggleSelect(doc.document_id)}
                      style={{ width:18, height:18, borderRadius:4, border:`2px solid ${isSel?T.accent:T.faint}`, background:isSel?T.accent:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {isSel && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#0d0d0d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </div>

                  {/* Stage badge */}
                  <div style={{ flexShrink:0, paddingTop:1 }}>
                    <span style={{ fontSize:11, fontWeight:700, fontFamily:T.mono, padding:'3px 8px', borderRadius:5, background:sc.bg, color:sc.text, border:`1px solid ${sc.text}22` }}>
                      {sc.label}{doc.sub_label?`-${doc.sub_label}`:''}
                    </span>
                  </div>

                  {/* Main content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Filename */}
                    <div style={{ fontSize:14, fontWeight:600, color:T.ink, fontFamily:T.mono, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
                      {doc.filename || `${doc.project_number} - ${sc.label} - ${doc.project_name}`}
                    </div>

                    {/* Project + dept */}
                    <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
                      <a href={`/CAStateIntel/stage${stageNum > 0 ? stageNum : 1}?project=${doc.project_number}`}
                        style={{ fontSize:13, color:T.accent, textDecoration:'none', fontWeight:500 }}>
                        {doc.project_number} — {doc.project_name}
                      </a>
                      <span style={{ fontSize:12, color:T.mute }}>{doc.department_name}</span>
                      <span style={{ fontSize:12, color:T.faint }}>· {fmtDate(doc.downloaded_at)}</span>
                    </div>

                    {/* Short description */}
                    {doc.short_description && (
                      <div style={{ fontSize:13, color:T.ink, lineHeight:1.5, marginBottom:8, maxWidth:700 }}>
                        {doc.short_description}
                      </div>
                    )}

                    {/* Stats row */}
                    <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap', marginBottom: tags.length > 0 ? 8 : 0 }}>
                      <span style={{ fontSize:12, color:T.ink, display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ color: isExtracted ? T.accent : T.faint }}>●</span>
                        {isExtracted ? fmtChars(chars) : 'Not extracted'}
                      </span>
                      {doc.contact_count > 0 && (
                        <a href={`/CAStateIntel/contacts?project=${doc.project_number}`}
                          style={{ fontSize:12, color:T.ink, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                          👤 <span style={{ color:T.ink }}>{doc.contact_count}</span> contact{doc.contact_count !== 1 ? 's' : ''}
                        </a>
                      )}
                      {doc.procurement_count > 0 && (
                        <a href={`/CAStateIntel/procurements?project=${doc.project_number}`}
                          style={{ fontSize:12, color:T.ink, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                          📋 <span style={{ color:T.ink }}>{doc.procurement_count}</span> procurement{doc.procurement_count !== 1 ? 's' : ''}
                        </a>
                      )}
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {tags.map((tag,i) => (
                          <button key={i} onClick={() => setTagF(tagF === tag ? '' : tag)}
                            style={{ padding:'2px 8px', borderRadius:9999, fontSize:11, cursor:'pointer', border:`1px solid ${tagF===tag ? T.accentBdr : T.border}`, background: tagF===tag ? T.accentDim : 'transparent', color: tagF===tag ? T.accent : T.mute, fontFamily:T.font }}>
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                    {/* View PDF */}
                    <a href={`/api/castateintel/pdf/${doc.document_id}`} target="_blank" rel="noreferrer"
                      style={{ padding:'5px 10px', borderRadius:6, fontSize:12, fontWeight:500, border:`1px solid ${T.border}`, background:'transparent', color:T.ink, textDecoration:'none', textAlign:'center', display:'block' }}>
                      📄 View PDF
                    </a>
                    {/* View Analysis */}
                    {stageNum > 0 && stageNum <= 4 && (
                      <a href={`/CAStateIntel/stage${stageNum}?project=${doc.project_number}`}
                        style={{ padding:'5px 10px', borderRadius:6, fontSize:12, fontWeight:500, border:`1px solid ${T.accentBdr}`, background:T.accentDim, color:T.accent, textDecoration:'none', textAlign:'center', display:'block' }}>
                        📊 Analysis
                      </a>
                    )}
                    {/* Re-analyze */}
                    <ReanalyzeBtn projectNumber={doc.project_number} onDone={()=>setBulkMsg(`✓ Queued ${doc.project_number}`)} />
                    {/* Delete */}
                    <DeleteBtn documentId={doc.document_id} filename={doc.filename} onDone={load} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-row action buttons ─────────────────────────────────────────────────────
function ReanalyzeBtn({ projectNumber, onDone }: { projectNumber: string; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      await fetch('/api/castateintel/analysis/extract', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({project_number: projectNumber}),
      });
      onDone();
    } finally { setRunning(false); }
  };
  return (
    <button onClick={run} disabled={running}
      style={{ padding:'5px 10px', borderRadius:6, fontSize:12, fontWeight:500, border:`1px solid rgba(245,158,11,0.4)`, background:'rgba(245,158,11,0.08)', color:'#f59e0b', cursor:running?'wait':'pointer', opacity:running?0.5:1, fontFamily:'"Inter",system-ui,sans-serif' }}>
      {running ? '⏳ …' : '⚡ Re-analyze'}
    </button>
  );
}

function DeleteBtn({ documentId, filename, onDone }: { documentId: string; filename: string; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const run = async () => {
    if (!confirm(`Delete "${filename}"?\nThis also removes contacts and analysis for this document.`)) return;
    setRunning(true);
    try {
      await fetch('/api/castateintel/upload', {
        method:'DELETE', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({document_id: documentId}),
      });
      onDone();
    } finally { setRunning(false); }
  };
  return (
    <button onClick={run} disabled={running}
      style={{ padding:'5px 10px', borderRadius:6, fontSize:12, fontWeight:500, border:`1px solid rgba(239,68,68,0.35)`, background:'rgba(239,68,68,0.08)', color:'#ef4444', cursor:running?'wait':'pointer', opacity:running?0.5:1, fontFamily:'"Inter",system-ui,sans-serif' }}>
      {running ? '⏳ …' : '🗑 Delete'}
    </button>
  );
}
