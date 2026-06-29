// app/api/castateintel/analysis/extract/route.ts
// Full TypeScript rewrite — no Python subprocess, direct Anthropic SDK + pg

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import db from "@/lib/db";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";

// ─── Prompts ────────────────────────────────────────────────────────────────

const STAGE4_PROMPT = `You are extracting structured data from a California IT project Stage 4 Project Readiness and Approval PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{
  "doc_created_date": "YYYY-MM-DD or null",

  "contacts": [
    {
      "name": "full legal name — REQUIRED, skip entry if unknown",
      "title": "job title or null",
      "email": "email address or null",
      "phone": "phone number with area code or null",
      "organization": "department or agency name or null",
      "context": "brief description of their role and involvement in this project",
      "source": "exact section name where this person appears",
      "doc_created_date": "date of this document in YYYY-MM-DD format or null",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|contact|other"
    }
  ],

  "urls": [
    {"url": "https://...", "context": "where/why it appeared"}
  ],

  "general_info": {
    "project_name": "...",
    "project_number": "...",
    "department": "...",
    "agency": "...",
    "key_values": {}
  },

  "submittal_info": {
    "contacts": [],
    "key_values": {}
  },

  "contract_management": [
    {"question": "...", "answer": "...", "notes": "..."}
  ],

  "org_readiness": [
    {"question": "...", "answer": "...", "notes": "..."}
  ],

  "project_readiness": {
    "methodology": "...",
    "otech": "...",
    "resource_info": "...",
    "key_values": {}
  },

  "objectives": [
    {
      "id": "...",
      "objective": "...",
      "metric": "...",
      "baseline": "...",
      "target": "...",
      "valuation_pct": "...",
      "change": "..."
    }
  ],

  "schedule_baseline": {
    "proposed_start": "YYYY-MM-DD or null",
    "proposed_end": "YYYY-MM-DD or null",
    "baseline_start": "YYYY-MM-DD or null",
    "baseline_end": "YYYY-MM-DD or null",
    "variances": "...",
    "milestones": [
      {"milestone": "...", "date": "...", "type": "..."}
    ]
  },

  "cost_baseline": {
    "proposed_total": "dollar amount or null",
    "baseline_total": "dollar amount or null",
    "annual_mo_cost": "dollar amount or null",
    "cost_rows": [
      {"category": "...", "amount": "...", "notes": "..."}
    ]
  },

  "solicitation_results": {
    "selected_vendor": "...",
    "contract_number": "...",
    "contract_start_date": "YYYY-MM-DD or null",
    "contract_end_date": "YYYY-MM-DD or null",
    "total_contract_cost": "...",
    "key_values": {}
  },

  "risk_register": [
    {"risk": "...", "probability": "...", "impact": "...", "mitigation": "..."}
  ],

  "dot_use_only": {
    "dates": [
      {"label": "...", "date": "YYYY-MM-DD or string"}
    ],
    "other_fields": {}
  }
}`;

const STAGE1_PROMPT = `You are extracting structured data from a California IT project Stage 1 Business Analysis PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{
  "doc_created_date": "YYYY-MM-DD or null",
  "s1ba_version_number": "string or null",
  "project_planning_start": "YYYY-MM-DD or null",
  "proposed_execution_start": "YYYY-MM-DD or null",

  "contacts": [
    {
      "name": "full legal name — REQUIRED, skip entry if unknown",
      "title": "job title or null",
      "email": "email address or null",
      "phone": "phone number with area code or null",
      "organization": "department or agency name or null",
      "context": "brief description of their role and involvement in this project",
      "source": "exact section name where this person appears",
      "doc_created_date": "date of this document in YYYY-MM-DD format or null",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|contact|other"
    }
  ],

  "urls": [{"url": "https://...", "context": "where/why it appeared"}],

  "general_info": {"summary": "200-word summary", "key_values": {}},
  "submittal_info": {"contacts": [], "submission_date": null, "submitted_to": null, "key_values": {}},
  "business_sponsorship": {"contacts": [], "key_values": {}},
  "stakeholder_assessment": {
    "description": "300-500 word description",
    "stakeholders": [{"name": "...", "organization": "...", "role": "...", "interest": "...", "influence": "..."}]
  },
  "business_program": {"contacts": [], "summary": "500-word summary", "key_values": {}},
  "project_justification": {"contacts": [], "summary": "500-word summary", "key_values": {}},
  "business_outcomes": {
    "contacts": [],
    "summary": "500-word summary",
    "outcomes": [{"outcome": "...", "metric": "...", "target": "..."}]
  },
  "project_management": {"description": "200-word description", "key_values": {}},
  "complexity_assessment": {
    "description": "200-word description",
    "scores": [{"dimension": "...", "score": "...", "rationale": "..."}]
  },
  "funding": {
    "description": "200-word description",
    "rom_estimate": [{"category": "...", "amount": "...", "notes": "..."}],
    "total_estimate": null,
    "funding_sources": [{"source": "...", "amount": "...", "fiscal_year": "..."}]
  },
  "dot_use_only": {"dates": [{"label": "...", "date": "..."}], "other_fields": {}}
}`;

