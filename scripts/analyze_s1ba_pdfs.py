#!/usr/bin/env python3
"""
analyze_s1ba_pdfs.py — Analyze S1BA PDFs for specific projects

Processes Stage 1 Business Analysis PDFs that have been uploaded to the database
and extracts structured analysis data using Claude API.

Usage:
  python3 scripts/analyze_s1ba_pdfs.py --project 4440-127
  python3 scripts/analyze_s1ba_pdfs.py --project 2660-552
  python3 scripts/analyze_s1ba_pdfs.py --all

The script:
  1. Looks up the project in the database
  2. Finds the S1BA document (uploaded via /CAStateIntel/upload)
  3. Extracts text from the PDF binary if needed
  4. Sends to Claude for structured analysis
  5. Stores analysis in pal_stage1_analysis table
  6. Links extracted contacts to pal_contacts table
"""

import os
import sys
import json
import uuid
import argparse
import tempfile
import psycopg2
import psycopg2.extras
import anthropic

DATABASE_URL = os.environ.get("DATABASE_URL")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
MODEL = "claude-sonnet-4-6"

# ══════════════════════════════════════════════════════════════════════════════
# Database helpers
# ══════════════════════════════════════════════════════════════════════════════

def get_db():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def get_project(conn, project_number):
    """Get project by number, creating it if needed."""
    cur = conn.cursor()
    cur.execute(
        "SELECT id, project_number, name FROM castateintel.pal_projects WHERE project_number = %s",
        (project_number,)
    )
    row = cur.fetchone()
    if row:
        return row

    # Create project if not found
    print(f"  Project {project_number} not found, creating placeholder...")
    cur.execute("""
        INSERT INTO castateintel.pal_projects
        (project_number, name, pal_stage, status)
        VALUES (%s, %s, 'Stage 1', 'In Progress')
        RETURNING id, project_number, name
    """, (project_number, f"Project {project_number}"))
    conn.commit()
    return cur.fetchone()


def get_s1ba_document(conn, project_id):
    """Get the S1BA document for this project (stage 1)."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, document_id, stage, filename, content_text,
               (pdf_data IS NOT NULL) AS has_pdf,
               length(content_text) AS text_len
        FROM castateintel.pal_documents
        WHERE project_id = %s AND stage = 1
        ORDER BY (content_text IS NOT NULL AND length(content_text) > 100) DESC,
                 id DESC
        LIMIT 1
    """, (project_id,))
    return cur.fetchone()


def extract_text_from_pdf_bytes(pdf_bytes):
    """Extract text from PDF bytes using pdfplumber."""
    try:
        import pdfplumber
    except ImportError:
        print("  pdfplumber not installed — run: pip3 install pdfplumber")
        return ""

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
        tmp = f.name
    try:
        with pdfplumber.open(tmp) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
        text = "\n".join(pages).strip()
        return text
    except Exception as e:
        print(f"  pdfplumber error: {e}")
        return ""
    finally:
        os.unlink(tmp)


def get_document_text(conn, doc):
    """
    Ensure we have extracted text for this document.
    Priority:
      1. content_text already in DB → use it
      2. pdf_data binary exists → extract text from it
      3. Return None
    """
    if doc and doc.get("text_len") and doc["text_len"] > 100:
        print(f"  ✓ Using existing text ({doc['text_len']:,} chars)")
        return doc["content_text"]

    if doc and doc.get("has_pdf"):
        print(f"  PDF binary found but no text — extracting...")
        cur = conn.cursor()
        cur.execute("SELECT pdf_data FROM castateintel.pal_documents WHERE id = %s", (doc["id"],))
        row = cur.fetchone()
        if row and row["pdf_data"]:
            pdf_bytes = bytes(row["pdf_data"])
            text = extract_text_from_pdf_bytes(pdf_bytes)
            if text:
                cur.execute(
                    "UPDATE castateintel.pal_documents SET content_text = %s WHERE id = %s",
                    (text, doc["id"])
                )
                conn.commit()
                print(f"  Extracted {len(text):,} chars")
                return text

    return None


