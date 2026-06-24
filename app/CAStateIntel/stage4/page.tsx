"use client";
// app/CAStateIntel/stage4/page.tsx
// Renders full project summary with Stage 4 tab pre-selected

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ProjectSummaryInline from "@/components/castateintel/ProjectSummaryInline";

function Stage4Inner() {
  const searchParams = useSearchParams();
  const projectNumber = searchParams.get("project") || "";
  return <ProjectSummaryInline defaultTab="s4" defaultProject={projectNumber} />;
}

export default function Stage4Page() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>}><Stage4Inner /></Suspense>;
}
