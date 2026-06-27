// app/api/castateintel/contacts/route.ts
// GET /api/castateintel/contacts
// Returns all contacts across all projects and stages with project info joined

import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const projectNumber = searchParams.get("project");
  const roleType = searchParams.get("role");
  const search = searchParams.get("search");

  try {
    let query = `
      SELECT
        c.contact_id,
        c.project_id,
        p.project_number,
        p.name AS project_name,
        c.document_id,
        c.stage,
        d.label AS doc_label,
        c.name,
        c.title,
        c.email,
        c.phone,
        c.organization,
        c.context,
        c.source,
        c.role_type,
        c.ai_email,
        c.ai_phone,
        c.ai_background,
        c.ai_technical_skills,
        c.ai_prior_roles,
        c.ai_education,
        c.ai_enriched_at,
        -- Use AI-extracted date first, fall back to document downloaded_at
        COALESCE(
          -- 1st: Form Received Date from stage analysis dot_dates array
          -- dot_dates is [{label, date}] — find element where label contains "received"
          CASE WHEN c.stage = 1 AND s1.dot_dates IS NOT NULL AND jsonb_typeof(s1.dot_dates) = 'array' THEN (
            SELECT elem->>'date' FROM jsonb_array_elements(s1.dot_dates) AS elem
            WHERE (lower(elem->>'label') LIKE '%received%' OR lower(elem->>'label') LIKE '%accepted%' OR lower(elem->>'label') LIKE '%submitted%' OR lower(elem->>'label') LIKE '%form date%') LIMIT 1)
          WHEN c.stage = 2 AND s2.dot_dates IS NOT NULL AND jsonb_typeof(s2.dot_dates) = 'array' THEN (
            SELECT elem->>'date' FROM jsonb_array_elements(s2.dot_dates) AS elem
            WHERE (lower(elem->>'label') LIKE '%received%' OR lower(elem->>'label') LIKE '%accepted%' OR lower(elem->>'label') LIKE '%submitted%' OR lower(elem->>'label') LIKE '%form date%') LIMIT 1)
          WHEN c.stage = 3 AND s3.dot_dates IS NOT NULL AND jsonb_typeof(s3.dot_dates) = 'array' THEN (
            SELECT elem->>'date' FROM jsonb_array_elements(s3.dot_dates) AS elem
            WHERE (lower(elem->>'label') LIKE '%received%' OR lower(elem->>'label') LIKE '%accepted%' OR lower(elem->>'label') LIKE '%submitted%' OR lower(elem->>'label') LIKE '%form date%') LIMIT 1)
          ELSE NULL END,
          -- 2nd: AI-extracted date from contact record
          CASE WHEN c.doc_created_date IS NOT NULL AND c.doc_created_date::text NOT IN ('', 'null')
               THEN c.doc_created_date::text ELSE NULL END,
          -- 3rd: document downloaded_at fallback
          TO_CHAR(d.downloaded_at, 'YYYY-MM-DD')
        ) AS doc_created_date
      FROM castateintel.pal_contacts c
      JOIN castateintel.pal_projects p ON c.project_id = p.id
      LEFT JOIN castateintel.pal_documents d
        ON d.project_id = p.id AND d.stage = c.stage
        AND d.document_id::text = c.document_id::text
      LEFT JOIN castateintel.pal_stage1_analysis s1 ON s1.project_id = c.project_id AND c.stage = 1
      LEFT JOIN castateintel.pal_stage2_analysis s2 ON s2.project_id = c.project_id AND c.stage = 2
      LEFT JOIN castateintel.pal_stage3_analysis s3 ON s3.project_id = c.project_id AND c.stage = 3
      WHERE c.name IS NOT NULL AND c.name != ''
    `;
    const params: (string | number)[] = [];
    let idx = 1;

    if (stage) {
      query += ` AND c.stage = $${idx++}`;
      params.push(parseInt(stage));
    }
    if (projectNumber) {
      query += ` AND p.project_number = $${idx++}`;
      params.push(projectNumber);
    }
    if (roleType) {
      query += ` AND c.role_type = $${idx++}`;
      params.push(roleType);
    }
    if (search) {
      query += ` AND (
        c.name ILIKE $${idx} OR
        c.email ILIKE $${idx} OR
        c.title ILIKE $${idx} OR
        c.organization ILIKE $${idx}
      )`;
      params.push(`%${search}%`);
      idx++;
    }

    query += " ORDER BY p.project_number, c.stage, c.role_type, c.name";

    const result = await db.query(query, params);

    // Deduplicate at DB level by (project_id, stage, name, email)
    const seen = new Set<string>();
    const rows = result.rows.filter(r => {
      const key = `${r.project_id}:${r.stage}:${(r.name||"").toLowerCase()}:${(r.email||"").toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      contacts: rows,
      total: rows.length,
    });
  } catch (error) {
    console.error("Contacts API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
