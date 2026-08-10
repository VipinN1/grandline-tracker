import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCardImageUrl } from '../lib/optcgapi'
import { captureAndShare } from '../lib/shareImage'
import { useWindowSize } from '../hooks/useWindowSize'
import TournamentModal from '../components/TournamentModal'
import TrophyCabinetShareCard from '../components/TrophyCabinetShareCard'
import { colors, radius, shadow, font, card, btnPrimary, btnGhost } from '../theme'

const TIER_META = {
  major:      { label: 'Major',       icon: '🏆', color: colors.gold, rank: 0 },
  regional:   { label: 'Regional',    icon: '🥈', color: colors.oceanBright, rank: 1 },
  prerelease: { label: 'Pre-Release', icon: '🎁', color: colors.orange, rank: 2 },
  locals:     { label: 'Locals',      icon: '🏅', color: colors.emerald, rank: 3 },
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
  if (n === 1) return { color: colors.gold, fill: 'rgba(200,162,74,0.16)', line: 'rgba(200,162,74,0.5)' }
  if (n === 2) return { color: '#c3ccd6', fill: 'rgba(195,204,214,0.12)', line: 'rgba(195,204,214,0.4)' }
  if (n === 3) return { color: colors.orange, fill: 'rgba(224,138,60,0.14)', line: 'rgba(224,138,60,0.4)' }
  return { color: colors.muted, fill: 'rgba(140,176,208,0.06)', line: colors.line }
}

// Eases a number up from 0 to `target` once, on mount / whenever target changes.
// Gives the headline win count a satisfying "reveal" instead of popping in flat.
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf, start
    function tick(ts) {
      if (start === undefined) start = ts
      const p = Math.min(1, (ts - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function StatTile({ label, value, accent, onEdit }) {
  return (
    <div style={{ ...card, padding: '16px 18px', textAlign: 'center', position: 'relative' }}>
      {onEdit && (
        <button
          onClick={onEdit}
          title="Set wins from before PirateTracker"
          style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 6, border: `1px solid ${colors.line}`, background: 'rgba(140,176,208,0.06)', color: colors.muted, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >✎</button>
      )}
      <div style={{ fontSize: 32, fontWeight: 700, color: accent ?? colors.text, fontFamily: font.mono, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: colors.muted, marginTop: 8 }}>{label}</div>
    </div>
  )
}

// Owner-only: self-report a count of past locals wins that happened before
// they started logging on PirateTracker (or just never got logged
// individually). Purely additive to the tally — see db/profile_legacy_wins.sql.
function LegacyWinsModal({ initialValue, onClose, onSave }) {
  const [value, setValue] = useState(String(initialValue ?? 0))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const n = parseInt(value, 10)
    if (isNaN(n) || n < 0) return setError('Enter a whole number of 0 or more')
    setSaving(true)
    const err = await onSave(n)
    setSaving(false)
    if (err) return setError('Failed to save. Please try again.')
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: `1px solid ${colors.line}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 4 }}>Locals Wins Before PirateTracker</div>
        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 18, lineHeight: 1.5 }}>
          Add wins from before you started tracking (or ones you never logged individually). This adds straight onto your Locals Wins tally — it doesn't create tournament entries or affect your win rate or event count.
        </div>
        <input
          autoFocus
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') handleSave() }}
          style={{ width: '100%', background: colors.surface3, border: `1px solid ${colors.lineStrong}`, borderRadius: radius.sm, padding: '10px 13px', color: colors.text, fontSize: 16, fontFamily: font.mono, outline: 'none', boxSizing: 'border-box' }}
        />
        {error && <div style={{ fontSize: 12, color: colors.crimson, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function TrophyCard({ t, index, onOpen }) {
  const meta = TIER_META[t.tier] ?? TIER_META.regional
  const podium = t.placement <= 3
  const pMeta = placementMeta(t.placement)

  return (
    <div
      className="gl-trophy-card"
      onClick={() => onOpen(t)}
      style={{
        animationDelay: `${Math.min(index, 12) * 70}ms`,
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`,
        border: `1px solid ${podium ? pMeta.line : colors.line}`,
        borderRadius: radius.lg,
        padding: 14,
        display: 'flex', gap: 12, alignItems: 'center',
        boxShadow: t.placement === 1 ? shadow.gold : shadow.sm,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = shadow.hover }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = t.placement === 1 ? shadow.gold : shadow.sm }}
    >
      {t.placement === 1 && <div className="gl-trophy-shine" />}
      <img
        src={getCardImageUrl(t.leader_id)}
        alt={cleanName(t.leader_name)}
        style={{ width: 52, height: 72, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, flexShrink: 0, border: `1px solid ${colors.line}` }}
        onError={e => { e.target.style.visibility = 'hidden' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: radius.pill, background: pMeta.fill, color: pMeta.color, border: `1px solid ${pMeta.line}` }}>{placementLabel(t.placement)}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: radius.pill, background: meta.color + '1f', color: meta.color, letterSpacing: '0.3px' }}>{meta.icon} {meta.label}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
        <div style={{ fontSize: 11, color: colors.faint, marginTop: 2 }}>
          {t.date}{t.player_count ? ` · ${t.player_count} players` : ''}
        </div>
      </div>
    </div>
  )
}

