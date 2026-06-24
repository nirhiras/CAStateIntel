'use client';

import { useEffect, useState, useCallback } from 'react';

type Doc = {
  id: number;
  document_id: string;
  project_number: string;
  project_name: string;
  stage: number;
  label: string;
  sub_label: string | null;
  doc_type: string | null;
  short_description: string | null;
  file_size_kb: number | null;
  downloaded_at: string | null;
  content_text: string | null;
};

type ProjectGroup = {
  project_number: string;
  project_name: string;
  docs: Doc[];
};

const STAGE_COLOR: Record<number, { dot: string; bg: string; text: string }> = {
  1: { dot: '#1D4ED8', bg: '#EFF6FF', text: '#1D4ED8' },
  2: { dot: '#15803D', bg: '#F0FDF4', text: '#15803D' },
  3: { dot: '#C2410C', bg: '#FFF7ED', text: '#C2410C' },
};

export default function DocumentsPage() {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectGroup | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [textSearch, setTextSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch ALL documents in one call, group by project
    fetch('/api/castateintel/documents')
      .then(r => r.json())
      .then((docs: Doc[]) => {
        const map = new Map<string, ProjectGroup>();
        docs.forEach(doc => {
          if (!map.has(doc.project_number)) {
            map.set(doc.project_number, {
              project_number: doc.project_number,
              project_name: doc.project_name,
              docs: [],
            });
          }
          map.get(doc.project_number)!.docs.push(doc);
        });
        setGroups(Array.from(map.values()));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = groups.filter(g => {
    const matchSearch = !search || g.project_name.toLowerCase().includes(search.toLowerCase()) || g.project_number.includes(search);
    const matchStage = !stageFilter || g.docs.some(d => d.stage === parseInt(stageFilter.slice(-1)));
    return matchSearch && matchStage;
  });

  const highlight = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '___H___$1___E___');
  }, []);

  const renderHighlighted = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const parts = highlight(text, query).split(/(___H___.*?___E___)/g);
    return <>{parts.map((part, i) => {
      if (part.startsWith('___H___')) {
        const word = part.replace('___H___', '').replace('___E___', '');
        return <mark key={i} style={{ background: '#FEF08A', padding: '0 1px', borderRadius: 2 }}>{word}</mark>;
      }
      return <span key={i}>{part}</span>;
    })}</>;
  };

  const getSnippets = (text: string, query: string) => {
    if (!query.trim() || !text) return null;
    const regex = new RegExp(`.{0,120}${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{0,120}`, 'gi');
    return (text.match(regex) || []).slice(0, 5);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", background: 'rgba(255,255,255,0.04)', color: '#ffffff' }}>
      {/* LEFT PANEL — project list */}
      <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--vg-hairline)', background: 'var(--vg-canvas-soft)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--vg-hairline)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 12 }}>PAL Documents</div>
          <input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', border: '1px solid var(--vg-hairline)', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: 'rgba(255,255,255,0.04)', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {['', 'Stage 3', 'Stage 2', 'Stage 1'].map(s => (
              <button key={s} onClick={() => setStageFilter(s)}
                style={{ flex: 1, padding: '4px 0', fontSize: 11, border: '1px solid', borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                  borderColor: stageFilter === s ? '#1A1A1A' : '#E5E3DF', background: stageFilter === s ? '#1A1A1A' : 'transparent',
                  color: stageFilter === s ? '#fff' : '#6B6861' }}>{s || 'All'}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading
            ? <div style={{ padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' }}>Loading...</div>
            : filtered.length === 0
              ? <div style={{ padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' }}>No projects found</div>
              : filtered.map(g => (
            <div key={g.project_number}
              onClick={() => { setSelectedProject(g); setSelectedDoc(g.docs[0] ?? null); setPdfOpen(false); }}
              style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F0EFED',
                background: selectedProject?.project_number === g.project_number ? '#F0EFED' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.3)' }}>{g.project_number}</span>
                {g.docs.map(d => (
                  <span key={d.document_id} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20,
                    background: d.stage === 0 ? '#ECFDF5' : (STAGE_COLOR[d.stage]?.bg ?? '#f5f5f5'),
                    color: d.stage === 0 ? '#065F46' : (STAGE_COLOR[d.stage]?.text ?? '#333'), fontWeight: 600 }}>
                    {d.stage === 0 ? '📎' : `S${d.stage}${d.sub_label || ''}`}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{g.project_name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{g.docs.length} doc{g.docs.length !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!selectedProject ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Select a project</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Choose from the list to view documents</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--vg-hairline)', background: 'var(--vg-canvas-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedProject.project_name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{selectedProject.project_number}</div>
              </div>
              <a href="/CAStateIntel/upload" style={{ fontSize: 13, padding: '8px 16px', background: 'var(--vg-hairline)', borderRadius: 8, textDecoration: 'none', color: '#ffffff', fontWeight: 500 }}>+ Upload PDF</a>
            </div>

            {/* Doc tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--vg-hairline)', background: 'var(--vg-canvas-soft)', padding: '0 24px' }}>
              {selectedProject.docs.map(doc => (
                <button key={doc.id} onClick={() => { setSelectedDoc(doc); setPdfOpen(false); }}
                  style={{ padding: '10px 16px', fontSize: 13, border: 'none',
                    borderBottom: selectedDoc?.id === doc.id ? '2px solid #1A1A1A' : '2px solid transparent',
                    background: 'transparent', cursor: 'pointer',
                    fontWeight: selectedDoc?.id === doc.id ? 600 : 400,
                    color: selectedDoc?.id === doc.id ? '#1A1A1A' : '#6B6861',
                    display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: doc.stage === 0 ? '#059669' : (STAGE_COLOR[doc.stage]?.dot ?? '#ccc'), display: 'inline-block' }} />
                  {doc.stage === 0 ? (doc.short_description || doc.label) : doc.label}
                  {doc.sub_label && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', background: '#EEF2FF', color: '#4F46E5', borderRadius: 4 }}>Part {doc.sub_label}</span>}
                  {doc.file_size_kb && <span style={{ fontSize: 10, color: '#B0AC9F' }}>({doc.file_size_kb}KB)</span>}
                </button>
              ))}
            </div>

            {selectedDoc && (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: 24, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>🔍</span>
                      <input type="text" placeholder="Search within document..." value={textSearch} onChange={e => setTextSearch(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--vg-hairline)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--vg-canvas-soft)' }} />
                    </div>
                    <button onClick={() => setPdfOpen(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                      {pdfOpen ? '📄 Hide PDF' : '📄 View Source PDF'}
                    </button>
                    <a href={`/api/castateintel/pdf/${selectedDoc.document_id}`} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--vg-hairline)', color: '#ffffff', borderRadius: 8, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
                      ↓ Download
                    </a>
                  </div>

                  {textSearch && selectedDoc.content_text && (() => {
                    const snippets = getSnippets(selectedDoc.content_text, textSearch);
                    return snippets && snippets.length > 0 ? (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                          {snippets.length} match{snippets.length !== 1 ? 'es' : ''} found
                        </div>
                        {snippets.map((snippet, i) => (
                          <div key={i} style={{ padding: '12px 16px', background: 'var(--vg-canvas-soft)', border: '1px solid var(--vg-hairline)', borderRadius: 8, marginBottom: 8, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}>
                            ...{renderHighlighted(snippet, textSearch)}...
                          </div>
                        ))}
                        <div style={{ height: 1, background: '#E5E3DF', margin: '20px 0' }} />
                      </div>
                    ) : (
                      <div style={{ padding: '12px 16px', background: '#FFF8F0', border: '1px solid #FDE8C8', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#9B6B1A' }}>
                        No matches for &ldquo;{textSearch}&rdquo;
                      </div>
                    );
                  })()}

                  {selectedDoc.content_text ? (
                    <div style={{ background: 'var(--vg-canvas-soft)', border: '1px solid var(--vg-hairline)', borderRadius: 12, padding: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
                        Extracted Text — {selectedDoc.content_text.length.toLocaleString()} characters
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
                        {textSearch ? renderHighlighted(selectedDoc.content_text, textSearch) : selectedDoc.content_text}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', background: 'var(--vg-canvas-soft)', borderRadius: 12, border: '1px solid var(--vg-hairline)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Text not yet extracted</div>
                    </div>
                  )}
                </div>

                {pdfOpen && (
                  <div style={{ width: 520, flexShrink: 0, borderLeft: '1px solid #E5E3DF', display: 'flex', flexDirection: 'column', background: '#2D2D2D' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #3D3D3D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#D0CEC9' }}>Source PDF</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={`/api/castateintel/pdf/${selectedDoc.document_id}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, padding: '4px 10px', background: '#3D3D3D', color: '#D0CEC9', borderRadius: 6, textDecoration: 'none' }}>Open in tab ↗</a>
                        <button onClick={() => setPdfOpen(false)}
                          style={{ fontSize: 11, padding: '4px 10px', background: '#3D3D3D', color: '#D0CEC9', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                    <iframe src={`/api/castateintel/pdf/${selectedDoc.document_id}#toolbar=1&navpanes=0`} style={{ flex: 1, border: 'none', width: '100%' }} title={selectedDoc.label} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
