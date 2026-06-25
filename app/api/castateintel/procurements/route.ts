// app/api/castateintel/procurements/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectNumber = searchParams.get("project");
  const dept = searchParams.get("dept");

  let where = "WHERE s3.ancillary_procurements IS NOT NULL";
  const params: string[] = [];
  let idx = 1;

  if (projectNumber) {
    where += ` AND p.project_number = $${idx++}`;
    params.push(projectNumber);
  }
  if (dept) {
    where += ` AND dep.name = $${idx++}`;
    params.push(dept);
  }

  try {
    const result = await db.query(`
      SELECT
        p.project_number,
        p.name AS project_name,
        COALESCE(dep.name,'') AS department_name,
        proc->>'name'                AS name,
        proc->>'description'         AS description,
        proc->>'procurement_type'    AS procurement_type,
        proc->>'vendor_or_source'    AS vendor_or_source,
        proc->>'estimated_value'     AS estimated_value,
        proc->>'proposed_start_date' AS proposed_start_date,
        proc->>'proposed_end_date'   AS proposed_end_date,
        proc->>'duration'            AS duration,
        proc->>'timeline'            AS timeline,
        proc->>'solicitation_number' AS solicitation_number,
        proc->>'justification'       AS justification,
        -- Source PDF: the Stage 3 document for this project
        (SELECT d.document_id::text
         FROM castateintel.pal_documents d
         WHERE d.project_id = p.id AND d.stage = 3
         ORDER BY d.id DESC LIMIT 1) AS source_doc_id,
        (SELECT d.filename
         FROM castateintel.pal_documents d
         WHERE d.project_id = p.id AND d.stage = 3
         ORDER BY d.id DESC LIMIT 1) AS source_filename
      FROM castateintel.pal_stage3_analysis s3
      JOIN castateintel.pal_projects p ON s3.project_id = p.id
      LEFT JOIN castateintel.departments dep ON dep.id = p.department_id
      CROSS JOIN jsonb_array_elements(s3.ancillary_procurements) AS proc
      ${where}
      ORDER BY
        CASE WHEN proc->>'proposed_start_date' IS NOT NULL AND proc->>'proposed_start_date' != 'null'
             THEN proc->>'proposed_start_date' ELSE '9999-99-99' END ASC,
        p.project_number, proc->>'name'
    `, params);

    return NextResponse.json({ procurements: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Procurements API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
