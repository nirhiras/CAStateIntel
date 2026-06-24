#!/usr/bin/env python3
"""
Run this from ~/CAMarketResearch/apps/api/ca-gov-intel to add Stage 4 to the extraction script.
Usage: python3 add_stage4_to_script.py
"""
import json, sys

STAGE4_PROMPT = """You are extracting structured data from a California IT project Stage 4 Project Readiness and Approval (S4PRA) PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{{
  "doc_created_date": "YYYY-MM-DD or null",
  "contacts": [
    {{
      "name": "full legal name - REQUIRED",
      "title": "job title or null",
      "email": "email or null",
      "phone": "phone or null",
      "organization": "dept/agency or null",
      "context": "role and context in this document",
      "source": "exact section (e.g. Section 4.2 Submittal Information)",
      "doc_created_date": "YYYY-MM-DD or null",
      "role_type": "contact|approver|vendor|author|manager|other"
    }}
  ],
  "urls": [{{"url": "https://...", "context": "where it appeared"}}],
  "general_info": {{
    "agency_name": "...", "proposal_name": "...", "project_number": "...",
    "s4pra_version": "...", "cdt_billing_case_number": "...", "key_values": {{}}
  }},
  "submittal_info": {{
    "contacts": [], "submission_type": "New Submission|Update|Resubmission|Withdrawal",
    "conditions_from_stage3": "...", "key_values": {{}}
  }},
  "contract_management": [
    {{"question": "short label", "answer": "Yes|No|Not Applicable", "notes": "explanation if any"}}
  ],
  "org_readiness": [
    {{"question": "short label", "answer": "Yes|No|Not Applicable", "status": "...", "notes": "..."}}
  ],
  "project_readiness": {{
    "methodology": "Agile|Waterfall|Hybrid|other",
    "methodology_description": "...",
    "otech_engaged": "Yes|No",
    "otech_alternative": "...",
    "resource_commitments_obtained": "Yes|No",
    "key_values": {{}}
  }},
  "objectives": [
    {{
      "id": "1A",
      "objective_summary": "one sentence",
      "full_objective": "complete text",
      "metric": "how measured",
      "baseline": "current baseline",
      "target_result": "desired outcome",
      "valuation_pct": "12.5%",
      "change_from_stage1": "No Change or description"
    }}
  ],
  "schedule_baseline": {{
    "proposed_project_start": "YYYY-MM-DD or null",
    "baseline_project_start": "YYYY-MM-DD or null",
    "start_variance": "description",
    "proposed_project_end": "YYYY-MM-DD or null",
    "baseline_project_end": "YYYY-MM-DD or null",
    "end_variance": "description",
    "variance_reasons": "...",
    "key_milestones": [{{"milestone": "...", "date": "...", "status": "..."}}]
  }},
  "cost_baseline": {{
    "cost_rows": [
      {{"category": "Total Planning Cost (One-Time)|Total Project Cost (One-Time)|Total Future Operations|Total Cost|Annual M&O",
        "proposed": "dollar amount", "baseline": "dollar amount", "variance": "dollar amount"}}
    ],
    "variance_reasons": "...",
    "bcp_summary": [
      {{"budget_request_id": "...", "budget_year": "...", "requested_amount": "...",
        "status": "Supported|Pending|Approved", "bill_language": "..."}}
    ]
  }},
  "solicitation_results": {{
    "stage2_solution_selected": "Yes|No",
    "selected_vendor": "...",
    "contract_number": "...",
    "contract_start_date": "YYYY-MM-DD or null",
    "contract_end_date": "YYYY-MM-DD or null",
    "total_contract_cost": "dollar amount",
    "optional_years_months": "...",
    "optional_years_cost": "...",
    "total_with_optional": "...",
    "project_management_plans": [
      {{"plan": "Configuration Management Plan", "status": "Yes|No|Not Applicable", "notes": "..."}}
    ]
  }},
  "risk_register": [
    {{"risk_id": "...", "risk": "description", "probability": "High|Medium|Low or null",
      "impact": "High|Medium|Low or null", "mitigation": "strategy", "owner": "..."}}
  ],
  "dot_use_only": {{
    "dates": [{{"label": "...", "date": "YYYY-MM-DD or string"}}],
    "form_status": "...",
    "form_disposition": "...",
    "other_fields": {{}}
  }}
}}"""