# ══════════════════════════════════════════════════════════════════════════════
# Claude API Analysis
# ══════════════════════════════════════════════════════════════════════════════

def clean_json(text):
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def safe_parse_json(text):
    """Safely parse JSON with recovery for truncated responses."""
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  JSON parse error at char {e.pos}: {e.msg}")
        # Try finding last complete closing brace
        depth, in_str, esc, last_ok = 0, False, False, 0
        for i, ch in enumerate(text):
            if esc: esc = False; continue
            if ch == '\\' and in_str: esc = True; continue
            if ch == '"' and not esc: in_str = not in_str; continue
            if in_str: continue
            if ch == '{': depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0: last_ok = i + 1
        if last_ok:
            try:
                result = json.loads(text[:last_ok])
                print(f"  Recovered JSON by truncating to char {last_ok}")
                return result
            except Exception:
                pass
        raise


def analyze_s1ba_pdf(content_text):
    """Call Claude API to extract S1BA analysis from PDF text."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    char_count = len(content_text)
    est_tokens = int(char_count / 3.5)
    print(f"  Document: {char_count:,} chars (~{est_tokens:,} tokens)")

    prompt = f"""You are extracting structured data from a California IT project Stage 1 Business Analysis (S1BA) PDF document.

<document>
{content_text}
</document>

Extract ALL of the following information. Return ONLY valid JSON, no preamble or markdown.

