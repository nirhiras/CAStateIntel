"use client";
// app/CAStateIntel/project/[projectNumber]/page.tsx
// Detailed analysis page — Excel-style layout

import { useState, useEffect, use } from "react";

interface StageDoc {
  document_id: string;
  filename: string;
  label: string;
}

interface Contact {
  name: string; title: string; email: string; phone: string;
  organization: string; role_type: string; stage: number; source: string;
}

interface AncillaryProc {
  name: string; procurement_type: string; estimated_value: string;
  timeline: string; vendor_or_source: string; description: string;
}

interface ProjectData {
  project: {
    id: number; project_number: string; name: string;
    department_name: string; agency_name: string;
    pal_stage: string; criticality_rating: string; detail_url: string;
  };
  s1: {
    doc_created_date: string;
    project_planning_start: string;
    proposed_execution_start: string;
    dot_dates: { label: string; date: string }[];
    general_info_summary: string;
    funding_raw: Record<string, string>;
    rom_estimate: { category: string; amount: string }[];
    document: StageDoc | null;
  } | null;
  s2: {
    doc_created_date: string;
    dot_dates: { label: string; date: string }[];
    viable_solutions: { name: string; recommended: boolean; summary: string; estimated_cost: string }[];
    market_research_summary: string;
    solution_tags: { tag: string; category: string; confidence: string }[];
    financial_analysis: { total?: string; cost_table?: { category: string; total: string }[] };
    document: StageDoc | null;
  } | null;
  s3: {
    doc_created_date: string;
    dot_dates: { label: string; date: string }[];
    ancillary_procurements: AncillaryProc[];
    primary_solicitation_raw: Record<string, string>;
    procurements_roadmap: { total_duration?: string; phases?: { phase: string; start_date: string; end_date: string }[] };
    document: StageDoc | null;
  } | null;
  s4: {
    doc_created_date: string;
    selected_vendor: string;
    total_contract_cost: string;
    contract_start_date: string;
    contract_end_date: string;
    dot_dates: { label: string; date: string }[];
    document: StageDoc | null;
  } | null;
  contacts: Contact[];
}

const TAG_COLORS: Record<string, string> = {
  vendor: "bg-blue-100 text-blue-800",
  technology: "bg-purple-100 text-purple-800",
  approach: "bg-green-100 text-green-800",
  deployment: "bg-orange-100 text-orange-800",
};

function Cell({ children, className = "", bold = false, header = false, span = 1, rowSpan = 1 }:
  { children?: React.ReactNode; className?: string; bold?: boolean; header?: boolean; span?: number; rowSpan?: number }) {
  return (
    <td
      colSpan={span}
      rowSpan={rowSpan}
      className={`border border-gray-400 px-2 py-1.5 text-xs align-top
        ${header ? "bg-gray-100 font-semibold" : "bg-white"}
        ${bold ? "font-bold" : ""}
        ${className}`}
    >
      {children}
    </td>
  );
}

function PdfButton({ doc, stage }: { doc: StageDoc | null | undefined; stage: number }) {
  const colors = ["", "text-green-700 border-green-300 bg-green-50", "text-indigo-700 border-indigo-300 bg-indigo-50",
    "text-violet-700 border-violet-300 bg-violet-50", "text-amber-700 border-amber-300 bg-amber-50"];
  if (!doc?.document_id) return <span className="text-gray-300 text-xs">No PDF</span>;
  return (
    <a href={`/api/castateintel/pdf/${doc.document_id}`} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${colors[stage] || colors[1]}`}>
      📄 Source PDF
    </a>
  );
}

function StageLink({ num, projectNumber, extracted, doc }: {
  num: number; projectNumber: string; extracted: boolean; doc: StageDoc | null | undefined;
}) {
  const colors = ["", "bg-green-50 text-green-700 border-green-300 hover:bg-green-100",
    "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100",
    "bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100",
    "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"];
  const labels = ["", "S1BA", "S2AA", "S3SA", "S4PRA"];
  return (
    <div className="space-y-1">
      <a href={`/CAStateIntel/stage${num}?project=${projectNumber}`}
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium transition-colors
          ${colors[num]} ${!extracted ? "opacity-40" : ""}`}>
        {labels[num]} {extracted ? "→" : "(pending)"}
      </a>
      {doc && <div className="mt-1"><PdfButton doc={doc} stage={num} /></div>}
    </div>
  );
}

