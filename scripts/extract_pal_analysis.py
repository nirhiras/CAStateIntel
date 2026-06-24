#!/usr/bin/env python3
"""
extract_pal_analysis.py — PAL Document Analysis Pipeline

WORKFLOW (per stage, per project):
  1. Check DB for existing PDF (pdf_data column) with extracted text
  2. If found → use content_text directly (full document, no truncation)
  3. If NOT found → scrape projecttracking.technology.ca.gov, download PDF,
     store binary + extract text into DB, then process
  4. Run Claude extraction → save structured data to analysis tables

Users can also upload PDFs via /CAStateIntel/upload — once stored in DB,
this script will pick them up automatically on next run.

Context window: claude-sonnet-4-6 supports 1M tokens input / 64K output.
At ~3.5 chars/token, even a 350K char document is only ~100K tokens — well
within limits. No truncation applied.

Usage:
  python3 scripts/extract_pal_analysis.py --project 4265-081
  python3 scripts/extract_pal_analysis.py --project 4265-081 --stage 1
  python3 scripts/extract_pal_analysis.py --all
  python3 scripts/extract_pal_analysis.py --all --force   # re-extract even if already done
"""

import os
import sys
import json
import time
import uuid
import argparse
import tempfile
import requests
import psycopg2
import psycopg2.extras
import anthropic
import httpx
import anthropic

DATABASE_URL  = os.environ.get("DATABASE_URL")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
MODEL = "claude-sonnet-4-6"

PAL_BASE = "https://projecttracking.technology.ca.gov"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
}

STAGE_LABEL_MAP = {
    1: "Stage 1 Business Analysis",
    2: "Stage 2 Alternative Analysis",
    3: "Stage 3 Solutions Analysis",
}
STAGE_FILENAME_MAP = {
    1: "Stage_1_Business_Analysis.pdf",
    2: "Stage_2_Alternative_Analysis.pdf",
    3: "Stage_3_Solutions_Analysis.pdf",
}


# ══════════════════════════════════════════════════════════════════════════════
# DB helpers
# ══════════════════════════════════════════════════════════════════════════════

def get_db():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def get_project(conn, project_number):
    cur = conn.cursor()
    cur.execute(
        "SELECT id, project_number, name, detail_url FROM castateintel.pal_projects WHERE project_number = %s",
        (project_number,)
    )
    return cur.fetchone()


def get_document(conn, project_id, stage):
    """
    Return the best document for this project+stage.
    Prefers rows with both pdf_data AND content_text; falls back to content_text only.
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT id, document_id, stage, label, filename, download_url,
               content_text, pdf_data IS NOT NULL AS has_pdf,
               length(content_text) AS text_len
        FROM castateintel.pal_documents
        WHERE project_id = %s AND stage = %s
        ORDER BY
            (pdf_data IS NOT NULL) DESC,
            (content_text IS NOT NULL AND length(content_text) > 100) DESC,
            id DESC
        LIMIT 1
    """, (project_id, stage))
    return cur.fetchone()


def get_all_projects_with_docs(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT p.project_number
        FROM castateintel.pal_projects p
        JOIN castateintel.pal_documents d ON d.project_id = p.id
        WHERE d.content_text IS NOT NULL AND length(d.content_text) > 100
        ORDER BY p.project_number
    """)
    return [r["project_number"] for r in cur.fetchall()]


def already_extracted(conn, project_id, stage):
    table = {1: "pal_stage1_analysis", 2: "pal_stage2_analysis", 3: "pal_stage3_analysis"}[stage]
    cur = conn.cursor()
    cur.execute(f"SELECT 1 FROM castateintel.{table} WHERE project_id = %s", (project_id,))
    return cur.fetchone() is not None


def store_document(conn, project_id, stage, label, filename, download_url, pdf_bytes, content_text):
    """Upsert a document record with PDF binary and extracted text."""
    doc_id = str(uuid.uuid4())
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO castateintel.pal_documents
          (project_id, stage, label, document_id, download_url, filename,
           file_size_kb, pdf_data, content_text)
        VALUES (%s, %s, %s, %s::uuid, %s, %s, %s, %s, %s)
        ON CONFLICT (project_id, stage, document_id) DO UPDATE SET
          pdf_data      = EXCLUDED.pdf_data,
          content_text  = EXCLUDED.content_text,
          filename      = EXCLUDED.filename,
          updated_at    = now()
        RETURNING id
    """, (
        project_id, stage, label, doc_id, download_url, filename,
        len(pdf_bytes) // 1024 if pdf_bytes else None,
        psycopg2.Binary(pdf_bytes) if pdf_bytes else None,
        content_text,
    ))
    conn.commit()
    return doc_id


