import { forwardRef } from 'react'
import { getProxiedCardImageUrl } from '../lib/optcgapi'

const TIER_META = {
  major:    { label: 'Major', icon: '🏆', color: '#dcb35e' },
  regional: { label: 'Regional', icon: '🥈', color: '#52a9cd' },
}

function cleanName(name) {
  if (!name) return ''
  return name.replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '').replace(/\s*\([^)]*\)$/, '').trim()
}

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function placementColor(n) {
  if (n === 1) return '#dcb35e'
  if (n === 2) return '#94a3b8'
  if (n === 3) return '#fb923c'
  return '#9db2c6'
}

// Off-screen (positioned outside the viewport, not display:none — html2canvas
// needs the node laid out) portrait card, rendered to a shareable PNG via
// captureAndShare(). Trimmed to the top 6 Regional/Major results so the
// image stays a reasonable, readable size — the live page shows the rest.
const TrophyCabinetShareCard = forwardRef(function TrophyCabinetShareCard(
  { profile, localsWins, localsEvents, legacyLocalsWins, prereleaseWins, bigResults, bestFinish, totalEvents },
  ref
) {
  if (!profile) return null

  const shown = (bigResults ?? []).slice(0, 6)
  const overflow = (bigResults?.length ?? 0) - shown.length
  const initials = (profile.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: '560px',
        background:
          'radial-gradient(ellipse 320px 280px at 0% 0%, rgba(200,162,74,0.20) 0%, transparent 60%),' +
          'radial-gradient(ellipse 220px 180px at 100% 100%, rgba(47,125,163,0.28) 0%, transparent 65%),' +
          '#06101b',
        border: '1px solid rgba(200,162,74,0.3)',
        borderRadius: '20px',
        padding: '28px',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        color: '#e9f1f8',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #1b4a66, #2f7da3)', border: '2px solid rgba(200,162,74,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#e9ddc4' }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#dcb35e', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>
            Trophy Cabinet
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e9f1f8', letterSpacing: '-0.4px', lineHeight: 1.1 }}>
            {profile.username}
          </div>
        </div>
      </div>

      {/* Locals win headline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: 'rgba(59,178,126,0.06)', border: '1px solid rgba(59,178,126,0.25)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 44 }}>🏅</div>
        <div>
          <div style={{ fontSize: 34, fontWeight: 700, fontFamily: '"Space Mono", "Courier New", monospace', color: '#3bb27e', lineHeight: 1 }}>{localsWins}</div>
          <div style={{ fontSize: 12, color: '#9db2c6', marginTop: 4 }}>
            Locals Wins · {localsEvents} events played
            {legacyLocalsWins > 0 && ` · ${legacyLocalsWins} before tracking`}
          </div>
        </div>
      </div>

      {/* Secondary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
        {[
          { label: 'Pre-Release Wins', value: `🎁 ${prereleaseWins ?? 0}` },
          { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—' },
          { label: 'Total Events', value: totalEvents ?? 0 },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(140,176,208,0.04)', borderRadius: 10, padding: '11px 12px', textAlign: 'center', border: '1px solid rgba(140,176,208,0.06)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#52a9cd', fontFamily: '"Space Mono", "Courier New", monospace' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#5f7589', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Big-event trophies */}
      {shown.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#5f7589', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
            The Case — Regionals &amp; Majors
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {shown.map(t => {
              const meta = TIER_META[t.tier] ?? TIER_META.regional
              const pColor = placementColor(t.placement)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(200,162,74,0.04)', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(200,162,74,0.12)' }}>
                  <img
                    crossOrigin="anonymous"
                    src={getProxiedCardImageUrl(t.leader_id)}
                    alt={cleanName(t.leader_name)}
                    style={{ width: 40, height: 56, objectFit: 'cover', objectPosition: 'top', borderRadius: 5, flexShrink: 0, display: 'block' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: meta.color, marginTop: 2, fontWeight: 600 }}>{meta.icon} {meta.label}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: pColor, flexShrink: 0 }}>{placementLabel(t.placement)}</div>
                </div>
              )
            })}
          </div>
          {overflow > 0 && (
            <div style={{ fontSize: 11, color: '#5f7589', marginTop: 8, textAlign: 'center' }}>+{overflow} more on the full cabinet</div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid rgba(140,176,208,0.2)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#52a9cd', letterSpacing: '-0.2px' }}>PirateTracker</div>
        <div style={{ fontSize: 11, color: '#5f7589' }}>Build your own → piratetracker.vercel.app</div>
      </div>
    </div>
  )
})

export default TrophyCabinetShareCard
