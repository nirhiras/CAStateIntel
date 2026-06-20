'use client';

import { useState, useRef, useCallback } from 'react';

type FileStatus = 'queued' | 'uploading' | 'extracting' | 'saving' | 'done' | 'error';

type UploadFile = {
  id: string;
  file: File;
  status: FileStatus;
  project_number?: string;
  stage?: number;
  label?: string;
  chars_extracted?: number;
  file_size_kb?: number;
  document_id?: string;
  error?: string;
  manualProject?: string;
  manualStage?: number;
  manualLabel?: string;
  showOverride?: boolean;
};

const STAGE_LABELS: Record<number, string> = {
  1: 'Stage 1 Business Analysis',
  2: 'Stage 2 Alternative Analysis',
  3: 'Stage 3 Solutions Analysis',
};
const STAGE_COLOR: Record<number, string> = { 3: '#C2410C', 2: '#15803D', 1: '#1D4ED8' };
const STAGE_BG: Record<number, string> = { 3: '#FFF7ED', 2: '#F0FDF4', 1: '#EFF6FF' };
const STATUS_CONFIG: Record<FileStatus, { label: string; color: string; bg: string }> = {
  queued:    { label: 'Queued',     color: '#9B9589', bg: '#F0EFED' },
  uploading: { label: 'Uploading',  color: '#1D4ED8', bg: '#EFF6FF' },
  extracting:{ label: 'Extracting', color: '#7C3AED', bg: '#F5F3FF' },
  saving:    { label: 'Saving',     color: '#0891B2', bg: '#ECFEFF' },
  done:      { label: 'Done',       color: '#15803D', bg: '#F0FDF4' },
  error:     { label: 'Error',      color: '#DC2626', bg: '#FFF5F5' },
};

