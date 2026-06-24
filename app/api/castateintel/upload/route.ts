import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const maxDuration = 60;

// Stage metadata
const STAGE_LABELS: Record<number, string> = {
  1: 'Stage 1 Business Analysis',
  2: 'Stage 2 Alternative Analysis',
  3: 'Stage 3 Solutions Analysis',
  4: 'Stage 4 Project Readiness and Approval',
};
const STAGE_ABBREV: Record<number, string> = {
  1: 'S1BA',
  2: 'S2AA',
  3: 'S3SA',
  4: 'S4PRA',
};

// Canonical filename: ####-### - S#ABR - Project Title
function canonicalFilename(projectNumber: string, stage: number, projectName: string): string {
  const abbrev = STAGE_ABBREV[stage] || `S${stage}`;
  const safeName = (projectName || projectNumber)
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `${projectNumber} - ${abbrev} - ${safeName}.pdf`;
}

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

    const tmpFile = path.join(os.tmpdir(), `pal_upload_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(tmpFile, buffer);

    let extractedText = '';
    let autoProject: string | null = null;
    let autoStage = 1;
    let autoLabel = STAGE_LABELS[1];
    let autoProjectName: string | null = null;

    try {
      const pyScript = [
        'import sys,re,json',
        'import pdfplumber',
        'with pdfplumber.open(sys.argv[1]) as pdf:',
        '    text="\\n".join(p.extract_text() or "" for p in pdf.pages)',
        'pm=re.search(r"Project Number[^:]*:\\s*(\\d{4}-\\d{3,4})",text,re.I)',
        'proj=pm.group(1) if pm and pm.group(1)!="0000-000" else None',
        'if not proj:',
        '    all=[m for m in re.findall(r"\\b(\\d{4}-\\d{3,4})\\b",text) if m!="0000-000"]',
        '    proj=all[-1] if all else None',
        'top=text[:1200]',
        // Stage 4 detection first (most specific)
        'if re.search(r"Stage\\s*4\\s*(Project Readiness|S4PRA)",top,re.I) or re.search(r"S4PRA",top): s=4;l="Stage 4 Project Readiness and Approval"',
        'elif re.search(r"Stage\\s*3\\s*(Solution|Solutions)",top,re.I): s=3;l="Stage 3 Solutions Analysis"',
        'elif re.search(r"Stage\\s*2\\s*(Alternative|Alternatives)",top,re.I): s=2;l="Stage 2 Alternative Analysis"',
        'elif re.search(r"stage 4",top,re.I): s=4;l="Stage 4 Project Readiness and Approval"',
        'elif re.search(r"stage 3",top,re.I): s=3;l="Stage 3 Solutions Analysis"',
        'elif re.search(r"stage 2",top,re.I): s=2;l="Stage 2 Alternative Analysis"',
        'else: s=1;l="Stage 1 Business Analysis"',
        // Extract project name
        'nm=re.search(r"Proposal Name[^:]*:\\s*([^\\n]+)",text,re.I)',
        'pname=nm.group(1).strip() if nm else ""',
        'print(json.dumps({"text":text,"project":proj,"stage":s,"label":l,"project_name":pname}))',
      ].join('\n');

      const result = execSync(`python3 -c '${pyScript.replace(/'/g, "'\\''")}' "${tmpFile}"`, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const parsed = JSON.parse(result.toString());
      extractedText = parsed.text || '';
      autoProject = parsed.project;
      autoStage = parsed.stage || 1;
      autoLabel = parsed.label || STAGE_LABELS[1];
      autoProjectName = parsed.project_name || null;
    } catch (e) {
      console.warn('Python extraction failed:', e);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    if (!projectNumber && autoProject) projectNumber = autoProject;
    if (!stage) stage = autoStage;
    if (!label) label = STAGE_LABELS[stage] || autoLabel;
    // Pass extracted name for project name update
    if (autoProjectName) formData.set('extracted_project_name', autoProjectName);

    if (!projectNumber) {
      return NextResponse.json({
        success: false,
        error: 'Could not detect project number. Use the override to enter it manually.',
        detected: { project_number: autoProject, stage: autoStage, label: autoLabel },
      }, { status: 422 });
    }

    // Get or create project — also update name if we extracted a better one from PDF
    const { rows: existing } = await pool.query(
      'SELECT id, name FROM castateintel.pal_projects WHERE project_number = $1', [projectNumber]
    );
    let projectId: number;
    let projectName: string;

    // Extract project name from PDF auto-detection (passed via autoProjectName)
    const extractedName = (formData.get('extracted_project_name') as string)?.trim() || null;

    if (existing.length > 0) {
      projectId = existing[0].id;
      const currentName = existing[0].name || '';
      // Update name if we have a better one from PDF (not just "Project ####-###")
      if (extractedName && extractedName.length > 5 &&
          (currentName.startsWith('Project ') || currentName === projectNumber)) {
        await pool.query(
          'UPDATE castateintel.pal_projects SET name=$1, updated_at=NOW() WHERE id=$2',
          [extractedName, projectId]
        );
        projectName = extractedName;
      } else {
        projectName = currentName || projectNumber;
      }
    } else {
      const insertName = extractedName && extractedName.length > 5
        ? extractedName
        : `Project ${projectNumber}`;
      const { rows } = await pool.query(`
        INSERT INTO castateintel.pal_projects (project_number, name, pal_stage, status, description)
        VALUES ($1,$2,$3,'Active','Manually uploaded document')
        ON CONFLICT (project_number) DO UPDATE SET
          name=CASE WHEN castateintel.pal_projects.name LIKE 'Project %'
               THEN EXCLUDED.name ELSE castateintel.pal_projects.name END,
          updated_at=NOW()
        RETURNING id, name
      `, [projectNumber, insertName, `Stage ${stage}`]);
      projectId = rows[0].id;
      projectName = rows[0].name || insertName;
    }

    const canonicalName = canonicalFilename(projectNumber, stage, projectName);

    // Check for existing document for this project+stage — overwrite it
    const { rows: existingDocs } = await pool.query(
      'SELECT id, document_id FROM castateintel.pal_documents WHERE project_id=$1 AND stage=$2 ORDER BY id DESC LIMIT 1',
      [projectId, stage]
    );

    let documentId: string;
    let wasOverwrite = false;

    if (existingDocs.length > 0) {
      // Overwrite: delete old analysis data first, then update document
      documentId = existingDocs[0].document_id;
      wasOverwrite = true;

      // Delete stage-specific analysis (but NOT global contacts from other stages)
      await deleteStageAnalysis(pool, projectId, stage, documentId);

      // Update existing document record
      await pool.query(`
        UPDATE castateintel.pal_documents SET
          label=$1, filename=$2, file_size_kb=$3,
          content_text=$4, downloaded_at=NOW(), pdf_data=$5, updated_at=NOW()
        WHERE project_id=$6 AND stage=$7
      `, [label, canonicalName, fileSizeKb, extractedText || null, buffer, projectId, stage]);
    } else {
      // New document
      documentId = randomUUID();
      await pool.query(`
        INSERT INTO castateintel.pal_documents
          (project_id,stage,label,document_id,download_url,filename,file_size_kb,content_text,downloaded_at,pdf_data)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9)
      `, [projectId, stage, label, documentId,
          `/api/castateintel/pdf/${documentId}`,
          canonicalName, fileSizeKb, extractedText || null, buffer]);
    }

    return NextResponse.json({
      success: true,
      document_id: documentId,
      filename: canonicalName,
      file_size_kb: fileSizeKb,
      chars_extracted: extractedText.length,
      project_number: projectNumber,
      project_name: projectName,
      label,
      stage,
      was_overwrite: wasOverwrite,
      auto_detected: { project_number: autoProject, stage: autoStage, label: autoLabel },
    });

  } catch (err) {
    console.error('[upload] Error:', err);
    return NextResponse.json({ success: false, error: 'Server error during upload' }, { status: 500 });
  }
}