const STAGE2_PROMPT = `You are extracting structured data from a California IT project Stage 2 Alternative Analysis PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{
  "doc_created_date": "YYYY-MM-DD or null",
  "contacts": [
    {
      "name": "full legal name — REQUIRED, skip entry if unknown",
      "title": "job title or null",
      "email": "email address or null",
      "phone": "phone number with area code or null",
      "organization": "department or agency name or null",
      "context": "brief description of their role",
      "source": "exact section name",
      "doc_created_date": "YYYY-MM-DD or null",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|contact|other"
    }
  ],
  "urls": [{"url": "https://...", "context": "..."}],
  "general_info": {"key_values": {}},
  "submittal_info": {"contacts": [], "key_values": {}},
  "baseline_processes": {"summary": "300-word summary", "systems": [{"system_name": "...", "purpose": "...", "status": "..."}]},
  "requirements_outcomes": {"summary": "300-word summary", "requirements": [{"id": "...", "description": "...", "priority": "...", "category": "..."}]},
  "assumptions_constraints": {
    "assumptions": [{"id": "...", "assumption": "...", "description": "...", "impact": "..."}],
    "constraints": [{"constraint": "...", "description": "...", "impact": "..."}]
  },
  "dependencies": {"summary": "300-word summary", "items": [{"dependency": "...", "type": "internal|external", "owner": "...", "impact": "..."}]},
  "market_research": {"summary": "500-word summary", "vendors_identified": [{"vendor": "...", "solution": "...", "notes": "..."}]},
  "viable_solutions": [{"name": "...", "summary": "300-word summary", "pros": [], "cons": [], "estimated_cost": "...", "recommended": false}],
  "solution_tags": [{"tag": "...", "category": "vendor|technology|approach|deployment|industry", "applies_to": "...", "confidence": "high|medium|low"}],
  "project_organization": {"summary": "500-word summary", "roles": [{"role": "...", "responsibilities": "...", "fte": "..."}]},
  "project_planning": {"summary": "300-500 word summary", "milestones": [{"milestone": "...", "date": "...", "owner": "..."}]},
  "data_migration": {"summary": "300-word summary", "activities": [{"activity": "...", "description": "...", "complexity": "..."}]},
  "financial_analysis": {"summary": "...", "cost_table": [], "npv": "...", "roi": "...", "payback_period": "..."},
  "dot_use_only": {"dates": [], "other_fields": {}}
}`;

