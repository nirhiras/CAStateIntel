'use client';

import { useEffect, useState } from 'react';
import RvtNav from '@/components/castateintel/RvtNav';
import { SmartMultiSelect, buildOptions, FilterPills } from '@/components/castateintel/SmartMultiSelect';

type Project = {
  id: number; project_number: string; name: string;
  pal_stage: string; effective_stage: string; criticality_rating: string;
  status: string; department_name: string; agency_name: string;
  doc_count: number; detail_url: string;
  has_s1: boolean; has_s2: boolean; has_s3: boolean;
  s1_extracted: boolean; s2_extracted: boolean; s3_extracted: boolean;
  s1_doc_id: string | null; s2_doc_id: string | null; s3_doc_id: string | null;
  solution_tags: { tag: string; category: string; confidence: string }[];
};

type Stats = {
  total_projects: number; stage1_count: number; stage2_count: number;
  stage3_count: number; total_documents: number; extracted_docs: number;
};

const STAGE_LABEL: Record<string, string> = {
  'Stage 1': 'S1BA', 'Stage 2': 'S2AA', 'Stage 3': 'S3SA', 'Stage 4': 'S4PRA',
};

// Revolut-style stage pills — subtle on elevated dark surface
const STAGE_PILL_STYLE: Record<string, { bg: string; color: string }> = {
  'Stage 1': { bg: 'rgba(0,217,146,0.08)', color: 'var(--vg-primary)' },
  'Stage 2': { bg: 'rgba(0,217,146,0.2)',  color: 'var(--vg-primary-soft)' },
  'Stage 3': { bg: 'rgba(0,168,126,0.15)', color: '#3dd6a8' },
  'Stage 4': { bg: 'rgba(176,144,0,0.15)', color: '#e8c840' },
};

const CRIT_STYLE: Record<string, { bg: string; color: string }> = {
  High:   { bg: 'rgba(226,59,74,0.15)',  color: '#f87171' },
  Medium: { bg: 'rgba(236,126,0,0.15)',  color: '#fb923c' },
  Low:    { bg: 'rgba(93,99,108,0.2)',   color: '#94a3b8' },
};

