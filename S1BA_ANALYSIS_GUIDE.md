# S1BA Document Analysis Guide

This guide explains how to upload and analyze Stage 1 Business Analysis (S1BA) PDF documents for California IT projects using the CAStateIntel platform.

## Quick Start

### Option 1: Upload via Web UI (Recommended)

1. Navigate to http://localhost:3000/CAStateIntel/upload (or your deployed instance)
2. Upload S1BA PDFs for projects 4440-127 and 2660-552
3. System will:
   - Auto-detect canonical filename (e.g., "4440-127 - S1BA - Pharmacy Modernization.pdf")
   - Extract PDF text on server
   - Process uploads to database

### Option 2: Command-Line Analysis

After PDFs are uploaded via the web UI, run:

```bash
# Analyze specific project
python3 scripts/analyze_s1ba_pdfs.py --project 4440-127
python3 scripts/analyze_s1ba_pdfs.py --project 2660-552

# Analyze all projects with S1BA documents
python3 scripts/analyze_s1ba_pdfs.py --all
```

## Projects to Analyze

### Project 1: 4440-127
- **Name**: Pharmacy Modernization
- **Department**: Department of State Hospitals (Org Code 4440)
- **Stage**: 1 (Business Analysis)
- **Key Contact**: Kwan Kim (kwan.kim@dsh.ca.gov, 916-653-6361)
- **Project Start**: 7/1/2020
- **Scope**: Pharmacy system modernization including inventory, dispensing automation, medication billing

### Project 2: 2660-552
- **Name**: Local Assistance Project Management System (LAPMS)
- **Stage**: 1 (Business Analysis)
- **Status**: Completed and Approved (2/19/2025)

## System Architecture

### Upload Flow
```
PDF Upload → Web UI (/CAStateIntel/upload)
    ↓
Canonical filename detection (client-side)
    ↓
Upload endpoint stores:
  - PDF binary in S3 / Supabase Storage
  - PDF metadata in pal_documents table
    ↓
Optional: Extract text from PDF (pdfplumber)
    ↓
Store content_text in database
```

### Analysis Flow
```
pal_documents table (with content_text)
    ↓
analyze_s1ba_pdfs.py script
    ↓
Claude API (claude-sonnet-4-6)
    ↓
Parse JSON response
    ↓
Store in pal_stage1_analysis table
Store contacts in pal_contacts table
```

## Database Schema

### pal_projects
```sql
- id (PRIMARY KEY)
- project_number (UNIQUE)
- name
- description
- pal_stage
- status
- department_id (FK to departments)
```

### pal_documents
```sql
- id (PRIMARY KEY)
- project_id (FK to pal_projects)
- document_id (UUID)
- stage (1-4)
- label ('Stage 1 Business Analysis')
- filename (canonical name)
- pdf_data (BYTEA - binary PDF)
- content_text (full extracted text)
```

### pal_stage1_analysis
```sql
- analysis_id (UUID PRIMARY KEY)
- project_id (INTEGER UNIQUE FK)
- doc_created_date
- s1ba_version_number
- project_planning_start
- proposed_execution_start
- general_info (JSONB)
- submittal_info (JSONB)
- business_sponsorship (JSONB)
- stakeholder_assessment (JSONB)
- business_program (JSONB)
- project_justification (JSONB)
- business_outcomes (JSONB)
- project_management (JSONB)
- complexity_assessment (JSONB)
- funding (JSONB)
- solution_tags (JSONB array)
- dot_use_only (JSONB)
- extracted_at (TIMESTAMPTZ)
```

### pal_contacts
```sql
- id (PRIMARY KEY)
- project_id (FK to pal_projects)
- document_id (UUID FK to pal_documents)
- name (REQUIRED)
- title
- email
- phone
- organization
- context
- source (section where found)
- role_type ('sponsor', 'stakeholder', 'approver', 'author', 'reviewer', 'contact', 'other')
```

## Environment Variables

Ensure these are set in your `.env.local`:

```env
DATABASE_URL=postgres://user:pass@host:5432/castateintel
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Running the Analysis

### Setup

```bash
# Install dependencies
npm install