const STAGE3_PROMPT = `You are extracting structured data from a California IT project Stage 3 Solution Analysis PDF.

<document>
{content_text}
</document>

Extract ALL of the following. Return ONLY valid JSON, no preamble, no markdown fences.

{
  "doc_created_date": "YYYY-MM-DD or null",
  "contacts": [
    {
      "name": "full legal name — REQUIRED, skip entry if unknown",
      "title": "job title or null",
      "email": "email address or null",
      "phone": "phone number with area code or null",
      "organization": "department or agency name or null",
      "context": "brief description of their role",
      "source": "exact section name",
      "doc_created_date": "YYYY-MM-DD or null",
      "role_type": "sponsor|stakeholder|approver|author|reviewer|contact|other"
    }
  ],
  "urls": [{"url": "https://...", "context": "..."}],
  "general_info": {"project_name": "...", "project_number": "...", "department": "...", "agency": "...", "project_manager": "...", "selected_solution": "...", "key_values": {}},
  "submittal_info": {"contacts": [], "key_values": {}},
  "solution_requirements": {
    "summary": "300-500 word summary",
    "functional_requirements": [{"id": "...", "requirement": "...", "priority": "...", "source": "..."}],
    "non_functional_requirements": [],
    "outcomes": [{"outcome": "...", "metric": "...", "target": "..."}]
  },
  "procurements_roadmap": {
    "phases": [{"phase": "...", "start_date": "...", "end_date": "...", "description": "...", "deliverables": []}],
    "key_milestones": [{"milestone": "...", "date": "...", "type": "..."}],
    "total_duration": "..."
  },
  "project_planning": {"schedule": [], "resources": []},
  "primary_solicitation": {"solicitation_type": "...", "anticipated_release_date": "...", "contract_term": "...", "evaluation_criteria": [], "contract_type": "...", "estimated_contract_value": "...", "key_values": {}},
  "ancillary_procurements": [
    {
      "name": "...",
      "description": "...",
      "procurement_type": "RFP|IFB|RFO|MSA|CMAS|Sole Source|WSCA|IT-MSA|other",
      "vendor_or_source": null,
      "estimated_value": "...",
      "proposed_start_date": null,
      "proposed_end_date": null,
      "duration": null,
      "timeline": "...",
      "solicitation_number": null,
      "justification": "...",
      "key_values": {}
    }
  ],
  "dot_use_only": {"dates": [], "other_fields": {}}
}`;

const PROMPT_MAP: Record<number, string> = {
  1: STAGE1_PROMPT,
  2: STAGE2_PROMPT,
  3: STAGE3_PROMPT,
  4: STAGE4_PROMPT,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function cleanJson(text: string): string {
  text = text.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    text = lines.slice(1).join("\n");
    if (text.trimEnd().endsWith("```")) text = text.trimEnd().slice(0, -3);
  }
  return text.trim();
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    // Try recovering up to last complete closing brace
    let depth = 0, inStr = false, esc = false, lastOk = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\" && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) lastOk = i + 1; }
    }
    if (lastOk) return JSON.parse(text.slice(0, lastOk));
    throw new Error("Could not parse JSON from Claude response");
  }
}

/** Re-extract text from stored pdf_data binary using PyMuPDF */
function extractTextFromPdfBytes(pdfBytes: Buffer): string {
  const tmp = path.join(os.tmpdir(), `pal_reextract_${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tmp, pdfBytes);
    const script = [
      "import sys,fitz",
      "doc=fitz.open(sys.argv[1])",
      "parts=[]",
      "for page in doc:",
      "    parts.append(page.get_text())",
      "    for w in (page.widgets() or []):",
      "        if w.field_value: parts.append(f\"{w.field_name}: {w.field_value}\")",
      "doc.close()",
      "print('\\n'.join(parts))",
    ].join("\n");
    const result = execSync(`python3 -c '${script.replace(/'/g, "'\\''")}' "${tmp}"`, {
      timeout: 120000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return result.toString().trim();
  } catch {
    return "";
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ─── Claude API call ─────────────────────────────────────────────────────────

async function callClaude(contentText: string, stage: number): Promise<Record<string, unknown>> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    timeout: 600_000,
  });

  const prompt = PROMPT_MAP[stage].replace("{content_text}", contentText);
  let responseText = "";
  let stopReason = "";

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      responseText += chunk.delta.text;
    } else if (chunk.type === "message_delta") {
      stopReason = chunk.delta.stop_reason ?? "";
    }
  }

  if (stopReason === "max_tokens") {
    console.warn(`[analysis] Stage ${stage}: hit max_tokens — attempting JSON recovery`);
  }

  return safeParseJson(cleanJson(responseText));
}

// ─── DB save functions ───────────────────────────────────────────────────────

type AnyJson = Record<string, unknown>;

async function saveContacts(projectId: number, documentId: string, stage: number, contacts: AnyJson[]) {
  await db.query("DELETE FROM castateintel.pal_contacts WHERE document_id = $1", [documentId]);
  const seen = new Set<string>();
  let saved = 0;
  for (const c of contacts) {
    const name = ((c.name as string) || "").trim();
    if (!name || ["null", "unknown", "n/a"].includes(name.toLowerCase())) continue;
    const key = `${name.toLowerCase()}|${((c.email as string) || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const docDate = c.doc_created_date && c.doc_created_date !== "null" ? c.doc_created_date : null;
    await db.query(`
      INSERT INTO castateintel.pal_contacts
        (project_id, document_id, stage, name, title, email, phone,
         organization, context, role_type, source, doc_created_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, [projectId, documentId, stage, name, c.title ?? null, c.email ?? null, c.phone ?? null,
        c.organization ?? null, c.context ?? null, c.role_type ?? null, c.source ?? null, docDate]);
    saved++;
  }
  return saved;
}

