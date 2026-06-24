"use client";
// app/CAStateIntel/stage3/page.tsx
// Renders full project summary with Stage 3 tab pre-selected

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ProjectSummaryInline from "@/components/castateintel/ProjectSummaryInline";

function Stage3Inner() {
  const searchParams = useSearchParams();
  const projectNumber = searchParams.get("project") || "";
  return <ProjectSummaryInline defaultTab="s3" defaultProject={projectNumber} />;
}

export default function Stage3Page() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>}><Stage3Inner /></Suspense>;
}