# Install Python dependencies
pip3 install psycopg2-binary anthropic pdfplumber

# Initialize database schema (if not already done)
psql "$DATABASE_URL" -f init_castateintel_schema.sql
```

### Execute Analysis

```bash
# Single project
python3 scripts/analyze_s1ba_pdfs.py --project 4440-127

# All projects with S1BA documents
python3 scripts/analyze_s1ba_pdfs.py --all

# With logging
python3 scripts/analyze_s1ba_pdfs.py --project 4440-127 2>&1 | tee analysis.log
```

### Expected Output

```
======================================================================
Analyzing S1BA for 4440-127
======================================================================

1. Getting project...
  Project ID: 123

2. Looking for S1BA document...
  Document ID: uuid-here
  Has PDF binary: true

3. Getting document text...
  ✓ Using existing text (45,230 chars)

4. Running Claude analysis...
  Document: 45,230 chars (~12,922 tokens)
  Response: 8,456 chars, stop=end_turn
  ✓ Analysis complete

5. Storing analysis...
  ✓ Stored analysis for project 123

6. Storing contacts...
  ✓ Stored 12 contacts for project 123

✓ Analysis complete for 4440-127
```

## Troubleshooting

### "No S1BA document found"
- Upload the PDF via the web UI first
- Verify the canonical filename is detected correctly
- Check `pal_documents` table: `SELECT * FROM castateintel.pal_documents WHERE project_id = ...`

### "Could not get document text"
- Ensure pdfplumber is installed: `pip3 install pdfplumber`
- Check if PDF binary is stored: `SELECT pdf_data IS NOT NULL FROM castateintel.pal_documents WHERE id = ...`
- Try manual extraction: `python3 scripts/extract_db_pdfs.py`

### JSON parse errors
- Claude response may have been truncated at max_tokens (64K)
- Check ANTHROPIC_API_KEY is valid
- Verify PDF content is extracting correctly

### Database connection errors
- Verify DATABASE_URL is correct: `psql "$DATABASE_URL" -c "SELECT 1"`
- Check Supabase credentials
- Ensure schema exists: `psql "$DATABASE_URL" -c "\dt castateintel.*"`

## Viewing Results

### Web UI
- Dashboard: http://localhost:3000/CAStateIntel
- Project Details: http://localhost:3000/CAStateIntel/project/4440-127
- Stage 1: http://localhost:3000/CAStateIntel/stage1

### Direct Database Queries

```sql
-- Check if analysis was stored
SELECT * FROM castateintel.pal_stage1_analysis WHERE project_id = (
  SELECT id FROM castateintel.pal_projects WHERE project_number = '4440-127'
);

-- View extracted contacts
SELECT name, email, organization, role_type
FROM castateintel.pal_contacts
WHERE project_id = (SELECT id FROM castateintel.pal_projects WHERE project_number = '4440-127')
ORDER BY name;

-- Check document text extraction
SELECT project_number, filename, length(content_text) AS chars
FROM castateintel.pal_documents
JOIN castateintel.pal_projects ON pal_documents.project_id = pal_projects.id
WHERE project_number IN ('4440-127', '2660-552');
```

## API Endpoints

### Trigger Analysis via API
```bash
curl -X POST http://localhost:3000/api/castateintel/analysis/extract \
  -H "Content-Type: application/json" \
  -d '{"project_number": "4440-127", "stage": 1}'
```

Response:
```json
{
  "success": true,
  "project_number": "4440-127",
  "stage": 1,
  "stdout": "Analysis complete..."
}
```

## Next Steps

1. **Upload S1BA PDFs** via /CAStateIntel/upload
2. **Run analysis script** for each project
3. **Review extracted data** in web UI or database
4. **Link contacts** to organizational records
5. **Repeat for Stages 2-4** as documents become available

## Related Files

- `/app/CAStateIntel/upload/page.tsx` - Upload UI
- `/app/api/castateintel/upload/route.ts` - Upload endpoint
- `/scripts/analyze_s1ba_pdfs.py` - Analysis script (this file)
- `/scripts/extract_db_pdfs.py` - Manual text extraction
- `/migration_stage4.sql` - Database migrations
