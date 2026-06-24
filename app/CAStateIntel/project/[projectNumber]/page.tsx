"use client";
// app/CAStateIntel/project/[projectNumber]/page.tsx
// Project summary layout matching the Excel template structure

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface ProjectData {
  project: {
    project_number: string;
    name: string;
    department_name: string;
    agency_name: string;
    pal_stage: string;
    criticality_rating: string;
    detail_url: string;
  };
  s1: {
    doc_created_date: string;
    project_planning_start: string;
    proposed_execution_start: string;
    funding_raw: { total_estimate?: string };
    rom_estimate: { category: string; amount: string }[];
    dot_dates: { label: string; date: string }[];
    general_info_summary: string;
    stakeholders: { name: string; organization: string; role: string }[];
    outcomes_raw: { outcome: string }[];
    complexity_raw: { dimension: string; score: string }[];
    document: { document_id: string; filename: string } | null;
    solution_tags: never[];
  } | null;
  s2: {
    doc_created_date: string;
    viable_solutions: { name: string; recommended: boolean; estimated_cost: string }[];
    financial_analysis: { total?: string; npv?: string; cost_table?: { category: string; total: string }[] };
    project_planning_raw: { milestones?: { milestone: string; date: string }[] };
    dot_dates: { label: string; date: string }[];
    solution_tags: { tag: string; category: string; confidence: string }[];
    document: { document_id: string; filename: string } | null;
  } | null;
  s3: {
    doc_created_date: string;
    ancillary_procurements: { name: string; estimated_value: string; timeline: string; procurement_type: string }[];
    primary_solicitation_raw: { solicitation_type: string; estimated_contract_value: string; anticipated_release_date: string };
    procurements_roadmap: { phases?: { phase: string; start_date: string; end_date: string }[]; total_duration?: string };
    dot_dates: { label: string; date: string }[];
    document: { document_id: string; filename: string } | null;
  } | null;
  contacts: { name: string; title: string; email: string; phone: string; organization: string; role_type: string; stage: number }[];
}

const TAG_COLORS: Record<string, string> = {
  vendor: "bg-blue-100 text-blue-800",
  technology: "bg-purple-100 text-purple-800",
  approach: "bg-green-100 text-green-800",
  deployment: "bg-orange-100 text-orange-800",
};

function InfoCell({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div className={`border border-gray-200 p-2 ${highlight ? "bg-blue-50" : "bg-white"}`}>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-sm font-semibold text-gray-900 mt-0.5">{value || "—"}</div>
    </div>
  );
}

function SectionHeader({ title, color = "bg-gray-800" }: { title: string; color?: string }) {
  return (
    <div className={`${color} text-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest`}>
      {title}
    </div>
  );
}

function StageBox({ num, label, color, doc, extracted, projectNumber }: {
  num: number; label: string; color: string; doc: { document_id: string; filename: string } | null | undefined;
  extracted: boolean; projectNumber: string;
}) {
  const borderColors = { 1: "border-green-400", 2: "border-indigo-400", 3: "border-violet-400" };
  const bgColors = { 1: "bg-green-50", 2: "bg-indigo-50", 3: "bg-violet-50" };
  const textColors = { 1: "text-green-700", 2: "text-indigo-700", 3: "text-violet-700" };

  return (
    <div className={`border-2 ${borderColors[num as 1|2|3]} ${bgColors[num as 1|2|3]} rounded-lg p-3 flex flex-col gap-2`}>
      <div className={`text-xs font-bold uppercase tracking-wide ${textColors[num as 1|2|3]}`}>
        Stage {num} — {label}
      </div>
      <div className="flex gap-2 flex-wrap">
        <a href={`/CAStateIntel/stage${num}?project=${projectNumber}`}
          className={`text-xs px-2 py-1 rounded font-medium ${color} transition-colors ${!extracted ? "opacity-50" : ""}`}>
          {extracted ? "View Analysis" : "Not yet extracted"} →
        </a>
        {doc?.document_id && (
          <a href={`/api/castateintel/pdf/${doc.document_id}`} target="_blank" rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded font-medium bg-white border border-gray-300 text-gray-600 hover:border-gray-400">
            📄 Source PDF
          </a>
        )}
      </div>
    </div>
  );
}

