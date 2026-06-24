// app/api/castateintel/analysis/[projectNumber]/4/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectNumber: string }> }
) {
  const { projectNumber } = await params;

  try {
    const projectRes = await db.query(
      `SELECT id, project_number, name, pal_stage, status, department_id
       FROM castateintel.pal_projects WHERE project_number = $1`,
      [projectNumber]
    );
    if (projectRes.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const project = projectRes.rows[0];
    const projectId = project.id;

    const contactsRes = await db.query(
      `SELECT contact_id, name, title, email, phone, organization, context, role_type, source, doc_created_date
       FROM castateintel.pal_contacts
       WHERE project_id = $1 AND stage = 4 ORDER BY role_type, name`,
      [projectId]
    );

    const urlsRes = await db.query(
      `SELECT url_id, url, context FROM castateintel.pal_urls
       WHERE project_id = $1 AND stage = 4`,
      [projectId]
    );

    const analysisRes = await db.query(
      `SELECT * FROM castateintel.pal_stage4_analysis WHERE project_id = $1`,
      [projectId]
    );

    const docRes = await db.query(
      `SELECT id, document_id, filename, label, stage, created_at
       FROM castateintel.pal_documents WHERE project_id = $1 AND stage = 4 LIMIT 1`,
      [projectId]
    );

    return NextResponse.json({
      project,
      document: docRes.rows[0] || null,
      contacts: contactsRes.rows,
      urls: urlsRes.rows,
      analysis: analysisRes.rows[0] || null,
      extracted: analysisRes.rows.length > 0,
    });
  } catch (error) {
    console.error("Stage 4 API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
