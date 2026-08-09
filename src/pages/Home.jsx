import { useNavigate } from 'react-router-dom'
import { colors, radius, font, btnPrimary, btnGhost } from '../theme'

const FEATURES = [
  { icon: '🃏', title: 'Deck Builder', body: 'Search the full card pool, build a 51-card deck, and export the list.', to: '/deck-builder' },
  { icon: '🏆', title: 'Tournament Log', body: 'Record round-by-round results and get win-rate and matchup breakdowns automatically.', to: '/log' },
  { icon: '💬', title: 'Community', body: 'Decklists, tournament reports, and meta discussion from other players.', to: '/community' },
  { icon: '🏪', title: 'Marketplace', body: 'Buy and sell singles with price and condition filters.', to: '/marketplace' },
]

function FeatureRow({ icon, title, body, to, navigate, first, last }) {
  return (
    <div
      onClick={() => navigate(to)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') navigate(to) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 18px',
        borderTop: first ? 'none' : `1px solid ${colors.line}`,
        borderRadius: first ? `${radius.lg}px ${radius.lg}px 0 0` : last ? `0 0 ${radius.lg}px ${radius.lg}px` : 0,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = colors.surface2 }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: radius.md, background: colors.surface3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.text, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: colors.muted, lineHeight: 1.5 }}>{body}</div>
      </div>
      <div style={{ fontSize: 16, color: colors.faint, flexShrink: 0 }}>→</div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="gl-page-enter" style={{ maxWidth: 640, margin: '0 auto', paddingTop: '2.5rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: colors.muted, marginBottom: 14 }}>
          One Piece Card Game
        </div>
        <div style={{ fontFamily: font.display, fontSize: 'clamp(32px, 6vw, 42px)', fontWeight: 600, color: colors.text, letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 16 }}>
          Build decks, log matches,<br />and track the <span style={{ color: colors.gold }}>meta</span>.
        </div>
        <div style={{ fontSize: 15, color: colors.muted, maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
          A free toolkit for One Piece TCG players — deck builder, tournament tracker, community, and a card marketplace. No account needed to start.
        </div>
      </div>

      {/* Features */}
      <div style={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: radius.lg, marginBottom: 24 }}>
        {FEATURES.map((f, i) => (
          <FeatureRow key={f.title} {...f} navigate={navigate} first={i === 0} last={i === FEATURES.length - 1} />
        ))}
      </div>

      {/* Auth CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', border: `1px solid ${colors.line}`, borderRadius: radius.lg, padding: '18px 20px' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 3 }}>Want to save your progress?</div>
          <div style={{ fontSize: 12.5, color: colors.muted }}>
            Create a free account for tournament history, saved decklists, and messaging.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={() => navigate('/signup')} className="gl-btn" style={{ ...btnPrimary, padding: '9px 18px', fontSize: 13 }}>
            Sign Up
          </button>
          <button onClick={() => navigate('/login')} className="gl-btn" style={{ ...btnGhost, padding: '9px 18px', fontSize: 13 }}>
            Log In
          </button>
        </div>
      </div>
    </div>
  )
}
