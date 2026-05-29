import { useNavigate } from 'react-router-dom'

const CARD_STYLE = {
  background: 'rgba(139,92,246,0.05)',
  border: '1px solid rgba(139,92,246,0.14)',
  borderRadius: 14,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

export default function Home() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingTop: '3rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.6px', color: '#8b5cf6', marginBottom: 10 }}>
          One Piece Card Game Tracker
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#f0f2f5', letterSpacing: '-0.8px', lineHeight: 1.15, marginBottom: 12 }}>
          Pirate<span style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Tracker</span>
        </div>
        <div style={{ fontSize: 15, color: '#7c6fa0', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
          Build decks, track live tournaments, and log your results — no account needed to get started.
        </div>
      </div>

      {/* Free features */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#34d399', marginBottom: 14 }}>
          Free — no account required
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={CARD_STYLE}>
            <div style={{ fontSize: 22 }}>🃏</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Deck Builder</div>
            <div style={{ fontSize: 13, color: '#7c6fa0', lineHeight: 1.5 }}>
              Full card search with filters. Build any deck and export the list.
            </div>
            <button
              onClick={() => navigate('/deck-builder')}
              style={{ marginTop: 4, padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}
            >
              Try Deck Builder →
            </button>
          </div>

          <div style={CARD_STYLE}>
            <div style={{ fontSize: 22 }}>🏆</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>Live Tournament</div>
            <div style={{ fontSize: 13, color: '#7c6fa0', lineHeight: 1.5 }}>
              Track rounds in real time during your next event. One session per visit.
            </div>
            <button
              onClick={() => navigate('/live')}
              style={{ marginTop: 4, padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34d399', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}
            >
              Start Live →
            </button>
          </div>
        </div>
      </div>

      {/* Auth CTA */}
      <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(139,92,246,0.16)', borderRadius: 14, padding: 24, marginTop: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5', marginBottom: 6 }}>Unlock everything with a free account</div>
        <div style={{ fontSize: 13, color: '#7c6fa0', marginBottom: 18, lineHeight: 1.6 }}>
          Tournament history · Saved decklists · Friends & profiles · Community feed · Card marketplace
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/signup')}
            style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign Up Free
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.25)', background: 'transparent', color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  )
}
