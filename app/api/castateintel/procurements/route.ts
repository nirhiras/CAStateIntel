// app/api/castateintel/procurements/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectNumber = searchParams.get("project");

  let where = "WHERE s3.ancillary_procurements IS NOT NULL";
  const params: string[] = [];
  let idx = 1;

  if (projectNumber) {
    where += ` AND p.project_number = $${idx++}`;
    params.push(projectNumber);
  }

  try {
    const result = await db.query(`
      SELECT
        p.project_number,
        p.name AS project_name,
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
        COALESCE((proc->>'key_values')::jsonb, '{}'::jsonb) AS key_values
      FROM castateintel.pal_stage3_analysis s3
      JOIN castateintel.pal_projects p ON s3.project_id = p.id
      CROSS JOIN jsonb_array_elements(s3.ancillary_procurements) AS proc
      ${where}
      ORDER BY
        CASE WHEN proc->>'proposed_start_date' IS NOT NULL AND proc->>'proposed_start_date' != 'null'
             THEN proc->>'proposed_start_date' ELSE '9999-99-99' END ASC,
        p.project_number, proc->>'name'
    `, params);

    return NextResponse.json({ procurements: result.rows, total: result.rows.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
