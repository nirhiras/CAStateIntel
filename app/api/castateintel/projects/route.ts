// app/api/castateintel/projects/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const stage = searchParams.get("stage");
  const department = searchParams.get("department");
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

  // Department list for filter dropdown
  if (searchParams.get("departments") === "true") {
    const r = await db.query(`
      SELECT DISTINCT dep.name
      FROM castateintel.departments dep
      JOIN castateintel.pal_projects p ON p.department_id = dep.id
      WHERE dep.name IS NOT NULL AND dep.name != ''
      ORDER BY dep.name
    `);
    return NextResponse.json(r.rows.map((x: { name: string }) => x.name));
  }

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
  if (department) {
    where += ` AND dep.name = $${idx}`;
    params.push(department); idx++;
  }
  if (projectNumber) {
    where += ` AND p.project_number = $${idx}`;
    params.push(projectNumber); idx++;
  }

  // effective_stage: derive from highest stage doc that exists (not just pal_stage from CDT)
  // solution_tags: deduplicated by tag value in SQL using jsonb aggregation
  const query = `
    SELECT
      p.id,
      p.project_number,
      p.name,
      p.pal_stage,
      -- Effective stage: highest stage with extracted content
      CASE
        WHEN BOOL_OR(d.stage = 3 AND length(COALESCE(d.content_text,'')) > 100) THEN 'Stage 3'
        WHEN BOOL_OR(d.stage = 2 AND length(COALESCE(d.content_text,'')) > 100) THEN 'Stage 2'
        WHEN BOOL_OR(d.stage = 1 AND length(COALESCE(d.content_text,'')) > 100) THEN 'Stage 1'
        ELSE p.pal_stage
      END AS effective_stage,
      p.criticality_rating,
      p.status,
      p.detail_url,
      COALESCE(dep.name, '') AS department_name,
      COALESCE(ag.name, '')  AS agency_name,
      COUNT(d.id) AS doc_count,
      BOOL_OR(d.stage = 1 AND length(COALESCE(d.content_text,'')) > 100) AS has_s1,
      BOOL_OR(d.stage = 2 AND length(COALESCE(d.content_text,'')) > 100) AS has_s2,
      BOOL_OR(d.stage = 3 AND length(COALESCE(d.content_text,'')) > 100) AS has_s3,
      MAX(CASE WHEN s1.project_id IS NOT NULL THEN 1 ELSE 0 END)::boolean AS s1_extracted,
      MAX(CASE WHEN s2.project_id IS NOT NULL THEN 1 ELSE 0 END)::boolean AS s2_extracted,
      MAX(CASE WHEN s3.project_id IS NOT NULL THEN 1 ELSE 0 END)::boolean AS s3_extracted,
      -- Deduplicate solution_tags by tag value: keep first occurrence per unique tag name
      COALESCE(
        (
          SELECT jsonb_agg(DISTINCT_TAG)
          FROM (
            SELECT DISTINCT ON (elem->>'tag') elem AS DISTINCT_TAG
            FROM jsonb_array_elements(COALESCE(s2.solution_tags, '[]'::jsonb)) AS elem
            ORDER BY elem->>'tag', elem
          ) deduped
        ),
        '[]'::jsonb
      ) AS solution_tags
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
