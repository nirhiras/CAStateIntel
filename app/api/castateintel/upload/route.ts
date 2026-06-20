import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { randomUUID } from 'crypto';

export const maxDuration = 60;

async function extractText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('pdf-parse');
  const fn = typeof mod === 'function' ? mod : mod.default ?? mod;
  const data = await fn(buffer);
  return data.text?.trim() ?? '';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const projectNumber = (formData.get('project_number') as string)?.trim();
    const label = (formData.get('label') as string)?.trim();
    const stageStr = formData.get('stage') as string;
    const stage = parseInt(stageStr ?? '1');

    if (!file || !projectNumber || !label)
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    if (file.type !== 'application/pdf')
      return NextResponse.json({ success: false, error: 'File must be a PDF' }, { status: 400 });
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ success: false, error: 'File too large (max 50 MB)' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSizeKb = Math.round(buffer.length / 1024);

    let contentText = '';
    try { contentText = await extractText(buffer); }
    catch (err) { console.warn('PDF extraction failed:', err); }

    const { rows: projects } = await pool.query(
      'SELECT id FROM castateintel.pal_projects WHERE project_number = $1',
      [projectNumber]
    );

    let projectId: number;
    if (projects.length > 0) {
      projectId = projects[0].id;
    } else {
      const { rows: newProject } = await pool.query(`
        INSERT INTO castateintel.pal_projects
          (project_number, name, pal_stage, status, description)
        VALUES ($1, $2, $3, 'Active', 'Manually uploaded document')
        ON CONFLICT (project_number) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [projectNumber, `Project ${projectNumber}`, `Stage ${stage}`]);
      projectId = newProject[0].id;
    }

    const documentId = randomUUID();
    const filename = file.name;

    await pool.query(`
      INSERT INTO castateintel.pal_documents
        (project_id, stage, label, document_id, download_url, filename,
         file_size_kb, content_text, downloaded_at, pdf_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      ON CONFLICT (project_id, stage, document_id) DO UPDATE SET
        content_text = EXCLUDED.content_text,
        file_size_kb = EXCLUDED.file_size_kb,
        downloaded_at = NOW(),
        pdf_data = EXCLUDED.pdf_data,
        updated_at = NOW()
    `, [projectId, stage, label, documentId,
        `/api/castateintel/pdf/${documentId}`,
        filename, fileSizeKb, contentText || null, buffer]);

    return NextResponse.json({
      success: true,
      document_id: documentId,
      filename,
      file_size_kb: fileSizeKb,
      chars_extracted: contentText.length,
      project_number: projectNumber,
      label,
      stage,
    });
  } catch (err) {
    console.error('[upload] Error:', err);
    return NextResponse.json({ success: false, error: 'Server error during upload' }, { status: 500 });
  }
}
