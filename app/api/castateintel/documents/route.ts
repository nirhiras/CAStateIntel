import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage');
    const projectNumber = searchParams.get('project') ?? undefined;
    const search = searchParams.get('search');

    let where = 'WHERE 1=1';
    const params: (string|number)[] = [];
    let idx = 1;

    if (search) {
      where += ` AND (doc.filename ILIKE $${idx} OR p.name ILIKE $${idx} OR p.project_number ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (stage) {
      where += ` AND doc.stage = $${idx}`;
      params.push(parseInt(stage)); idx++;
    }
    if (projectNumber) {
      where += ` AND p.project_number = $${idx}`;
      params.push(projectNumber); idx++;
    }

    const result = await db.query(`
      SELECT
        doc.id,
        doc.document_id::text,
        doc.stage,
        doc.label,
        COALESCE(doc.sub_label,'') AS sub_label,
        COALESCE(doc.doc_type,'stage') AS doc_type,
        COALESCE(doc.short_description,'') AS short_description,
        COALESCE(doc.filename,'') AS filename,
        doc.downloaded_at,
        COALESCE(length(doc.content_text),0) AS content_length,
        doc.content_text,
        p.project_number,
        p.name AS project_name,
        p.id::text AS project_id,
        COALESCE(dept.name,'') AS department_name,
        COALESCE((SELECT COUNT(*)::int FROM castateintel.pal_contacts ct
          WHERE ct.document_id::text = doc.document_id::text), 0) AS contact_count,
        0::int AS procurement_count,
        COALESCE(
          (SELECT s3.solution_tags FROM castateintel.pal_stage3_analysis s3 WHERE s3.project_id = p.id LIMIT 1),
          (SELECT s2.solution_tags FROM castateintel.pal_stage2_analysis s2 WHERE s2.project_id = p.id LIMIT 1),
          (SELECT s1.solution_tags FROM castateintel.pal_stage1_analysis s1 WHERE s1.project_id = p.id LIMIT 1),
          '[]'::jsonb
        ) AS solution_tags
      FROM castateintel.pal_documents doc
      JOIN castateintel.pal_projects p ON p.id = doc.project_id
      LEFT JOIN castateintel.departments dept ON dept.id = p.department_id
      ${where}
      ORDER BY p.project_number, doc.stage DESC
      LIMIT 500
    `, params);

    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error('[documents] GET error:', err?.message || err);
    return NextResponse.json([]);
  }
}