# ══════════════════════════════════════════════════════════════════════════════
# PDF download + text extraction
# ══════════════════════════════════════════════════════════════════════════════

def extract_text_from_bytes(pdf_bytes):
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


def extract_text_from_db_pdf(conn, doc):
    """Re-extract text from the stored pdf_data binary in DB."""
    cur = conn.cursor()
    cur.execute("SELECT pdf_data FROM castateintel.pal_documents WHERE id = %s", (doc["id"],))
    row = cur.fetchone()
    if not row or not row["pdf_data"]:
        return None
    pdf_bytes = bytes(row["pdf_data"])
    print(f"  Re-extracting text from stored PDF ({len(pdf_bytes):,} bytes)...")
    text = extract_text_from_bytes(pdf_bytes)
    if text:
        cur.execute(
            "UPDATE castateintel.pal_documents SET content_text = %s WHERE id = %s",
            (text, doc["id"])
        )
        conn.commit()
        print(f"  Extracted {len(text):,} chars")
    return text


def download_pdf_from_pal(project, stage):
    """
    Try to scrape the PAL project detail page and download the stage PDF.
    Returns (pdf_bytes, download_url) or (None, None).
    """
    import re

    detail_url = project.get("detail_url") or ""

    # If we have a direct detail URL, use it
    if not detail_url or "PALDetails" not in detail_url:
        # Try to find it from the project number
        print(f"  Searching PAL listing for {project['project_number']}...")
        try:
            r = requests.get(f"{PAL_BASE}/PAL", headers=HEADERS, timeout=20)
            # Look for project number in page, extract detail link
            matches = re.findall(
                rf'{re.escape(project["project_number"])}.*?href=["\']([^"\']*PALDetails[^"\']*)["\']',
                r.text, re.S
            )
            if matches:
                detail_url = PAL_BASE + matches[0] if not matches[0].startswith("http") else matches[0]
        except Exception as e:
            print(f"  PAL listing fetch failed: {e}")

    if not detail_url:
        print("  Could not determine project detail URL")
        return None, None

    print(f"  Fetching project detail: {detail_url}")
    time.sleep(3)  # Rate limit
    try:
        r = requests.get(detail_url, headers=HEADERS, timeout=30)
        if r.status_code != 200:
            print(f"  Detail page returned {r.status_code}")
            return None, None
    except Exception as e:
        print(f"  Detail page fetch failed: {e}")
        return None, None

    # Find stage-specific download link
    stage_keywords = {
        1: ["stage 1", "business analysis"],
        2: ["stage 2", "alternative analysis", "alternatives analysis"],
        3: ["stage 3", "solution", "solutions analysis"],
    }
    keywords = stage_keywords[stage]

    # Find all DownloadProposal links with surrounding text
    all_links = re.findall(
        r'<[^>]*href=["\']([^"\']*DownloadProposal[^"\']*)["\'][^>]*>(.*?)</[^>]+>',
        r.text, re.S | re.I
    )
    if not all_links:
        # Try looser match
        all_links = re.findall(r'href=["\']([^"\']*DownloadProposal[^"\']*)["\']', r.text)
        all_links = [(url, "") for url in all_links]

    download_url = None
    for url, label in all_links:
        label_clean = re.sub(r'<[^>]+>', '', label).strip().lower()
        if any(kw in label_clean for kw in keywords):
            download_url = url if url.startswith("http") else PAL_BASE + url
            break

    # Fallback: if only one link found
    if not download_url and len(all_links) == 1:
        download_url = all_links[0][0]
        if not download_url.startswith("http"):
            download_url = PAL_BASE + download_url

    if not download_url:
        print(f"  No Stage {stage} PDF link found on detail page")
        return None, None

    print(f"  Downloading PDF: {download_url}")
    time.sleep(3)
    try:
        r = requests.get(download_url, headers=HEADERS, timeout=60, stream=True)
        if r.status_code == 200 and "pdf" in r.headers.get("content-type", "").lower():
            pdf_bytes = r.content
            print(f"  Downloaded {len(pdf_bytes):,} bytes")
            return pdf_bytes, download_url
        else:
            print(f"  Download returned {r.status_code} / {r.headers.get('content-type')}")
    except Exception as e:
        print(f"  Download failed: {e}")

    return None, None


