'use client';

import { useState, useRef, useCallback } from 'react';


// ── Client-side canonical filename preview ─────────────────────────────────────
// Parses filename to extract project number + stage, then builds canonical name.
// Format: "NNNN-NNN - S1BA - Project Name.pdf"
// This runs instantly on drop, before any upload.
function previewCanonical(filename: string): string | null {
  const base = filename.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
  // Try to detect project number: 4-digit dash 3-digit pattern
  const pnMatch = base.match(/\b(\d{4}-\d{3})\b/);
  // Try to detect stage label
  const stageMatch = base.match(/\b(S[1-4][A-Z]{0,3})\b/i) ||
                     base.match(/\bStage[\s_]?([1-4])\b/i) ||
                     base.match(/\b(stage[1-4])\b/i);
  const stageLabelMap: Record<string, string> = {
    's1': 'S1BA', 's1ba': 'S1BA', 'stage1': 'S1BA', 'stage 1': 'S1BA',
    's2': 'S2AA', 's2aa': 'S2AA', 'stage2': 'S2AA', 'stage 2': 'S2AA',
    's3': 'S3SA', 's3sa': 'S3SA', 'stage3': 'S3SA', 'stage 3': 'S3SA',
    's4': 'S4PRA','s4pra': 'S4PRA','stage4': 'S4PRA','stage 4': 'S4PRA',
    's3a': 'S3SAA','s3b': 'S3SAB',
  };
  const rawStage = stageMatch ? (stageMatch[1] || stageMatch[0]).toLowerCase().replace(/\s/g,'') : null;
  const stageLabel = rawStage ? (stageLabelMap[rawStage] || rawStage.toUpperCase()) : null;
  if (!pnMatch && !stageLabel) return null;
  // Extract project name: remove known prefixes
  let name = base
    .replace(/\b\d{4}-\d{3}\b/g, '')
    .replace(/\b(S[1-4][A-Za-z]*|Stage[\s_]?[1-4])[A-Za-z]*/gi, '')
    .replace(/[-_–]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Build canonical: "NNNN-NNN - STAGE - Name" or best guess
  const parts = [pnMatch?.[0], stageLabel, name].filter(Boolean);
  return parts.join(' - ');
}

type FileStatus = 'queued' | 'uploading' | 'done' | 'error';

type UploadFile = {
  id: string;
  file: File;
  status: FileStatus;
  project_number?: string;
  project_name?: string;
  stage?: number;
  label?: string;
  sub_label?: string;
  doc_type?: string;
  is_other_doc?: boolean;
  chars_extracted?: number;
  file_size_kb?: number;
  document_id?: string;
  canonical_filename?: string;
  was_overwrite?: boolean;
  error?: string;
  manualProject?: string;
  manualStage?: number;
  manualSubLabel?: string;
  showOverride?: boolean;
  // null = preview-pdf API responded but found no pattern
  // undefined = API call still in flight
  previewResolved?: boolean;
};

const STAGE_LABELS: Record<number, string> = {
  1: 'Stage 1 Business Analysis',
  2: 'Stage 2 Alternative Analysis',
  3: 'Stage 3 Solutions Analysis',
  4: 'Stage 4 Project Readiness & Approval',
};
const STAGE_COLOR: Record<number, string> = {
  1: '#818cf8', 2: '#a78bfa', 3: '#c084fc', 4: '#f59e0b'
};
const STAGE_BG: Record<number, string> = {
  1: 'rgba(99,102,241,0.12)', 2: 'rgba(139,92,246,0.12)', 3: 'rgba(124,58,237,0.12)', 4: 'rgba(180,83,9,0.12)'
};

let idCounter = 0;
const newId = () => `f${++idCounter}_${Date.now()}`;

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [analyzeAfter, setAnalyzeAfter] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<'idle'|'running'|'done'|'error'>('idle');
  const [analyzeLog, setAnalyzeLog] = useState<{pn: string; ok: boolean}[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(f => f.type === 'application/pdf');
    if (!arr.length) return;
    const newEntries = arr.map(f => ({
      id: newId(),
      file: f,
      status: 'queued' as FileStatus,
      canonical_filename: previewCanonical(f.name) || undefined,
      previewResolved: !!previewCanonical(f.name), // client-side hit = already resolved
    }));
    setFiles(prev => [...prev, ...newEntries]);
    // Call preview-pdf for each file to confirm/improve canonical name from PDF content
    newEntries.forEach(async (entry) => {
      try {
        const fd = new FormData();
        fd.append('pdf', entry.file);
        const res = await fetch('/api/castateintel/preview-pdf', { method: 'POST', body: fd });
        if (!res.ok) {
          // Mark resolved even on error so we stop showing spinner
          setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, previewResolved: true } : f));
          return;
        }
        const data = await res.json();
        setFiles(prev => prev.map(f => f.id === entry.id ? {
          ...f,
          canonical_filename: data.canonical_filename || f.canonical_filename,
          stage: data.stage || f.stage,
          previewResolved: true,
        } : f));
      } catch {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, previewResolved: true } : f));
      }
    });
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const update = (id: string, patch: Partial<UploadFile>) =>
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const remove = async (uf: UploadFile) => {
    // If already uploaded, delete from DB
    if (uf.document_id && uf.status === 'done') {
      try {
        await fetch('/api/castateintel/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: uf.document_id }),
        });
      } catch {}
    }
    setFiles(prev => prev.filter(f => f.id !== uf.id));
  };

  const uploadOne = async (uf: UploadFile): Promise<void> => {
    update(uf.id, { status: 'uploading' });
    const formData = new FormData();
    formData.append('pdf', uf.file);
    if (uf.manualProject) formData.append('project_number', uf.manualProject);
    if (uf.manualStage) formData.append('stage', String(uf.manualStage));
    if (uf.manualSubLabel) formData.append('sub_label', uf.manualSubLabel);
    try {
      const res = await fetch('/api/castateintel/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        update(uf.id, {
          status: 'done',
          project_number: data.project_number,
          sub_label: data.sub_label || '',
          doc_type: data.doc_type || '',
          is_other_doc: data.is_other_doc || false,
          project_name: data.project_name,
          stage: data.stage,
          label: data.label,
          chars_extracted: data.chars_extracted,
          file_size_kb: data.file_size_kb,
          document_id: data.document_id,
          canonical_filename: data.filename,
          was_overwrite: data.was_overwrite,
        });
      } else {
        const isProjectDetectionError = data.error?.includes('Could not detect project number');
        update(uf.id, {
          status: 'error',
          error: data.error ?? 'Upload failed',
          showOverride: isProjectDetectionError,
        });
      }
    } catch {
      update(uf.id, { status: 'error', error: 'Network error' });
    }
  };

  const runAll = async () => {
    const queued = files.filter(f => f.status === 'queued' || f.status === 'error');
    if (!queued.length) return;
    setRunning(true); abortRef.current = false;
    // Upload 3 at a time
    for (let i = 0; i < queued.length; i += 3) {
      if (abortRef.current) break;
      await Promise.all(queued.slice(i, i + 3).map(uploadOne));
    }
    // Auto-analyze if checked
    if (analyzeAfter && !abortRef.current) {
      const done = files.filter(f => f.status === 'done' && f.project_number);
      const projectNums = [...new Set(done.map(f => f.project_number!))];
      for (const pn of projectNums) {
        try {
          await fetch('/api/castateintel/analysis/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_number: pn }),
          });
        } catch {}
      }
    }
    setRunning(false);
  };

  const analyzeAll = async () => {
    const done = files.filter(f => f.status === 'done' && f.project_number);
    const projectNums = [...new Set(done.map(f => f.project_number!))];
    if (!projectNums.length) return;
    setAnalyzeStatus('running');
    setAnalyzeLog([]);
    const log: {pn: string; ok: boolean}[] = [];
    for (const pn of projectNums) {
      try {
        const res = await fetch('/api/castateintel/analysis/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_number: pn }),
        });
        log.push({ pn, ok: res.ok });
      } catch {
        log.push({ pn, ok: false });
      }
      setAnalyzeLog([...log]);
    }
    setAnalyzeStatus(log.every(l => l.ok) ? 'done' : 'error');
  };

  const queued = files.filter(f => f.status === 'queued').length;
  const done = files.filter(f => f.status === 'done').length;
  const errors = files.filter(f => f.status === 'error').length;
  const active = files.filter(f => f.status === 'uploading').length;
  const totalChars = files.filter(f => f.status === 'done').reduce((s, f) => s + (f.chars_extracted ?? 0), 0);
  const overwriteCount = files.filter(f => f.was_overwrite).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#f0f0f0" }}>
      
      {/* Header */}
      <div style={{ background: "#161616", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--vg-hairline)" }}>
        <div className="flex items-center gap-4">
          <a href="/CAStateIntel/documents" style={{ color: "#aaaaaa", textDecoration: "none", fontSize: 14 }}>← Documents</a>
          <div style={{ width: 1, height: 16, background: "#2a2a2a" }} />
          <span className="text-sm font-semibold">Bulk PDF Upload</span>
        </div>
        {files.length > 0 && (
          <div className="flex gap-3 text-xs items-center">
            <span className="text-white">{files.length} file{files.length !== 1 ? 's' : ''}</span>
            {done > 0 && <span className="text-green-400">· {done} uploaded</span>}
            {overwriteCount > 0 && <span className="text-amber-400">· {overwriteCount} overwritten</span>}
            {errors > 0 && <span className="text-red-400">· {errors} failed</span>}
            {active > 0 && <span className="text-blue-400">· {active} uploading</span>}
            {totalChars > 0 && <span className="text-white">· {totalChars.toLocaleString()} chars</span>}
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all mb-5
            ${dragging ? 'border-gray-900 bg-gray-100' : 'border-gray-300 bg-white hover:border-gray-400'}`}
        >
          <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          <div className="text-4xl mb-3">📂</div>
          <div className="text-base font-semibold text-gray-900">
            {dragging ? 'Drop PDFs here' : 'Drop multiple PDFs here'}
          </div>
          <div className="text-sm text-white mt-1">or click to browse — S1, S2, S3, or S4 documents</div>
          <div className="text-xs text-white mt-2">
            Project number, stage & label auto-detected · Existing files overwritten · Filenames standardized
          </div>
        </div>

        {/* Action bar */}
        {files.length > 0 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button onClick={runAll} disabled={running || (queued === 0 && errors === 0)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors
                ${(running || (queued === 0 && errors === 0)) ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-gray-700'}`}>
              {running
                ? `Uploading ${active} file${active !== 1 ? 's' : ''}...`
                : `⬆ Upload ${queued + errors} PDF${(queued + errors) !== 1 ? 's' : ''}`}
            </button>

            {done > 0 && !running && (
              <button onClick={analyzeAll}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                ⚡ Analyze All with AI
              </button>
            )}

            {running && (
              <button onClick={() => { abortRef.current = true; }}
                className="px-4 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                ✕ Stop
              </button>
            )}

            <label className="flex items-center gap-2 text-xs text-white cursor-pointer ml-1">
              <input type="checkbox" checked={analyzeAfter} onChange={e => setAnalyzeAfter(e.target.checked)}
                className="rounded" />
              Auto-analyze after upload
            </label>

            {analyzeStatus !== 'idle' && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                {analyzeStatus === 'running' && (
                  <span style={{ fontSize: 13, color: "#aaaaaa", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#494fdf", display: "inline-block", animation: "pulse 1s infinite" }} />
                    Extracting {analyzeLog.length} / {files.filter(f => f.status === "done" && f.project_number).length}…
                  </span>
                )}
                {analyzeStatus === 'done' && (
                  <span style={{ fontSize: 13, color: "#3dd6a8", fontWeight: 600 }}>
                    ✓ Extraction complete — {analyzeLog.filter(l => l.ok).length} projects analyzed
                  </span>
                )}
                {analyzeStatus === 'error' && (
                  <span style={{ fontSize: 13, color: "#f87171" }}>
                    ⚠ {analyzeLog.filter(l => !l.ok).length} failed
                  </span>
                )}
                {analyzeLog.map(l => (
                  <span key={l.pn} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: l.ok ? "rgba(0,168,126,0.15)" : "rgba(226,59,74,0.15)", color: l.ok ? "#3dd6a8" : "#f87171" }}>
                    {l.pn} {l.ok ? "✓" : "✗"}
                  </span>
                ))}
                <button onClick={() => { setAnalyzeStatus("idle"); setAnalyzeLog([]); }}
                  style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>
            )}
            {!running && (
              <button onClick={() => setFiles([])}
                className="ml-auto text-xs text-white hover:text-white">
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Progress bar */}
        {running && files.length > 0 && (
          <div className="mb-4">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gray-900 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((done / files.length) * 100)}%` }} />
            </div>
            <p className="text-xs text-white mt-1">{done} of {files.length} complete</p>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {files.map((uf, i) => (
              <div key={uf.id}
                className={`px-4 py-3 ${i < files.length - 1 ? 'border-b border-gray-100' : ''}
                  ${uf.status === 'done' ? 'bg-green-50/30' : uf.status === 'error' ? 'bg-red-50/30' : 'bg-white'}`}>
                <div className="flex items-start gap-3">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                    ${uf.status === 'done' ? 'bg-green-500' :
                      uf.status === 'error' ? 'bg-red-500' :
                      uf.status === 'uploading' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />

                  <div className="flex-1 min-w-0">
                    {/* Filename row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 truncate max-w-xs">{uf.file.name}</span>
                      <span style={{ fontSize: 12, color: "#aaaaaa" }}>{(uf.file.size / 1024).toFixed(0)} KB</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${uf.status === 'done' ? 'bg-green-100 text-green-700' :
                          uf.status === 'error' ? 'bg-red-100 text-red-700' :
                          uf.status === 'uploading' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-white'}`}>
                        {uf.status === 'uploading' ? 'Uploading...' : uf.status}
                      </span>
                      {uf.was_overwrite && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          ↺ Overwritten
                        </span>
                      )}
                    </div>

                    {/* Canonical filename preview — visible for queued/uploading files so user can
                        decide whether to proceed before committing to the upload */}
                    {(uf.status === 'queued' || uf.status === 'uploading') && (
                      <div style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 5 }}>
                        {!uf.previewResolved && !uf.canonical_filename ? (
                          // API call still in flight and client-side parse also missed
                          <span style={{ color: '#666', fontSize: 11 }}>Detecting S1–S4 pattern…</span>
                        ) : uf.canonical_filename && uf.canonical_filename !== uf.file.name ? (
                          // Pattern found — show what it will be saved as
                          <span>
                            <span style={{ color: 'rgba(0,217,146,0.7)', fontSize: 11 }}>Will import as: </span>
                            <span style={{ color: '#00d992', fontWeight: 600 }}>{uf.canonical_filename}</span>
                          </span>
                        ) : uf.previewResolved ? (
                          // API responded but no S1–S4 pattern found
                          <span style={{ color: '#888', fontSize: 11 }}>⚠ No S1–S4 pattern detected — filename will be used as-is</span>
                        ) : null}
                      </div>
                    )}

                    {/* Success details */}
                    {uf.status === 'done' && uf.project_number && (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
                            {uf.project_number}
                          </span>
                          {uf.stage && uf.stage > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: STAGE_BG[uf.stage], color: STAGE_COLOR[uf.stage] }}>
                              Stage {uf.stage}{uf.sub_label ? `${uf.sub_label}` : ''}
                            </span>
                          )}
                          {uf.is_other_doc && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(0,217,146,0.08)', color: '#065F46' }}>
                              📎 Other Doc
                            </span>
                          )}
                          <span className="text-xs text-white">{uf.chars_extracted?.toLocaleString()} chars</span>
                          {uf.stage && uf.stage > 0 && (
                            <a href={`/CAStateIntel/stage${uf.stage}?project=${uf.project_number}`}
                              className="text-xs text-blue-600 hover:underline">View Analysis →</a>
                          )}
                        </div>
                        {/* Confirmed canonical filename after upload */}
                        {uf.canonical_filename && (
                          <div style={{ fontSize: 12, color: "#aaaaaa", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {uf.canonical_filename !== uf.file.name ? (
                              <span>
                                <span style={{color:"#888",fontSize:11}}>Original: </span>
                                <span style={{color:"#ccc",fontSize:12}}>{uf.file.name}</span>
                                <br/>
                                <span style={{color:"rgba(0,217,146,0.7)",fontSize:11}}>Imported as: </span>
                                <span style={{color:"#00d992",fontWeight:600}}>{uf.canonical_filename}</span>
                              </span>
                            ) : (
                              <span>📄 {uf.file.name}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {uf.status === 'error' && (
                      <p style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>{uf.error}</p>
                    )}

                    {/* Manual override */}
          {uf.showOverride && (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid var(--vg-hairline)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#e8e8e8', marginBottom: 6 }}>Manual Override</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <input type="text" placeholder="Project # (e.g. 4440-127)"
                          value={uf.manualProject || ''}
                          onChange={e => update(uf.id, { manualProject: e.target.value })}
                          style={{ border: '1px solid var(--vg-hairline)', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: 160 }} />
                        <select value={uf.manualStage || ''}
                          onChange={e => update(uf.id, { manualStage: parseInt(e.target.value) || undefined })}
                          style={{ border: '1px solid var(--vg-hairline)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                          <option value="">Auto-detect stage</option>
                          <option value="1">Stage 1 — Business Analysis</option>
                          <option value="2">Stage 2 — Alternative Analysis</option>
                          <option value="3">Stage 3 — Solutions Analysis</option>
                          <option value="4">Stage 4 — Project Readiness</option>
                          <option value="0">Other document (non-stage)</option>
                        </select>
                        <select value={uf.manualSubLabel || ''}
                          onChange={e => update(uf.id, { manualSubLabel: e.target.value || undefined })}
                          style={{ border: '1px solid var(--vg-hairline)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                          title="Use A or B if this is one of multiple docs for the same stage">
                          <option value="">No sub-label (single doc)</option>
                          <option value="A">Part A</option>
                          <option value="B">Part B</option>
                          <option value="C">Part C</option>
                        </select>
                        <button
                          onClick={() => uploadOne(uf)}
                          style={{
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#00d992',
                            color: '#000',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          Retry Upload
                        </button>
                      </div>
                    </div>
                  )}
                  </div>

                  {/* Delete button */}
                  <button onClick={() => remove(uf)}
                    disabled={uf.status === 'uploading'}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}
                    title={uf.status === 'done' ? 'Delete from DB + analysis' : 'Remove'}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {[
              { icon: '🏷️', title: 'Auto-detects S1–S4', desc: 'Project number and stage extracted from PDF. Stage 4 (S4PRA) now fully supported.' },
              { icon: '↺', title: 'Overwrites existing', desc: 'Re-uploading a file for the same project+stage replaces the PDF and wipes prior analysis.' },
              { icon: '🗑️', title: 'Delete cleans up', desc: 'Deleting a file removes its contacts and analysis — but not contacts from other stages.' },
              { icon: '📄', title: 'Standardized filenames', desc: 'Files saved as ####-### - S#ABR - Project Name.pdf in the database.' },
            ].map(c => (
              <div key={c.title} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-2xl mb-2">{c.icon}</div>
                <div className="text-sm font-semibold text-gray-900 mb-1">{c.title}</div>
                <div className="text-xs text-white leading-relaxed">{c.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