// DELETE: remove a document and its analysis
export async function DELETE(req: Request) {
  try {
    const { document_id } = await req.json();
    if (!document_id) return NextResponse.json({ success: false, error: 'document_id required' }, { status: 400 });

    // Find the document
    const { rows } = await pool.query(
      'SELECT id, project_id, stage, document_id FROM castateintel.pal_documents WHERE document_id=$1',
      [document_id]
    );
    if (!rows.length) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });

    const { project_id, stage, document_id: docId } = rows[0];

    // Delete stage analysis + contacts for this document only
    await deleteStageAnalysis(pool, project_id, stage, docId);

    // Delete the document itself
    await pool.query('DELETE FROM castateintel.pal_documents WHERE document_id=$1', [document_id]);

    return NextResponse.json({ success: true, deleted: { project_id, stage, document_id } });
  } catch (err) {
    console.error('[upload DELETE] Error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

async function deleteStageAnalysis(db: typeof pool, projectId: number, stage: number, documentId: string) {
  // Delete contacts for this specific document only (not global contacts from other docs)
  await db.query(
    'DELETE FROM castateintel.pal_contacts WHERE project_id=$1 AND stage=$2 AND document_id=$3::uuid',
    [projectId, stage, documentId]
  );
  // Delete URLs for this document
  await db.query(
    'DELETE FROM castateintel.pal_urls WHERE project_id=$1 AND stage=$2 AND document_id=$3::uuid',
    [projectId, stage, documentId]
  );
  // Delete stage-specific analysis
  const analysisTable: Record<number, string> = {
    1: 'pal_stage1_analysis',
    2: 'pal_stage2_analysis',
    3: 'pal_stage3_analysis',
    4: 'pal_stage4_analysis',
  };
  if (analysisTable[stage]) {
    await db.query(
      `DELETE FROM castateintel.${analysisTable[stage]} WHERE project_id=$1`,
      [projectId]
    );
  }
}