def save_stage4(conn, pid, did, d):
    import json as _json
    cur = conn.cursor()
    cur.execute("DELETE FROM castateintel.pal_stage4_analysis WHERE project_id=%s", (pid,))

    cost_rows = d.get("cost_baseline", {}).get("cost_rows", [])
    total_proposed = next((r.get("proposed") for r in cost_rows
                           if "total cost" in r.get("category", "").lower()), None)
    total_baseline = next((r.get("baseline") for r in cost_rows
                           if "total cost" in r.get("category", "").lower()), None)
    annual_mo = next((r.get("proposed") for r in cost_rows
                      if "annual" in r.get("category", "").lower()
                      or "m&o" in r.get("category", "").lower()), None)

    sched = d.get("schedule_baseline", {})
    sol = d.get("solicitation_results", {})

    cur.execute("""
        INSERT INTO castateintel.pal_stage4_analysis (
          project_id, document_id, doc_created_date,
          general_info_raw, submittal_contacts, submittal_info,
          contract_management, org_readiness, project_readiness,
          objectives, schedule_baseline,
          proposed_project_start, baseline_project_start,
          proposed_project_end, baseline_project_end,
          cost_baseline, total_cost_proposed, total_cost_baseline, annual_mo_cost,
          solicitation_results, selected_vendor, contract_number,
          contract_start_date, contract_end_date, total_contract_cost,
          risk_register, dot_dates, dot_raw
        ) VALUES (
          %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
        )
    """, (
        pid, str(did), d.get("doc_created_date") or None,
        _json.dumps(d.get("general_info", {})),
        _json.dumps(d.get("submittal_info", {}).get("contacts", [])),
        _json.dumps(d.get("submittal_info", {})),
        _json.dumps(d.get("contract_management", [])),
        _json.dumps(d.get("org_readiness", [])),
        _json.dumps(d.get("project_readiness", {})),
        _json.dumps(d.get("objectives", [])),
        _json.dumps(sched),
        sched.get("proposed_project_start") or None,
        sched.get("baseline_project_start") or None,
        sched.get("proposed_project_end") or None,
        sched.get("baseline_project_end") or None,
        _json.dumps(d.get("cost_baseline", {})),
        total_proposed, total_baseline, annual_mo,
        _json.dumps(sol),
        sol.get("selected_vendor"),
        sol.get("contract_number"),
        sol.get("contract_start_date") or None,
        sol.get("contract_end_date") or None,
        sol.get("total_contract_cost"),
        _json.dumps(d.get("risk_register", [])),
        _json.dumps(d.get("dot_use_only", {}).get("dates", [])),
        _json.dumps(d.get("dot_use_only", {})),
    ))
    print(f"  Saved Stage 4 ({len(d.get('objectives',[]))} objectives, "
          f"{len(d.get('risk_register',[]))} risks, "
          f"vendor={sol.get('selected_vendor','—')})")


def patch_script(script_path="scripts/extract_pal_analysis.py"):
    with open(script_path) as f:
        content = f.read()

    changed = False

    # Add Stage 4 prompt
    if "STAGE4_PROMPT" not in content:
        insert_after = "PROMPT_MAP = {1: STAGE1_PROMPT, 2: STAGE2_PROMPT, 3: STAGE3_PROMPT}"
        stage4_prompt_code = f'\n\nSTAGE4_PROMPT = """{STAGE4_PROMPT}"""\n\n'
        content = content.replace(insert_after,
            stage4_prompt_code + insert_after)
        changed = True
        print("Added STAGE4_PROMPT")

    # Update PROMPT_MAP
    if "4: STAGE4_PROMPT" not in content:
        content = content.replace(
            "PROMPT_MAP = {1: STAGE1_PROMPT, 2: STAGE2_PROMPT, 3: STAGE3_PROMPT}",
            "PROMPT_MAP = {1: STAGE1_PROMPT, 2: STAGE2_PROMPT, 3: STAGE3_PROMPT, 4: STAGE4_PROMPT}"
        )
        changed = True
        print("Updated PROMPT_MAP")

    # Add save_stage4 function
    if "def save_stage4" not in content:
        import inspect
        save4_src = inspect.getsource(save_stage4)
        content = content.replace(
            "SAVE_MAP = {1: save_stage1, 2: save_stage2, 3: save_stage3}",
            save4_src + "\n\nSAVE_MAP = {1: save_stage1, 2: save_stage2, 3: save_stage3, 4: save_stage4}"
        )
        changed = True
        print("Added save_stage4")

    # Update SAVE_MAP
    if "4: save_stage4" not in content:
        content = content.replace(
            "SAVE_MAP = {1: save_stage1, 2: save_stage2, 3: save_stage3}",
            "SAVE_MAP = {1: save_stage1, 2: save_stage2, 3: save_stage3, 4: save_stage4}"
        )
        changed = True
        print("Updated SAVE_MAP")

    # Update stage labels/filenames maps
    if '4: "Stage 4' not in content:
        content = content.replace(
            '3: "Stage 3 Solutions Analysis"}',
            '3: "Stage 3 Solutions Analysis", 4: "Stage 4 Project Readiness and Approval"}'
        )
        content = content.replace(
            '3: "Stage_3_Solutions_Analysis.pdf"}',
            '3: "Stage_3_Solutions_Analysis.pdf", 4: "Stage_4_Project_Readiness_Approval.pdf"}'
        )
        changed = True
        print("Updated STAGE_LABELS/FILENAMES")

    if changed:
        with open(script_path, "w") as f:
            f.write(content)
        print(f"✓ Script patched: {script_path}")
    else:
        print("No changes needed")


if __name__ == "__main__":
    patch_script()
