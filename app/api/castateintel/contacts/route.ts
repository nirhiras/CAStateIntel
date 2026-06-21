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
        c.doc_created_date
      FROM castateintel.pal_contacts c
      JOIN castateintel.pal_projects p ON c.project_id = p.id
      LEFT JOIN castateintel.pal_documents d
        ON d.project_id = p.id AND d.stage = c.stage
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