async function saveUrls(projectId: number, documentId: string, stage: number, urls: AnyJson[]) {
  await db.query("DELETE FROM castateintel.pal_urls WHERE document_id = $1", [documentId]);
  for (const u of urls) {
    if (!u.url) continue;
    await db.query(
      "INSERT INTO castateintel.pal_urls (project_id, document_id, stage, url, context) VALUES ($1,$2,$3,$4,$5)",
      [projectId, documentId, stage, u.url, u.context ?? null]
    );
  }
}

async function saveStage1(projectId: number, documentId: string, data: AnyJson) {
  await db.query("DELETE FROM castateintel.pal_stage1_analysis WHERE project_id=$1 AND document_id=$2", [projectId, documentId]);
  const gi = (data.general_info as AnyJson) || {};
  const sa = (data.stakeholder_assessment as AnyJson) || {};
  const bp = (data.business_program as AnyJson) || {};
  const pj = (data.project_justification as AnyJson) || {};
  const bo = (data.business_outcomes as AnyJson) || {};
  const pm = (data.project_management as AnyJson) || {};
  const ca = (data.complexity_assessment as AnyJson) || {};
  const fu = (data.funding as AnyJson) || {};
  const dot = (data.dot_use_only as AnyJson) || {};
  await db.query(`
    INSERT INTO castateintel.pal_stage1_analysis (
      project_id, document_id, doc_created_date, s1ba_version_number,
      project_planning_start, proposed_execution_start,
      general_info_summary, general_info_raw, submittal_info, business_sponsorship,
      stakeholder_summary, stakeholders,
      business_program_summary, business_program_raw,
      justification_summary, justification_raw,
      outcomes_summary, outcomes_raw,
      project_mgmt_summary, project_mgmt_raw,
      complexity_summary, complexity_raw,
      funding_summary, rom_estimate, funding_raw,
      dot_dates, dot_raw
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
  `, [
    projectId, documentId,
    (data.doc_created_date as string) || null, data.s1ba_version_number ?? null,
    (data.project_planning_start as string) || null, (data.proposed_execution_start as string) || null,
    gi.summary ?? null, JSON.stringify(gi.key_values ?? {}),
    JSON.stringify(data.submittal_info ?? {}), JSON.stringify(data.business_sponsorship ?? {}),
    sa.description ?? null, JSON.stringify(sa.stakeholders ?? []),
    bp.summary ?? null, JSON.stringify(bp.key_values ?? {}),
    pj.summary ?? null, JSON.stringify(pj.key_values ?? {}),
    bo.summary ?? null, JSON.stringify(bo.outcomes ?? []),
    pm.description ?? null, JSON.stringify(pm.key_values ?? {}),
    ca.description ?? null, JSON.stringify(ca.scores ?? []),
    fu.description ?? null, JSON.stringify(fu.rom_estimate ?? []), JSON.stringify(fu),
    JSON.stringify(dot.dates ?? []), JSON.stringify(dot),
  ]);
}

async function saveStage2(projectId: number, documentId: string, data: AnyJson) {
  await db.query("DELETE FROM castateintel.pal_stage2_analysis WHERE project_id=$1 AND document_id=$2", [projectId, documentId]);
  const gi = (data.general_info as AnyJson) || {};
  const si = (data.submittal_info as AnyJson) || {};
  const bp = (data.baseline_processes as AnyJson) || {};
  const ro = (data.requirements_outcomes as AnyJson) || {};
  const ac = (data.assumptions_constraints as AnyJson) || {};
  const dep = (data.dependencies as AnyJson) || {};
  const mr = (data.market_research as AnyJson) || {};
  const pp = (data.project_planning as AnyJson) || {};
  const dm = (data.data_migration as AnyJson) || {};
  const fa = (data.financial_analysis as AnyJson) || {};
  const dot = (data.dot_use_only as AnyJson) || {};
  await db.query(`
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
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
  `, [
    projectId, documentId, (data.doc_created_date as string) || null,
    JSON.stringify(gi.key_values ?? {}), JSON.stringify(si.contacts ?? []),
    bp.summary ?? null, JSON.stringify(bp),
    ro.summary ?? null, JSON.stringify(ro.requirements ?? []),
    JSON.stringify(ac.assumptions ?? []), JSON.stringify(ac.constraints ?? []),
    dep.summary ?? null, JSON.stringify(dep.items ?? []),
    mr.summary ?? null, JSON.stringify(mr),
    JSON.stringify(data.viable_solutions ?? []), JSON.stringify(data.solution_tags ?? []),
    (data.project_organization as AnyJson)?.summary ?? null, JSON.stringify((data.project_organization as AnyJson)?.roles ?? []),
    pp.summary ?? null, JSON.stringify(pp),
    dm.summary ?? null, JSON.stringify(dm),
    JSON.stringify(fa), JSON.stringify(fa.cost_table ?? []),
    JSON.stringify(dot.dates ?? []), JSON.stringify(dot),
  ]);
}

