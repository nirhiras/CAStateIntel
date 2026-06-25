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
  { label: 'Dashboard',          href: '/CAStateIntel' },
  { label: 'PAL Projects',       href: '/CAStateIntel/pal' },
  { label: 'BCP Documents',      href: '/CAStateIntel/bcp' },
  { label: 'Contract Award Data',href: '/CAStateIntel/contracts' },
];

export default function RvtNav() {
  const path = usePathname();
  return (
    <nav style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, padding: '0 32px', fontFamily: T.font, display: 'flex', alignItems: 'center', height: 60, gap: 0, position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Bold title — no icon */}
      <Link href="/CAStateIntel" style={{ textDecoration: 'none', marginRight: 40, flexShrink: 0 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: '-0.3px', lineHeight: 1 }}>
          State of CA —{' '}
          <span style={{ color: T.accent }}>Procurement Intelligence</span>
        </span>
      </Link>
      {/* Nav links */}
      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {NAV.map(l => {
          const active = path === l.href || (l.href !== '/CAStateIntel' && path.startsWith(l.href));
          return (
            <Link key={l.href} href={l.href} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? T.accent : T.mute, background: active ? T.accentDim : 'transparent',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}>
              {l.label}
            </Link>
          );
        })}
      </div>
      {/* Upload button */}
      <Link href="/CAStateIntel/upload" style={{ padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: T.accent, color: '#0d0d0d', textDecoration: 'none', flexShrink: 0 }}>
        + Upload PDF
      </Link>
    </nav>
  );
}