{{
  "doc_created_date": "YYYY-MM-DD or null",
  "s1ba_version_number": "string or null",
  "project_planning_start": "YYYY-MM-DD or null",
  "proposed_execution_start": "YYYY-MM-DD or null",

  "contacts": [
    {{
      "name": "full legal name — REQUIRED, skip entry if unknown",
      "title": "job title or null",
      "email": "email address or null",
      "phone": "phone number with area code or null",
      "organization": "department or agency name or null",
      "context": "brief description of their role",
      "source": "section name where found",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|contact|other"
    }}
  ],

  "urls": [
    {{"url": "https://...", "context": "where/why it appeared"}}
  ],

  "general_info": {{
    "summary": "200-word summary",
    "key_values": {{"field_name": "value"}}
  }},

  "submittal_info": {{
    "submission_date": "date or null",
    "submitted_to": "org or null",
    "key_values": {{}}
  }},

  "business_sponsorship": {{
    "key_values": {{}}
  }},

  "stakeholder_assessment": {{
    "description": "300-500 word summary",
    "stakeholders": [
      {{"name": "...", "organization": "...", "role": "...", "interest": "...", "influence": "..."}}
    ]
  }},

  "business_program": {{
    "summary": "500-word summary",
    "key_values": {{}}
  }},

  "project_justification": {{
    "summary": "500-word summary",
    "key_values": {{}}
  }},

  "business_outcomes": {{
    "summary": "500-word summary",
    "outcomes": [
      {{"outcome": "description", "metric": "how measured or null", "target": "target value or null"}}
    ]
  }},

  "project_management": {{
    "description": "200-word description",
    "key_values": {{}}
  }},

  "complexity_assessment": {{
    "description": "200-word description",
    "scores": [
      {{"dimension": "...", "score": "...", "rationale": "..."}}
    ]
  }},

  "funding": {{
    "description": "200-word description",
    "rom_estimate": [
      {{"category": "...", "amount": "...", "notes": "..."}}
    ],
    "total_estimate": "dollar amount or null",
    "funding_sources": [
      {{"source": "...", "amount": "...", "fiscal_year": "..."}}
    ]
  }},

  "solution_tags": ["tag1", "tag2", "tag3"],

  "dot_use_only": {{
    "dates": [
      {{"label": "...", "date": "YYYY-MM-DD or string"}}
    ],
    "other_fields": {{}}
  }}
}}"""

    response_text = ""
    with client.messages.stream(
        model=MODEL,
        max_tokens=64000,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            response_text += text
        final = stream.get_final_message()
        stop_reason = final.stop_reason

    response_text = response_text.strip()
    print(f"  Response: {len(response_text):,} chars, stop={stop_reason}")

    return safe_parse_json(clean_json(response_text))


# ══════════════════════════════════════════════════════════════════════════════
# Database Storage
# ══════════════════════════════════════════════════════════════════════════════

def store_analysis(conn, project_id, document_id, analysis_data):
    """Store the analyzed S1BA data in the pal_stage1_analysis table."""
    cur = conn.cursor()

    # Extract top-level fields
    doc_created_date = analysis_data.get("doc_created_date")
    s1ba_version = analysis_data.get("s1ba_version_number")
    planning_start = analysis_data.get("project_planning_start")
    exec_start = analysis_data.get("proposed_execution_start")

    # Convert date strings to date objects if they're valid
    def to_date(d):
        if isinstance(d, str) and d != "null" and d:
            try:
                return d[:10]  # YYYY-MM-DD
            except:
                return None
        return None

    doc_created_date = to_date(doc_created_date)
    planning_start = to_date(planning_start)
    exec_start = to_date(exec_start)

    # Store analysis record
    cur.execute("""
        INSERT INTO castateintel.pal_stage1_analysis
        (project_id, document_id, doc_created_date, s1ba_version_number,
         project_planning_start, proposed_execution_start,
         general_info, submittal_info, submittal_contacts, business_sponsorship,
         stakeholder_assessment, business_program, project_justification,
         business_outcomes, project_management, complexity_assessment, funding,
         solution_tags, dot_use_only)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (project_id) DO UPDATE SET
          document_id = EXCLUDED.document_id,
          doc_created_date = EXCLUDED.doc_created_date,
          general_info = EXCLUDED.general_info,
          submittal_info = EXCLUDED.submittal_info,
          business_sponsorship = EXCLUDED.business_sponsorship,
          stakeholder_assessment = EXCLUDED.stakeholder_assessment,
          business_program = EXCLUDED.business_program,
          project_justification = EXCLUDED.project_justification,
          business_outcomes = EXCLUDED.business_outcomes,
          project_management = EXCLUDED.project_management,
          complexity_assessment = EXCLUDED.complexity_assessment,
          funding = EXCLUDED.funding,
          solution_tags = EXCLUDED.solution_tags,
          dot_use_only = EXCLUDED.dot_use_only,
          updated_at = now()
    """, (
        project_id, document_id, doc_created_date, s1ba_version,
        planning_start, exec_start,
        json.dumps(analysis_data.get("general_info", {})),
        json.dumps(analysis_data.get("submittal_info", {})),
        json.dumps(analysis_data.get("submittal_contacts", []) or analysis_data.get("contacts", [])),
        json.dumps(analysis_data.get("business_sponsorship", {})),
        json.dumps(analysis_data.get("stakeholder_assessment", {})),
        json.dumps(analysis_data.get("business_program", {})),
        json.dumps(analysis_data.get("project_justification", {})),
        json.dumps(analysis_data.get("business_outcomes", {})),
        json.dumps(analysis_data.get("project_management", {})),
        json.dumps(analysis_data.get("complexity_assessment", {})),
        json.dumps(analysis_data.get("funding", {})),
        json.dumps(analysis_data.get("solution_tags", [])),
        json.dumps(analysis_data.get("dot_use_only", {})),
    ))
    conn.commit()
    print(f"  ✓ Stored analysis for project {project_id}")


def store_contacts(conn, project_id, document_id, contacts):
    """Store extracted contacts in the pal_contacts table."""
    if not contacts:
        return

    cur = conn.cursor()
    for contact in contacts:
        if not contact.get("name"):
            continue

        cur.execute("""
            INSERT INTO castateintel.pal_contacts
            (project_id, document_id, name, title, email, phone, organization,
             context, source, role_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (
            project_id,
            uuid.UUID(document_id) if document_id else None,
            contact.get("name"),
            contact.get("title"),
            contact.get("email"),
            contact.get("phone"),
            contact.get("organization"),
            contact.get("context"),
            contact.get("source"),
            contact.get("role_type", "contact"),
        ))

    conn.commit()
    print(f"  ✓ Stored {len(contacts)} contacts for project {project_id}")