export default function CAStateIntelPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch]           = useState('');
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [deptFilters, setDeptFilters]   = useState<string[]>([]);
  const [tagFilters, setTagFilters]     = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects?stats=true').then(r => r.json()).then(setStats);
    fetch('/api/castateintel/projects?departments=true').then(r => r.json()).then(setDepartments);
    fetch('/api/castateintel/projects')
      .then(r => r.json())
      .then(data => { setProjects(Array.isArray(data) ? data : data.projects || []); setLoading(false); });
  }, []);

  const getStage = (p: Project) => p.effective_stage || p.pal_stage;
  const getDept  = (p: Project) => p.department_name;
  const getTags  = (p: Project) => (p.solution_tags || []).map(t => t.tag);

  const matchSearch = (p: Project) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.project_number.includes(search);
  const matchStage  = (p: Project) => stageFilters.length === 0 || stageFilters.includes(getStage(p));
  const matchDept   = (p: Project) => deptFilters.length === 0  || deptFilters.includes(getDept(p));
  const matchTag    = (p: Project) => tagFilters.length === 0   || tagFilters.some(tf => getTags(p).includes(tf));

  const filtered = projects.filter(p => matchSearch(p) && matchStage(p) && matchDept(p) && matchTag(p));

  const allStages = ['Stage 1','Stage 2','Stage 3','Stage 4'];
  const allDepts  = [...new Set(projects.map(getDept).filter(Boolean))].sort();
  const allTags   = [...new Set(projects.flatMap(getTags))].sort();

  const stageOptions = buildOptions(projects, getStage, [matchSearch, matchDept, matchTag], allStages, v => STAGE_LABEL[v] || v);
  const deptOptions  = buildOptions(projects, getDept,  [matchSearch, matchStage, matchTag], allDepts);
  const tagOptions   = buildOptions(projects, getTags,  [matchSearch, matchStage, matchDept], allTags);

  const hasFilters = search || stageFilters.length > 0 || deptFilters.length > 0 || tagFilters.length > 0;
  const clearAll = () => { setSearch(''); setStageFilters([]); setDeptFilters([]); setTagFilters([]); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vg-canvas)', color: 'var(--vg-ink-strong)' }}>
      <RvtNav />

      {/* ── Hero band (canvas-dark) ── */}
      <div style={{ padding: '88px 40px 80px', borderBottom: '1px solid var(--vg-hairline)', maxWidth: '100%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(0,217,146,0.15)', color: 'var(--vg-primary-soft)',
                fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '6px 14px', borderRadius: 9999, marginBottom: 24,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--vg-primary)', display: 'inline-block' }} />
                California Department of Technology
              </div>
              <h1 style={{
                fontSize: 'clamp(40px,5vw,80px)', fontWeight: 500, lineHeight: 1.0,
                letterSpacing: '-0.8px', color: 'var(--vg-ink-strong)', marginBottom: 16,
              }}>
                PAL Project<br />Tracking
              </h1>
              <p style={{ fontSize: 18, fontWeight: 400, lineHeight: 1.56, letterSpacing: '-0.09px', color: 'var(--vg-body)', maxWidth: 480 }}>
                Project Approval Lifecycle — IT project proposals &amp; analysis across California state agencies.
              </p>
            </div>

            {/* Stat cards — surface-elevated on canvas-dark */}
            {stats && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { v: stats.total_projects, l: 'Projects',  sub: '' },
                  { v: stats.total_documents, l: 'Documents', sub: '' },
                  { v: stats.stage3_count,    l: 'Stage 3',   sub: 'S3SA' },
                  { v: stats.stage2_count,    l: 'Stage 2',   sub: 'S2AA' },
                  { v: stats.stage1_count,    l: 'Stage 1',   sub: 'S1BA' },
                ].map(s => (
                  <div key={s.l} style={{
                    background: 'var(--vg-canvas-soft)', borderRadius: 20,
                    padding: '20px 24px', minWidth: 110, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.0, letterSpacing: '-0.32px', color: 'var(--vg-ink-strong)' }}>{s.v}</div>
                    <div style={{ fontSize: 13, color: 'var(--vg-mute)', marginTop: 4 }}>{s.l}</div>
                    {s.sub && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--vg-primary)', marginTop: 2 }}>{s.sub}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter band (surface-elevated) ── */}
      <div style={{ background: 'var(--vg-canvas-soft)', borderBottom: '1px solid var(--vg-hairline)', padding: '20px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            {/* Search */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--vg-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Search</label>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Project name or number…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{
                    height: 48, padding: '0 16px 0 42px', borderRadius: 9999,
                    fontSize: 14, letterSpacing: '0.24px', width: 240,
                    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(61,58,57,0.6)',
                    color: 'var(--vg-ink-strong)', outline: 'none',
                  }} />
              </div>
            </div>

            {/* SmartMultiSelects — dark mode via inline override */}
            <DarkMultiSelect label="Stage"       options={stageOptions} selected={stageFilters} onChange={setStageFilters} placeholder="All Stages" />
            <DarkMultiSelect label="Department"  options={deptOptions}  selected={deptFilters}  onChange={setDeptFilters}  placeholder="All Depts" />
            <DarkMultiSelect label="Solution Tag" options={tagOptions}   selected={tagFilters}   onChange={setTagFilters}   placeholder="All Tags" />

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, paddingBottom: 2 }}>
              {hasFilters && (
                <button onClick={clearAll} style={{
                  height: 48, padding: '0 20px', borderRadius: 9999,
                  background: 'transparent', color: '#f87171',
                  border: '1px solid rgba(248,113,113,0.3)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '0.24px',
                }}>
                  ✕ Clear
                </button>
              )}
              <span style={{ fontSize: 14, color: 'var(--vg-mute)', fontWeight: 400 }}>
                <span style={{ color: 'var(--vg-ink-strong)', fontWeight: 600 }}>{filtered.length}</span> projects
              </span>
            </div>
          </div>

          {/* Active pills */}
          {hasFilters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {search && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'var(--vg-hairline)', color: 'var(--vg-ink)', fontSize: 13 }}>
                  "{search}" <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--vg-mute)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </span>
              )}
              {stageFilters.map(s => (
                <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'rgba(0,217,146,0.2)', color: 'var(--vg-primary-soft)', fontSize: 13, fontWeight: 600 }}>
                  {STAGE_LABEL[s] || s} <button onClick={() => setStageFilters(stageFilters.filter(x => x !== s))} style={{ background: 'none', border: 'none', color: 'var(--vg-primary-soft)', cursor: 'pointer', opacity: 0.6 }}>✕</button>
                </span>
              ))}
              {deptFilters.map(d => (
                <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'rgba(0,168,126,0.15)', color: '#3dd6a8', fontSize: 13 }}>
                  {d} <button onClick={() => setDeptFilters(deptFilters.filter(x => x !== d))} style={{ background: 'none', border: 'none', color: '#3dd6a8', cursor: 'pointer', opacity: 0.6 }}>✕</button>
                </span>
              ))}
              {tagFilters.map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'rgba(0,217,146,0.15)', color: 'var(--vg-primary-soft)', fontSize: 13 }}>
                  🏷 {t} <button onClick={() => setTagFilters(tagFilters.filter(x => x !== t))} style={{ background: 'none', border: 'none', color: 'var(--vg-primary-soft)', cursor: 'pointer', opacity: 0.6 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Table (canvas-dark) ── */}
      <div style={{ padding: '32px 40px 80px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ background: 'var(--vg-canvas-soft)', borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(61,58,57,0.6)' }}>
            <table className="rvt-table" style={{ background: 'transparent' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {[
                  { label: 'Project #',    w: '80px'  },
                  { label: 'Name',         w: '280px' },
                  { label: 'Stage',        w: '80px'  },
                  { label: 'Criticality',  w: '90px'  },
                  { label: 'Department',   w: '160px' },
                  { label: 'Source Docs',  w: '110px' },
                  { label: 'Analysis',     w: '100px' },
                  { label: 'Solution Tags',w: 'auto'  },
                ].map(h => (
                  <th key={h.label} style={{ width: h.w, minWidth: h.w, padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(61,58,57,0.6)" }}>{h.label}</th>
                ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 48, background: 'transparent' }}>Loading projects…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 48, background: 'transparent' }}>No projects match the selected filters</td></tr>
                ) : filtered.map(p => {
                  const tags = p.solution_tags || [];
                  const effStage = p.effective_stage || p.pal_stage;
                  const stagePill = STAGE_PILL_STYLE[effStage] || { bg: 'var(--vg-hairline)', color: 'var(--vg-mute)' };
                  const critPill = CRIT_STYLE[p.criticality_rating] || null;
                  return (
                    <tr key={p.id} style={{ cursor: 'default' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <td style={{ color: 'var(--vg-mute)', fontFamily: 'monospace', fontSize: 12, background: 'transparent', borderBottom: '1px solid rgba(61,58,57,0.4)', whiteSpace: 'nowrap' }}>{p.project_number}</td>
                      <td style={{ fontWeight: 500, color: 'var(--vg-ink-strong)', width: 300, background: 'transparent', borderBottom: '1px solid rgba(61,58,57,0.4)' }}>
                        <span style={{ fontSize: 14, lineHeight: 1.4 }}>{p.name}</span>
                      </td>
                      <td style={{ background: 'transparent', borderBottom: '1px solid rgba(61,58,57,0.4)' }}>
                        <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: stagePill.bg, color: stagePill.color }}>
                          {STAGE_LABEL[effStage] || effStage}
                        </span>
                      </td>
                      <td style={{ background: 'transparent', borderBottom: '1px solid rgba(61,58,57,0.4)' }}>
                        {critPill && p.criticality_rating && (
                          <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 500, background: critPill.bg, color: critPill.color }}>
                            {p.criticality_rating}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--vg-mute)', width: 180, background: 'transparent', borderBottom: '1px solid rgba(61,58,57,0.4)' }}>{p.department_name}</td>
                      {/* Source Docs — direct PDF links from DB */}
                      <td style={{ background: 'transparent', borderBottom: '1px solid rgba(61,58,57,0.4)', width: 110 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {([
                            { n: 1, docId: p.s1_doc_id, has: p.has_s1 },
                            { n: 2, docId: p.s2_doc_id, has: p.has_s2 },
                            { n: 3, docId: p.s3_doc_id, has: p.has_s3 },
                          ] as {n:number;docId:string|null;has:boolean}[]).filter(s => s.has || s.docId).map(s => {
                            const stageColors: Record<number,{bg:string;color:string}> = {
                              1:{bg:'rgba(79,85,241,0.15)',color:'#8b90f8'},
                              2:{bg:'rgba(0,217,146,0.2)',color:'var(--vg-primary-soft)'},
                              3:{bg:'rgba(0,168,126,0.15)',color:'#3dd6a8'},
                            };
                            const sc = stageColors[s.n];
                            return s.docId ? (
                              <a key={s.n}
                                href={`/api/castateintel/pdf/${s.docId}`}
                                target="_blank" rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none', background: sc.bg, color: sc.color }}
                                title={`Open Stage ${s.n} PDF`}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                </svg>
                                S{s.n}
                              </a>
                            ) : (
                              <span key={s.n} style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}>
                                S{s.n}
                              </span>
                            );
                          })}
                          {!p.has_s1 && !p.has_s2 && !p.has_s3 && (
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ background: 'transparent', borderBottom: '1px solid rgba(61,58,57,0.4)' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {[1,2,3,4].map(n => {
                            const hasDoc = n===1?p.has_s1:n===2?p.has_s2:n===3?p.has_s3:false;
                            const extracted = n===1?p.s1_extracted:n===2?p.s2_extracted:n===3?p.s3_extracted:false;
                            if (!hasDoc && !extracted) return null;
                            const c = STAGE_PILL_STYLE[`Stage ${n}`] || { bg: 'var(--vg-hairline)', color: 'var(--vg-mute)' };
                            return (
                              <a key={n} href={`/CAStateIntel/stage${n}?project=${p.project_number}`}
                                style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none', opacity: extracted ? 1 : 0.4, background: c.bg, color: c.color }}>
                                S{n}
                              </a>
                            );
                          })}
                          {!p.has_s1&&!p.has_s2&&!p.has_s3&&<span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>}
                        </div>
                      </td>
                      <td style={{ background: 'transparent', borderBottom: '1px solid rgba(61,58,57,0.4)', maxWidth: 340, width: 340 }}>
                        {tags.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {tags.map((t, i) => (
                              <button key={i}
                                onClick={() => setTagFilters(tagFilters.includes(t.tag) ? tagFilters.filter(x => x !== t.tag) : [...tagFilters, t.tag])}
                                style={{
                                  padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
                                  background: tagFilters.includes(t.tag) ? 'rgba(0,217,146,0.35)' : 'rgba(61,58,57,0.6)',
                                  color: tagFilters.includes(t.tag) ? 'var(--vg-primary-soft)' : 'rgba(255,255,255,0.55)',
                                  outline: tagFilters.includes(t.tag) ? '1px solid rgba(0,217,146,0.6)' : 'none',
                                  transition: 'all 0.1s',
                                }}
                                title={`${tagFilters.includes(t.tag)?'Remove':'Add'} filter: ${t.tag}`}>
                                {t.tag}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{p.s2_extracted?'No tags':'—'}</span>
                        )}
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

// ── Dark-mode SmartMultiSelect wrapper ────────────────────────────────────────
import { useRef } from 'react';
import type { FilterOption } from '@/components/castateintel/SmartMultiSelect';

function DarkMultiSelect({ label, options, selected, onChange, placeholder }: {
  label: string; options: FilterOption[]; selected: string[];
  onChange: (v: string[]) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  const filtered = options.filter(o => (o.label||o.value).toLowerCase().includes(search.toLowerCase()));
  const displayText = selected.length === 0 ? placeholder : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label || selected[0]) : `${selected.length} selected`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} ref={ref}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--vg-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          height: 48, padding: '0 16px', borderRadius: 9999, minWidth: 148, cursor: 'pointer',
          border: selected.length > 0 ? '1px solid rgba(0,217,146,0.6)' : '1px solid rgba(255,255,255,0.12)',
          background: selected.length > 0 ? 'rgba(0,217,146,0.15)' : 'rgba(61,58,57,0.6)',
          color: selected.length > 0 ? 'var(--vg-primary-soft)' : 'rgba(255,255,255,0.6)',
          fontSize: 14, fontWeight: selected.length > 0 ? 600 : 400, letterSpacing: '0.24px',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{displayText}</span>
          <svg style={{ width: 12, height: 12, flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div style={{
            position: 'absolute', zIndex: 50, top: '100%', marginTop: 8, left: 0,
            background: 'var(--vg-canvas-soft)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)', minWidth: 240, maxHeight: 280,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {options.length > 8 && (
              <div style={{ padding: 8, borderBottom: '1px solid rgba(61,58,57,0.6)', flexShrink: 0 }}>
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, background: 'rgba(61,58,57,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(61,58,57,0.6)', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{filtered.filter(o => o.count > 0 || selected.includes(o.value)).length} available</span>
              {selected.length > 0 && <button onClick={() => { onChange([]); setSearch(''); }} style={{ background: 'none', border: 'none', color: 'var(--vg-primary-soft)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>}
            </div>
            <div style={{ overflowY: 'auto' }}>
              {filtered.map(opt => {
                const isSel = selected.includes(opt.value);
                const isUnavail = opt.count === 0 && !isSel;
                return (
                  <button key={opt.value} onClick={() => !isUnavail && toggle(opt.value)} disabled={isUnavail}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: isUnavail ? 'not-allowed' : 'pointer', border: 'none',
                      background: isSel ? 'rgba(0,217,146,0.2)' : 'transparent',
                      color: isUnavail ? 'rgba(255,255,255,0.2)' : isSel ? 'var(--vg-primary-soft)' : 'rgba(255,255,255,0.7)',
                      fontSize: 14, opacity: isUnavail ? 0.4 : 1,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, border: isSel ? 'none' : '1px solid rgba(255,255,255,0.2)', background: isSel ? 'var(--vg-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#fff' }}>
                        {isSel ? '✓' : ''}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label || opt.value}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 6px', borderRadius: 6, flexShrink: 0, background: isSel ? 'rgba(0,217,146,0.3)' : 'rgba(61,58,57,0.6)', color: isSel ? 'var(--vg-primary-soft)' : 'rgba(255,255,255,0.35)' }}>
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
