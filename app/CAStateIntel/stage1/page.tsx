"use client";
// app/CAStateIntel/stage1/page.tsx
// Renders full project summary with Stage 1 tab pre-selected

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ProjectSummaryInline from "@/components/castateintel/ProjectSummaryInline";

function Stage1Inner() {
  const searchParams = useSearchParams();
  const projectNumber = searchParams.get("project") || "";
  return <ProjectSummaryInline defaultTab="s1" defaultProject={projectNumber} />;
}

export default function Stage1Page() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>}><Stage1Inner /></Suspense>;
}
