import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(dep.name,'Unknown') AS department_name,
        COALESCE(ag.name,'')        AS agency_name,
        COUNT(DISTINCT p.id)::int   AS project_count,
        COUNT(DISTINCT CASE WHEN p.pal_stage='Stage 1' THEN p.id END)::int AS stage1,
        COUNT(DISTINCT CASE WHEN p.pal_stage='Stage 2' THEN p.id END)::int AS stage2,
        COUNT(DISTINCT CASE WHEN p.pal_stage='Stage 3' THEN p.id END)::int AS stage3,
        COUNT(d.id)::int            AS doc_count,
        COUNT(DISTINCT CASE WHEN p.criticality_rating='High' THEN p.id END)::int AS criticality_high
      FROM castateintel.pal_projects p
      LEFT JOIN castateintel.departments dep ON dep.id = p.department_id
      LEFT JOIN castateintel.agencies ag     ON ag.id  = dep.agency_id
      LEFT JOIN castateintel.pal_documents d ON d.project_id = p.id
      WHERE dep.name IS NOT NULL AND dep.name != ''
      GROUP BY dep.name, ag.name
      ORDER BY COUNT(DISTINCT p.id) DESC, dep.name
    `);
    return NextResponse.json(result.rows);
  } catch(err:any) {
    console.error('Departments API error:', err?.message);
    return NextResponse.json([]);
  }
}
