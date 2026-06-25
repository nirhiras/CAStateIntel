"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ProjectSummaryInline from "@/components/castateintel/ProjectSummaryInline";

function Stage1Inner() {
  const searchParams = useSearchParams();
  const projectNumber = searchParams.get("project") || "";
  const tab = searchParams.get("tab") || "s1";
  return <ProjectSummaryInline defaultTab={tab} defaultProject={projectNumber} />;
}

export default function Stage1Page() {
  return <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0d0d0d",color:"#888"}}>Loading…</div>}><Stage1Inner /></Suspense>;
}