export default function ProjectSummaryPage({ params }: { params: { projectNumber: string } }) {
  const projectNumber = params?.projectNumber;
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectNumber) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/castateintel/analysis/${projectNumber}/1`).then(r => r.json()),
      fetch(`/api/castateintel/analysis/${projectNumber}/2`).then(r => r.json()),
      fetch(`/api/castateintel/analysis/${projectNumber}/3`).then(r => r.json()),
      fetch(`/api/castateintel/contacts?project=${projectNumber}`).then(r => r.json()),
    ]).then(([r1, r2, r3, rc]) => {
      setData({
        project: r1.project || r2.project || r3.project,
        s1: r1.extracted ? { ...r1.analysis, document: r1.document } : null,
        s2: r2.extracted ? { ...r2.analysis, solution_tags: r2.analysis?.solution_tags || [], document: r2.document } : null,
        s3: r3.extracted ? { ...r3.analysis, document: r3.document } : null,
        contacts: rc.contacts || [],
      });
      setLoading(false);
    }).catch(e => { setError(String(e)); setLoading(false); });
  }, [projectNumber]);

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading project summary...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const { project, s1, s2, s3, contacts } = data;
  const tags = s2?.solution_tags || [];

  // Get financial totals
  const totalValue = s1?.funding_raw?.total_estimate || s2?.financial_analysis?.total || "—";
  const oneTimeCost = s2?.financial_analysis?.cost_table?.find(r => r.category?.toLowerCase().includes("one"))?.total;
  const continuingCost = s2?.financial_analysis?.cost_table?.find(r => r.category?.toLowerCase().includes("continu") || r.category?.toLowerCase().includes("ongoing"))?.total;

  // Duration from roadmap
  const duration = s3?.procurements_roadmap?.total_duration || "—";

  // Get form accepted dates from CDT sections
  const s1AcceptedDate = s1?.dot_dates?.find(d => d.label?.toLowerCase().includes("accept") || d.label?.toLowerCase().includes("approved"))?.date;
  const s3AcceptedDate = s3?.dot_dates?.find(d => d.label?.toLowerCase().includes("accept") || d.label?.toLowerCase().includes("approved"))?.date;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-900 text-white px-8 py-5">
        <div className="flex items-center gap-3 mb-1">
          <a href="/CAStateIntel" className="text-blue-300 hover:text-white text-sm">← Dashboard</a>
          <span className="text-blue-600">|</span>
          <span className="text-blue-300 text-sm">Project Summary</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project?.name}</h1>
            <p className="text-blue-200 text-sm mt-1">{project?.department_name} • {project?.agency_name}</p>
          </div>
          <div className="flex gap-2">
            <a href={`/CAStateIntel/procurements?project=${projectNumber}`}
              className="px-3 py-1.5 rounded text-xs font-medium bg-violet-500/30 text-violet-200 hover:bg-violet-500/50 border border-violet-400/30">
              Procurements
            </a>
            <a href={`/CAStateIntel/calendar?project=${projectNumber}`}
              className="px-3 py-1.5 rounded text-xs font-medium bg-yellow-500/30 text-yellow-200 hover:bg-yellow-500/50 border border-yellow-400/30">
              📅 Calendar
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* TOP: Department + Project + Key Metrics (Excel-style grid) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Title rows */}
          <div className="grid grid-cols-2 border-b border-gray-200">
            <div className="border-r border-gray-200 p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Department Name</div>
              <div className="text-base font-bold text-gray-900">{project?.department_name || "—"}</div>
              <div className="text-xs text-gray-400 mt-0.5">{project?.agency_name}</div>
            </div>
            <div className="p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Project Number and Title</div>
              <div className="text-base font-bold text-gray-900">{project?.project_number} — {project?.name}</div>
              <div className="mt-1 flex gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">{project?.pal_stage}</span>
                {project?.criticality_rating && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">{project?.criticality_rating} Criticality</span>
                )}
              </div>
            </div>
          </div>

          {/* Financials + Tags */}
          <div className="grid grid-cols-2 border-b border-gray-200">
            <div className="border-r border-gray-200">
              <SectionHeader title="Financial Summary" color="bg-slate-700" />
              <div className="grid grid-cols-2 gap-px bg-gray-100">
                <InfoCell label="Total Project Value" value={totalValue} highlight />
                <InfoCell label="Solution Tags" value="" />
                <InfoCell label="One Time Cost" value={oneTimeCost} />
                <div className="bg-white p-2 row-span-3">
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tags.length > 0 ? tags.map((t, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[t.category] || "bg-gray-100 text-gray-600"}`}>
                        {t.tag}
                      </span>
                    )) : <span className="text-xs text-gray-400">No tags extracted</span>}
                  </div>
                </div>
                <InfoCell label="Continuing Cost" value={continuingCost} />
                <InfoCell label="Project Duration" value={duration} />
              </div>
            </div>
            <div>
              <SectionHeader title="Key Dates" color="bg-slate-700" />
              <div className="grid grid-cols-2 gap-px bg-gray-100">
                <InfoCell label="S1 — Planning Start" value={s1?.project_planning_start ? new Date(s1.project_planning_start).toLocaleDateString("en-US", {year:"numeric",month:"short",day:"numeric"}) : "—"} />
                <InfoCell label="S1 — Execution Start" value={s1?.proposed_execution_start ? new Date(s1.proposed_execution_start).toLocaleDateString("en-US", {year:"numeric",month:"short",day:"numeric"}) : "—"} highlight />
                <InfoCell label="S1 — Form Accepted" value={s1AcceptedDate || "—"} highlight />
                <InfoCell label="S3 — Form Accepted" value={s3AcceptedDate || "—"} highlight />
                <InfoCell label="S2 — Doc Created" value={s2?.doc_created_date ? new Date(s2.doc_created_date).toLocaleDateString("en-US", {year:"numeric",month:"short"}) : "—"} />
                <InfoCell label="S3 — Doc Created" value={s3?.doc_created_date ? new Date(s3.doc_created_date).toLocaleDateString("en-US", {year:"numeric",month:"short"}) : "—"} />
              </div>
            </div>
          </div>

          {/* Stage links + Ancillary + Contacts */}
          <div className="grid grid-cols-3 border-b border-gray-200">
            {/* Stage 1/2/3 links */}
            <div className="border-r border-gray-200">
              <SectionHeader title="Analysis Documents" color="bg-blue-800" />
              <div className="p-3 space-y-2">
                <StageBox num={1} label="Business Analysis" color="bg-green-100 text-green-800 hover:bg-green-200"
                  doc={s1?.document} extracted={!!s1} projectNumber={projectNumber} />
                <StageBox num={2} label="Alternative Analysis" color="bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                  doc={s2?.document} extracted={!!s2} projectNumber={projectNumber} />
                <StageBox num={3} label="Solution Analysis" color="bg-violet-100 text-violet-800 hover:bg-violet-200"
                  doc={s3?.document} extracted={!!s3} projectNumber={projectNumber} />
              </div>
            </div>

            {/* Ancillary Procurements */}
            <div className="border-r border-gray-200">
              <SectionHeader title="Ancillary Procurements" color="bg-violet-800" />
              <div className="p-3">
                {s3?.ancillary_procurements?.length ? (
                  <div className="space-y-2">
                    {s3.ancillary_procurements.slice(0, 5).map((ap, i) => (
                      <div key={i} className="text-xs border border-gray-200 rounded p-2 bg-gray-50">
                        <div className="font-semibold text-gray-800">{ap.name}</div>
                        <div className="text-gray-500 mt-0.5 flex justify-between">
                          <span>{ap.procurement_type}</span>
                          <span className="font-medium text-violet-700">{ap.estimated_value}</span>
                        </div>
                        {ap.timeline && <div className="text-gray-400 mt-0.5">📅 {ap.timeline}</div>}
                      </div>
                    ))}
                    {s3.ancillary_procurements.length > 5 && (
                      <a href={`/CAStateIntel/procurements?project=${projectNumber}`}
                        className="text-xs text-violet-600 hover:underline">
                        +{s3.ancillary_procurements.length - 5} more →
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 p-2">
                    {s3 ? "No ancillary procurements" : "Stage 3 not yet extracted"}
                  </p>
                )}
              </div>
            </div>

            {/* All Contacts */}
            <div>
              <SectionHeader title="All Contacts for This Project" color="bg-teal-800" />
              <div className="p-3 max-h-64 overflow-y-auto">
                {contacts.length > 0 ? (
                  <div className="space-y-1.5">
                    {contacts.map((c, i) => (
                      <div key={i} className="text-xs border border-gray-100 rounded p-2 hover:bg-gray-50">
                        <div className="font-semibold text-gray-800">{c.name}</div>
                        {c.title && <div className="text-gray-500">{c.title}</div>}
                        {c.email && <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a>}
                        {c.phone && <div className="text-gray-400">{c.phone}</div>}
                        <div className="flex gap-1 mt-1">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">
                            S{c.stage}
                          </span>
                          {c.role_type && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-xs capitalize">{c.role_type}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 p-2">No contacts extracted yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Content rows — summaries */}
          <div className="grid grid-cols-3">
            <div className="border-r border-gray-200 p-3">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">S1 — Business Summary</div>
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">
                {s1?.general_info_summary || "Not yet extracted"}
              </p>
            </div>
            <div className="border-r border-gray-200 p-3">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">S2 — Recommended Solution</div>
              {s2?.viable_solutions?.filter(v => v.recommended).map((sol, i) => (
                <div key={i} className="text-xs">
                  <div className="font-semibold text-indigo-800 mb-1">{sol.name}</div>
                  {sol.estimated_cost && <div className="text-gray-500">Est. Cost: {sol.estimated_cost}</div>}
                </div>
              ))}
              {!s2 && <p className="text-xs text-gray-400">Not yet extracted</p>}
            </div>
            <div className="p-3">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">S3 — Primary Solicitation</div>
              {s3?.primary_solicitation_raw ? (
                <div className="text-xs space-y-1">
                  <div><span className="text-gray-500">Type:</span> <span className="font-medium">{s3.primary_solicitation_raw.solicitation_type}</span></div>
                  <div><span className="text-gray-500">Value:</span> <span className="font-medium text-violet-700">{s3.primary_solicitation_raw.estimated_contract_value}</span></div>
                  <div><span className="text-gray-500">Release:</span> <span className="font-medium">{s3.primary_solicitation_raw.anticipated_release_date}</span></div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Not yet extracted</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
