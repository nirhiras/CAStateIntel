// app/api/castateintel/projects/route.ts
// GET /api/castateintel/projects
// Returns projects with doc availability, extraction status, and solution tags

import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const stage = searchParams.get("stage");
  const statsOnly = searchParams.get("stats");
  const projectNumber = searchParams.get("project");

  // Stats summary
  if (statsOnly === "true") {
    const r = await db.query(`
      SELECT
        COUNT(DISTINCT p.id) AS total_projects,
        COUNT(DISTINCT CASE WHEN p.pal_stage = 'Stage 1' THEN p.id END) AS stage1_count,
        COUNT(DISTINCT CASE WHEN p.pal_stage = 'Stage 2' THEN p.id END) AS stage2_count,
        COUNT(DISTINCT CASE WHEN p.pal_stage = 'Stage 3' THEN p.id END) AS stage3_count,
        COUNT(d.id) AS total_documents,
        COUNT(CASE WHEN d.content_text IS NOT NULL AND length(d.content_text) > 100 THEN 1 END) AS extracted_docs
      FROM castateintel.pal_projects p
      LEFT JOIN castateintel.pal_documents d ON d.project_id = p.id
    `);
    return NextResponse.json(r.rows[0]);
  }

  // Build project query with doc flags, extraction status, and solution tags
  let where = "WHERE 1=1";
  const params: (string | number)[] = [];
  let idx = 1;

  if (search) {
    where += ` AND (p.name ILIKE $${idx} OR p.project_number ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }
  if (stage) {
    where += ` AND p.pal_stage = $${idx}`;
    params.push(stage); idx++;
  }
  if (projectNumber) {
    where += ` AND p.project_number = $${idx}`;
    params.push(projectNumber); idx++;
  }

  const query = `
    SELECT
      p.id,
      p.project_number,
      p.name,
      p.pal_stage,
      p.criticality_rating,
      p.status,
      p.detail_url,
      COALESCE(dep.name, '') AS department_name,
      COALESCE(ag.name, '')  AS agency_name,
      COUNT(d.id) AS doc_count,
      -- Doc availability per stage
      BOOL_OR(d.stage = 1 AND length(COALESCE(d.content_text,'')) > 100) AS has_s1,
      BOOL_OR(d.stage = 2 AND length(COALESCE(d.content_text,'')) > 100) AS has_s2,
      BOOL_OR(d.stage = 3 AND length(COALESCE(d.content_text,'')) > 100) AS has_s3,
      -- Extraction status
      MAX(CASE WHEN s1.project_id IS NOT NULL THEN 1 ELSE 0 END)::boolean AS s1_extracted,
      MAX(CASE WHEN s2.project_id IS NOT NULL THEN 1 ELSE 0 END)::boolean AS s2_extracted,
      MAX(CASE WHEN s3.project_id IS NOT NULL THEN 1 ELSE 0 END)::boolean AS s3_extracted,
      -- Solution tags from Stage 2 analysis
      COALESCE(s2.solution_tags, '[]'::jsonb) AS solution_tags
    FROM castateintel.pal_projects p
    LEFT JOIN castateintel.departments dep ON p.department_id = dep.id
    LEFT JOIN castateintel.agencies ag ON dep.agency_id = ag.id
    LEFT JOIN castateintel.pal_documents d ON d.project_id = p.id
    LEFT JOIN castateintel.pal_stage1_analysis s1 ON s1.project_id = p.id
    LEFT JOIN castateintel.pal_stage2_analysis s2 ON s2.project_id = p.id
    LEFT JOIN castateintel.pal_stage3_analysis s3 ON s3.project_id = p.id
    ${where}
    GROUP BY p.id, p.project_number, p.name, p.pal_stage, p.criticality_rating,
             p.status, p.detail_url, dep.name, ag.name, s2.solution_tags
    ORDER BY p.project_number
  `;

  try {
    const result = await db.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Projects API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
