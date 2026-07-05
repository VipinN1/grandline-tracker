import { PRIVACY_SECTIONS, LEGAL_UPDATED } from '../lib/legal'

const SECTION = {
  background: 'rgba(140,176,208,0.05)',
  border: '1px solid rgba(140,176,208,0.14)',
  borderRadius: 14,
  padding: 24,
  marginBottom: 18,
}

const EYEBROW = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1.4px',
  color: '#dcb35e',
  marginBottom: 12,
}

export default function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: '2.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, fontWeight: 600, color: '#e9f1f8', letterSpacing: '-0.6px', marginBottom: 10 }}>
          Privacy Policy
        </div>
        <div style={{ fontSize: 13, color: '#67809a' }}>Last updated: {LEGAL_UPDATED}</div>
      </div>
      {PRIVACY_SECTIONS.map(([title, paragraphs]) => (
        <div key={title} style={SECTION}>
          <div style={EYEBROW}>{title}</div>
          {paragraphs.map((p, i) => (
            <div key={i} style={{ fontSize: 14, color: '#c2d2e0', lineHeight: 1.7, marginTop: i > 0 ? 12 : 0 }}>{p}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
