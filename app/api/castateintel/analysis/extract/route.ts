// app/api/castateintel/analysis/extract/route.ts

import { NextResponse } from "next/server";
import db from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  const body = await request.json();
  const { project_number, stage } = body;

  if (!project_number) {
    return NextResponse.json({ error: "project_number is required" }, { status: 400 });
  }

  try {
    // Verify document exists with extracted text (join on id, not project_id UUID)
    const docRes = await db.query(
      `SELECT d.document_id
       FROM castateintel.pal_documents d
       JOIN castateintel.pal_projects p ON d.project_id = p.id
       WHERE p.project_number = $1
         AND ($2::int IS NULL OR d.stage = $2::int)
         AND d.content_text IS NOT NULL
         AND length(d.content_text) > 100`,
      [project_number, stage || null]
    );

    if (docRes.rows.length === 0) {
      return NextResponse.json({
        error: "No documents with extracted text found. Upload PDFs first."
      }, { status: 404 });
    }

    const scriptPath = path.join(process.cwd(), "scripts", "extract_pal_analysis.py");
    const stageArg = stage ? `--stage ${stage}` : "";
    const cmd = `python3 "${scriptPath}" --project ${project_number} ${stageArg}`;

    const { stdout, stderr } = await execAsync(cmd, {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL!,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
      },
      timeout: 300000,
    });

    return NextResponse.json({
      success: true,
      project_number,
      stage,
      stdout: stdout.trim(),
      stderr: stderr.trim() || undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Extraction error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