# ══════════════════════════════════════════════════════════════════════════════
# Main Workflow
# ══════════════════════════════════════════════════════════════════════════════

def analyze_project(project_number):
    """Analyze a single project's S1BA PDF."""
    print(f"\n{'='*70}")
    print(f"Analyzing S1BA for {project_number}")
    print(f"{'='*70}")

    try:
        conn = get_db()

        # 1. Get/create project
        print(f"\n1. Getting project...")
        project = get_project(conn, project_number)
        print(f"  Project ID: {project['id']}")

        # 2. Get S1BA document
        print(f"\n2. Looking for S1BA document...")
        doc = get_s1ba_document(conn, project["id"])
        if not doc:
            print(f"  ✗ No S1BA document found for {project_number}")
            print(f"    → Upload via /CAStateIntel/upload")
            return False

        print(f"  Document ID: {doc['document_id']}")
        print(f"  Has PDF binary: {doc['has_pdf']}")

        # 3. Extract text from PDF if needed
        print(f"\n3. Getting document text...")
        content_text = get_document_text(conn, doc)
        if not content_text:
            print(f"  ✗ Could not get document text")
            return False

        # 4. Analyze with Claude
        print(f"\n4. Running Claude analysis...")
        analysis_data = analyze_s1ba_pdf(content_text)
        print(f"  ✓ Analysis complete")

        # 5. Store analysis
        print(f"\n5. Storing analysis...")
        store_analysis(conn, project["id"], str(doc["document_id"]), analysis_data)

        # 6. Store contacts
        print(f"\n6. Storing contacts...")
        store_contacts(conn, project["id"], str(doc["document_id"]), analysis_data.get("contacts", []))

        print(f"\n✓ Analysis complete for {project_number}")
        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if 'conn' in locals():
            conn.close()


def main():
    parser = argparse.ArgumentParser(description="Analyze S1BA PDFs")
    parser.add_argument("--project", help="Analyze specific project (e.g., 4440-127)")
    parser.add_argument("--all", action="store_true", help="Analyze all projects with S1BA documents")
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set")
        sys.exit(1)

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    try:
        if args.project:
            success = analyze_project(args.project)
            sys.exit(0 if success else 1)

        elif args.all:
            print("Analyzing all projects with S1BA documents...")
            conn = get_db()
            cur = conn.cursor()
            cur.execute("""
                SELECT DISTINCT p.project_number
                FROM castateintel.pal_projects p
                JOIN castateintel.pal_documents d ON d.project_id = p.id
                WHERE d.stage = 1 AND d.content_text IS NOT NULL
                   OR (d.stage = 1 AND d.pdf_data IS NOT NULL)
                ORDER BY p.project_number
            """)
            projects = [r[0] for r in cur.fetchall()]
            conn.close()

            if not projects:
                print("No projects found with S1BA documents")
                sys.exit(1)

            print(f"Found {len(projects)} projects")
            results = {}
            for pn in projects:
                results[pn] = analyze_project(pn)

            print(f"\n{'='*70}")
            print("SUMMARY")
            print(f"{'='*70}")
            for pn, success in results.items():
                status = "✓" if success else "✗"
                print(f"{status} {pn}")

            success_count = sum(1 for s in results.values() if s)
            sys.exit(0 if success_count == len(results) else 1)

        else:
            parser.print_help()
            sys.exit(0)

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
