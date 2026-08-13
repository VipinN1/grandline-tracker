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

function placementMeta(n) {
  if (n === 1) return { color: '#dcb35e', fill: 'rgba(220,179,94,0.16)' }
  if (n === 2) return { color: '#c3ccd6', fill: 'rgba(195,204,214,0.14)' }
  if (n === 3) return { color: '#e08a3c', fill: 'rgba(224,138,60,0.16)' }
  return { color: '#9db2c6', fill: 'rgba(157,178,198,0.08)' }
}

// A small art-or-initial thumbnail, reused for both the spotlight and the
// case list rows below it.
function LeaderThumb({ t, size }) {
  const [w, h] = size
  return t.leader_id ? (
    <img
      crossOrigin="anonymous"
      src={getProxiedCardImageUrl(t.leader_id)}
      alt={cleanName(t.leader_name)}
      style={{ width: w, height: h, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, flexShrink: 0, display: 'block' }}
    />
  ) : (
    <div style={{ width: w, height: h, borderRadius: 6, flexShrink: 0, background: 'rgba(140,176,208,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(w * 0.4), color: '#67809a', fontWeight: 700 }}>
      {t.leader_name ? cleanName(t.leader_name).slice(0, 1) : '?'}
    </div>
  )
}

// Off-screen (positioned outside the viewport, not display:none — html2canvas
// needs the node laid out) portrait card, rendered to a shareable PNG via
// captureAndShare(). Widened and given more headroom than a typical share
// card so a full Regional/Major history — plus a "Best Result" spotlight —
// fits without feeling cramped; the live page is still the place to browse
// everything if the case runs past what's shown here.
const TrophyCabinetShareCard = forwardRef(function TrophyCabinetShareCard(
  { profile, localsWins, localsEvents, legacyLocalsWins, prereleaseWins, podiumFinishes, bigResults, bestFinish, totalEvents },
  ref
) {
  if (!profile) return null

  // bigResults arrives pre-sorted (major before regional, then by placement,
  // then most recent) — its head is already this person's best result.
  const best = bigResults?.[0] ?? null
  const shown = (bigResults ?? []).slice(0, 8)
  const overflow = (bigResults?.length ?? 0) - shown.length
  const initials = (profile.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: '680px',
        background:
          'radial-gradient(ellipse 380px 320px at 0% 0%, rgba(200,162,74,0.20) 0%, transparent 60%),' +
          'radial-gradient(ellipse 280px 220px at 100% 100%, rgba(47,125,163,0.28) 0%, transparent 65%),' +
          '#06101b',
        border: '1px solid rgba(200,162,74,0.3)',
        borderRadius: '22px',
        padding: '32px',
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        color: '#e9f1f8',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #1b4a66, #2f7da3)', border: '2px solid rgba(200,162,74,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: '#e9ddc4' }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#dcb35e', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>
            Trophy Cabinet
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#e9f1f8', letterSpacing: '-0.4px', lineHeight: 1.1 }}>
            {profile.username}
          </div>
        </div>
      </div>

      {/* Best Result spotlight — the single strongest Regional/Major result,
          given hero treatment so the headline achievement reads instantly. */}
      {best && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg, rgba(220,179,94,0.14), rgba(82,169,205,0.07))', border: '1px solid rgba(220,179,94,0.4)', borderRadius: 16, padding: '16px 18px', marginBottom: 14 }}>
          <LeaderThumb t={best} size={[54, 74]} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#dcb35e', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>🏆 Best Result</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{best.name}</div>
            <div style={{ fontSize: 12, color: '#9db2c6', marginTop: 3 }}>
              {(TIER_META[best.tier] ?? TIER_META.regional).icon} {(TIER_META[best.tier] ?? TIER_META.regional).label} · {best.date}{best.player_count ? ` · ${best.player_count} players` : ''}
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: placementMeta(best.placement).color, flexShrink: 0, fontFamily: '"Space Mono", "Courier New", monospace' }}>
            {placementLabel(best.placement)}
          </div>
        </div>
      )}

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

      {/* Secondary stats — mirrors the live page's manifest strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 26 }}>
        {[
          { label: 'Pre-Release Wins', value: `🎁 ${prereleaseWins ?? 0}` },
          { label: 'Podium Finishes', value: podiumFinishes ?? 0 },
          { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—' },
          { label: 'Total Events', value: totalEvents ?? 0 },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(140,176,208,0.04)', borderRadius: 10, padding: '11px 10px', textAlign: 'center', border: '1px solid rgba(140,176,208,0.06)' }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#52a9cd', fontFamily: '"Space Mono", "Courier New", monospace' }}>{s.value}</div>
            <div style={{ fontSize: 9.5, color: '#5f7589', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Big-event trophies — richer rows: art, tier, date, player count, and
          a podium-colored placement pill instead of plain text. */}
      {shown.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#5f7589', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
            The Case — Regionals &amp; Majors ({bigResults.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map(t => {
              const meta = TIER_META[t.tier] ?? TIER_META.regional
              const pMeta = placementMeta(t.placement)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(200,162,74,0.04)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(200,162,74,0.12)' }}>
                  <LeaderThumb t={t} size={[44, 60]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: meta.color, marginTop: 3, fontWeight: 600 }}>
                      {meta.icon} {meta.label} <span style={{ color: '#5f7589', fontWeight: 500 }}>· {t.date}{t.player_count ? ` · ${t.player_count} players` : ''}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: pMeta.color, background: pMeta.fill, padding: '5px 12px', borderRadius: 999, flexShrink: 0 }}>{placementLabel(t.placement)}</div>
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
