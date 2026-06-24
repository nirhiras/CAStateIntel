"use client";
// app/CAStateIntel/calendar/page.tsx
// Calendar view of key PAL project dates across S1/S2/S3

import { useState, useEffect } from "react";

interface CalendarEvent {
  project_number: string;
  project_name: string;
  date: string;
  label: string;
  stage: number;
  type: "execution_start" | "form_accepted" | "project_start" | "project_end" | "procurement_start" | "ancillary";
}

interface ProjectOption { project_number: string; name: string; }

const EVENT_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  execution_start:  { bg: "bg-green-50",  border: "border-green-300",  text: "text-green-800",  dot: "bg-green-500"  },
  form_accepted:    { bg: "bg-blue-50",   border: "border-blue-300",   text: "text-blue-800",   dot: "bg-blue-500"   },
  project_start:    { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", dot: "bg-indigo-500" },
  project_end:      { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", dot: "bg-orange-500" },
  procurement_start:{ bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-800", dot: "bg-violet-500" },
  ancillary:        { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-800", dot: "bg-purple-500" },
};

const STAGE_LABELS: Record<number, string> = { 1: "S1BA", 2: "S2AA", 3: "S3SA" };
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch("/api/castateintel/projects")
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : data.projects || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectFilter) params.set("project", projectFilter);
    fetch(`/api/castateintel/calendar-events?${params}`)
      .then(r => r.json())
      .then(data => { setEvents(data.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectFilter]);

  const filtered = events.filter(e => {
    if (typeFilter && e.type !== typeFilter) return false;
    return true;
  });

  // Group events by year/month
  const byMonth: Record<string, CalendarEvent[]> = {};
  filtered.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(e);
  });

  // Build calendar grid for currentYear
  const calendarMonths = Array.from({ length: 12 }, (_, m) => {
    const key = `${currentYear}-${String(m).padStart(2,"0")}`;
    return { month: m, year: currentYear, events: byMonth[key] || [] };
  });

  // All years with events
  const yearsWithEvents = [...new Set(
    filtered.map(e => e.date ? new Date(e.date).getFullYear() : null).filter(Boolean)
  )].sort() as number[];

  const typeOptions = [
    { value: "execution_start",   label: "S1 — Execution Start" },
    { value: "form_accepted",     label: "S1/S3 — Form Accepted" },
    { value: "project_start",     label: "S2 — Est. Project Start" },
    { value: "project_end",       label: "S2 — Est. Project End" },
    { value: "procurement_start", label: "S3 — Procurement Start" },
    { value: "ancillary",         label: "S3 — Ancillary Procurement" },
  ];

  const sortedEvents = [...filtered]
    .filter(e => e.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-8 py-5">
        <div className="flex items-center gap-3 mb-2">
          <a href="/CAStateIntel" className="text-slate-300 hover:text-white text-sm">← Dashboard</a>
          <span className="text-slate-600">|</span>
          <h1 className="text-xl font-bold">📅 Project Calendar</h1>
        </div>
        <p className="text-slate-400 text-sm">Key dates from Stage 1, 2, and 3 analysis documents</p>
      </div>

      {/* Legend */}
      <div className="bg-white border-b px-8 py-3 flex flex-wrap gap-4 items-center">
        {typeOptions.map(t => {
          const s = EVENT_STYLES[t.value];
          return (
            <div key={t.value} className="flex items-center gap-1.5 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
              <span className="text-gray-600">{t.label}</span>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-8 py-3 flex flex-wrap gap-3 items-center">
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.project_number} value={p.project_number}>{p.project_number} — {p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500">
          <option value="">All Date Types</option>
          {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {viewMode === "calendar" && (
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentYear(y => y - 1)} className="px-2 py-1 rounded border text-sm hover:bg-gray-50">←</button>
            <span className="text-sm font-semibold text-gray-700">{currentYear}</span>
            <button onClick={() => setCurrentYear(y => y + 1)} className="px-2 py-1 rounded border text-sm hover:bg-gray-50">→</button>
            {yearsWithEvents.map(y => (
              <button key={y} onClick={() => setCurrentYear(y)}
                className={`px-2 py-0.5 rounded text-xs ${y === currentYear ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {y}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setViewMode("calendar")}
            className={`px-3 py-1.5 rounded text-xs font-medium ${viewMode === "calendar" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600"}`}>
            📅 Calendar
          </button>
          <button onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded text-xs font-medium ${viewMode === "list" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600"}`}>
            ☰ Timeline
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading calendar...</div>
        ) : viewMode === "calendar" ? (
          /* CALENDAR GRID */
          <div className="grid grid-cols-4 gap-4">
            {calendarMonths.map(({ month, year, events: monthEvents }) => (
              <div key={month} className={`bg-white rounded-xl border ${monthEvents.length > 0 ? "border-slate-300 shadow-sm" : "border-gray-100"} overflow-hidden`}>
                <div className={`px-3 py-2 flex items-center justify-between ${monthEvents.length > 0 ? "bg-slate-800 text-white" : "bg-gray-50 text-gray-400"}`}>
                  <span className="font-semibold text-sm">{MONTH_NAMES[month]}</span>
                  <span className="text-xs opacity-70">{year}</span>
                  {monthEvents.length > 0 && (
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{monthEvents.length}</span>
                  )}
                </div>
                <div className="p-2 space-y-1 min-h-[80px]">
                  {monthEvents.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-3">—</p>
                  ) : monthEvents.map((e, i) => {
                    const s = EVENT_STYLES[e.type] || EVENT_STYLES.form_accepted;
                    const d = new Date(e.date);
                    return (
                      <div key={i} className={`${s.bg} ${s.border} border rounded p-1.5 text-xs`}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                          <span className={`font-semibold ${s.text} text-xs`}>
                            {d.getDate()} — {e.label}
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs truncate">{e.project_number}</div>
                        <div className="text-gray-400 text-xs truncate">{e.project_name?.slice(0,30)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* TIMELINE LIST */
          <div className="space-y-2">
            {sortedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <p>No dated events found</p>
                <p className="text-sm mt-1">Extract Stage 1/2/3 to populate calendar dates</p>
              </div>
            ) : (
              sortedEvents.map((e, i) => {
                const s = EVENT_STYLES[e.type] || EVENT_STYLES.form_accepted;
                const d = new Date(e.date);
                const isValid = !isNaN(d.getTime());
                return (
                  <div key={i} className={`flex items-start gap-4 bg-white rounded-xl border ${s.border} p-4`}>
                    <div className={`${s.bg} rounded-lg p-3 text-center min-w-[60px]`}>
                      {isValid ? (
                        <>
                          <div className={`text-lg font-bold ${s.text}`}>{d.getDate()}</div>
                          <div className={`text-xs ${s.text} opacity-70`}>{MONTH_NAMES[d.getMonth()]} {d.getFullYear()}</div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">{e.date}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.bg} ${s.text} border ${s.border}`}>
                          {STAGE_LABELS[e.stage]} — {e.label}
                        </span>
                      </div>
                      <a href={`/CAStateIntel/stage${e.stage}?project=${e.project_number}`}
                        className="font-medium text-gray-900 text-sm hover:underline">
                        {e.project_name}
                      </a>
                      <div className="text-xs text-gray-400 mt-0.5">{e.project_number}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
