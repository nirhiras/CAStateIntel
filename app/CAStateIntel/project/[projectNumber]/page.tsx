"use client";
import { use } from "react";
import ProjectSummaryInline from "@/components/castateintel/ProjectSummaryInline";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Inner({ projectNumber }: { projectNumber: string }) {
  return <ProjectSummaryInline defaultProject={projectNumber} defaultTab="overview" />;
}

export default function ProjectSummaryPage({ params }: { params: Promise<{ projectNumber: string }> }) {
  const { projectNumber } = use(params);
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>}>
      <Inner projectNumber={projectNumber} />
    </Suspense>
  );
}
