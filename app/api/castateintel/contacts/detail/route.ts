// app/api/castateintel/contacts/detail/route.ts
// GET /api/castateintel/contacts/detail?name=X&organization=Y
// Returns a single contact with all instances/appearances across projects

import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const organization = searchParams.get("organization");

  if (!name || !organization) {
    return NextResponse.json(
      { error: "name and organization are required" },
      { status: 400 }
    );
  }

  try {
    // Get primary contact data (enriched fields)
    const primaryQuery = `
      SELECT
        c.contact_id,
        c.name,
        c.title,
        c.email,
        c.phone,
        c.organization,
        c.role_type,
        c.ai_email,
        c.ai_phone,
        c.ai_background,
        c.ai_prior_roles,
        c.ai_education,
        c.ai_technical_skills,
        c.ai_linkedin_url,
        c.ai_enrichment_notes,
        c.ai_enrichment_source,
        c.ai_enriched_at
      FROM castateintel.pal_contacts c
      WHERE LOWER(c.name) = LOWER($1)
      AND LOWER(c.organization) = LOWER($2)
      LIMIT 1
    `;

    const primaryResult = await db.query(primaryQuery, [name, organization]);
    const primaryContact = primaryResult.rows[0];

    if (!primaryContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Get all instances of this contact across all projects
    const instancesQuery = `
      SELECT
        c.contact_id,
        c.project_id,
        p.project_number,
        p.name AS project_name,
        c.stage,
        c.title,
        c.role_type,
        c.email,
        c.phone,
        c.context,
        d.label AS doc_label,
        COALESCE(
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
          CASE WHEN c.doc_created_date IS NOT NULL AND c.doc_created_date::text NOT IN ('', 'null')
               THEN c.doc_created_date::text ELSE NULL END,
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
      WHERE LOWER(c.name) = LOWER($1)
      AND LOWER(c.organization) = LOWER($2)
      ORDER BY p.project_number, c.stage, c.doc_created_date DESC
    `;

    const instancesResult = await db.query(instancesQuery, [name, organization]);
    const instances = instancesResult.rows;

    return NextResponse.json({
      contact: primaryContact,
      instances: instances,
      totalInstances: instances.length,
    });
  } catch (error) {
    console.error("Contact detail API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
