'use client';

import { useState, useRef, useCallback } from 'react';

type UploadResult = {
  success: boolean;
  document_id?: string;
  filename?: string;
  file_size_kb?: number;
  chars_extracted?: number;
  project_number?: string;
  label?: string;
  error?: string;
};

type RecentUpload = {
  id: string;
  filename: string;
  project_number: string;
  label: string;
  size_kb: number;
  chars: number;
  uploaded_at: Date;
};

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [projectNumber, setProjectNumber] = useState('');
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState('1');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [progress, setProgress] = useState<'idle'|'uploading'|'extracting'|'saving'|'done'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
  }, []);

  const handleSubmit = async () => {
    if (!file || !projectNumber.trim() || !label.trim()) return;
    setUploading(true);
    setResult(null);
    setProgress('uploading');
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('project_number', projectNumber.trim());
    formData.append('label', label.trim());
    formData.append('stage', stage);
    try {
      setProgress('extracting');
      const res = await fetch('/api/castateintel/upload', { method: 'POST', body: formData });
      setProgress('saving');
      const data: UploadResult = await res.json();
      setProgress('done');
      setResult(data);
      if (data.success && data.document_id) {
        setRecentUploads(prev => [{
          id: data.document_id!, filename: data.filename!, project_number: data.project_number!,
          label: data.label!, size_kb: data.file_size_kb!, chars: data.chars_extracted!, uploaded_at: new Date(),
        }, ...prev.slice(0, 9)]);
        setFile(null); setProjectNumber(''); setLabel('');
      }
    } catch {
      setResult({ success: false, error: 'Upload failed — please try again.' });
      setProgress('idle');
    } finally {
      setUploading(false);
    }
  };

  const STEPS = [
    { key: 'uploading', label: 'Uploading PDF' },
    { key: 'extracting', label: 'Extracting text' },
    { key: 'saving', label: 'Saving to database' },
    { key: 'done', label: 'Complete' },
  ];
  const progressIndex = STEPS.findIndex(s => s.key === progress);

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F5', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ background: '#1A1A1A', color: '#fff', padding: '18px 40px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <a href="/CAStateIntel/documents" style={{ color: '#9B9589', fontSize: 13, textDecoration: 'none' }}>← Back to documents</a>
        <div style={{ width: 1, height: 16, background: '#3D3D3D' }} />
        <div style={{ fontSize: 15, fontWeight: 600 }}>Upload PDF Document</div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1A1A1A' }}>Add a document</h1>
          <p style={{ fontSize: 14, color: '#6B6861', marginTop: 8 }}>Upload a PAL PDF — text is extracted automatically and stored for full-text search.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#1A1A1A' : file ? '#15803D' : '#C8C5BF'}`, borderRadius: 12, padding: 32,
                textAlign: 'center', cursor: 'pointer', background: dragging ? '#F0EFED' : file ? '#F0FDF4' : '#fff', transition: 'all 0.15s ease' }}>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              {file ? (
                <><div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#15803D' }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: '#6B6861', marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · click to change</div></>
              ) : (
                <><div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Drop PDF here</div>
                  <div style={{ fontSize: 12, color: '#9B9589', marginTop: 4 }}>or click to browse</div></>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6861', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Project Number</label>
              <input type="text" placeholder="e.g. 4265-081" value={projectNumber} onChange={e => setProjectNumber(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #E5E3DF', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6861', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>PAL Stage</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['1','Business Analysis'],['2','Alternative Analysis'],['3','Solutions Analysis']].map(([v, name]) => (
                  <button key={v} onClick={() => { setStage(v); setLabel(`Stage ${v} ${name}`); }}
                    style={{ flex: 1, padding: '9px 0', fontSize: 12, border: '1px solid', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                      borderColor: stage === v ? '#1A1A1A' : '#E5E3DF', background: stage === v ? '#1A1A1A' : '#fff', color: stage === v ? '#fff' : '#6B6861' }}>
                    S{v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6861', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Document Label</label>
              <input type="text" placeholder="e.g. Stage 1 Business Analysis" value={label} onChange={e => setLabel(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #E5E3DF', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
            </div>

            <button onClick={handleSubmit} disabled={!file || !projectNumber || !label || uploading}
              style={{ padding: '12px 0', background: (!file || !projectNumber || !label || uploading) ? '#C8C5BF' : '#1A1A1A',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: (!file || !projectNumber || !label || uploading) ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
              {uploading ? 'Processing...' : 'Upload & Extract'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {progress !== 'idle' && (
              <div style={{ background: '#fff', border: '1px solid #E5E3DF', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6B6861', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Processing</div>
                {STEPS.map((step, i) => {
                  const done = i < progressIndex || progress === 'done';
                  const active = i === progressIndex && progress !== 'done';
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                        background: done ? '#15803D' : active ? '#1A1A1A' : '#F0EFED', color: (done || active) ? '#fff' : '#9B9589', fontWeight: 700 }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div style={{ fontSize: 13, color: done ? '#15803D' : active ? '#1A1A1A' : '#9B9589', fontWeight: active ? 600 : 400 }}>
                        {step.label}{active && '...'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {result && (
              <div style={{ background: result.success ? '#F0FDF4' : '#FFF5F5', border: `1px solid ${result.success ? '#BBF7D0' : '#FECACA'}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: result.success ? '#15803D' : '#DC2626', marginBottom: result.success ? 12 : 0 }}>
                  {result.success ? '✓ Upload complete' : `✕ ${result.error}`}
                </div>
                {result.success && (
                  <div style={{ fontSize: 13, color: '#3D3A35', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>📁 <strong>{result.filename}</strong></div>
                    <div>📊 {result.file_size_kb} KB · {result.chars_extracted?.toLocaleString()} chars extracted</div>
                    <div>🔖 {result.project_number} — {result.label}</div>
                    <a href="/CAStateIntel/documents" style={{ marginTop: 8, display: 'inline-block', padding: '8px 14px', background: '#1A1A1A', color: '#fff', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
                      View in documents →
                    </a>
                  </div>
                )}
              </div>
            )}

            {recentUploads.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #E5E3DF', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6B6861', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>This session</div>
                {recentUploads.map(u => (
                  <div key={u.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #F0EFED' }}>
                    <div style={{ fontSize: 20 }}>📄</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.filename}</div>
                      <div style={{ fontSize: 11, color: '#9B9589', marginTop: 2 }}>{u.project_number} · {u.size_kb} KB · {u.chars.toLocaleString()} chars</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#9B9589', flexShrink: 0 }}>{u.uploaded_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', marginBottom: 8 }}>What happens on upload</div>
              <div style={{ fontSize: 12, color: '#3B5BCC', lineHeight: 1.6 }}>
                1. PDF stored as binary in the database<br />
                2. Text extracted from every page<br />
                3. Document linked to the project<br />
                4. Full-text search available immediately
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
