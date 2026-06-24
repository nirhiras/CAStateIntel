// app/api/castateintel/calendar-events/route.ts
// Aggregates key dates from S1/S2/S3 analysis into calendar events

import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectNumber = searchParams.get("project");

  const projectFilter = projectNumber ? `AND p.project_number = '${projectNumber.replace(/'/g,"''")}'` : "";

  try {
    const events: {
      project_number: string; project_name: string;
      date: string; label: string; stage: number; type: string;
    }[] = [];

    // S1: Execution Start + Form Accepted dates
    const s1 = await db.query(`
      SELECT p.project_number, p.name,
        s1.proposed_execution_start,
        s1.dot_dates
      FROM castateintel.pal_stage1_analysis s1
      JOIN castateintel.pal_projects p ON s1.project_id = p.id
      WHERE 1=1 ${projectFilter}
    `);
    s1.rows.forEach(r => {
      if (r.proposed_execution_start) {
        events.push({ project_number: r.project_number, project_name: r.name,
          date: r.proposed_execution_start, label: "Execution Start", stage: 1, type: "execution_start" });
      }
      (r.dot_dates || []).forEach((d: { label: string; date: string }) => {
        const lbl = (d.label || "").toLowerCase();
        if (lbl.includes("accept") || lbl.includes("approv") || lbl.includes("received")) {
          events.push({ project_number: r.project_number, project_name: r.name,
            date: d.date, label: d.label, stage: 1, type: "form_accepted" });
        }
      });
    });

    // S2: Estimated project start + end from milestones/planning
    const s2 = await db.query(`
      SELECT p.project_number, p.name,
        s2.project_planning_raw,
        s2.dot_dates
      FROM castateintel.pal_stage2_analysis s2
      JOIN castateintel.pal_projects p ON s2.project_id = p.id
      WHERE 1=1 ${projectFilter}
    `);
    s2.rows.forEach(r => {
      const planning = r.project_planning_raw || {};
      const milestones = planning.milestones || [];
      milestones.forEach((m: { milestone: string; date: string }) => {
        const ml = (m.milestone || "").toLowerCase();
        if (ml.includes("start") || ml.includes("kick") || ml.includes("initiat")) {
          events.push({ project_number: r.project_number, project_name: r.name,
            date: m.date, label: `Est. Start — ${m.milestone}`, stage: 2, type: "project_start" });
        }
        if (ml.includes("end") || ml.includes("complet") || ml.includes("close") || ml.includes("go-live")) {
          events.push({ project_number: r.project_number, project_name: r.name,
            date: m.date, label: `Est. End — ${m.milestone}`, stage: 2, type: "project_end" });
        }
      });
      // Also check dot_dates for S2 accepted date
      (r.dot_dates || []).forEach((d: { label: string; date: string }) => {
        const lbl = (d.label || "").toLowerCase();
        if (lbl.includes("accept") || lbl.includes("approv")) {
          events.push({ project_number: r.project_number, project_name: r.name,
            date: d.date, label: d.label, stage: 2, type: "form_accepted" });
        }
      });
    });

    // S3: Ancillary procurement start dates + form accepted
    const s3 = await db.query(`
      SELECT p.project_number, p.name,
        s3.ancillary_procurements,
        s3.procurements_roadmap,
        s3.dot_dates
      FROM castateintel.pal_stage3_analysis s3
      JOIN castateintel.pal_projects p ON s3.project_id = p.id
      WHERE 1=1 ${projectFilter}
    `);
    s3.rows.forEach(r => {
      // Ancillary procurement timelines
      (r.ancillary_procurements || []).forEach((ap: { name: string; timeline: string; estimated_value: string }) => {
        if (ap.timeline) {
          // Try to parse a date from the timeline string
          const dateMatch = ap.timeline.match(/\d{4}/);
          if (dateMatch) {
            const monthMatch = ap.timeline.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
            const dateStr = monthMatch
              ? `${monthMatch[0]} 1 ${dateMatch[0]}`
              : `Jan 1 ${dateMatch[0]}`;
            events.push({ project_number: r.project_number, project_name: r.name,
              date: new Date(dateStr).toISOString().split("T")[0],
              label: ap.name, stage: 3, type: "ancillary" });
          } else {
            events.push({ project_number: r.project_number, project_name: r.name,
              date: ap.timeline, label: ap.name, stage: 3, type: "ancillary" });
          }
        }
      });
      // Roadmap phases start dates
      const phases = r.procurements_roadmap?.phases || [];
      phases.forEach((ph: { phase: string; start_date: string }) => {
        if (ph.start_date) {
          events.push({ project_number: r.project_number, project_name: r.name,
            date: ph.start_date, label: `${ph.phase} Start`, stage: 3, type: "procurement_start" });
        }
      });
      // S3 form accepted
      (r.dot_dates || []).forEach((d: { label: string; date: string }) => {
        const lbl = (d.label || "").toLowerCase();
        if (lbl.includes("accept") || lbl.includes("approv")) {
          events.push({ project_number: r.project_number, project_name: r.name,
            date: d.date, label: d.label, stage: 3, type: "form_accepted" });
        }
      });
    });

    // Filter out invalid/empty dates
    const validEvents = events.filter(e => e.date && e.date !== "null" && e.date.length > 3);

    return NextResponse.json({ events: validEvents, total: validEvents.length });
  } catch (error) {
    console.error("Calendar API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
