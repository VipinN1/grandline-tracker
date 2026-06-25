import { useNavigate } from 'react-router-dom'
import { colors, radius, shadow, font, eyebrow, btnPrimary, btnGhost } from '../theme'

const FEATURES = [
  { icon: '🃏', title: 'Deck Builder', accent: colors.ocean, body: 'Full card search with filters. Build any deck and export the list.', cta: 'Try Deck Builder →', to: '/deck-builder' },
  { icon: '🏆', title: 'Track Your Tournaments', accent: colors.emerald, body: 'Log event results round by round and build a complete history with win-rate and matchup stats.', cta: 'Track a Tournament →', to: '/log' },
  { icon: '💬', title: 'Community', accent: colors.ocean, body: 'Browse decklists, tournament reports, and meta discussion. Sign in to post.', cta: 'Browse Posts →', to: '/community' },
  { icon: '🏪', title: 'Marketplace', accent: colors.ocean, body: 'Browse card listings with price and condition filters. Sign in to buy or sell.', cta: 'Browse Market →', to: '/marketplace' },
]

function FeatureCard({ icon, title, body, cta, to, accent, navigate }) {
  return (
    <div
      className="gl-lift"
      style={{
        position: 'relative',
        background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`,
        border: `1px solid ${colors.line}`,
        borderRadius: radius.lg,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: shadow.md,
        overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = colors.goldLine; e.currentTarget.style.boxShadow = shadow.hover }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = colors.line; e.currentTarget.style.boxShadow = shadow.md }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontFamily: font.display, fontSize: 17, fontWeight: 600, color: colors.text }}>{title}</div>
      <div style={{ fontSize: 13, color: colors.muted, lineHeight: 1.55, flex: 1 }}>{body}</div>
      <button
        onClick={() => navigate(to)}
        className="gl-btn"
        style={{ marginTop: 6, padding: '9px 16px', borderRadius: radius.sm, border: `1px solid ${colors.lineStrong}`, background: 'rgba(140,176,208,0.05)', color: colors.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}
      >
        {cta}
      </button>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="gl-page-enter" style={{ maxWidth: 760, margin: '0 auto', paddingTop: '2.5rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ ...eyebrow, fontSize: 11.5, letterSpacing: '2px', marginBottom: 14 }}>
          ⚓ One Piece Card Game Tracker
        </div>
        <div style={{ fontFamily: font.display, fontSize: 'clamp(38px, 7vw, 52px)', fontWeight: 600, color: colors.text, letterSpacing: '-1px', lineHeight: 1.08, marginBottom: 16 }}>
          Chart Your Course<br />Through the <span style={{ color: colors.gold }}>Grand Line</span>
        </div>
        <div style={{ fontSize: 15.5, color: colors.muted, maxWidth: 500, margin: '0 auto', lineHeight: 1.65 }}>
          Build decks, browse the community, track your tournaments, and explore the card marketplace — no account needed to set sail.
        </div>
      </div>

      {/* Free features */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ ...eyebrow, color: colors.emerald, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.emerald, boxShadow: `0 0 8px ${colors.emerald}` }} />
          Free — no account required
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} navigate={navigate} />)}
        </div>
      </div>

      {/* Auth CTA */}
      <div style={{ position: 'relative', background: `linear-gradient(135deg, rgba(47,125,163,0.12), rgba(18,127,118,0.08))`, border: `1px solid ${colors.goldLine}`, borderRadius: radius.lg, padding: 28, overflow: 'hidden', boxShadow: shadow.md }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(400px 200px at 90% -20%, rgba(220,179,94,0.10), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 600, color: colors.text, marginBottom: 8 }}>Unlock everything with a free account</div>
        <div style={{ fontSize: 13.5, color: colors.muted, marginBottom: 20, lineHeight: 1.6 }}>
          Tournament history · Saved decklists · Post in Community · Message sellers · Friends & profiles
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/signup')} className="gl-btn" style={{ ...btnPrimary, padding: '11px 24px', fontSize: 14 }}>
            Sign Up Free
          </button>
          <button onClick={() => navigate('/login')} className="gl-btn" style={{ ...btnGhost, padding: '11px 24px', fontSize: 14 }}>
            Log In
          </button>
        </div>
      </div>
    </div>
  )
}
