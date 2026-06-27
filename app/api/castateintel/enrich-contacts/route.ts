// app/api/castateintel/enrich-contacts/route.ts
// POST /api/castateintel/enrich-contacts
// Apply AI enrichment to contacts while preserving document data

import { NextResponse } from "next/server";
import db from "@/lib/db";

interface EnrichmentData {
  name: string;
  organization: string;
  ai_email?: string;
  ai_phone?: string;
  ai_background?: string;
  ai_prior_roles?: string;
  ai_education?: string;
  ai_technical_skills?: string;
  ai_linkedin_url?: string;
  ai_enrichment_notes?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const enrichments: EnrichmentData[] = body.enrichments || [];

    if (!Array.isArray(enrichments)) {
      return NextResponse.json(
        { error: "enrichments must be an array" },
        { status: 400 }
      );
    }

    let successCount = 0;
    let notFoundCount = 0;
    const errors: string[] = [];

    for (const enrichment of enrichments) {
      try {
        // Find contact by name and organization
        const findResult = await db.query(
          `SELECT contact_id FROM castateintel.pal_contacts
           WHERE LOWER(name) = LOWER($1)
           AND LOWER(organization) = LOWER($2)
           LIMIT 1`,
          [enrichment.name, enrichment.organization]
        );

        if (findResult.rows.length === 0) {
          notFoundCount++;
          errors.push(`Contact not found: ${enrichment.name} at ${enrichment.organization}`);
          continue;
        }

        const contactId = findResult.rows[0].contact_id;

        // Update with enrichment data
        const updateQuery = `
          UPDATE castateintel.pal_contacts
          SET
            ai_email = COALESCE($1, ai_email),
            ai_phone = COALESCE($2, ai_phone),
            ai_background = COALESCE($3, ai_background),
            ai_prior_roles = COALESCE($4, ai_prior_roles),
            ai_education = COALESCE($5, ai_education),
            ai_technical_skills = COALESCE($6, ai_technical_skills),
            ai_linkedin_url = COALESCE($7, ai_linkedin_url),
            ai_enrichment_notes = COALESCE($8, ai_enrichment_notes),
            ai_enrichment_source = $9,
            ai_enriched_at = NOW()
          WHERE contact_id = $10
        `;

        await db.query(updateQuery, [
          enrichment.ai_email || null,
          enrichment.ai_phone || null,
          enrichment.ai_background || null,
          enrichment.ai_prior_roles || null,
          enrichment.ai_education || null,
          enrichment.ai_technical_skills || null,
          enrichment.ai_linkedin_url || null,
          enrichment.ai_enrichment_notes || null,
          "Free sources: CA.gov directories, government websites, public LinkedIn profiles",
          contactId,
        ]);

        successCount++;
        console.log(`✓ Enriched contact: ${enrichment.name}`);
      } catch (error) {
        errors.push(
          `Error enriching ${enrichment.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: enrichments.length,
        enriched: successCount,
        notFound: notFoundCount,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully enriched ${successCount}/${enrichments.length} contacts from free sources (AI research)`,
    });
  } catch (error) {
    console.error("Enrichment API error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to view enrichment status or fetch unenriched contacts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");
  const fetchUnenriched = searchParams.get("unenriched") === "true";
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    if (fetchUnenriched) {
      // Fetch unenriched contacts for research
      const result = await db.query(
        `SELECT
          contact_id,
          name,
          title,
          organization,
          role_type,
          email,
          phone,
          CASE
            WHEN role_type IN ('Director', 'Sponsor', 'Executive', 'Chief', 'Deputy Director', 'Secretary', 'Administrator')
            THEN 'PRIORITY'
            ELSE 'STANDARD'
          END as priority_level
        FROM castateintel.pal_contacts
        WHERE name IS NOT NULL AND name != ''
        AND ai_enriched_at IS NULL
        ORDER BY priority_level, organization, name
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const countResult = await db.query(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN role_type IN ('Director', 'Sponsor', 'Executive', 'Chief', 'Deputy Director', 'Secretary', 'Administrator')
                THEN 1 END) as priority_count,
          COUNT(CASE WHEN role_type NOT IN ('Director', 'Sponsor', 'Executive', 'Chief', 'Deputy Director', 'Secretary', 'Administrator')
                THEN 1 END) as standard_count
        FROM castateintel.pal_contacts
        WHERE name IS NOT NULL AND name != ''
        AND ai_enriched_at IS NULL`
      );

      return NextResponse.json({
        unenrichedContacts: result.rows,
        totalUnenriched: countResult.rows[0].total,
        priorityCount: countResult.rows[0].priority_count,
        standardCount: countResult.rows[0].standard_count,
        limit,
        offset,
        message: "Unenriched contacts for research (sorted by priority)",
      });
    } else {
      // Fetch enriched contacts (existing behavior)
      const result = await db.query(
        `SELECT
          contact_id,
          name,
          organization,
          email,
          phone,
          ai_email,
          ai_phone,
          ai_background,
          ai_prior_roles,
          ai_technical_skills,
          ai_enriched_at,
          ai_enrichment_source
        FROM castateintel.pal_contacts
        WHERE ai_enriched_at IS NOT NULL
        ORDER BY ai_enriched_at DESC
        LIMIT $1`,
        [limit]
      );

      const enrichedCount = await db.query(
        `SELECT COUNT(*) as count FROM castateintel.pal_contacts WHERE ai_enriched_at IS NOT NULL`
      );

      return NextResponse.json({
        enrichedContacts: result.rows,
        totalEnriched: enrichedCount.rows[0].count,
        message: "View enriched contacts with AI-researched data",
      });
    }
  } catch (error) {
    console.error("Enrichment status error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
