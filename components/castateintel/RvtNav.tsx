// components/castateintel/RvtNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const T = {
  bg: '#0f172a', border: '#1e293b', accent: '#00d992',
  accentDim: 'rgba(0,217,146,0.12)', ink: '#f0f0f0', mute: '#94a3b8',
  font: '"Inter", system-ui, sans-serif',
};

const ROW1 = [
  { label: 'PAL Docs',            href: '/CAStateIntel/pal' },
  { label: 'BCP Docs',            href: '/CAStateIntel/bcp' },
  { label: 'Contract Award Data', href: '/CAStateIntel/contracts' },
];

const ROW2 = [
  { label: 'Dashboard',                  href: '/CAStateIntel' },
  { label: 'All Contacts',              href: '/CAStateIntel/contacts' },
  { label: 'All PAL Docs',              href: '/CAStateIntel/documents' },
  { label: 'All Ancillary Procurements',href: '/CAStateIntel/procurements' },
  { label: 'Upload',                     href: '/CAStateIntel/upload' },
];

export default function RvtNav() {
  const path = usePathname();

  const palPaths = ['/CAStateIntel/pal', '/CAStateIntel/stage1', '/CAStateIntel/stage2', '/CAStateIntel/stage3', '/CAStateIntel/stage4', '/CAStateIntel/contacts', '/CAStateIntel/documents', '/CAStateIntel/procurements', '/CAStateIntel/upload', '/CAStateIntel/project', '/CAStateIntel'];

  function linkStyle(href: string, exact = false) {
    let active: boolean;
    if (href === '/CAStateIntel/pal') {
      active = palPaths.some(p => path === p || path.startsWith(p + '/'));
    } else if (exact) {
      active = path === href;
    } else {
      active = path === href || (href !== '/CAStateIntel' && path.startsWith(href));
    }
    return {
      padding: '7px 14px', fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? T.accent : T.mute,
      background: active ? T.accentDim : 'transparent',
      textDecoration: 'none', whiteSpace: 'nowrap' as const,
      borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
      display: 'inline-block',
    };
  }

  return (
    <div style={{ background: T.bg, fontFamily: T.font, position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Title + doc-type tabs on one line */}
      <div style={{ padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
        <Link href="/CAStateIntel" style={{ textDecoration: 'none', padding: '12px 0' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
            State of CA{' '}
            <span style={{ color: '#64748b', fontWeight: 300 }}>—</span>{' '}
            <span style={{ color: T.accent }}>Procurement Intelligence</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {ROW1.map(l => (
            <Link key={l.href} href={l.href} style={linkStyle(l.href)}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      {/* Row 2 — Dashboard | All Contacts | All PAL Docs | All Ancillary Procurements | Upload */}
      <div style={{ padding: '0 40px', display: 'flex', alignItems: 'center', gap: 2, borderBottom: `1px solid ${T.border}` }}>
        {ROW2.map(l => (
          <Link key={l.href} href={l.href} style={linkStyle(l.href, l.href === '/CAStateIntel')}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