export default function ProjectSummaryPage({ params }: { params: Promise<{ projectNumber: string }> }) {
  const { projectNumber } = use(params);
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (!projectNumber) return;
    Promise.all([
      fetch(`/api/castateintel/analysis/${projectNumber}/1`).then(r => r.json()),
      fetch(`/api/castateintel/analysis/${projectNumber}/2`).then(r => r.json()),
      fetch(`/api/castateintel/analysis/${projectNumber}/3`).then(r => r.json()),
      fetch(`/api/castateintel/analysis/${projectNumber}/4`).then(r => r.json()),
      fetch(`/api/castateintel/contacts?project=${projectNumber}`).then(r => r.json()),
    ]).then(([r1, r2, r3, r4, rc]) => {
      setData({
        project: r1.project || r2.project || r3.project || r4.project,
        s1: r1.extracted ? { ...r1.analysis, document: r1.document } : null,
        s2: r2.extracted ? { ...r2.analysis, document: r2.document } : null,
        s3: r3.extracted ? { ...r3.analysis, document: r3.document } : null,
        s4: r4.extracted ? {
          doc_created_date: r4.analysis?.doc_created_date,
          selected_vendor: r4.analysis?.selected_vendor,
          total_contract_cost: r4.analysis?.total_contract_cost,
          contract_start_date: r4.analysis?.solicitation_results?.contract_start_date,
          contract_end_date: r4.analysis?.solicitation_results?.contract_end_date,
          dot_dates: r4.analysis?.dot_dates || [],
          document: r4.document,
        } : null,
        contacts: rc.contacts || [],
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectNumber]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Loading project...</div>
  );
  if (!data) return null;

  const { project, s1, s2, s3, s4, contacts } = data;
  const tags = s2?.solution_tags || [];

  // Key financial values
  const totalValue = s1?.funding_raw?.total_estimate
    || s1?.rom_estimate?.find(r => r.category?.toLowerCase().includes("total"))?.amount
    || s4?.total_contract_cost || "—";
  const oneTimeCost = s2?.financial_analysis?.cost_table?.find(r =>
    r.category?.toLowerCase().includes("one"))?.total || "—";
  const continuingCost = s2?.financial_analysis?.cost_table?.find(r =>
    r.category?.toLowerCase().includes("continu") || r.category?.toLowerCase().includes("ongoing"))?.total || "—";
  const duration = s3?.procurements_roadmap?.total_duration || "—";

  // Key dates
  const executionStart = s1?.proposed_execution_start;
  const s1Accepted = s1?.dot_dates?.find(d => (d.label || "").toLowerCase().includes("accept"))?.date;
  const s2EstStart = s2?.dot_dates?.find(d => (d.label || "").toLowerCase().includes("start"))?.date;
  const s2EstEnd = s2?.dot_dates?.find(d => (d.label || "").toLowerCase().includes("end"))?.date;
  const s3AcceptDate = s3?.dot_dates?.find(d => (d.label || "").toLowerCase().includes("accept"))?.date;
  const s4AcceptDate = s4?.dot_dates?.find(d => (d.label || "").toLowerCase().includes("accept"))?.date;

  // Recommended solution
  const recommended = s2?.viable_solutions?.find(v => v.recommended) || s2?.viable_solutions?.[0];

  // Ancillary procurements
  const ancillary = s3?.ancillary_procurements || [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* PDF Modal */}
      {pdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold text-gray-800">📄 {pdfModal.title}</span>
              <button onClick={() => setPdfModal(null)} className="text-gray-400 hover:text-gray-700 text-xl font-bold px-2">✕</button>
            </div>
            <iframe src={pdfModal.url} className="flex-1 w-full" title="PDF Viewer" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-blue-900 text-white px-6 py-4">
        <div className="flex items-center gap-3 mb-1 text-sm">
          <a href="/CAStateIntel" className="text-blue-300 hover:text-white">← Dashboard</a>
          <span className="text-blue-600">|</span>
          <span className="text-blue-300">Project Analysis</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{project?.project_number} — {project?.name}</h1>
            <p className="text-blue-200 text-sm mt-0.5">
              {project?.department_name}
              {project?.agency_name ? ` · ${project.agency_name}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {project?.detail_url && (
              <a href={project.detail_url} target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 text-white hover:bg-white/20 border border-white/20">
                CDT ↗
              </a>
            )}
            <a href={`/CAStateIntel/calendar?project=${projectNumber}`}
              className="px-3 py-1.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/40 border border-yellow-400/30">
              📅 Calendar
            </a>
            <a href={`/CAStateIntel/procurements?project=${projectNumber}`}
              className="px-3 py-1.5 rounded text-xs font-medium bg-violet-500/20 text-violet-200 hover:bg-violet-500/40 border border-violet-400/30">
              Procurements
            </a>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-300">
          <table className="w-full border-collapse text-sm">

            {/* ROW 1: Department Name */}
            <tbody>
              <tr>
                <Cell header bold className="w-48">Department Name</Cell>
                <Cell span={7} bold className="text-gray-800">
                  {project?.department_name || "—"}
                  {project?.agency_name ? ` · ${project.agency_name}` : ""}
                </Cell>
              </tr>

              {/* ROW 2: Project Number and Title */}
              <tr>
                <Cell header bold>Project Number and Title</Cell>
                <Cell span={7} bold className="text-blue-900 text-sm">
                  {project?.project_number} — {project?.name}
                </Cell>
              </tr>

              {/* Spacer */}
              <tr><Cell span={8} className="h-2 bg-gray-50 border-0" /></tr>

              {/* ROW 3: Financials + Tags */}
              <tr>
                <Cell header>Total Project Value</Cell>
                <Cell className="font-semibold text-gray-900">{totalValue}</Cell>
                <Cell header>Tags</Cell>
                <Cell span={5} rowSpan={4}>
                  <div className="flex flex-wrap gap-1 p-1">
                    {tags.length > 0 ? tags.map((t, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[t.category] || "bg-gray-100 text-gray-600"}`}>
                        {t.tag}
                      </span>
                    )) : <span className="text-gray-400 text-xs">No tags extracted yet</span>}
                  </div>
                </Cell>
              </tr>
              <tr>
                <Cell header>One Time Cost</Cell>
                <Cell>{oneTimeCost}</Cell>
              </tr>
              <tr>
                <Cell header>Continuing Cost</Cell>
                <Cell>{continuingCost}</Cell>
              </tr>
              <tr>
                <Cell header>Project Duration</Cell>
                <Cell>{duration}</Cell>
              </tr>

              {/* Spacer */}
              <tr><Cell span={8} className="h-3 bg-gray-50 border-0" /></tr>

              {/* ROW: Stage links header */}
              <tr>
                <Cell header className="text-center w-28">Stage 1</Cell>
                <Cell header className="text-center w-28">Stage 2</Cell>
                <Cell header className="text-center w-28">Stage 3</Cell>
                <Cell header className="text-center w-28">Stage 4</Cell>
                <Cell header className="w-56">Ancillary Procurements<br/><span className="font-normal text-gray-500">(incl start dates)</span></Cell>
                <Cell header className="w-40">All Contacts for<br/>this project</Cell>
                <Cell header className="w-48">Market Research</Cell>
                <Cell header className="w-48">Recommended Solution</Cell>
              </tr>

              {/* ROW: Stage links */}
              <tr>
                <Cell className="align-top">
                  <StageLink num={1} projectNumber={projectNumber} extracted={!!s1}
                    doc={s1?.document ?? (data as any)?.s1_doc} />
                </Cell>
                <Cell className="align-top">
                  <StageLink num={2} projectNumber={projectNumber} extracted={!!s2}
                    doc={s2?.document ?? (data as any)?.s2_doc} />
                </Cell>
                <Cell className="align-top">
                  <StageLink num={3} projectNumber={projectNumber} extracted={!!s3}
                    doc={s3?.document ?? (data as any)?.s3_doc} />
                </Cell>
                <Cell className="align-top">
                  <StageLink num={4} projectNumber={projectNumber} extracted={!!s4}
                    doc={s4?.document ?? (data as any)?.s4_doc} />
                </Cell>

                {/* Ancillary Procurements */}
                <Cell className="align-top">
                  {ancillary.length > 0 ? (
                    <div className="space-y-1.5">
                      {ancillary.slice(0, 6).map((ap, i) => (
                        <div key={i} className="text-xs border-b border-gray-100 pb-1 last:border-0">
                          <div className="font-semibold text-gray-800">{ap.name}</div>
                          {ap.timeline && <div className="text-violet-600">📅 {ap.timeline}</div>}
                          {ap.estimated_value && <div className="text-gray-500">{ap.estimated_value}</div>}
                        </div>
                      ))}
                      {ancillary.length > 6 && (
                        <a href={`/CAStateIntel/procurements?project=${projectNumber}`}
                          className="text-xs text-violet-600 hover:underline">+{ancillary.length - 6} more →</a>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">{s3 ? "None" : "—"}</span>
                  )}
                </Cell>

                {/* All Contacts */}
                <Cell className="align-top max-w-[160px]">
                  {contacts.length > 0 ? (
                    <div className="space-y-1.5">
                      {contacts.slice(0, 8).map((c, i) => (
                        <div key={i} className="text-xs border-b border-gray-100 pb-1 last:border-0">
                          <div className="font-semibold text-gray-800 truncate">{c.name}</div>
                          {c.title && <div className="text-gray-500 truncate">{c.title}</div>}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline text-xs truncate block">{c.email}</a>
                          )}
                          {c.phone && <div className="text-gray-400">{c.phone}</div>}
                          <span className="inline-block text-xs px-1 rounded bg-gray-100 text-gray-500 mt-0.5">S{c.stage}</span>
                        </div>
                      ))}
                      {contacts.length > 8 && (
                        <div className="text-xs text-gray-400">+{contacts.length - 8} more</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </Cell>

                {/* Market Research */}
                <Cell className="align-top">
                  {s2?.market_research_summary ? (
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-10">
                      {s2.market_research_summary}
                    </p>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </Cell>

                {/* Recommended Solution + Source PDF */}
                <Cell className="align-top">
                  {recommended ? (
                    <div className="space-y-2">
                      <div className="font-semibold text-indigo-800 text-xs">{recommended.name}</div>
                      {recommended.estimated_cost && (
                        <div className="text-xs text-gray-500">Est. Cost: {recommended.estimated_cost}</div>
                      )}
                      {recommended.summary && (
                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">{recommended.summary}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </Cell>
              </tr>

              {/* ROW: Source PDF row */}
              <tr>
                <Cell className="text-center">
                  {s1?.document?.document_id && (
                    <button onClick={() => s1.document && setPdfModal({ url: `/api/castateintel/pdf/${s1.document.document_id}`, title: s1.document.filename })}
                      className="text-xs text-green-700 hover:underline">📄 View PDF</button>
                  )}
                </Cell>
                <Cell className="text-center">
                  {s2?.document?.document_id && (
                    <button onClick={() => s2.document && setPdfModal({ url: `/api/castateintel/pdf/${s2.document.document_id}`, title: s2.document.filename })}
                      className="text-xs text-indigo-700 hover:underline">📄 View PDF</button>
                  )}
                </Cell>
                <Cell className="text-center">
                  {s3?.document?.document_id && (
                    <button onClick={() => s3.document && setPdfModal({ url: `/api/castateintel/pdf/${s3.document.document_id}`, title: s3.document.filename })}
                      className="text-xs text-violet-700 hover:underline">📄 View PDF</button>
                  )}
                </Cell>
                <Cell className="text-center">
                  {s4?.document?.document_id && (
                    <button onClick={() => s4.document && setPdfModal({ url: `/api/castateintel/pdf/${s4.document.document_id}`, title: s4.document.filename })}
                      className="text-xs text-amber-700 hover:underline">📄 View PDF</button>
                  )}
                </Cell>
                <Cell />
                <Cell />
                <Cell />
                <Cell className="text-right text-xs text-gray-400">Source PDF ↑</Cell>
              </tr>

              {/* Content row — S1 summary */}
              <tr>
                <Cell span={8} header className="pt-3">
                  <span className="text-gray-600 font-semibold">S1 — Business Analysis Summary</span>
                </Cell>
              </tr>
              <tr>
                <Cell span={8} className="leading-relaxed text-gray-700">
                  {s1?.general_info_summary || <span className="text-gray-300">Not yet extracted</span>}
                </Cell>
              </tr>

              {/* Key Dates row */}
              <tr>
                <Cell span={8} header className="pt-3">
                  <span className="text-gray-600 font-semibold">Key Dates</span>
                </Cell>
              </tr>
              <tr>
                {[
                  ["S1 — Execution Start", executionStart],
                  ["S1 — Form Accepted", s1Accepted],
                  ["S2 — Est. Project Start", s2EstStart],
                  ["S2 — Est. Project End", s2EstEnd],
                  ["S3 — Form Accepted", s3AcceptDate],
                  ["S4 — Form Accepted", s4AcceptDate],
                  ["Vendor (S4)", s4?.selected_vendor],
                  ["Contract Cost (S4)", s4?.total_contract_cost],
                ].map(([label, val]) => (
                  <Cell key={String(label)} className="align-top">
                    <div className="text-gray-400 text-xs mb-0.5">{label}</div>
                    <div className={`text-xs font-medium ${val ? "text-gray-800" : "text-gray-300"}`}>
                      {val ? (val.match(/^\d{4}-\d{2}-\d{2}/)
                        ? new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                        : val)
                        : "—"}
                    </div>
                  </Cell>
                ))}
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