let idCounter = 0;
const newId = () => `f${++idCounter}_${Date.now()}`;

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(f => f.type === 'application/pdf');
    if (!arr.length) return;
    setFiles(prev => [...prev, ...arr.map(f => ({ id: newId(), file: f, status: 'queued' as FileStatus }))]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const updateFile = (id: string, patch: Partial<UploadFile>) =>
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const uploadOne = async (uf: UploadFile): Promise<void> => {
    updateFile(uf.id, { status: 'uploading' });
    const formData = new FormData();
    formData.append('pdf', uf.file);
    if (uf.manualProject) formData.append('project_number', uf.manualProject);
    if (uf.manualStage) formData.append('stage', String(uf.manualStage));
    if (uf.manualLabel) formData.append('label', uf.manualLabel);
    try {
      updateFile(uf.id, { status: 'extracting' });
      const res = await fetch('/api/castateintel/upload', { method: 'POST', body: formData });
      updateFile(uf.id, { status: 'saving' });
      const data = await res.json();
      if (data.success) {
        updateFile(uf.id, { status: 'done', project_number: data.project_number, stage: data.stage,
          label: data.label, chars_extracted: data.chars_extracted, file_size_kb: data.file_size_kb, document_id: data.document_id });
      } else {
        updateFile(uf.id, { status: 'error', error: data.error ?? 'Upload failed' });
      }
    } catch (e) {
      updateFile(uf.id, { status: 'error', error: 'Network error — check console' });
    }
  };

  const runAll = async () => {
    const queued = files.filter(f => f.status === 'queued' || f.status === 'error');
    if (!queued.length) return;
    setRunning(true); abortRef.current = false;
    for (let i = 0; i < queued.length; i += 2) {
      if (abortRef.current) break;
      await Promise.all(queued.slice(i, i + 2).map(uploadOne));
    }
    setRunning(false);
  };

  const clearDone = () => setFiles(prev => prev.filter(f => f.status !== 'done'));
  const clearAll = () => { if (!running) setFiles([]); };

  const queued = files.filter(f => f.status === 'queued').length;
  const done = files.filter(f => f.status === 'done').length;
  const errors = files.filter(f => f.status === 'error').length;
  const active = files.filter(f => ['uploading','extracting','saving'].includes(f.status)).length;
  const totalChars = files.filter(f => f.status === 'done').reduce((s, f) => s + (f.chars_extracted ?? 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F5', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ background: '#1A1A1A', color: '#fff', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/CAStateIntel/documents" style={{ color: '#9B9589', fontSize: 13, textDecoration: 'none' }}>← Documents</a>
          <div style={{ width: 1, height: 16, background: '#3D3D3D' }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Bulk PDF Upload</span>
        </div>
        {files.length > 0 && (
          <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <span style={{ color: '#9B9589' }}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
            {done > 0 && <span style={{ color: '#15803D' }}>· {done} done</span>}
            {errors > 0 && <span style={{ color: '#EF4444' }}>· {errors} failed</span>}
            {active > 0 && <span style={{ color: '#60A5FA' }}>· {active} processing</span>}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? '#1A1A1A' : '#C8C5BF'}`, borderRadius: 14, padding: '36px 32px',
            textAlign: 'center', cursor: 'pointer', background: dragging ? '#F0EFED' : '#fff', transition: 'all 0.15s ease', marginBottom: 20 }}>
          <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>{dragging ? 'Drop PDFs here' : 'Drop multiple PDFs here'}</div>
          <div style={{ fontSize: 13, color: '#9B9589', marginTop: 6 }}>or click to browse — select as many as you need</div>
          <div style={{ fontSize: 11, color: '#B0AC9F', marginTop: 10 }}>Project number, stage & label auto-detected from each PDF</div>
        </div>

        {files.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button onClick={runAll} disabled={running || (queued === 0 && errors === 0)}
              style={{ padding: '10px 20px', background: (running || (queued === 0 && errors === 0)) ? '#C8C5BF' : '#1A1A1A',
                color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
                cursor: (running || (queued === 0 && errors === 0)) ? 'not-allowed' : 'pointer' }}>
              {running ? `Processing ${active} file${active !== 1 ? 's' : ''}...` : `Upload ${queued + errors} PDF${(queued + errors) !== 1 ? 's' : ''}`}
            </button>
            {running && <button onClick={() => { abortRef.current = true; }}
              style={{ padding: '10px 16px', background: '#FFF5F5', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>
              Stop
            </button>}
            {done > 0 && !running && <button onClick={clearDone}
              style={{ padding: '10px 16px', background: '#F0EFED', color: '#6B6861', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>
              Clear done ({done})
            </button>}
            {!running && <button onClick={clearAll}
              style={{ padding: '10px 16px', background: 'transparent', color: '#9B9589', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>
              Clear all
            </button>}
            {done > 0 && totalChars > 0 && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6B6861' }}>
              {totalChars.toLocaleString()} chars extracted
            </span>}
          </div>
        )}

        {running && files.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 4, background: '#E5E3DF', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: '#1A1A1A', transition: 'width 0.4s ease',
                width: `${Math.round((done / files.length) * 100)}%` }} />
            </div>
            <div style={{ fontSize: 11, color: '#9B9589', marginTop: 5 }}>{done} of {files.length} complete</div>
          </div>
        )}

        {files.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E3DF', overflow: 'hidden' }}>
            {files.map((uf, i) => {
              const sc = STATUS_CONFIG[uf.status];
              const isActive = ['uploading','extracting','saving'].includes(uf.status);
              return (
                <div key={uf.id} style={{ padding: '14px 18px', borderBottom: i < files.length - 1 ? '1px solid #F0EFED' : 'none',
                  background: uf.status === 'done' ? '#FAFFFE' : uf.status === 'error' ? '#FFFAFA' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: sc.color,
                      boxShadow: isActive ? `0 0 0 3px ${sc.bg}` : 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                          {uf.file.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#9B9589' }}>{(uf.file.size / 1024).toFixed(0)} KB</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, background: sc.bg, color: sc.color }}>
                          {isActive ? sc.label + '...' : sc.label}
                        </span>
                      </div>
                      {uf.status === 'done' && uf.project_number && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', background: '#F0EFED', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                            {uf.project_number}
                          </span>
                          {uf.stage && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                            background: STAGE_BG[uf.stage] ?? '#f5f5f5', color: STAGE_COLOR[uf.stage] ?? '#333' }}>
                            Stage {uf.stage}
                          </span>}
                          <span style={{ fontSize: 11, color: '#6B6861' }}>{uf.label}</span>
                          <span style={{ fontSize: 11, color: '#9B9589' }}>· {uf.chars_extracted?.toLocaleString()} chars</span>
                          <a href="/CAStateIntel/documents" style={{ fontSize: 11, color: '#1D4ED8', textDecoration: 'none' }}>View →</a>
                        </div>
                      )}
                      {uf.status === 'error' && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{uf.error}</div>}
                      {(uf.status === 'queued' || uf.status === 'error') && (
                        <div style={{ marginTop: 6 }}>
                          <button onClick={() => updateFile(uf.id, { showOverride: !uf.showOverride })}
                            style={{ fontSize: 11, color: '#9B9589', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            {uf.showOverride ? '▾ hide overrides' : '▸ override auto-detect'}
                          </button>
                          {uf.showOverride && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                              <input type="text" placeholder="Project # (auto)" value={uf.manualProject ?? ''}
                                onChange={e => updateFile(uf.id, { manualProject: e.target.value })}
                                style={{ width: 130, padding: '5px 8px', border: '1px solid #E5E3DF', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                              <select value={uf.manualStage ?? 0}
                                onChange={e => updateFile(uf.id, { manualStage: parseInt(e.target.value),
                                  manualLabel: parseInt(e.target.value) ? STAGE_LABELS[parseInt(e.target.value)] : '' })}
                                style={{ padding: '5px 8px', border: '1px solid #E5E3DF', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff' }}>
                                <option value={0}>Stage (auto)</option>
                                <option value={1}>Stage 1</option>
                                <option value={2}>Stage 2</option>
                                <option value={3}>Stage 3</option>
                              </select>
                              <input type="text" placeholder="Label (auto)" value={uf.manualLabel ?? ''}
                                onChange={e => updateFile(uf.id, { manualLabel: e.target.value })}
                                style={{ flex: 1, minWidth: 160, padding: '5px 8px', border: '1px solid #E5E3DF', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {!isActive && <button onClick={() => removeFile(uf.id)}
                      style={{ fontSize: 18, color: '#C8C5BF', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: '0 4px' }}>×</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {files.length === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
            {[
              { icon: '🏷️', title: 'Auto-detects everything', desc: 'Project number, stage (1/2/3), and label extracted from PDF content.' },
              { icon: '⚡', title: 'Parallel processing', desc: 'Uploads 2 PDFs simultaneously. Drop a whole folder at once.' },
              { icon: '🗄️', title: 'Stored in database', desc: 'PDF binary and extracted text saved to Postgres.' },
              { icon: '🔎', title: 'Instantly searchable', desc: 'Full-text search available immediately after upload.' },
            ].map(card => (
              <div key={card.title} style={{ background: '#fff', border: '1px solid #E5E3DF', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: '#6B6861', lineHeight: 1.6 }}>{card.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
