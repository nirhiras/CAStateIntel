// app/api/castateintel/analysis/[projectNumber]/[stage]/route.ts

import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectNumber: string; stage: string }> }
) {
  const { projectNumber, stage } = await params;
  const stageNum = parseInt(stage);

  if (![1, 2, 3].includes(stageNum)) {
    return NextResponse.json({ error: "Stage must be 1, 2, or 3" }, { status: 400 });
  }

  try {
    // pal_projects PK is "id" (integer), unique key is "project_number"
    const projectRes = await db.query(
      `SELECT id, project_number, name, pal_stage, status, department_id
       FROM castateintel.pal_projects WHERE project_number = $1`,
      [projectNumber]
    );
    if (projectRes.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const project = projectRes.rows[0];
    const projectId = project.id; // integer

    const contactsRes = await db.query(
      `SELECT contact_id, name, title, email, phone, organization, context, role_type
       FROM castateintel.pal_contacts
       WHERE project_id = $1 AND stage = $2 ORDER BY role_type, name`,
      [projectId, stageNum]
    );

    const urlsRes = await db.query(
      `SELECT url_id, url, context FROM castateintel.pal_urls
       WHERE project_id = $1 AND stage = $2`,
      [projectId, stageNum]
    );

    const tableMap: Record<number, string> = {
      1: "pal_stage1_analysis", 2: "pal_stage2_analysis", 3: "pal_stage3_analysis"
    };
    const analysisRes = await db.query(
      `SELECT * FROM castateintel.${tableMap[stageNum]} WHERE project_id = $1`,
      [projectId]
    );

    const docRes = await db.query(
      `SELECT document_id, filename, label, stage, sub_label, created_at
       FROM castateintel.pal_documents WHERE project_id = $1 AND stage = $2
       ORDER BY sub_label ASC, created_at DESC`,
      [projectId, stageNum]
    );

    return NextResponse.json({
      project,
      documents: docRes.rows,
      document: docRes.rows[0] || null,
      contacts: contactsRes.rows,
      urls: urlsRes.rows,
      analyses: analysisRes.rows,
      analysis: analysisRes.rows[0] || null,
      extracted: analysisRes.rows.length > 0,
    });
  } catch (error) {
    console.error("Analysis API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
