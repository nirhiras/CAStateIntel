#!/usr/bin/env python3
"""
extract_pal_analysis.py
Reads content_text from pal_documents, calls Claude API to extract
structured data per stage, saves results to pal_stage1/2/3_analysis,
pal_contacts, and pal_urls tables.

Schema note: pal_projects PK is "id" (integer), pal_documents.project_id
references pal_projects.id

Usage:
  python3 scripts/extract_pal_analysis.py --project 4265-081
  python3 scripts/extract_pal_analysis.py --project 4265-081 --stage 1
  python3 scripts/extract_pal_analysis.py --all
"""

import os
import sys
import json
import argparse
import psycopg2
import psycopg2.extras
import anthropic

DATABASE_URL = os.environ.get("DATABASE_URL")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
MODEL = "claude-sonnet-4-6"

# ──────────────────────────────────────────────────────────────
# Stage 1 prompt
# ──────────────────────────────────────────────────────────────
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
      "name": "full name",
      "title": "job title or null",
      "email": "email or null",
      "phone": "phone or null",
      "organization": "dept/agency or null",
      "context": "which section they appeared in and their role",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|other"
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

# ──────────────────────────────────────────────────────────────
# Stage 2 prompt
# ──────────────────────────────────────────────────────────────
STAGE2_PROMPT = """You are extracting structured data from a California IT project Stage 2 Alternative Analysis PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{{
  "doc_created_date": "YYYY-MM-DD or null",

  "contacts": [
    {{
      "name": "full name",
      "title": "job title or null",
      "email": "email or null",
      "phone": "phone or null",
      "organization": "dept/agency or null",
      "context": "which section they appeared in and their role",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|other"
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

# ──────────────────────────────────────────────────────────────
# Stage 3 prompt
# ──────────────────────────────────────────────────────────────
STAGE3_PROMPT = """You are extracting structured data from a California IT project Stage 3 Solution Analysis PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{{
  "doc_created_date": "YYYY-MM-DD or null",

  "contacts": [
    {{
      "name": "full name",
      "title": "job title or null",
      "email": "email or null",
      "phone": "phone or null",
      "organization": "dept/agency or null",
      "context": "which section they appeared in and their role",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|other"
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


def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def get_documents(conn, project_number, stage=None):
    """
    pal_projects PK = id (integer)
    pal_documents.project_id references pal_projects.id
    """
    cur = conn.cursor()
    query = """
        SELECT d.document_id, d.stage, d.label, d.content_text, d.filename,
               p.id as project_id, p.project_number, p.name as project_name
        FROM castateintel.pal_documents d
        JOIN castateintel.pal_projects p ON d.project_id = p.id
        WHERE p.project_number = %s
          AND d.content_text IS NOT NULL
          AND length(d.content_text) > 100
    """
    params = [project_number]
    if stage:
        query += " AND d.stage = %s"
        params.append(stage)
    query += " ORDER BY d.stage"
    cur.execute(query, params)
    return cur.fetchall()


def clean_json_response(text):
    """Strip markdown fences and return cleaned string."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def safe_json_parse(text):
    """Try to parse JSON, with fallback repair."""
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  JSON parse error at char {e.pos}: {e.msg}")
        print(f"  Context: {text[max(0,e.pos-80):e.pos+80]!r}")
        # Try truncating to last valid structure
        # Find the last complete top-level closing brace
        depth = 0
        last_valid = 0
        in_string = False
        escape = False
        for i, ch in enumerate(text):
            if escape:
                escape = False
                continue
            if ch == '\\' and in_string:
                escape = True
                continue
            if ch == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    last_valid = i + 1
        if last_valid > 0 and last_valid < len(text):
            print(f"  Attempting truncation fix (keeping to char {last_valid})...")
            try:
                return json.loads(text[:last_valid])
            except json.JSONDecodeError:
                pass
        raise


def call_claude(content_text, prompt_template):
    """Call Claude with extended tokens. For large docs, use streaming to avoid truncation."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Limit input to avoid exceeding context window while maximising content
    # Stage 2 docs can be 73k chars; keep under 80k to leave room for output
    MAX_INPUT = 75000
    truncated = content_text[:MAX_INPUT] if len(content_text) > MAX_INPUT else content_text
    if len(content_text) > MAX_INPUT:
        print(f"  Note: Document truncated from {len(content_text):,} to {MAX_INPUT:,} chars")

    prompt = prompt_template.format(content_text=truncated)

    print(f"  Sending {len(prompt):,} char prompt to Claude (max_tokens=16000)...")

    message = client.messages.create(
        model=MODEL,
        max_tokens=16000,  # Increased from 8192 to prevent mid-JSON cutoff
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text.strip()
    stop_reason = message.stop_reason
    print(f"  Response: {len(response_text):,} chars, stop_reason={stop_reason}")

    if stop_reason == "max_tokens":
        print("  WARNING: Response hit max_tokens limit — JSON may be truncated")

    response_text = clean_json_response(response_text)

    # Strip leading { only if it appears duplicated from prefill attempts
    if not response_text.startswith("{"):
        response_text = "{" + response_text

    return safe_json_parse(response_text)


def save_contacts(conn, project_id, document_id, stage, contacts):
    cur = conn.cursor()
    cur.execute("DELETE FROM castateintel.pal_contacts WHERE document_id = %s", (str(document_id),))
    for c in contacts:
        cur.execute("""
            INSERT INTO castateintel.pal_contacts
              (project_id, document_id, stage, name, title, email, phone,
               organization, context, role_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            project_id, str(document_id), stage,
            c.get("name"), c.get("title"), c.get("email"), c.get("phone"),
            c.get("organization"), c.get("context"), c.get("role_type")
        ))
    print(f"  Saved {len(contacts)} contacts")


def save_urls(conn, project_id, document_id, stage, urls):
    cur = conn.cursor()
    cur.execute("DELETE FROM castateintel.pal_urls WHERE document_id = %s", (str(document_id),))
    for u in urls:
        cur.execute("""
            INSERT INTO castateintel.pal_urls (project_id, document_id, stage, url, context)
            VALUES (%s, %s, %s, %s, %s)
        """, (project_id, str(document_id), stage, u.get("url"), u.get("context")))
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
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
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
          viable_solutions,
          project_org_summary, project_org_raw,
          project_planning_summary, project_planning_raw,
          data_migration_summary, data_migration_raw,
          financial_analysis, financial_raw,
          dot_dates, dot_raw
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
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
    print("  Saved Stage 2 analysis")


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
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
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
    print("  Saved Stage 3 analysis")


def process_document(conn, doc):
    project_id = doc["project_id"]  # integer
    document_id = doc["document_id"]  # UUID
    stage = doc["stage"]
    content_text = doc["content_text"]

    print(f"\nProcessing Stage {stage}: {doc['project_name']} ({doc['project_number']})")
    print(f"  Document: {doc['filename']} ({len(content_text):,} chars)")

    prompt_map = {1: STAGE1_PROMPT, 2: STAGE2_PROMPT, 3: STAGE3_PROMPT}
    save_map = {1: save_stage1, 2: save_stage2, 3: save_stage3}

    if stage not in prompt_map:
        print(f"  Skipping: no prompt for stage {stage}")
        return

    print("  Calling Claude API for extraction...")
    data = call_claude(content_text, prompt_map[stage])

    save_contacts(conn, project_id, document_id, stage, data.get("contacts", []))
    save_urls(conn, project_id, document_id, stage, data.get("urls", []))
    save_map[stage](conn, project_id, document_id, data)

    conn.commit()
    print(f"  ✓ Stage {stage} complete")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", help="Project number e.g. 4265-081")
    parser.add_argument("--stage", type=int, choices=[1, 2, 3])
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: Set DATABASE_URL"); sys.exit(1)
    if not ANTHROPIC_API_KEY:
        print("ERROR: Set ANTHROPIC_API_KEY"); sys.exit(1)

    conn = get_db_connection()
    try:
        if args.all:
            cur = conn.cursor()
            cur.execute("""
                SELECT DISTINCT p.project_number
                FROM castateintel.pal_projects p
                JOIN castateintel.pal_documents d ON d.project_id = p.id
                WHERE d.content_text IS NOT NULL AND length(d.content_text) > 100
                ORDER BY p.project_number
            """)
            project_numbers = [r["project_number"] for r in cur.fetchall()]
            print(f"Found {len(project_numbers)} projects")
            for pn in project_numbers:
                for doc in get_documents(conn, pn, args.stage):
                    try:
                        process_document(conn, doc)
                    except Exception as e:
                        print(f"  ERROR: {e}"); conn.rollback()
        elif args.project:
            docs = get_documents(conn, args.project, args.stage)
            if not docs:
                print(f"No documents found for {args.project}"); sys.exit(1)
            for doc in docs:
                try:
                    process_document(conn, doc)
                except Exception as e:
                    print(f"  ERROR: {e}")
                    import traceback; traceback.print_exc()
                    conn.rollback()
        else:
            parser.print_help(); sys.exit(1)
    finally:
        conn.close()

    print("\n✓ Extraction complete")


if __name__ == "__main__":
    main()
