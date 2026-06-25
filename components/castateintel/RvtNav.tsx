// components/castateintel/RvtNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const T = {
  bg: '#0f172a', border: '#1e293b', accent: '#00d992',
  accentDim: 'rgba(0,217,146,0.12)', ink: '#f0f0f0', mute: '#94a3b8',
  font: '"Inter", system-ui, sans-serif',
};

const NAV = [
  { label: 'Dashboard',           href: '/CAStateIntel' },
  { label: 'PAL Projects',        href: '/CAStateIntel/pal' },
  { label: 'BCP Documents',       href: '/CAStateIntel/bcp' },
  { label: 'Contract Award Data', href: '/CAStateIntel/contracts' },
];

export default function RvtNav() {
  const path = usePathname();
  return (
    <div style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, fontFamily: T.font, position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Row 1 — bold title */}
      <div style={{ padding: '10px 40px 0', display: 'flex', alignItems: 'center' }}>
        <Link href="/CAStateIntel" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: '-0.2px' }}>
            State of CA{' '}
            <span style={{ color: '#64748b', fontWeight: 300 }}>—</span>{' '}
            <span style={{ color: T.accent }}>Procurement Intelligence</span>
          </span>
        </Link>
      </div>
      {/* Row 2 — nav links */}
      <div style={{ padding: '0 40px', display: 'flex', alignItems: 'center', gap: 2 }}>
        {NAV.map(l => {
          const active = path === l.href || (l.href !== '/CAStateIntel' && path.startsWith(l.href));
          return (
            <Link key={l.href} href={l.href} style={{
              padding: '8px 14px', fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? T.accent : T.mute,
              background: active ? T.accentDim : 'transparent',
              textDecoration: 'none', whiteSpace: 'nowrap',
              borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
              display: 'inline-block',
            }}>
              {l.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
