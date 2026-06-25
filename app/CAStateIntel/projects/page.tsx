'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/CAStateIntel/pal'); }, [router]);
  return <div style={{minHeight:'100vh',background:'#0d0d0d',display:'flex',alignItems:'center',justifyContent:'center',color:'#aaa'}}>Redirecting…</div>;
}
