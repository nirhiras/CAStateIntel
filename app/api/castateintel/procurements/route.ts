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
        proc->>'name' AS name,
        proc->>'description' AS description,
        proc->>'procurement_type' AS procurement_type,
        proc->>'vendor_or_source' AS vendor_or_source,
        proc->>'estimated_value' AS estimated_value,
        proc->>'timeline' AS timeline,
        proc->>'justification' AS justification,
        COALESCE((proc->>'key_values')::jsonb, '{}'::jsonb) AS key_values
      FROM castateintel.pal_stage3_analysis s3
      JOIN castateintel.pal_projects p ON s3.project_id = p.id
      CROSS JOIN jsonb_array_elements(s3.ancillary_procurements) AS proc
      ${where}
      ORDER BY p.project_number, proc->>'name'
    `, params);

    return NextResponse.json({ procurements: result.rows, total: result.rows.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
