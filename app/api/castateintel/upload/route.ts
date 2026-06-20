import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const projectNumber = (formData.get('project_number') as string)?.trim();
    const label = (formData.get('label') as string)?.trim();
    const stage = parseInt((formData.get('stage') as string) ?? '1');

    if (!file || !projectNumber || !label)
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    if (file.type !== 'application/pdf')
      return NextResponse.json({ success: false, error: 'File must be a PDF' }, { status: 400 });
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json({ success: false, error: 'File too large (max 50 MB)' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSizeKb = Math.round(buffer.length / 1024);
    const documentId = randomUUID();
    const filename = file.name;

    const { rows: projects } = await pool.query(
      'SELECT id FROM castateintel.pal_projects WHERE project_number = $1',
      [projectNumber]
    );

    let projectId: number;
    if (projects.length > 0) {
      projectId = projects[0].id;
    } else {
      const { rows } = await pool.query(`
        INSERT INTO castateintel.pal_projects
          (project_number, name, pal_stage, status, description)
        VALUES ($1, $2, $3, 'Active', 'Manually uploaded document')
        ON CONFLICT (project_number) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [projectNumber, `Project ${projectNumber}`, `Stage ${stage}`]);
      projectId = rows[0].id;
    }

    await pool.query(`
      INSERT INTO castateintel.pal_documents
        (project_id, stage, label, document_id, download_url, filename, file_size_kb, downloaded_at, pdf_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      ON CONFLICT (project_id, stage, document_id) DO UPDATE SET
        pdf_data = EXCLUDED.pdf_data, file_size_kb = EXCLUDED.file_size_kb,
        downloaded_at = NOW(), updated_at = NOW()
    `, [projectId, stage, label, documentId,
        `/api/castateintel/pdf/${documentId}`,
        filename, fileSizeKb, buffer]);

    // Extract text via Python (most reliable)
    let charsExtracted = 0;
    try {
      execSync(
        `python3 scripts/extract_db_pdfs.py`,
        { env: { ...process.env }, timeout: 30000 }
      );
      const { rows } = await pool.query(
        'SELECT LENGTH(content_text) as chars FROM castateintel.pal_documents WHERE document_id = $1',
        [documentId]
      );
      charsExtracted = rows[0]?.chars ?? 0;
    } catch (e) {
      console.warn('Python extraction failed, continuing:', e);
    }

    return NextResponse.json({
      success: true,
      document_id: documentId,
      filename,
      file_size_kb: fileSizeKb,
      chars_extracted: charsExtracted,
      project_number: projectNumber,
      label,
      stage,
    });
  } catch (err) {
    console.error('[upload] Error:', err);
    return NextResponse.json({ success: false, error: 'Server error during upload' }, { status: 500 });
  }
}
