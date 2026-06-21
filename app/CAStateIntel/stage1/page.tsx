"use client";
// apps/api/ca-gov-intel/app/CAStateIntel/stage1/page.tsx

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────
interface Contact {
  contact_id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  organization: string;
  context: string;
  role_type: string;
}

interface UrlEntry { url_id: string; url: string; context: string; }

interface Stage1Analysis {
  doc_created_date: string;
  s1ba_version_number: string;
  project_planning_start: string;
  proposed_execution_start: string;
  general_info_summary: string;
  general_info_raw: Record<string, string>;
  submittal_info: { contacts: Contact[]; submission_date?: string; key_values?: Record<string,string> };
  business_sponsorship: { contacts: Contact[]; key_values?: Record<string,string> };
  stakeholder_summary: string;
  stakeholders: { name: string; organization: string; role: string; interest: string; influence: string }[];
  business_program_summary: string;
  business_program_raw: Record<string, string>;
  justification_summary: string;
  outcomes_summary: string;
  outcomes_raw: { outcome: string; metric: string; target: string }[];
  project_mgmt_summary: string;
  complexity_summary: string;
  complexity_raw: { dimension: string; score: string; rationale: string }[];
  funding_summary: string;
  rom_estimate: { category: string; amount: string; notes: string }[];
  funding_raw: { total_estimate?: string; funding_sources?: { source: string; amount: string; fiscal_year: string }[] };
  dot_dates: { label: string; date: string }[];
}

interface ProjectOption { project_number: string; name: string; }
interface AnalysisResponse {
  project: { project_number: string; name: string; agency: string; department: string };
  document: { id: number; document_id: string; filename: string; label: string; created_at: string } | null;
  contacts: Contact[];
  urls: UrlEntry[];
  analysis: Stage1Analysis | null;
  extracted: boolean;
}

// ─── Sub-components ───────────────────────────────────────────
function Section({ title, children, accent = "#1a5276" }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 rounded" style={{ background: accent }} />
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InfoGrid({ data }: { data: Record<string, string> }) {
  const entries = Object.entries(data).filter(([, v]) => v);
  if (!entries.length) return <p className="text-gray-400 text-sm italic">No data extracted</p>;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-sm">
          <span className="text-gray-500 font-medium min-w-fit">{k}:</span>
          <span className="text-gray-800">{v}</span>
        </div>
      ))}
    </div>
  );
}