export default function TrophyCabinet({ session }) {
  const { username } = useParams()
  const navigate = useNavigate()
  const { isMobile } = useWindowSize()

  const [profile, setProfile] = useState(null)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingLegacy, setEditingLegacy] = useState(false)

  const shareRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      const { data: p } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
      if (cancelled) return
      if (!p) { setNotFound(true); setLoading(false); return }
      setProfile(p)
      const { data: t } = await supabase
        .from('tournaments')
        .select('*, decklists(*), tournament_rounds(*), tournament_decklists(decklists(*))')
        .eq('user_id', p.id)
        .order('date', { ascending: false })
      if (!cancelled) { setTournaments(t ?? []); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [username])

  const isOwner = !!(session && profile && session.user.id === profile.id)

  async function handleShare() {
    setShareError('')
    setSharing(true)
    try {
      await captureAndShare(shareRef.current, {
        fileName: `${(profile?.username ?? 'trophy-cabinet').replace(/[^\w\- ]+/g, '').trim()}-trophy-cabinet.png`,
        title: `${profile?.username}'s Trophy Cabinet`,
        text: 'Check out my OPTCG Trophy Cabinet on PirateTracker!',
      })
    } catch {
      setShareError('Could not generate the image. Try again.')
    }
    setSharing(false)
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }

  async function saveLegacyWins(n) {
    const { error } = await supabase.from('profiles').update({ legacy_locals_wins: n }).eq('id', session.user.id)
    if (!error) setProfile(prev => ({ ...prev, legacy_locals_wins: n }))
    return error
  }

  // Derived from state that's always defined (even before load finishes), so
  // this — and the useCountUp hook below — can run unconditionally ahead of
  // the loading/notFound early returns, keeping hook order stable.
  const ranked = tournaments.filter(t => !t.is_practice)
  const localsWinsList = ranked.filter(t => (t.tier ?? 'locals') === 'locals' && t.placement === 1)
  const localsEvents = ranked.filter(t => (t.tier ?? 'locals') === 'locals')
  const prereleaseWinsList = ranked.filter(t => t.tier === 'prerelease' && t.placement === 1)
  const prereleaseEvents = ranked.filter(t => t.tier === 'prerelease')
  const bigResults = ranked
    .filter(t => t.tier === 'regional' || t.tier === 'major')
    .slice()
    .sort((a, b) => (TIER_META[a.tier].rank - TIER_META[b.tier].rank) || (a.placement - b.placement) || new Date(b.date) - new Date(a.date))
  const podiumBig = bigResults.filter(t => t.placement <= 3).length
  const bestFinish = ranked.length > 0 ? Math.min(...ranked.map(t => t.placement)) : null
  const legacyLocalsWins = profile?.legacy_locals_wins ?? 0
  const totalLocalsWins = localsWinsList.length + legacyLocalsWins
  const localsWinCount = useCountUp(totalLocalsWins)
  const prereleaseWinCount = useCountUp(prereleaseWinsList.length)

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><div style={{ fontSize: 13, color: colors.muted }}>Charting the case…</div></div>
  }

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: colors.faint }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏴‍☠️</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: colors.muted }}>No user found with that username.</div>
      </div>
    )
  }

  const initials = (profile.username ?? '?').slice(0, 2).toUpperCase()
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="gl-page-enter">
      {/* Header */}
      <div style={{ ...card, padding: isMobile ? 18 : 26, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: `linear-gradient(135deg, ${colors.oceanDeep}, ${colors.ocean})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, color: colors.parchment, flexShrink: 0, overflow: 'hidden', border: `2px solid ${colors.goldLine}` }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.6px', color: colors.gold, marginBottom: 2 }}>Trophy Cabinet</div>
            <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 700, color: colors.text, fontFamily: font.display }}>{profile.username}</div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{ranked.length} events logged{memberSince ? ` · Since ${memberSince}` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleCopyLink} style={btnGhost}>{copied ? '✓ Copied' : '🔗 Copy Link'}</button>
            <button onClick={handleShare} disabled={sharing} style={{ ...btnPrimary, opacity: sharing ? 0.6 : 1 }}>{sharing ? 'Rendering…' : '↗ Share Image'}</button>
          </div>
        </div>
        {shareError && <div style={{ fontSize: 12, color: colors.crimson, marginTop: 12 }}>{shareError}</div>}
        {isOwner && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${colors.line}`, fontSize: 12, color: colors.faint }}>
            Set an event's tier (Locals / Pre-Release / Regional / Major) from <Link to="/log" style={{ color: colors.oceanBright, fontWeight: 600 }}>Log Result</Link> — Regional and Major podiums show up here as trophies, Locals and Pre-Release wins are each tallied separately above.
          </div>
        )}
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 10, marginBottom: 22 }}>
        <StatTile label="Locals Wins" value={`🏅 ${localsWinCount}`} accent={colors.emerald} onEdit={isOwner ? () => setEditingLegacy(true) : undefined} />
        <StatTile label="Pre-Release Wins" value={`🎁 ${prereleaseWinCount}`} accent={colors.orange} />
        <StatTile label="Podium Finishes" value={podiumBig} accent={colors.gold} />
        <StatTile label="Best Finish" value={bestFinish ? placementLabel(bestFinish) : '—'} />
        <StatTile label="Total Events" value={ranked.length} />
      </div>

      {/* The big case */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.gold, marginBottom: 12 }}>🏆 The Case — Regionals & Majors</div>
        {bigResults.length === 0 ? (
          <div style={{ ...card, padding: 30, textAlign: 'center', color: colors.faint }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🗝️</div>
            <div style={{ fontSize: 13 }}>No Regional or Major podiums logged yet.</div>
            {isOwner && <Link to="/log" style={{ ...btnGhost, display: 'inline-block', marginTop: 14, textDecoration: 'none' }}>Log an Event</Link>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
            {bigResults.map((t, i) => <TrophyCard key={t.id} t={t} index={i} onOpen={setSelectedTournament} />)}
          </div>
        )}
      </div>

      {/* Pre-release wall — its own category, separate from Locals */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.orange, marginBottom: 12 }}>🎁 Pre-Release Wins ({prereleaseWinsList.length} of {prereleaseEvents.length} events)</div>
        {prereleaseWinsList.length === 0 ? (
          <div style={{ fontSize: 13, color: colors.faint, padding: '4px 0' }}>No pre-release wins logged yet — first place at a pre-release adds a badge here.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {prereleaseWinsList.map((t, i) => (
              <div
                key={t.id}
                className="gl-trophy-card"
                onClick={() => setSelectedTournament(t)}
                title={`${t.name} · ${t.date}`}
                style={{ animationDelay: `${Math.min(i, 16) * 40}ms`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(224,138,60,0.08)', border: '1px solid rgba(224,138,60,0.3)', borderRadius: radius.pill, padding: '6px 12px 6px 8px' }}
              >
                <span style={{ fontSize: 14 }}>🎁</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.text, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Locals wall */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.emerald }}>🏅 Locals Wins ({totalLocalsWins} total)</div>
          <div style={{ fontSize: 11, color: colors.faint }}>{localsWinsList.length} logged of {localsEvents.length} events{legacyLocalsWins > 0 ? ` · ${legacyLocalsWins} before tracking` : ''}</div>
        </div>
        {localsWinsList.length === 0 && legacyLocalsWins === 0 ? (
          <div style={{ fontSize: 13, color: colors.faint, padding: '4px 0' }}>
            No locals wins logged yet — first place at a locals adds a badge here.
            {isOwner && <>{' '}Had wins before joining PirateTracker? <button onClick={() => setEditingLegacy(true)} style={{ background: 'none', border: 'none', color: colors.oceanBright, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0 }}>Add them here</button>.</>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {localsWinsList.map((t, i) => (
              <div
                key={t.id}
                className="gl-trophy-card"
                onClick={() => setSelectedTournament(t)}
                title={`${t.name} · ${t.date}`}
                style={{ animationDelay: `${Math.min(i, 16) * 40}ms`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(59,178,126,0.08)', border: '1px solid rgba(59,178,126,0.3)', borderRadius: radius.pill, padding: '6px 12px 6px 8px' }}
              >
                <span style={{ fontSize: 14 }}>🏅</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.text, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              </div>
            ))}
            {legacyLocalsWins > 0 && (
              <div
                className="gl-trophy-card"
                onClick={() => isOwner && setEditingLegacy(true)}
                title="Self-reported wins from before PirateTracker"
                style={{ animationDelay: `${Math.min(localsWinsList.length, 16) * 40}ms`, cursor: isOwner ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(59,178,126,0.04)', border: `1px dashed rgba(59,178,126,0.3)`, borderRadius: radius.pill, padding: '6px 12px 6px 8px' }}
              >
                <span style={{ fontSize: 14 }}>🏅</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSoft }}>+{legacyLocalsWins} before tracking</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Growth loop CTA — shown to anyone not viewing their own cabinet */}
      {!isOwner && (
        <div style={{ ...card, padding: '18px 22px', marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', border: `1px solid ${colors.goldLine}` }}>
          <div style={{ fontSize: 13, color: colors.textSoft }}>🏴‍☠️ Track your own tournaments and build a Trophy Cabinet like this one.</div>
          {session ? (
            <button onClick={() => navigate('/profile')} style={btnPrimary}>My Profile</button>
          ) : (
            <button onClick={() => navigate('/signup')} style={btnPrimary}>Sign Up Free</button>
          )}
        </div>
      )}

      {/* Off-screen render target for the shareable image */}
      <TrophyCabinetShareCard
        ref={shareRef}
        profile={profile}
        localsWins={totalLocalsWins}
        localsEvents={localsEvents.length}
        legacyLocalsWins={legacyLocalsWins}
        prereleaseWins={prereleaseWinsList.length}
        bigResults={bigResults}
        bestFinish={bestFinish}
        totalEvents={ranked.length}
      />

      {selectedTournament && (
        <TournamentModal
          tournament={selectedTournament}
          onClose={() => setSelectedTournament(null)}
          isMobile={isMobile}
          onEdit={isOwner ? t => navigate('/log', { state: { editTournament: t } }) : undefined}
          onDelete={isOwner ? () => { setTournaments(prev => prev.filter(x => x.id !== selectedTournament.id)); setSelectedTournament(null) } : false}
        />
      )}

      {editingLegacy && (
        <LegacyWinsModal
          initialValue={legacyLocalsWins}
          onClose={() => setEditingLegacy(false)}
          onSave={saveLegacyWins}
        />
      )}
    </div>
  )
}
