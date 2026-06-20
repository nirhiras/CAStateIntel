import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    let projectNumber = (formData.get('project_number') as string)?.trim() || null;
    let label = (formData.get('label') as string)?.trim() || null;
    let stage = parseInt((formData.get('stage') as string) ?? '0') || 0;

    if (!file) return NextResponse.json({ success: false, error: 'No PDF file provided' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ success: false, error: 'File must be a PDF' }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ success: false, error: 'File too large (max 50 MB)' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSizeKb = Math.round(buffer.length / 1024);
    const filename = file.name;

    const tmpFile = path.join(os.tmpdir(), `pal_upload_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(tmpFile, buffer);

    let extractedText = '';
    let autoProject: string | null = null;
    let autoStage = 1;
    let autoLabel = 'Stage 1 Business Analysis';

    try {
      const pyScript = [
        'import sys,re,json',
        'import pdfplumber',
        'text=""',
        'with pdfplumber.open(sys.argv[1]) as pdf:',
        '    [text.__add__(p.extract_text() or "") for p in pdf.pages]',
        'with pdfplumber.open(sys.argv[1]) as pdf:',
        '    text="\\n".join(p.extract_text() or "" for p in pdf.pages)',
        'pm=re.search(r"Project Number[^:]*:\\s*(\\d{4}-\\d{3,4})",text,re.I)',
        'proj=pm.group(1) if pm and pm.group(1)!="0000-000" else None',
        'if not proj:',
        '    all=[m for m in re.findall(r"\\b(\\d{4}-\\d{3,4})\\b",text) if m!="0000-000"]',
        '    proj=all[-1] if all else None',
        'top=text[:800]',
        'if re.search(r"Stage\\s*3\\s*(Solution|Solutions)",top,re.I): s=3;l="Stage 3 Solutions Analysis"',
        'elif re.search(r"Stage\\s*2\\s*(Alternative|Alternatives)",top,re.I): s=2;l="Stage 2 Alternative Analysis"',
        'elif re.search(r"stage 3",top,re.I): s=3;l="Stage 3 Solutions Analysis"',
        'elif re.search(r"stage 2",top,re.I): s=2;l="Stage 2 Alternative Analysis"',
        'else: s=1;l="Stage 1 Business Analysis"',
        'print(json.dumps({"text":text,"project":proj,"stage":s,"label":l}))',
      ].join('\n');

      const result = execSync(`python3 -c '${pyScript.replace(/'/g, "'\\''")}' "${tmpFile}"`, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const parsed = JSON.parse(result.toString());
      extractedText = parsed.text || '';
      autoProject = parsed.project;
      autoStage = parsed.stage || 1;
      autoLabel = parsed.label || 'Stage 1 Business Analysis';
    } catch (e) {
      console.warn('Python extraction failed:', e);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    if (!projectNumber && autoProject) projectNumber = autoProject;
    if (!stage) stage = autoStage;
    if (!label) label = autoLabel;

    if (!projectNumber) {
      return NextResponse.json({
        success: false,
        error: 'Could not detect project number. Use the override to enter it manually.',
        detected: { project_number: autoProject, stage: autoStage, label: autoLabel },
      }, { status: 422 });
    }

    const documentId = randomUUID();

    const { rows: existing } = await pool.query(
      'SELECT id FROM castateintel.pal_projects WHERE project_number = $1', [projectNumber]
    );
    let projectId: number;
    if (existing.length > 0) {
      projectId = existing[0].id;
    } else {
      const { rows } = await pool.query(`
        INSERT INTO castateintel.pal_projects (project_number, name, pal_stage, status, description)
        VALUES ($1,$2,$3,'Active','Manually uploaded document')
        ON CONFLICT (project_number) DO UPDATE SET updated_at=NOW() RETURNING id
      `, [projectNumber, `Project ${projectNumber}`, `Stage ${stage}`]);
      projectId = rows[0].id;
    }

    await pool.query(`
      INSERT INTO castateintel.pal_documents
        (project_id,stage,label,document_id,download_url,filename,file_size_kb,content_text,downloaded_at,pdf_data)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9)
      ON CONFLICT (project_id,stage,document_id) DO UPDATE SET
        content_text=EXCLUDED.content_text, file_size_kb=EXCLUDED.file_size_kb,
        downloaded_at=NOW(), pdf_data=EXCLUDED.pdf_data, updated_at=NOW()
    `, [projectId, stage, label, documentId,
        `/api/castateintel/pdf/${documentId}`,
        filename, fileSizeKb, extractedText || null, buffer]);

    return NextResponse.json({
      success: true,
      document_id: documentId,
      filename,
      file_size_kb: fileSizeKb,
      chars_extracted: extractedText.length,
      project_number: projectNumber,
      label,
      stage,
      auto_detected: { project_number: autoProject, stage: autoStage, label: autoLabel },
    });

  } catch (err) {
    console.error('[upload] Error:', err);
    return NextResponse.json({ success: false, error: 'Server error during upload' }, { status: 500 });
  }
}