function ContactsTable({ contacts, label }: { contacts: Contact[]; label?: string }) {
  if (!contacts?.length) return <p className="text-gray-400 text-sm italic">No contacts in this section</p>;
  return (
    <>
      {label && <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">{label}</p>}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {["Name", "Title", "Organization", "Email", "Phone", "Context"].map(h => (
              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((c, i) => (
            <tr key={c.contact_id || i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{c.name || "—"}</td>
              <td className="px-3 py-2 text-gray-600">{c.title || "—"}</td>
              <td className="px-3 py-2 text-gray-600">{c.organization || "—"}</td>
              <td className="px-3 py-2">
                {c.email ? <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a> : "—"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">{c.phone || "—"}</td>
              <td className="px-3 py-2 text-gray-500 text-xs max-w-xs">{c.context || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function SummaryBlock({ text, wordTarget }: { text: string; wordTarget?: string }) {
  if (!text) return <p className="text-gray-400 text-sm italic">Not yet extracted</p>;
  return (
    <div className="relative">
      <p className="text-gray-700 leading-relaxed text-sm">{text}</p>
      {wordTarget && (
        <p className="text-xs text-gray-400 mt-1">{text.split(" ").length} words</p>
      )}
    </div>
  );
}

function DataTable<T extends Record<string, string>>({ data, columns }: { data: T[]; columns: { key: keyof T; label: string }[] }) {
  if (!data?.length) return <p className="text-gray-400 text-sm italic">No data</p>;
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-blue-50">
          {columns.map(c => (
            <th key={String(c.key)} className="text-left px-3 py-2 text-xs font-semibold text-blue-800 border-b border-blue-100">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
            {columns.map(c => (
              <td key={String(c.key)} className="px-3 py-2 text-gray-700 border-b border-gray-100">{String(row[c.key] || "—")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function Stage1Page() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const searchParams = useSearchParams();
  const [selectedProject, setSelectedProject] = useState(searchParams.get("project") || "4265-081");
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [showPdf, setShowPdf] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  // Fetch project list
  useEffect(() => {
    fetch("/api/castateintel/projects")
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (projectNumber: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/castateintel/analysis/${projectNumber}/1`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(selectedProject); }, [selectedProject, loadData]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const r = await fetch("/api/castateintel/analysis/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_number: selectedProject, stage: 1 }),
      });
      if (!r.ok) throw new Error(await r.text());
      await loadData(selectedProject);
    } catch (e) {
      setError(String(e));
    } finally {
      setExtracting(false);
    }
  };

  const a = data?.analysis;
  const contacts = data?.contacts || [];
  const urls = data?.urls || [];

  const navSections = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: `Contacts (${contacts.length})` },
    { id: "urls", label: `URLs (${urls.length})` },
    { id: "general", label: "General Info" },
    { id: "submittal", label: "Submittal & Sponsorship" },
    { id: "stakeholders", label: "Stakeholders" },
    { id: "business", label: "Business Program" },
    { id: "justification", label: "Justification" },
    { id: "outcomes", label: "Outcomes" },
    { id: "management", label: "Project Mgmt" },
    { id: "complexity", label: "Complexity" },
    { id: "funding", label: "Funding" },
    { id: "dot", label: "CDT Use Only" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/CAStateIntel" className="text-gray-400 hover:text-gray-600 text-sm">← CAStateIntel</a>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Stage 1</span>
              <h1 className="text-lg font-bold text-gray-900">Business Analysis</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {projects.map(p => (
                <option key={p.project_number} value={p.project_number}>
                  {p.project_number} — {p.name}
                </option>
              ))}
            </select>
            {data && !data.extracted && (
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {extracting ? "⟳ Extracting..." : "⚡ Extract with AI"}
              </button>
            )}
            {data?.extracted && (
              <span className="text-xs text-green-600 flex items-center gap-1">✓ Extracted</span>
            )}
          </div>
        </div>

        {/* Section nav */}
        <div className="max-w-screen-2xl mx-auto px-6 border-t border-gray-100 flex gap-0 overflow-x-auto">
          {navSections.map(s => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSection(s.id);
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeSection === s.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* PDF Viewer Panel */}
        {showPdf && data?.document?.document_id && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-800">📄 {data.document.filename}</span>
                  <a
                    href={`/api/castateintel/pdf/${data.document.document_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open in new tab ↗
                  </a>
                </div>
                <button
                  onClick={() => setShowPdf(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
                >
                  ✕
                </button>
              </div>
              <iframe
                src={`/api/castateintel/pdf/${data.document.document_id}`}
                className="flex-1 w-full rounded-b-xl"
                title={data.document.filename}
              />
            </div>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-sm">Loading analysis...</div>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">{error}</div>
        )}

        {data && !loading && (
          <>
            {/* Overview banner */}
            <div id="overview" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{data.project.agency} › {data.project.department}</p>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{data.project.name}</h2>
                  <p className="text-sm text-gray-500">Project {data.project.project_number}</p>
                </div>
                <div className="text-right text-sm text-gray-500 space-y-1">
                  {a?.doc_created_date && <p>Created: <strong>{a.doc_created_date ? new Date(a.doc_created_date).toLocaleDateString("en-US", {year:"numeric",month:"short",day:"numeric"}) : "—"}</strong></p>}
                  {a?.s1ba_version_number && <p>S1BA Version: <strong>{a.s1ba_version_number}</strong></p>}
                  {data.document && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-400">{data.document.filename}</p>
                    {data.document.document_id && (
                      <button
                        onClick={() => setShowPdf(p => !p)}
                        className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 font-medium"
                      >
                        {showPdf ? "Hide PDF" : "📄 View PDF"}
                      </button>
                    )}
                  </div>
                )}
                </div>
              </div>

              {a && (
                <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-100">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-blue-600 font-medium mb-1">Planning Start</p>
                    <p className="text-lg font-bold text-blue-900">{a.project_planning_start || "—"}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-green-600 font-medium mb-1">Execution Start</p>
                    <p className="text-lg font-bold text-green-900">{a.proposed_execution_start || "—"}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-xs text-purple-600 font-medium mb-1">ROM Estimate</p>
                    <p className="text-lg font-bold text-purple-900">{a.funding_raw?.total_estimate || "—"}</p>
                  </div>
                </div>
              )}

              {!data.extracted && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  Document found but analysis not yet extracted. Click <strong>⚡ Extract with AI</strong> to analyze.
                </div>
              )}
            </div>

            {/* All Contacts */}
            <div id="contacts" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="All Contacts in Document">
                <ContactsTable contacts={contacts} />
              </Section>
            </div>

            {/* All URLs */}
            <div id="urls" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
              <Section title="All URLs in Document">
                {urls.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">No URLs extracted</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">URL</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {urls.map((u, i) => (
                        <tr key={u.url_id || i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                          <td className="px-3 py-2">
                            <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all text-xs">{u.url}</a>
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{u.context}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            </div>

            {a && (
              <>
                {/* General Info */}
                <div id="general" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="General Information">
                    <div className="mb-4">
                      <ContactsTable contacts={contacts.filter(c => c.context?.toLowerCase().includes("general"))} label="Contacts in this section" />
                    </div>
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Summary</p>
                      <SummaryBlock text={a.general_info_summary} wordTarget="~200 words" />
                    </div>
                    {a.general_info_raw && Object.keys(a.general_info_raw).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Key Fields</p>
                        <InfoGrid data={a.general_info_raw} />
                      </div>
                    )}
                  </Section>
                </div>

                {/* Submittal & Sponsorship */}
                <div id="submittal" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Submittal Information & Business Sponsorship">
                    <div className="mb-6">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Submittal Contacts</p>
                      <ContactsTable contacts={(a.submittal_info?.contacts || []) as unknown as Contact[]} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Business Sponsors</p>
                      <ContactsTable contacts={(a.business_sponsorship?.contacts || []) as unknown as Contact[]} />
                    </div>
                  </Section>
                </div>

                {/* Stakeholders */}
                <div id="stakeholders" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Stakeholder Assessment">
                    <div className="mb-6">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Assessment (300–500 words)</p>
                      <SummaryBlock text={a.stakeholder_summary} />
                    </div>
                    {a.stakeholders?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Who&apos;s Involved</p>
                        <DataTable
                          data={a.stakeholders}
                          columns={[
                            { key: "name", label: "Name" },
                            { key: "organization", label: "Organization" },
                            { key: "role", label: "Role" },
                            { key: "interest", label: "Interest" },
                            { key: "influence", label: "Influence" },
                          ]}
                        />
                      </div>
                    )}
                  </Section>
                </div>

                {/* Business Program */}
                <div id="business" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Business Program">
                    <div className="mb-4">
                      <ContactsTable contacts={contacts.filter(c => c.context?.toLowerCase().includes("business program"))} label="Contacts in this section" />
                    </div>
                    <SummaryBlock text={a.business_program_summary} wordTarget="~500 words" />
                  </Section>
                </div>

                {/* Justification */}
                <div id="justification" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Project Justification">
                    <div className="mb-4">
                      <ContactsTable contacts={contacts.filter(c => c.context?.toLowerCase().includes("justif"))} label="Contacts in this section" />
                    </div>
                    <SummaryBlock text={a.justification_summary} wordTarget="~500 words" />
                  </Section>
                </div>

                {/* Business Outcomes */}
                <div id="outcomes" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Business Outcomes Desired">
                    <div className="mb-4">
                      <ContactsTable contacts={contacts.filter(c => c.context?.toLowerCase().includes("outcome"))} label="Contacts in this section" />
                    </div>
                    <div className="mb-6">
                      <SummaryBlock text={a.outcomes_summary} wordTarget="~500 words" />
                    </div>
                    {a.outcomes_raw?.length > 0 && (
                      <DataTable
                        data={a.outcomes_raw}
                        columns={[
                          { key: "outcome", label: "Outcome" },
                          { key: "metric", label: "Metric" },
                          { key: "target", label: "Target" },
                        ]}
                      />
                    )}
                  </Section>
                </div>

                {/* Project Management */}
                <div id="management" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Project Management">
                    <SummaryBlock text={a.project_mgmt_summary} wordTarget="~200 words" />
                  </Section>
                </div>

                {/* Complexity */}
                <div id="complexity" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Initial Complexity Assessment">
                    <div className="mb-6">
                      <SummaryBlock text={a.complexity_summary} wordTarget="~200 words" />
                    </div>
                    {a.complexity_raw?.length > 0 && (
                      <DataTable
                        data={a.complexity_raw}
                        columns={[
                          { key: "dimension", label: "Dimension" },
                          { key: "score", label: "Score" },
                          { key: "rationale", label: "Rationale" },
                        ]}
                      />
                    )}
                  </Section>
                </div>

                {/* Funding */}
                <div id="funding" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Funding">
                    <div className="mb-6">
                      <SummaryBlock text={a.funding_summary} wordTarget="~200 words" />
                    </div>
                    {a.rom_estimate?.length > 0 && (
                      <>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Rough Order of Magnitude (ROM) Estimate</p>
                        <DataTable
                          data={a.rom_estimate}
                          columns={[
                            { key: "category", label: "Category" },
                            { key: "amount", label: "Amount" },
                            { key: "notes", label: "Notes" },
                          ]}
                        />
                      </>
                    )}
                    {a.funding_raw?.funding_sources?.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-medium">Funding Sources</p>
                        <DataTable
                          data={a.funding_raw.funding_sources}
                          columns={[
                            { key: "source", label: "Source" },
                            { key: "amount", label: "Amount" },
                            { key: "fiscal_year", label: "Fiscal Year" },
                          ]}
                        />
                      </div>
                    )}
                  </Section>
                </div>

                {/* CDT Use Only */}
                <div id="dot" className="bg-white rounded-xl border border-gray-200 p-6 mb-6 scroll-mt-28">
                  <Section title="Department of Technology Use Only">
                    {a.dot_dates?.length > 0 ? (
                      <DataTable
                        data={a.dot_dates}
                        columns={[
                          { key: "label", label: "Field" },
                          { key: "date", label: "Date" },
                        ]}
                      />
                    ) : (
                      <p className="text-gray-400 text-sm italic">No dates extracted</p>
                    )}
                  </Section>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
