// app/api/castateintel/export-contacts/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const result = await db.query(
      `SELECT
        contact_id,
        name,
        title,
        organization,
        email,
        phone,
        ai_email,
        ai_phone,
        ai_background,
        ai_prior_roles,
        ai_education,
        ai_technical_skills,
        ai_linkedin_url,
        ai_enrichment_notes,
        ai_enrichment_source,
        ai_enriched_at
      FROM castateintel.pal_contacts
      WHERE ai_enriched_at IS NOT NULL
      ORDER BY organization, name`
    );

    const contacts = result.rows.map((contact: any) => ({
      "Name": contact.name,
      "Title": contact.title,
      "Organization": contact.organization,
      "Original Email": contact.email,
      "Original Phone": contact.phone,
      "AI Email": contact.ai_email,
      "AI Phone": contact.ai_phone,
      "Background": contact.ai_background,
      "Prior Roles": contact.ai_prior_roles,
      "Education": contact.ai_education,
      "Technical Skills": contact.ai_technical_skills,
      "LinkedIn URL": contact.ai_linkedin_url,
      "Enrichment Notes": contact.ai_enrichment_notes,
      "Data Source": contact.ai_enrichment_source,
      "Enriched Date": contact.ai_enriched_at,
    }));

    const worksheet = XLSX.utils.json_to_sheet(contacts);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Enriched Contacts");

    const columnWidths = [
      { wch: 25 }, // Name
      { wch: 20 }, // Title
      { wch: 30 }, // Organization
      { wch: 25 }, // Original Email
      { wch: 15 }, // Original Phone
      { wch: 30 }, // AI Email
      { wch: 15 }, // AI Phone
      { wch: 40 }, // Background
      { wch: 30 }, // Prior Roles
      { wch: 20 }, // Education
      { wch: 30 }, // Technical Skills
      { wch: 30 }, // LinkedIn URL
      { wch: 30 }, // Enrichment Notes
      { wch: 50 }, // Data Source
      { wch: 20 }, // Enriched Date
    ];
    worksheet["!cols"] = columnWidths;

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": "attachment; filename=enriched-contacts.xlsx",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
