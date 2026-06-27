-- ============================================================
-- Contact Enrichment Columns Migration
-- Adds AI-researched contact enrichment while preserving document data
-- Run: psql "$DATABASE_URL" -f migration_contact_enrichment.sql
-- ============================================================

-- Add AI enrichment columns to pal_contacts table
ALTER TABLE castateintel.pal_contacts
  ADD COLUMN IF NOT EXISTS ai_email TEXT COMMENT 'Email address from AI research (free sources)',
  ADD COLUMN IF NOT EXISTS ai_phone TEXT COMMENT 'Phone number from AI research (free sources)',
  ADD COLUMN IF NOT EXISTS ai_background TEXT COMMENT 'Background information from AI research',
  ADD COLUMN IF NOT EXISTS ai_prior_roles TEXT COMMENT 'Previous roles and work history from AI research',
  ADD COLUMN IF NOT EXISTS ai_education TEXT COMMENT 'Education and certifications from AI research',
  ADD COLUMN IF NOT EXISTS ai_technical_skills TEXT COMMENT 'Technical skills and expertise from AI research',
  ADD COLUMN IF NOT EXISTS ai_linkedin_url TEXT COMMENT 'LinkedIn profile URL from public sources',
  ADD COLUMN IF NOT EXISTS ai_enrichment_notes TEXT COMMENT 'Additional enrichment notes and source details',
  ADD COLUMN IF NOT EXISTS ai_enrichment_source TEXT DEFAULT 'Free sources: CA.gov directories, government websites, public LinkedIn profiles' COMMENT 'Source attribution for AI enrichment',
  ADD COLUMN IF NOT EXISTS ai_enriched_at TIMESTAMPTZ COMMENT 'Timestamp when contact was enriched by AI';

-- Add index for tracking enriched contacts
CREATE INDEX IF NOT EXISTS idx_contacts_ai_enriched
  ON castateintel.pal_contacts(ai_enriched_at);

-- Add comment to the table documenting enrichment policy
COMMENT ON TABLE castateintel.pal_contacts IS
'Contact records extracted from PAL documents.
AI-researched enrichment stored in ai_* columns to preserve original document data in email/phone/organization columns.
See ai_enrichment_source for data attribution.';

SELECT 'Contact enrichment migration complete' AS status;
