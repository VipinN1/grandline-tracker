const SECTION = {
  background: 'rgba(139,92,246,0.05)',
  border: '1px solid rgba(139,92,246,0.14)',
  borderRadius: 14,
  padding: 24,
  marginBottom: 18,
}

const EYEBROW = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1.2px',
  color: '#8b5cf6',
  marginBottom: 12,
}

const FEATURES = [
  { icon: '🃏', label: 'Deck Builder', desc: 'Full card search and filters, build any deck and export the list.' },
  { icon: '🏆', label: 'Tournaments', desc: 'Run real Swiss events with live pairings, standings, and match reporting.' },
  { icon: '☠', label: 'Bounty Board', desc: 'Earn your bounty from real wins, losses, and placements. Climb the ranks.' },
  { icon: '🏪', label: 'Marketplace', desc: 'Browse, buy, and sell singles with price and condition filters.' },
  { icon: '💬', label: 'Community', desc: 'Share decklists, tournament reports, and meta discussion.' },
  { icon: '📷', label: 'Card Scanner', desc: 'Scan your physical cards to add them fast.' },
]

const CREW = [
  { name: 'Vipin', role: 'Original Creator' },
  { name: 'Weston', role: 'Co-Developer' },
]

export default function About() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: '2.5rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.6px', color: '#8b5cf6', marginBottom: 10 }}>
          About
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, color: '#f0f2f5', letterSpacing: '-0.8px', lineHeight: 1.15, marginBottom: 12 }}>
          Pirate<span style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Tracker</span>
        </div>
        <div style={{ fontSize: 15, color: '#7c6fa0', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
          The all-in-one companion for the One Piece Card Game — built by players, for players.
        </div>
      </div>

      {/* What it is */}
      <div style={SECTION}>
        <div style={EYEBROW}>What is this?</div>
        <div style={{ fontSize: 14, color: '#b8add4', lineHeight: 1.7 }}>
          PirateTracker brings everything an OPTCG player needs into one place. Build and save your
          decks, run and play in live tournaments, track your competitive bounty as you win,
          buy and sell singles on the marketplace, and talk meta with the community, all themed
          around the world of One Piece. No account is needed to get started, and the core tools
          stay free.
        </div>
      </div>

      {/* Features */}
      <div style={SECTION}>
        <div style={EYEBROW}>What you can do</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {FEATURES.map(f => (
            <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 20 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f2f5' }}>{f.label}</div>
              <div style={{ fontSize: 12.5, color: '#7c6fa0', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Who we are */}
      <div style={SECTION}>
        <div style={EYEBROW}>Who we are</div>
        <div style={{ fontSize: 14, color: '#b8add4', lineHeight: 1.7, marginBottom: 18 }}>
          PirateTracker is an independent project built and maintained by a small crew of One Piece
          Card Game fans who wanted better tools for their local scene and ended up building them
          for everyone.
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {CREW.map(m => (
            <div key={m.name} style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(139,92,246,0.16)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {m.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f2f5' }}>{m.name}</div>
                <div style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600 }}>{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Credits */}
      <div style={{ textAlign: 'center', padding: '24px 16px 48px', color: '#7c6fa0', fontSize: 13, lineHeight: 1.7 }}>
        <div style={{ marginBottom: 4 }}>
          Card data and images are powered by the <strong style={{ color: '#a78bfa' }}>OPTCG API</strong>.
        </div>
        <div>
          Huge thanks to its creator <strong style={{ color: '#f0f2f5' }}>DomoBot</strong> (Discord:{' '}
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>DomoBot</span>) for making it available.
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: '#4a5068' }}>
          One Piece and all related characters are property of their respective owners. PirateTracker
          is an unofficial, fan-made project and is not affiliated with or endorsed by Bandai or
          Eiichiro Oda.
        </div>
      </div>
    </div>
  )
}