def ensure_document_text(conn, project, stage, doc):
    """
    Guarantee content_text is populated for this document.
    Priority:
      1. content_text already exists in DB → use it
      2. pdf_data exists in DB → re-extract text from it
      3. Try to download from PAL site → store + extract
      4. Fail with guidance to use the upload UI
    Returns content_text string or None.
    """
    # 1. Already have text
    if doc and doc.get("text_len") and doc["text_len"] > 100:
        print(f"  ✓ Using existing text ({doc['text_len']:,} chars)")
        return doc["content_text"]

    # 2. Have PDF binary but no text
    if doc and doc.get("has_pdf"):
        print(f"  PDF binary found but no text — re-extracting...")
        text = extract_text_from_db_pdf(conn, doc)
        if text:
            return text
        print("  Re-extraction failed")

    # 3. Try downloading from PAL site
    print(f"  No document found in DB for Stage {stage} — attempting download from PAL...")
    pdf_bytes, download_url = download_pdf_from_pal(project, stage)
    if pdf_bytes:
        text = extract_text_from_bytes(pdf_bytes)
        if not text:
            print("  Text extraction failed — storing PDF binary only")
        label = STAGE_LABEL_MAP[stage]
        filename = STAGE_FILENAME_MAP[stage]
        store_document(conn, project["id"], stage, label, filename, download_url, pdf_bytes, text)
        print(f"  Stored in DB: {len(text):,} chars extracted")
        return text if text else None

    # 4. Guidance
    print(f"""
  ✗ Could not obtain Stage {stage} PDF for {project['project_number']}.
  Options:
    A) Upload via the web UI: http://localhost:3000/CAStateIntel/upload
       The script will use it automatically on next run.
    B) Check the PAL site manually:
       {project.get('detail_url') or PAL_BASE + '/PAL'}
""")
    return None


# ══════════════════════════════════════════════════════════════════════════════
# Claude API — no truncation, full document
# ══════════════════════════════════════════════════════════════════════════════

