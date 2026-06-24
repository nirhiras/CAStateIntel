// components/castateintel/RvtNav.tsx
// Global navigation — Revolut design system
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Dashboard',    href: '/CAStateIntel' },
  { label: 'Contacts',     href: '/CAStateIntel/contacts' },
  { label: 'Documents',    href: '/CAStateIntel/documents' },
  { label: 'Procurements', href: '/CAStateIntel/procurements' },
  { label: 'Upload',       href: '/CAStateIntel/upload' },
];

export default function RvtNav() {
  const path = usePathname();

  return (
    <nav className="rvt-nav px-6 md:px-10" style={{ gap: 0 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 0 }}>

        {/* Wordmark */}
        <Link href="/CAStateIntel" style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 40, textDecoration: 'none' }}>
          {/* Brand glyph — cobalt violet stamp */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#494fdf"/>
            <path d="M8 8h8a4 4 0 0 1 0 8h-4l5 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{
            color: '#ffffff', fontWeight: 500, fontSize: 16,
            letterSpacing: '-0.2px', lineHeight: 1,
          }}>
            CA State Intel
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = path === item.href || (item.href !== '/CAStateIntel' && path.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s',
                letterSpacing: '0.24px',
              }}
                onMouseEnter={e => { if (!active) (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.9)'; }}
                onMouseLeave={e => { if (!active) (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right side CTA */}
        <Link href="/CAStateIntel/upload" className="btn btn-primary" style={{ height: 40, padding: '0 20px', fontSize: 14 }}>
          + Upload PDF
        </Link>
      </div>
    </nav>
  );
}