async function saveStage3(projectId: number, documentId: string, data: AnyJson) {
  await db.query("DELETE FROM castateintel.pal_stage3_analysis WHERE project_id=$1 AND document_id=$2", [projectId, documentId]);
  const si = (data.submittal_info as AnyJson) || {};
  const sr = (data.solution_requirements as AnyJson) || {};
  const dot = (data.dot_use_only as AnyJson) || {};
  await db.query(`
    INSERT INTO castateintel.pal_stage3_analysis (
      project_id, document_id, doc_created_date,
      general_info_raw, submittal_contacts,
      solution_requirements_summary, solution_requirements_raw,
      roadmap_raw, project_planning_raw,
      primary_solicitation_raw, ancillary_procurements,
      dot_dates, dot_raw
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  `, [
    projectId, documentId, (data.doc_created_date as string) || null,
    JSON.stringify(data.general_info ?? {}), JSON.stringify(si.contacts ?? []),
    sr.summary ?? null, JSON.stringify(sr),
    JSON.stringify(data.procurements_roadmap ?? {}), JSON.stringify(data.project_planning ?? {}),
    JSON.stringify(data.primary_solicitation ?? {}), JSON.stringify(data.ancillary_procurements ?? []),
    JSON.stringify(dot.dates ?? []), JSON.stringify(dot),
  ]);
}

async function saveStage4(projectId: number, documentId: string, data: AnyJson) {
  await db.query("DELETE FROM castateintel.pal_stage4_analysis WHERE project_id=$1 AND document_id=$2", [projectId, documentId]);
  const si = (data.submittal_info as AnyJson) || {};
  const sched = (data.schedule_baseline as AnyJson) || {};
  const cost = (data.cost_baseline as AnyJson) || {};
  const sol = (data.solicitation_results as AnyJson) || {};
  const dot = (data.dot_use_only as AnyJson) || {};
  await db.query(`
    INSERT INTO castateintel.pal_stage4_analysis (
      project_id, document_id, doc_created_date,
      general_info_raw, submittal_contacts, submittal_info,
      contract_management, org_readiness, project_readiness,
      objectives, schedule_baseline,
      proposed_project_start, proposed_project_end,
      baseline_project_start, baseline_project_end,
      cost_baseline, total_cost_proposed, total_cost_baseline, annual_mo_cost,
      solicitation_results, selected_vendor, contract_number,
      contract_start_date, contract_end_date, total_contract_cost,
      risk_register, dot_dates, dot_raw
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
  `, [
    projectId, documentId, (data.doc_created_date as string) || null,
    JSON.stringify(data.general_info ?? {}), JSON.stringify(si.contacts ?? []), JSON.stringify(si),
    JSON.stringify(data.contract_management ?? []), JSON.stringify(data.org_readiness ?? []), JSON.stringify(data.project_readiness ?? {}),
    JSON.stringify(data.objectives ?? []), JSON.stringify(sched),
    (sched.proposed_start as string) || null, (sched.proposed_end as string) || null,
    (sched.baseline_start as string) || null, (sched.baseline_end as string) || null,
    JSON.stringify(cost), (cost.proposed_total as string) || null, (cost.baseline_total as string) || null, (cost.annual_mo_cost as string) || null,
    JSON.stringify(sol), (sol.selected_vendor as string) || null, (sol.contract_number as string) || null,
    (sol.contract_start_date as string) || null, (sol.contract_end_date as string) || null, (sol.total_contract_cost as string) || null,
    JSON.stringify(data.risk_register ?? []), JSON.stringify(dot.dates ?? []), JSON.stringify(dot),
  ]);
}