def clean_json(text):
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def safe_parse(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  JSON error at char {e.pos}: {e.msg}")
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


def call_claude(content_text, prompt_template, stage=None):
    # Use a very long timeout — large responses can take several minutes
    client = anthropic.Anthropic(
        api_key=ANTHROPIC_API_KEY,
        timeout=httpx.Timeout(600.0, connect=10.0),  # 10 min read timeout
    )

    char_count = len(content_text)
    est_tokens = int(char_count / 3.5)
    print(f"  Document: {char_count:,} chars (~{est_tokens:,} tokens) — full document, no truncation")

    prompt = prompt_template.format(content_text=content_text)

    # Streaming required for max_tokens > ~8K
    response_text = ""
    stop_reason = None
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

    if stop_reason == "max_tokens":
        print("  WARNING: Response hit max_tokens — attempting JSON recovery")

    return safe_parse(clean_json(response_text))


# ══════════════════════════════════════════════════════════════════════════════
# Prompts
# ══════════════════════════════════════════════════════════════════════════════

STAGE1_PROMPT = """You are extracting structured data from a California IT project Stage 1 Business Analysis PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

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
      "context": "brief description of their role and involvement in this project",
      "source": "exact section name where this person appears (e.g. Section 1.2 Submittal Information)",
      "doc_created_date": "date of this document in YYYY-MM-DD format or null",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|contact|other"
    }}
  ],

  "urls": [
    {{"url": "https://...", "context": "where/why it appeared"}}
  ],

  "general_info": {{
    "summary": "200-word summary of the General Information section",
    "key_values": {{"field_name": "value"}}
  }},

  "submittal_info": {{
    "contacts": [],
    "submission_date": "date or null",
    "submitted_to": "org or null",
    "key_values": {{}}
  }},

  "business_sponsorship": {{
    "contacts": [],
    "key_values": {{}}
  }},

  "stakeholder_assessment": {{
    "description": "300-500 word description of the stakeholder assessment",
    "stakeholders": [
      {{"name": "...", "organization": "...", "role": "...", "interest": "...", "influence": "..."}}
    ]
  }},

  "business_program": {{
    "contacts": [],
    "summary": "500-word summary of the Business Program section",
    "key_values": {{}}
  }},

  "project_justification": {{
    "contacts": [],
    "summary": "500-word summary of the Project Justification section",
    "key_values": {{}}
  }},

  "business_outcomes": {{
    "contacts": [],
    "summary": "500-word summary of Business Outcomes Desired",
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

  "dot_use_only": {{
    "dates": [
      {{"label": "...", "date": "YYYY-MM-DD or string"}}
    ],
    "other_fields": {{}}
  }}
}}"""

STAGE2_PROMPT = """You are extracting structured data from a California IT project Stage 2 Alternative Analysis PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{{
  "doc_created_date": "YYYY-MM-DD or null",

  "contacts": [
    {{
      "name": "full legal name — REQUIRED, skip entry if unknown",
      "title": "job title or null",
      "email": "email address or null",
      "phone": "phone number with area code or null",
      "organization": "department or agency name or null",
      "context": "brief description of their role and involvement in this project",
      "source": "exact section name where this person appears (e.g. Section 2.2 Submittal Information)",
      "doc_created_date": "date of this document in YYYY-MM-DD format or null",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|contact|other"
    }}
  ],

  "urls": [
    {{"url": "https://...", "context": "where/why it appeared"}}
  ],

  "general_info": {{
    "key_values": {{"field": "value"}}
  }},

  "submittal_info": {{
    "contacts": [],
    "key_values": {{}}
  }},

  "baseline_processes": {{
    "summary": "300-word summary of baseline processes and current systems",
    "systems": [
      {{"system_name": "...", "purpose": "...", "status": "..."}}
    ]
  }},

  "requirements_outcomes": {{
    "summary": "300-word summary",
    "requirements": [
      {{"id": "...", "description": "...", "priority": "...", "category": "..."}}
    ]
  }},

  "assumptions_constraints": {{
    "assumptions": [
      {{"id": "...", "assumption": "...", "description": "...", "impact": "..."}}
    ],
    "constraints": [
      {{"constraint": "...", "description": "...", "impact": "..."}}
    ]
  }},

  "dependencies": {{
    "summary": "300-word summary",
    "items": [
      {{"dependency": "...", "type": "internal|external", "owner": "...", "impact": "..."}}
    ]
  }},

  "market_research": {{
    "summary": "500-word summary",
    "vendors_identified": [
      {{"vendor": "...", "solution": "...", "notes": "..."}}
    ]
  }},

  "viable_solutions": [
    {{
      "name": "solution name",
      "summary": "300-word summary for this solution",
      "pros": ["..."],
      "cons": ["..."],
      "estimated_cost": "...",
      "recommended": true
    }}
  ],

  "solution_tags": [
    {{
      "tag": "short tag label (e.g. Microsoft Azure, Salesforce, SaaS, BPM, COTS, Custom Dev, Cloud Migration, API Integration, ERP, CRM, RPA, Low-Code, Open Source)",
      "category": "vendor|technology|approach|deployment|industry",
      "applies_to": "name of the solution this tag applies to, or 'all' if general",
      "confidence": "high|medium|low"
    }}
  ],

  "project_organization": {{
    "summary": "500-word summary",
    "roles": [
      {{"role": "...", "responsibilities": "...", "fte": "..."}}
    ]
  }},

  "project_planning": {{
    "summary": "300-500 word summary",
    "milestones": [
      {{"milestone": "...", "date": "...", "owner": "..."}}
    ]
  }},

  "data_migration": {{
    "summary": "300-word summary",
    "activities": [
      {{"activity": "...", "description": "...", "complexity": "..."}}
    ]
  }},

  "financial_analysis": {{
    "summary": "narrative",
    "cost_table": [
      {{"category": "...", "year1": "...", "year2": "...", "year3": "...", "total": "..."}}
    ],
    "npv": "...",
    "roi": "...",
    "payback_period": "..."
  }},

  "dot_use_only": {{
    "dates": [
      {{"label": "...", "date": "YYYY-MM-DD or string"}}
    ],
    "other_fields": {{}}
  }}
}}"""

STAGE3_PROMPT = """You are extracting structured data from a California IT project Stage 3 Solution Analysis PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{{
  "doc_created_date": "YYYY-MM-DD or null",

  "contacts": [
    {{
      "name": "full legal name — REQUIRED, skip entry if unknown",
      "title": "job title or null",
      "email": "email address or null",
      "phone": "phone number with area code or null",
      "organization": "department or agency name or null",
      "context": "brief description of their role and involvement in this project",
      "source": "exact section name where this person appears (e.g. Section 3.2 Submittal Information)",
      "doc_created_date": "date of this document in YYYY-MM-DD format or null",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|contact|other"
    }}
  ],

  "urls": [
    {{"url": "https://...", "context": "where/why it appeared"}}
  ],

  "general_info": {{
    "project_name": "...",
    "project_number": "...",
    "department": "...",
    "agency": "...",
    "project_manager": "...",
    "selected_solution": "...",
    "key_values": {{}}
  }},

  "submittal_info": {{
    "contacts": [],
    "key_values": {{}}
  }},

  "solution_requirements": {{
    "summary": "300-500 word summary",
    "functional_requirements": [
      {{"id": "...", "requirement": "...", "priority": "...", "source": "..."}}
    ],
    "non_functional_requirements": [],
    "outcomes": [
      {{"outcome": "...", "metric": "...", "target": "..."}}
    ]
  }},

  "procurements_roadmap": {{
    "phases": [
      {{"phase": "...", "start_date": "...", "end_date": "...", "description": "...", "deliverables": []}}
    ],
    "key_milestones": [
      {{"milestone": "...", "date": "...", "type": "..."}}
    ],
    "total_duration": "..."
  }},

  "project_planning": {{
    "schedule": [
      {{"task": "...", "start": "...", "end": "...", "owner": "...", "status": "..."}}
    ],
    "resources": [
      {{"role": "...", "fte": "...", "duration": "...", "source": "state|contractor"}}
    ]
  }},

  "primary_solicitation": {{
    "solicitation_type": "RFP|IFB|RFO|other",
    "anticipated_release_date": "...",
    "contract_term": "...",
    "evaluation_criteria": [
      {{"criterion": "...", "weight": "..."}}
    ],
    "contract_type": "...",
    "estimated_contract_value": "...",
    "key_values": {{}}
  }},

  "ancillary_procurements": [
    {{
      "name": "procurement name",
      "description": "detailed description",
      "procurement_type": "...",
      "vendor_or_source": "...",
      "estimated_value": "...",
      "timeline": "...",
      "justification": "...",
      "key_values": {{}}
    }}
  ],

  "dot_use_only": {{
    "dates": [
      {{"label": "...", "date": "YYYY-MM-DD or string"}}
    ],
    "other_fields": {{}}
  }}
}}"""

PROMPT_MAP = {1: STAGE1_PROMPT, 2: STAGE2_PROMPT, 3: STAGE3_PROMPT}


# ══════════════════════════════════════════════════════════════════════════════
# Save functions
# ══════════════════════════════════════════════════════════════════════════════

def save_contacts(conn, project_id, document_id, stage, contacts):
    cur = conn.cursor()
    cur.execute("DELETE FROM castateintel.pal_contacts WHERE document_id = %s", (str(document_id),))
    saved, skipped = 0, 0
    seen = set()
    for c in contacts:
        name = (c.get("name") or "").strip()
        if not name or name.lower() in ("null", "unknown", "n/a", ""):
            skipped += 1; continue
        key = (name.lower(), (c.get("email") or "").lower())
        if key in seen:
            skipped += 1; continue
        seen.add(key)
        doc_date = c.get("doc_created_date")
        if doc_date in (None, "null", "", "N/A"): doc_date = None
        cur.execute("""
            INSERT INTO castateintel.pal_contacts
              (project_id, document_id, stage, name, title, email, phone,
               organization, context, role_type, source, doc_created_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            project_id, str(document_id), stage,
            name, c.get("title"), c.get("email"), c.get("phone"),
            c.get("organization"), c.get("context"), c.get("role_type"),
            c.get("source"), doc_date,
        ))
        saved += 1
    print(f"  Saved {saved} contacts ({skipped} skipped)")


def save_urls(conn, project_id, document_id, stage, urls):
    cur = conn.cursor()
    cur.execute("DELETE FROM castateintel.pal_urls WHERE document_id = %s", (str(document_id),))
    for u in urls:
        cur.execute(
            "INSERT INTO castateintel.pal_urls (project_id, document_id, stage, url, context) VALUES (%s,%s,%s,%s,%s)",
            (project_id, str(document_id), stage, u.get("url"), u.get("context"))
        )
    print(f"  Saved {len(urls)} URLs")


def save_stage1(conn, project_id, document_id, data):
    cur = conn.cursor()
    cur.execute("DELETE FROM castateintel.pal_stage1_analysis WHERE project_id = %s", (project_id,))
    cur.execute("""
        INSERT INTO castateintel.pal_stage1_analysis (
          project_id, document_id, doc_created_date, s1ba_version_number,
          project_planning_start, proposed_execution_start,
          general_info_summary, general_info_raw,
          submittal_info, business_sponsorship,
          stakeholder_summary, stakeholders,
          business_program_summary, business_program_raw,
          justification_summary, justification_raw,
          outcomes_summary, outcomes_raw,
          project_mgmt_summary, project_mgmt_raw,
          complexity_summary, complexity_raw,
          funding_summary, rom_estimate, funding_raw,
          dot_dates, dot_raw
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        project_id, str(document_id),
        data.get("doc_created_date") or None,
        data.get("s1ba_version_number"),
        data.get("project_planning_start") or None,
        data.get("proposed_execution_start") or None,
        data.get("general_info", {}).get("summary"),
        json.dumps(data.get("general_info", {}).get("key_values", {})),
        json.dumps(data.get("submittal_info", {})),
        json.dumps(data.get("business_sponsorship", {})),
        data.get("stakeholder_assessment", {}).get("description"),
        json.dumps(data.get("stakeholder_assessment", {}).get("stakeholders", [])),
        data.get("business_program", {}).get("summary"),
        json.dumps(data.get("business_program", {}).get("key_values", {})),
        data.get("project_justification", {}).get("summary"),
        json.dumps(data.get("project_justification", {}).get("key_values", {})),
        data.get("business_outcomes", {}).get("summary"),
        json.dumps(data.get("business_outcomes", {}).get("outcomes", [])),
        data.get("project_management", {}).get("description"),
        json.dumps(data.get("project_management", {}).get("key_values", {})),
        data.get("complexity_assessment", {}).get("description"),
        json.dumps(data.get("complexity_assessment", {}).get("scores", [])),
        data.get("funding", {}).get("description"),
        json.dumps(data.get("funding", {}).get("rom_estimate", [])),
        json.dumps(data.get("funding", {})),
        json.dumps(data.get("dot_use_only", {}).get("dates", [])),
        json.dumps(data.get("dot_use_only", {})),
    ))
    print("  Saved Stage 1 analysis")


def save_stage2(conn, project_id, document_id, data):
    cur = conn.cursor()
    cur.execute("DELETE FROM castateintel.pal_stage2_analysis WHERE project_id = %s", (project_id,))
    cur.execute("""
        INSERT INTO castateintel.pal_stage2_analysis (
          project_id, document_id, doc_created_date,
          general_info_raw, submittal_contacts,
          baseline_summary, baseline_raw,
          requirements_summary, requirements_raw,
          assumptions, constraints_raw,
          dependencies_summary, dependencies_raw,
          market_research_summary, market_research_raw,
          viable_solutions, solution_tags,
          project_org_summary, project_org_raw,
          project_planning_summary, project_planning_raw,
          data_migration_summary, data_migration_raw,
          financial_analysis, financial_raw,
          dot_dates, dot_raw
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        project_id, str(document_id), data.get("doc_created_date") or None,
        json.dumps(data.get("general_info", {}).get("key_values", {})),
        json.dumps(data.get("submittal_info", {}).get("contacts", [])),
        data.get("baseline_processes", {}).get("summary"),
        json.dumps(data.get("baseline_processes", {})),
        data.get("requirements_outcomes", {}).get("summary"),
        json.dumps(data.get("requirements_outcomes", {}).get("requirements", [])),
        json.dumps(data.get("assumptions_constraints", {}).get("assumptions", [])),
        json.dumps(data.get("assumptions_constraints", {}).get("constraints", [])),
        data.get("dependencies", {}).get("summary"),
        json.dumps(data.get("dependencies", {}).get("items", [])),
        data.get("market_research", {}).get("summary"),
        json.dumps(data.get("market_research", {})),
        json.dumps(data.get("viable_solutions", [])),
        json.dumps(data.get("solution_tags", [])),
        data.get("project_organization", {}).get("summary"),
        json.dumps(data.get("project_organization", {}).get("roles", [])),
        data.get("project_planning", {}).get("summary"),
        json.dumps(data.get("project_planning", {})),
        data.get("data_migration", {}).get("summary"),
        json.dumps(data.get("data_migration", {})),
        json.dumps(data.get("financial_analysis", {})),
        json.dumps(data.get("financial_analysis", {}).get("cost_table", [])),
        json.dumps(data.get("dot_use_only", {}).get("dates", [])),
        json.dumps(data.get("dot_use_only", {})),
    ))
    print(f"  Saved Stage 2 analysis ({len(data.get('solution_tags', []))} solution tags)")


def save_stage3(conn, project_id, document_id, data):
    cur = conn.cursor()
    cur.execute("DELETE FROM castateintel.pal_stage3_analysis WHERE project_id = %s", (project_id,))
    cur.execute("""
        INSERT INTO castateintel.pal_stage3_analysis (
          project_id, document_id, doc_created_date,
          general_info_raw, submittal_contacts,
          solution_requirements_summary, solution_requirements_raw,
          roadmap_raw, project_planning_raw,
          primary_solicitation_raw, ancillary_procurements,
          dot_dates, dot_raw
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        project_id, str(document_id), data.get("doc_created_date") or None,
        json.dumps(data.get("general_info", {})),
        json.dumps(data.get("submittal_info", {}).get("contacts", [])),
        data.get("solution_requirements", {}).get("summary"),
        json.dumps(data.get("solution_requirements", {})),
        json.dumps(data.get("procurements_roadmap", {})),
        json.dumps(data.get("project_planning", {})),
        json.dumps(data.get("primary_solicitation", {})),
        json.dumps(data.get("ancillary_procurements", [])),
        json.dumps(data.get("dot_use_only", {}).get("dates", [])),
        json.dumps(data.get("dot_use_only", {})),
    ))
    print(f"  Saved Stage 3 analysis ({len(data.get('ancillary_procurements', []))} procurements)")


SAVE_MAP = {1: save_stage1, 2: save_stage2, 3: save_stage3}


# ══════════════════════════════════════════════════════════════════════════════
# Main processing
# ══════════════════════════════════════════════════════════════════════════════

def process_stage(conn, project, stage, force=False):
    project_id = project["id"]

    print(f"\n{'─'*60}")
    print(f"  Project : {project['project_number']} — {project['name']}")
    print(f"  Stage   : {stage} ({STAGE_LABEL_MAP[stage]})")

    # Skip if already extracted (unless --force)
    if not force and already_extracted(conn, project_id, stage):
        print("  ✓ Already extracted — skipping (use --force to re-run)")
        return True

    # Get or obtain document text
    doc = get_document(conn, project_id, stage)
    content_text = ensure_document_text(conn, project, stage, doc)

    if not content_text:
        print(f"  ✗ Could not obtain content for Stage {stage} — skipping")
        return False

    # Refresh doc reference after potential insert
    doc = get_document(conn, project_id, stage)
    document_id = doc["document_id"] if doc else str(uuid.uuid4())

    # Call Claude
    print(f"  Calling Claude API ({MODEL})...")
    try:
        data = call_claude(content_text, PROMPT_MAP[stage], stage)
    except Exception as e:
        print(f"  ✗ Claude API error: {e}")
        import traceback; traceback.print_exc()
        conn.rollback()
        return False

    # Save results
    save_contacts(conn, project_id, document_id, stage, data.get("contacts", []))
    save_urls(conn, project_id, document_id, stage, data.get("urls", []))
    SAVE_MAP[stage](conn, project_id, document_id, data)
    conn.commit()
    print(f"  ✓ Stage {stage} complete")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="PAL Document Analysis Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Workflow:
  1. Check DB for existing document with extracted text
  2. If found → process directly (full document, no truncation)
  3. If not found → download from PAL site, store in DB, then process
  4. Users can also upload PDFs via /CAStateIntel/upload

Examples:
  python3 scripts/extract_pal_analysis.py --project 4265-081
  python3 scripts/extract_pal_analysis.py --project 4265-081 --stage 2
  python3 scripts/extract_pal_analysis.py --all
  python3 scripts/extract_pal_analysis.py --all --force
        """
    )
    parser.add_argument("--project", help="Project number (e.g. 4265-081)")
    parser.add_argument("--stage", type=int, choices=[1, 2, 3], help="Stage to process")
    parser.add_argument("--all", action="store_true", help="Process all projects with documents")
    parser.add_argument("--force", action="store_true", help="Re-extract even if already done")
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: Set DATABASE_URL environment variable"); sys.exit(1)
    if not ANTHROPIC_API_KEY:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable"); sys.exit(1)

    stages = [args.stage] if args.stage else [1, 2, 3]
    ok, failed, skipped = 0, 0, 0

    def fresh_conn():
        """Get a fresh DB connection, retrying if needed."""
        for attempt in range(3):
            try:
                return get_db()
            except Exception as e:
                print(f"  DB connect attempt {attempt+1} failed: {e}")
                time.sleep(5)
        raise RuntimeError("Could not connect to DB after 3 attempts")

    conn = fresh_conn()

    try:
        if args.all:
            project_numbers = get_all_projects_with_docs(conn)
            print(f"Found {len(project_numbers)} projects with documents")
            for pn in project_numbers:
                try:
                    project = get_project(conn, pn)
                except Exception:
                    conn = fresh_conn()
                    project = get_project(conn, pn)
                if not project: continue
                for s in stages:
                    try:
                        result = process_stage(conn, project, s, force=args.force)
                        if result: ok += 1
                        else: skipped += 1
                    except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                        print(f"  DB error — reconnecting: {e}")
                        try: conn.close()
                        except: pass
                        time.sleep(3)
                        conn = fresh_conn()
                        failed += 1
                    except Exception as e:
                        print(f"  ERROR: {e}")
                        try: conn.rollback()
                        except: conn = fresh_conn()
                        failed += 1
        elif args.project:
            project = get_project(conn, args.project)
            if not project:
                print(f"ERROR: Project '{args.project}' not found in DB"); sys.exit(1)
            for s in stages:
                try:
                    result = process_stage(conn, project, s, force=args.force)
                    if result: ok += 1
                    else: skipped += 1
                except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
                    print(f"  DB error — reconnecting: {e}")
                    try: conn.close()
                    except: pass
                    time.sleep(3)
                    conn = fresh_conn()
                    failed += 1
                except Exception as e:
                    print(f"  ERROR: {e}")
                    import traceback; traceback.print_exc()
                    try: conn.rollback()
                    except: conn = fresh_conn()
                    failed += 1
        else:
            parser.print_help(); sys.exit(1)
    finally:
        try: conn.close()
        except: pass

    print(f"\n{'═'*60}")
    print(f"  ✓ Pipeline complete — {ok} extracted, {skipped} skipped, {failed} failed")


if __name__ == "__main__":
    main()
