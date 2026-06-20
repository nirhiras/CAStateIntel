'use client';

import { useEffect, useState, useCallback } from 'react';

type Document = {
  id: number;
  project_id: number;
  project_number: string;
  project_name: string;
  stage: number;
  label: string;
  document_id: string;
  download_url: string;
  file_size_kb: number | null;
  downloaded_at: string | null;
  content_text: string | null;
};

type Project = {
  project_number: string;
  name: string;
  pal_stage: string;
  department_name: string;
  agency_name: string;
  documents: Document[];
};

const STAGE_DOT: Record<number, string> = { 3: '#C2410C', 2: '#15803D', 1: '#1D4ED8' };
const STAGE_BG: Record<number, string> = { 3: '#FFF7ED', 2: '#F0FDF4', 1: '#EFF6FF' };

export default function DocumentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [textSearch, setTextSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/castateintel/projects')
      .then(r => r.json())
      .then(async (list) => {
        const full: Project[] = await Promise.all(
          list.map((p: { project_number: string }) =>
            fetch(`/api/castateintel/projects?project=${p.project_number}`).then(r => r.json())
          )
        );
        setProjects(full);
        setLoading(false);
      });
  }, []);

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.project_number.includes(search);
    const matchStage = !stageFilter || p.pal_stage === stageFilter;
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
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", background: '#F8F7F5', color: '#1A1A1A' }}>
      <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid #E5E3DF', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #E5E3DF' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#6B6861', textTransform: 'uppercase', marginBottom: 12 }}>PAL Documents</div>
          <input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', border: '1px solid #E5E3DF', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#F8F7F5', outline: 'none', boxSizing: 'border-box' }} />
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
          {loading ? <div style={{ padding: 24, color: '#9B9589', fontSize: 13, textAlign: 'center' }}>Loading...</div>
            : filtered.map(p => (
            <div key={p.project_number} onClick={() => { setSelectedProject(p); setSelectedDoc(p.documents?.[0] ?? null); setPdfOpen(false); }}
              style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F0EFED', background: selectedProject?.project_number === p.project_number ? '#F0EFED' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', color: '#9B9589' }}>{p.project_number}</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: STAGE_BG[parseInt(p.pal_stage?.slice(-1))] ?? '#f5f5f5',
                  color: STAGE_DOT[parseInt(p.pal_stage?.slice(-1))] ?? '#333', fontWeight: 600 }}>{p.pal_stage}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#9B9589', marginTop: 3 }}>{p.documents?.length ?? 0} doc{(p.documents?.length ?? 0) !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!selectedProject ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9B9589' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Select a project</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Choose from the list to view documents</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E3DF', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9B9589', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {selectedProject.agency_name} · {selectedProject.department_name}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedProject.name}</div>
                <div style={{ fontSize: 12, color: '#9B9589', marginTop: 2 }}>{selectedProject.project_number}</div>
              </div>
              <a href="/CAStateIntel/upload" style={{ fontSize: 13, padding: '8px 16px', background: '#F0EFED', borderRadius: 8, textDecoration: 'none', color: '#1A1A1A', fontWeight: 500 }}>+ Upload PDF</a>
            </div>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E3DF', background: '#fff', padding: '0 24px' }}>
              {selectedProject.documents?.map(doc => (
                <button key={doc.id} onClick={() => { setSelectedDoc(doc); setPdfOpen(false); }}
                  style={{ padding: '10px 16px', fontSize: 13, border: 'none', borderBottom: selectedDoc?.id === doc.id ? '2px solid #1A1A1A' : '2px solid transparent',
                    background: 'transparent', cursor: 'pointer', fontWeight: selectedDoc?.id === doc.id ? 600 : 400,
                    color: selectedDoc?.id === doc.id ? '#1A1A1A' : '#6B6861', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_DOT[doc.stage] ?? '#ccc', display: 'inline-block' }} />
                  {doc.label}
                  {doc.file_size_kb && <span style={{ fontSize: 10, color: '#B0AC9F' }}>({doc.file_size_kb}KB)</span>}
                </button>
              ))}
            </div>
            {selectedDoc && (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: 24, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9B9589', fontSize: 14 }}>🔍</span>
                      <input type="text" placeholder="Search within document..." value={textSearch} onChange={e => setTextSearch(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #E5E3DF', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                    </div>
                    <button onClick={() => setPdfOpen(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                      {pdfOpen ? '📄 Hide PDF' : '📄 View Source PDF'}
                    </button>
                    <a href={`/api/castateintel/pdf/${selectedDoc.document_id}`} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#F0EFED', color: '#1A1A1A', borderRadius: 8, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
                      ↓ Download
                    </a>
                  </div>
                  {textSearch && selectedDoc.content_text && (() => {
                    const snippets = getSnippets(selectedDoc.content_text, textSearch);
                    return snippets && snippets.length > 0 ? (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B9589', marginBottom: 10 }}>
                          {snippets.length} match{snippets.length !== 1 ? 'es' : ''} found
                        </div>
                        {snippets.map((snippet, i) => (
                          <div key={i} style={{ padding: '12px 16px', background: '#fff', border: '1px solid #E5E3DF', borderRadius: 8, marginBottom: 8, fontSize: 13, lineHeight: 1.6, color: '#3D3A35' }}>
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
                    <div style={{ background: '#fff', border: '1px solid #E5E3DF', borderRadius: 12, padding: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B9589', marginBottom: 16 }}>
                        Extracted Text — {selectedDoc.content_text.length.toLocaleString()} characters
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.8, color: '#3D3A35', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
                        {textSearch ? renderHighlighted(selectedDoc.content_text, textSearch) : selectedDoc.content_text}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9B9589', background: '#fff', borderRadius: 12, border: '1px solid #E5E3DF' }}>
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