const SAVE_MAP: Record<number, (pid: number, did: string, data: AnyJson) => Promise<void>> = {
  1: saveStage1, 2: saveStage2, 3: saveStage3, 4: saveStage4,
};

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json();
  const { project_number, stage: stageParam, force } = body;

  if (!project_number) {
    return NextResponse.json({ error: "project_number is required" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  // Resolve project
  const projRes = await db.query(
    "SELECT id, project_number, name FROM castateintel.pal_projects WHERE project_number = $1",
    [project_number]
  );
  if (!projRes.rows.length) {
    return NextResponse.json({ error: `Project ${project_number} not found` }, { status: 404 });
  }
  const project = projRes.rows[0];
  const projectId: number = project.id;

  const stagesToRun: number[] = stageParam ? [parseInt(stageParam)] : [1, 2, 3, 4];
  const results: Array<{ stage: number; status: string; contacts?: number; error?: string }> = [];

  for (const stage of stagesToRun) {
    try {
      // Get document for this stage
      const docRes = await db.query(`
        SELECT id, document_id, content_text, pdf_data IS NOT NULL AS has_pdf,
               length(content_text) AS text_len
        FROM castateintel.pal_documents
        WHERE project_id = $1 AND stage = $2
        ORDER BY (pdf_data IS NOT NULL) DESC, (content_text IS NOT NULL) DESC, id DESC
        LIMIT 1
      `, [projectId, stage]);

      if (!docRes.rows.length) {
        results.push({ stage, status: "skipped", error: "No document uploaded for this stage" });
        continue;
      }

      const doc = docRes.rows[0];
      let contentText: string = doc.content_text || "";

      // If content_text is empty but pdf_data exists, re-extract now
      if (contentText.trim().length < 100 && doc.has_pdf) {
        console.log(`[analysis] Stage ${stage}: content_text empty, re-extracting from pdf_data...`);
        const pdfRow = await db.query(
          "SELECT pdf_data FROM castateintel.pal_documents WHERE id = $1", [doc.id]
        );
        if (pdfRow.rows[0]?.pdf_data) {
          contentText = extractTextFromPdfBytes(Buffer.from(pdfRow.rows[0].pdf_data));
          if (contentText.length > 100) {
            await db.query(
              "UPDATE castateintel.pal_documents SET content_text=$1, updated_at=NOW() WHERE id=$2",
              [contentText, doc.id]
            );
            console.log(`[analysis] Stage ${stage}: extracted ${contentText.length} chars from stored PDF`);
          }
        }
      }

      if (contentText.trim().length < 100) {
        results.push({ stage, status: "skipped", error: "Document has no extractable text. Try re-uploading the PDF." });
        continue;
      }

      // Skip if already extracted (unless force)
      if (!force) {
        const alreadyDone = await db.query(
          `SELECT 1 FROM castateintel.pal_stage${stage}_analysis WHERE project_id=$1 LIMIT 1`,
          [projectId]
        );
        if (alreadyDone.rows.length) {
          results.push({ stage, status: "skipped", error: "Already analyzed. Pass force:true to re-run." });
          continue;
        }
      }

      console.log(`[analysis] Stage ${stage}: calling Claude (${contentText.length} chars)...`);
      const data = await callClaude(contentText, stage);

      const documentId: string = doc.document_id;
      const contacts = (data.contacts as AnyJson[]) || [];
      const urls = (data.urls as AnyJson[]) || [];

      const savedContacts = await saveContacts(projectId, documentId, stage, contacts);
      await saveUrls(projectId, documentId, stage, urls);
      await SAVE_MAP[stage](projectId, documentId, data);

      results.push({ stage, status: "ok", contacts: savedContacts });
      console.log(`[analysis] Stage ${stage} complete — ${savedContacts} contacts saved`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[analysis] Stage ${stage} error:`, msg);
      results.push({ stage, status: "error", error: msg });
    }
  }

  const anyOk = results.some(r => r.status === "ok");
  const anyError = results.some(r => r.status === "error");

  return NextResponse.json({
    success: anyOk,
    project_number,
    project_name: project.name,
    results,
  }, { status: anyError && !anyOk ? 500 : 200 });
}
