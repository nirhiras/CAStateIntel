// components/castateintel/RvtNav.tsx — inline styles only
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const T = { canvas:'#0d0d0d', surface:'#161616', border:'#2a2a2a', accent:'#00d992', accentDim:'rgba(0,217,146,0.12)', mute:'#bbb', ink:'#f0f0f0', font:'"Inter", system-ui, sans-serif' };

const NAV = [
  { label:'Dashboard',    href:'/CAStateIntel' },
  { label:'Contacts',     href:'/CAStateIntel/contacts' },
  { label:'Documents',    href:'/CAStateIntel/documents' },
  { label:'Procurements', href:'/CAStateIntel/procurements' },
];

export default function RvtNav() {
  const path = usePathname();
  return (
    <nav style={{ position:'sticky', top:0, zIndex:100, background:T.canvas, borderBottom:`1px solid ${T.border}`, height:56, display:'flex', alignItems:'center', padding:'0 32px', fontFamily:T.font }}>
      <Link href="/CAStateIntel" style={{ display:'flex', alignItems:'center', gap:8, marginRight:36, textDecoration:'none' }}>
        <div style={{ width:28, height:28, borderRadius:6, background:T.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2h6a3 3 0 010 6H5l4 4" stroke="#0d0d0d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span style={{ color:T.ink, fontWeight:600, fontSize:15 }}>CA State Intel</span>
      </Link>
      <div style={{ display:'flex', gap:2, flex:1 }}>
        {NAV.map(l => {
          const active = path === l.href || (l.href !== '/CAStateIntel' && path.startsWith(l.href));
          return (
            <Link key={l.href} href={l.href} style={{ padding:'6px 12px', borderRadius:6, fontSize:14, fontWeight:active?600:400, color:active?T.accent:T.mute, background:active?T.accentDim:'transparent', textDecoration:'none' }}>
              {l.label}
            </Link>
          );
        })}
      </div>
      <Link href="/CAStateIntel/upload" style={{ padding:'7px 16px', borderRadius:6, fontSize:13, fontWeight:600, background:T.accent, color:T.canvas, textDecoration:'none' }}>
        + Upload PDF
      </Link>
    </nav>
  );
}
