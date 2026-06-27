'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const T = {
  canvas: '#0d0d0d', surface: '#161616', border: '#2a2a2a',
  accent: '#00d992', accentDim: 'rgba(0,217,146,0.12)',
  ink: '#f0f0f0', mute: '#cccccc', faint: '#aaaaaa',
  font: '"Inter",system-ui,sans-serif', mono: '"SF Mono","Fira Code",monospace',
};

type ContactDetail = {
  contact_id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  organization: string;
  role_type: string;
  ai_email?: string;
  ai_phone?: string;
  ai_background?: string;
  ai_prior_roles?: string;
  ai_education?: string;
  ai_technical_skills?: string;
  ai_linkedin_url?: string;
  ai_enrichment_notes?: string;
  ai_enrichment_source?: string;
  ai_enriched_at?: string;
};

type ContactInstance = {
  contact_id: string;
  project_id: string;
  project_number: string;
  project_name: string;
  stage: number;
  title: string;
  role_type: string;
  email: string;
  phone: string;
  context: string;
  doc_label: string;
  doc_created_date: string;
};

export default function ContactDetailPage({ params }: { params: { name: string } }) {
  const searchParams = useSearchParams();
  const organization = searchParams.get('org') || '';
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [instances, setInstances] = useState<ContactInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const decodedName = decodeURIComponent(params.name);

  useEffect(() => {
    const fetchContactDetail = async () => {
      try {
        const response = await fetch(
          `/api/castateintel/contacts/detail?name=${encodeURIComponent(decodedName)}&organization=${encodeURIComponent(organization)}`
        );
        const data = await response.json();

        if (response.ok) {
          setContact(data.contact);
          setInstances(data.instances || []);
        } else {
          setError(data.error || 'Failed to fetch contact');
        }
      } catch (err) {
        setError(`Failed to fetch contact: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    if (organization) {
      fetchContactDetail();
    }
  }, [decodedName, organization]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.canvas, color: T.ink, fontFamily: T.font, padding: '40px' }}>
        <div style={{ textAlign: 'center', color: T.mute }}>Loading contact details...</div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div style={{ minHeight: '100vh', background: T.canvas, color: T.ink, fontFamily: T.font, padding: '40px' }}>
        <div style={{ color: '#ef4444' }}>Error: {error || 'Contact not found'}</div>
        <a href="/CAStateIntel/contacts" style={{ color: T.accent, textDecoration: 'none', marginTop: '16px', display: 'inline-block' }}>
          ← Back to Contacts
        </a>
      </div>
    );
  }

  const Badge = ({ color, label }: { color: string; label: string }) => (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: 3,
      background: `${color}15`,
      color: color,
      border: `1px solid ${color}50`,
      marginLeft: 6,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );

  const FieldRow = ({ label, value, isEnriched, isEmail }: { label: string; value?: string; isEnriched?: boolean; isEmail?: boolean }) => (
    <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {value ? (
          <>
            {isEmail ? (
              <a href={`mailto:${value}`} style={{ color: T.accent, textDecoration: 'none', wordBreak: 'break-all' }}>
                {value}
              </a>
            ) : (
              <span style={{ color: T.ink, wordBreak: 'break-all' }}>{value}</span>
            )}
            {isEnriched && <Badge color="#22c55e" label="AI" />}
          </>
        ) : (
          <span style={{ color: T.faint }}>—</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.canvas, color: T.ink, fontFamily: T.font, paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: '24px 32px' }}>
        <a href="/CAStateIntel/contacts" style={{ color: T.accent, textDecoration: 'none', fontSize: 13, marginBottom: 12, display: 'inline-block' }}>
          ← Back to Contacts
        </a>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: T.ink, margin: 0, marginTop: 12 }}>{contact.name}</h1>
        <div style={{ fontSize: 13, color: T.mute, marginTop: 6 }}>{contact.organization}</div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '32px', maxWidth: 1200 }}>
        {/* Primary Contact Info */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.accent, marginTop: 0, marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Contact Information
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {/* Left Column */}
            <div>
              <FieldRow label="Title" value={contact.title} />
              <FieldRow label="Role Type" value={contact.role_type} />

              {/* Email Field - Merged */}
              <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Email Address
                </div>
                {contact.email && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>Original:</div>
                    <a href={`mailto:${contact.email}`} style={{ color: T.mute, textDecoration: 'none', fontSize: 13, wordBreak: 'break-all' }}>
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.ai_email && (
                  <div>
                    <div style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>AI Enriched:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <a href={`mailto:${contact.ai_email}`} style={{ color: '#22c55e', textDecoration: 'none', fontSize: 13, wordBreak: 'break-all' }}>
                        {contact.ai_email}
                      </a>
                      <Badge color="#22c55e" label="AI" />
                    </div>
                  </div>
                )}
                {!contact.email && !contact.ai_email && <span style={{ color: T.faint }}>—</span>}
              </div>

              {/* Phone Field - Merged */}
              <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.mute, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Phone Number
                </div>
                {contact.phone && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>Original:</div>
                    <span style={{ color: T.mute, fontSize: 13 }}>{contact.phone}</span>
                  </div>
                )}
                {contact.ai_phone && (
                  <div>
                    <div style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>AI Enriched:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#22c55e', fontSize: 13 }}>{contact.ai_phone}</span>
                      <Badge color="#22c55e" label="AI" />
                    </div>
                  </div>
                )}
                {!contact.phone && !contact.ai_phone && <span style={{ color: T.faint }}>—</span>}
              </div>
            </div>

            {/* Right Column */}
            <div>
              <FieldRow label="Background" value={contact.ai_background} isEnriched={!!contact.ai_background} />
              <FieldRow label="Prior Roles" value={contact.ai_prior_roles} isEnriched={!!contact.ai_prior_roles} />
              <FieldRow label="Education" value={contact.ai_education} isEnriched={!!contact.ai_education} />
            </div>
          </div>

          <div style={{ marginTop: 32 }}>
            <FieldRow label="Technical Skills" value={contact.ai_technical_skills} isEnriched={!!contact.ai_technical_skills} />
            {contact.ai_linkedin_url && <FieldRow label="LinkedIn" value={contact.ai_linkedin_url} isEmail isEnriched={!!contact.ai_linkedin_url} />}
            {contact.ai_enrichment_notes && <FieldRow label="Enrichment Notes" value={contact.ai_enrichment_notes} isEnriched />}
          </div>

          {contact.ai_enriched_at && (
            <div style={{ marginTop: 16, fontSize: 12, color: T.faint }}>
              Enriched on {new Date(contact.ai_enriched_at).toLocaleDateString()} · Source: {contact.ai_enrichment_source}
            </div>
          )}
        </div>

        {/* Contact Instances */}
        {instances.length > 0 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.accent, marginTop: 0, marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Appearances ({instances.length})
            </h2>

            <div style={{ display: 'grid', gap: 16 }}>
              {instances.map((instance, idx) => (
                <div
                  key={idx}
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                    <div>
                      <a href={`/CAStateIntel/stage${instance.stage}?project=${instance.project_number}&tab=overview`}
                        style={{ color: T.accent, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                        {instance.project_number} · {instance.project_name}
                      </a>
                      <div style={{ fontSize: 12, color: T.mute, marginTop: 4 }}>
                        Stage {instance.stage} · {instance.doc_label || 'Document'}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: T.faint, textAlign: 'right' }}>
                      {instance.doc_created_date && new Date(instance.doc_created_date).toLocaleDateString()}
                    </div>
                  </div>

                  {instance.title && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: T.faint, marginBottom: 2 }}>Title</div>
                      <div style={{ fontSize: 13, color: T.ink }}>{instance.title}</div>
                    </div>
                  )}

                  {instance.role_type && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: T.faint, marginBottom: 2 }}>Role</div>
                      <div style={{ fontSize: 13, color: T.ink }}>{instance.role_type}</div>
                    </div>
                  )}

                  {instance.context && (
                    <div>
                      <div style={{ fontSize: 11, color: T.faint, marginBottom: 6 }}>Context</div>
                      <div style={{ fontSize: 13, color: T.mute, lineHeight: 1.5, maxHeight: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {instance.context}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
