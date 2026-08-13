import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCardImageUrl, getCard, searchLeaders } from '../lib/optcgapi'
import { captureAndShare } from '../lib/shareImage'
import { useWindowSize } from '../hooks/useWindowSize'
import TournamentModal from '../components/TournamentModal'
import TrophyCabinetShareCard from '../components/TrophyCabinetShareCard'
import { colors, radius, shadow, font, card, btnPrimary, btnGhost, transition } from '../theme'

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

// One joined "manifest strip" instead of five separate stat cards — reads as
// a single panel divided into columns rather than a row of boxes.
function StatStrip({ items, isMobile }) {
  const cols = isMobile ? 2 : items.length
  const lastRowStart = Math.floor((items.length - 1) / cols) * cols
  return (
    <div style={{ ...card, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, marginBottom: 22, overflow: 'hidden' }}>
      {items.map((it, i) => {
        const isLastCol = (i + 1) % cols === 0 || i === items.length - 1
        const isLastRow = i >= lastRowStart
        const spanRemainder = i === items.length - 1 ? (cols - (items.length % cols)) % cols : 0
        return (
          <div
            key={it.label}
            style={{
              position: 'relative', textAlign: 'center', padding: '16px 12px',
              gridColumn: spanRemainder ? `span ${spanRemainder + 1}` : undefined,
              borderRight: isLastCol ? 'none' : `1px solid ${colors.line}`,
              borderBottom: isLastRow ? 'none' : `1px solid ${colors.line}`,
            }}
          >
            {it.onEdit && (
              <button
                onClick={it.onEdit}
                title="Set wins from before PirateTracker"
                style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 6, border: `1px solid ${colors.line}`, background: 'rgba(140,176,208,0.06)', color: colors.muted, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✎</button>
            )}
            <div style={{ fontSize: 26, fontWeight: 700, color: it.accent ?? colors.text, fontFamily: font.mono, letterSpacing: '-0.5px', lineHeight: 1 }}>{it.value}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.muted, marginTop: 8 }}>{it.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// Small debounced leader search, used inline in LegacyCountModal — a trimmed
// copy of LogResult's LeaderSearchInput (that one's local to LogResult.jsx,
// not shared) since all that's needed here is "pick a card, get its id back".
function MiniLeaderSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val); setOpen(true)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { setResults((await searchLeaders(val)).slice(0, 30)) }
      catch { setResults([]) }
      setSearching(false)
    }, 350)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Search leader..."
        value={query}
        onChange={handleChange}
        onFocus={() => query.length >= 2 && setOpen(true)}
        style={{ width: '100%', background: colors.surface3, border: `1px solid ${colors.lineStrong}`, borderRadius: radius.sm, padding: '9px 12px', color: colors.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
      {open && query.length >= 2 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#161b27', border: `1px solid ${colors.lineStrong}`, borderRadius: radius.sm, marginTop: 4, boxShadow: shadow.lg, maxHeight: 220, overflowY: 'auto' }}>
          {searching ? <div style={{ padding: '10px 12px', fontSize: 12, color: colors.muted }}>Searching…</div>
            : results.length === 0 ? <div style={{ padding: '10px 12px', fontSize: 12, color: colors.faint }}>No leaders found</div>
            : results.map(c => (
              <div key={c.card_image_id ?? c.card_set_id} onClick={() => { onSelect(c); setQuery(''); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${colors.line}` }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,176,208,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <img src={getCardImageUrl(c)} alt={c.card_name} style={{ width: 26, height: 36, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.text }}>{c.card_name}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// Owner-only: self-report a count of past Locals/Pre-Release wins that
// happened before they started logging on PirateTracker (or just never got
// logged individually). Purely additive to the tally — see
// db/profile_legacy_wins.sql and db/legacy_results.sql. Optionally paired
// with a representative leader card (db/legacy_leader.sql) shown as that
// tally's Trophy Wall badge art, since there's no per-event leader to draw on.
function LegacyCountModal({ title, description, initialValue, initialLeaderId, onClose, onSave, onSplit }) {
  const [value, setValue] = useState(String(initialValue ?? 0))
  const [leader, setLeader] = useState(null)
  const [leaderLoading, setLeaderLoading] = useState(!!initialLeaderId)
  const [saving, setSaving] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [confirmSplit, setConfirmSplit] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initialLeaderId) return
    let cancelled = false
    getCard(initialLeaderId)
      .then(c => { if (!cancelled && c) setLeader(c) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLeaderLoading(false) })
    return () => { cancelled = true }
  }, [initialLeaderId])

  async function handleSave() {
    const n = parseInt(value, 10)
    if (isNaN(n) || n < 0) return setError('Enter a whole number of 0 or more')
    setSaving(true)
    const leaderId = leader ? (leader.card_image_id ?? leader.card_set_id ?? null) : null
    const err = await onSave(n, leaderId)
    setSaving(false)
    if (err) return setError('Failed to save. Please try again.')
    onClose()
  }

  async function handleSplit() {
    setSplitting(true)
    const err = await onSplit()
    setSplitting(false)
    if (err) return setError('Failed to split. Please try again.')
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: `1px solid ${colors.line}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 18, lineHeight: 1.5 }}>{description}</div>

        {initialValue > 0 && onSplit && (
          <div style={{ background: 'rgba(200,162,74,0.08)', border: `1px solid ${colors.goldLine}`, borderRadius: radius.sm, padding: 14, marginBottom: 18 }}>
            {!confirmSplit ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 4 }}>Want these as separate squares instead?</div>
                <div style={{ fontSize: 11.5, color: colors.muted, lineHeight: 1.5, marginBottom: 10 }}>
                  Turns this single "+{initialValue} before tracking" tile into {initialValue} individual Trophy Wall squares, each with its own card art you can set.
                </div>
                <button onClick={() => setConfirmSplit(true)} style={{ ...btnGhost, width: '100%', borderColor: colors.goldLine, color: colors.gold }}>Split into {initialValue} squares</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 4 }}>Create {initialValue} individual squares?</div>
                <div style={{ fontSize: 11.5, color: colors.muted, lineHeight: 1.5, marginBottom: 10 }}>
                  This replaces the single tile above — the count resets to 0 and {initialValue} blank squares appear on the Trophy Wall for you to fill in (date, name, card art) one at a time.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmSplit(false)} disabled={splitting} style={{ ...btnGhost, flex: 1 }}>Back</button>
                  <button onClick={handleSplit} disabled={splitting} style={{ ...btnPrimary, flex: 1, opacity: splitting ? 0.6 : 1 }}>{splitting ? 'Splitting…' : 'Confirm split'}</button>
                </div>
              </>
            )}
          </div>
        )}

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
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.muted, marginBottom: 6 }}>
            Representative Leader <span style={{ color: colors.faint, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — shown as this square's art)</span>
          </div>
          {leaderLoading ? (
            <div style={{ fontSize: 12, color: colors.faint, padding: '9px 0' }}>Loading current leader…</div>
          ) : leader ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: colors.surface3, border: `1px solid ${colors.lineStrong}`, borderRadius: radius.sm, padding: '8px 12px' }}>
              <img src={getCardImageUrl(leader)} alt={leader.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leader.card_name}</div>
              <button onClick={() => setLeader(null)} style={{ background: 'none', border: 'none', color: colors.muted, cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
            </div>
          ) : (
            <MiniLeaderSearch onSelect={setLeader} />
          )}
        </div>
        {error && <div style={{ fontSize: 12, color: colors.crimson, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

const LEGACY_TROPHY_TIERS = [
  { value: 'locals', label: '🏅 Locals', color: colors.emerald },
  { value: 'prerelease', label: '🎁 Pre-Release', color: colors.orange },
  { value: 'regional', label: '🥈 Regional', color: colors.oceanBright },
  { value: 'major', label: '🏆 Major', color: colors.gold },
]

// Mirrors LogResult.jsx's getLeaderStorageId (not shared/exported from there)
// — prefers the variant-specific image id so art matches the exact card art.
function getLeaderStorageId(c) {
  if (c?.card_image_id) return c.card_image_id
  if (c?.card_image) {
    const m = c.card_image.match(/Card_Images\/(.+?)\.jpg/i)
    if (m?.[1]) return m[1]
  }
  return c?.card_set_id ?? ''
}

// Owner-only: backfill a single result — any tier — that happened before (or
// wasn't logged on) PirateTracker. Creates/edits an ordinary `tournaments`
// row flagged `is_legacy`, with no rounds required — this is what gives every
// individual past win its own Trophy Wall/Case square (rather than a single
// aggregate count), each with its own real leader art via the card picker.
function LegacyTrophyModal({ initial, defaultTier, onClose, onSave, onDelete }) {
  const isEditing = !!initial?.id
  const [tier, setTier] = useState(initial?.tier ?? defaultTier ?? 'regional')
  const [placement, setPlacement] = useState(initial?.placement != null ? String(initial.placement) : (tier === 'locals' || tier === 'prerelease' ? '1' : ''))
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [leader, setLeader] = useState(null)
  const [legacyLeaderName, setLegacyLeaderName] = useState(initial?.leader_id ? '' : (initial?.leader_name ?? '')) // old free-text-only entries
  const [leaderLoading, setLeaderLoading] = useState(!!initial?.leader_id)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initial?.leader_id) return
    let cancelled = false
    getCard(initial.leader_id)
      .then(c => { if (!cancelled && c) setLeader(c) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLeaderLoading(false) })
    return () => { cancelled = true }
  }, [initial?.leader_id])

  function handleTierChange(v) {
    setTier(v)
    if ((v === 'locals' || v === 'prerelease') && !placement) setPlacement('1')
  }

  async function handleSave() {
    const p = parseInt(placement, 10)
    if (isNaN(p) || p < 1) return setError('Enter a placement of 1 or more (e.g. 148)')
    if (!name.trim()) return setError('Give the event a name')
    if (!date) return setError('Date is required')
    setSaving(true)
    const err = await onSave({
      tier, placement: p, name: name.trim(), date,
      leader_id: leader ? getLeaderStorageId(leader) : null,
      leader_name: leader ? leader.card_name : (legacyLeaderName.trim() || null),
      leader_color: leader ? leader.card_color : null,
    })
    setSaving(false)
    if (err) return setError('Failed to save. Please try again.')
    onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    const err = await onDelete()
    setDeleting(false)
    if (err) return setError('Failed to delete. Please try again.')
    onClose()
  }

  const inputStyle = { width: '100%', background: colors.surface3, border: `1px solid ${colors.lineStrong}`, borderRadius: radius.sm, padding: '9px 12px', color: colors.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.muted, marginBottom: 6, display: 'block' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161b27', border: `1px solid ${colors.line}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 4 }}>{isEditing ? 'Edit Past Result' : 'Add a Past Result'}</div>
        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 18, lineHeight: 1.5 }}>
          For a result that happened before (or wasn't logged on) PirateTracker — gets its own square with real card art, same as anything logged normally. No round-by-round detail needed, just the placement.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Tier</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {LEGACY_TROPHY_TIERS.map(opt => (
                <button key={opt.value} type="button" onClick={() => handleTierChange(opt.value)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${tier === opt.value ? opt.color : colors.line}`, background: tier === opt.value ? opt.color + '22' : 'rgba(140,176,208,0.03)', color: tier === opt.value ? opt.color : colors.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Placement</label>
              <input type="number" min="1" step="1" placeholder="e.g. 148" value={placement} onChange={e => { setPlacement(e.target.value); setError('') }} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, WebkitAppearance: 'none' }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Event Name</label>
            <input type="text" placeholder="e.g. 2022 East Coast Regional" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Leader <span style={{ color: colors.faint, fontWeight: 400 }}>(optional — sets this square's art)</span></label>
            {leaderLoading ? (
              <div style={{ fontSize: 12, color: colors.faint, padding: '9px 0' }}>Loading current leader…</div>
            ) : leader ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: colors.surface3, border: `1px solid ${colors.lineStrong}`, borderRadius: radius.sm, padding: '8px 12px' }}>
                <img src={getCardImageUrl(leader)} alt={leader.card_name} style={{ width: 28, height: 38, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leader.card_name}</div>
                <button onClick={() => setLeader(null)} style={{ background: 'none', border: 'none', color: colors.muted, cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
              </div>
            ) : (
              <>
                <MiniLeaderSearch onSelect={setLeader} />
                {legacyLeaderName && (
                  <div style={{ fontSize: 11, color: colors.faint, marginTop: 6 }}>Currently just a name, no art: "{legacyLeaderName}" — search above to attach a real card.</div>
                )}
              </>
            )}
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: colors.crimson, marginTop: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {isEditing && <button onClick={handleDelete} disabled={deleting || saving} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid rgba(210,74,58,0.4)`, background: 'rgba(210,74,58,0.1)', color: '#ff7676', fontSize: 13, fontWeight: 600, cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit' }}>{deleting ? 'Deleting…' : 'Delete'}</button>}
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || deleting} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
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
      {t.leader_id ? (
        <img
          src={getCardImageUrl(t.leader_id)}
          alt={cleanName(t.leader_name)}
          style={{ width: 52, height: 72, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, flexShrink: 0, border: `1px solid ${colors.line}` }}
          onError={e => { e.target.style.visibility = 'hidden' }}
        />
      ) : (
        <div style={{ width: 52, height: 72, borderRadius: 6, flexShrink: 0, background: 'rgba(140,176,208,0.06)', border: `1px solid ${colors.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: colors.faint }}>
          {t.leader_name ? cleanName(t.leader_name).slice(0, 1) : '?'}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: radius.pill, background: pMeta.fill, color: pMeta.color, border: `1px solid ${pMeta.line}` }}>{placementLabel(t.placement)}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: radius.pill, background: meta.color + '1f', color: meta.color, letterSpacing: '0.3px' }}>{meta.icon} {meta.label}</span>
          {t.is_legacy && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: radius.pill, color: colors.faint, border: `1px dashed ${colors.line}` }}>SELF-REPORTED</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
        <div style={{ fontSize: 11, color: colors.faint, marginTop: 2 }}>
          {t.date}{t.player_count ? ` · ${t.player_count} players` : ''}{t.leader_name && !t.leader_id ? ` · ${cleanName(t.leader_name)}` : ''}
        </div>
      </div>
    </div>
  )
}

// Empty state for a case with nothing in it yet — matches "The Case —
// Regional Performance"'s look so both sections read as one system.
function EmptyCase({ message, isOwner, actions = [] }) {
  return (
    <div style={{ ...card, padding: 30, textAlign: 'center', color: colors.faint }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🗝️</div>
      <div style={{ fontSize: 13 }}>{message}</div>
      {isOwner && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <Link to="/log" style={{ ...btnGhost, display: 'inline-block', textDecoration: 'none' }}>Log an Event</Link>
          {actions.map(a => (
            <button key={a.label} onClick={a.onClick} style={{ ...btnGhost, textDecoration: 'none' }}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact badge for the Trophy Wall — a single icon + name instead of a full
// TrophyCard, since a Locals/Pre-Release win history can run into the dozens.
// When the win has a known leader, its card art fills the badge as a zoomed,
// top-anchored background (portrait art lives up there) with a bottom scrim
// so the name/date stay legible over whatever's underneath. Without one (a
// freshly-split legacy square, say), it centers everything instead of
// leaving the top-left-icon/bottom-caption layout's middle empty, plus an
// owner-only nudge toward setting art — same idea as GhostBadge.
function TrophyBadge({ t, index, onOpen, isOwner }) {
  const meta = TIER_META[t.tier] ?? TIER_META.locals
  const artUrl = t.leader_id ? getCardImageUrl(t.leader_id) : null
  return (
    <div
      className="gl-badge-pop"
      onClick={() => onOpen(t)}
      title={`${t.name} · ${t.date}`}
      style={{
        animationDelay: `${Math.min(index, 24) * 25}ms`,
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        height: 108,
        border: `1px ${t.is_legacy ? 'dashed' : 'solid'} ${meta.color}40`,
        borderRadius: radius.md,
        background: artUrl
          ? colors.deep
          : `radial-gradient(120% 90% at 50% 0%, ${meta.color}22 0%, ${meta.color}0c 55%, transparent 100%), linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`,
        transition: transition.fast,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = meta.color + '80' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = meta.color + '40' }}
    >
      {artUrl ? (
        <>
          <div
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${artUrl})`,
              backgroundSize: 'cover', backgroundPosition: 'top center',
              transform: 'scale(1.7)', transformOrigin: 'top center',
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(6,16,27,0.05) 0%, rgba(6,16,27,0.35) 45%, rgba(6,16,27,0.94) 100%)` }} />
          <div style={{ position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: '50%', background: 'rgba(6,16,27,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1 }}>{meta.icon}</div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '6px 8px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t.date}</div>
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 10px 8px', textAlign: 'center' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: meta.color + '22', border: `1px solid ${meta.color}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, lineHeight: 1, marginBottom: 2 }}>{meta.icon}</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: colors.text, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
          <div style={{ fontSize: 9, color: colors.faint }}>{t.date}</div>
          {isOwner && <div style={{ fontSize: 8.5, color: meta.color, marginTop: 1 }}>tap to add photo</div>}
        </div>
      )}
    </div>
  )
}

// Matching ghost badge for a tally of self-reported wins with no individual
// tournament row behind them — still gets leader art if a representative
// leader was set (db/legacy_leader.sql), same zoomed treatment as TrophyBadge,
// just kept dashed so it still reads as "one square standing in for several".
// Clicking it (owner only) opens the same LegacyCountModal used to set the
// count in the first place, which is also where that leader gets picked —
// the camera hint below just makes that discoverable, since a plain icon+
// text square gives no clue it's interactive.
function GhostBadge({ label, icon, leaderId, onClick, isOwner }) {
  const artUrl = leaderId ? getCardImageUrl(leaderId) : null
  return (
    <div
      onClick={onClick}
      title={isOwner ? 'Click to set a background photo' : 'Self-reported wins from before PirateTracker'}
      style={{
        position: 'relative', overflow: 'hidden', height: 108,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '12px 8px 10px', textAlign: 'center', cursor: isOwner ? 'pointer' : 'default',
        background: artUrl ? colors.deep : 'rgba(140,176,208,0.03)',
        border: `1px dashed ${colors.lineStrong}`,
        borderRadius: radius.md,
      }}
    >
      {artUrl && (
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${artUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'top center',
            transform: 'scale(1.7)', transformOrigin: 'top center',
          }}
        />
      )}
      {artUrl && (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(6,16,27,0.1) 0%, rgba(6,16,27,0.4) 45%, rgba(6,16,27,0.94) 100%)` }} />
      )}
      {isOwner && (
        <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 6, background: 'rgba(6,16,27,0.6)', border: `1px solid ${colors.lineStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
          📷
        </div>
      )}
      <span style={{ position: 'relative', fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{ position: 'relative', fontSize: 10.5, fontWeight: 700, color: artUrl ? '#fff' : colors.textSoft, textShadow: artUrl ? '0 1px 3px rgba(0,0,0,0.6)' : undefined }}>{label}</span>
      {isOwner && !artUrl && (
        <span style={{ position: 'relative', fontSize: 9, color: colors.faint }}>tap to add photo</span>
      )}
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
  const [editingLegacyTier, setEditingLegacyTier] = useState(null) // 'locals' | 'prerelease' | null
  const [editingLegacyTrophy, setEditingLegacyTrophy] = useState(null) // { defaultTier } (new) | tournament row (edit) | null

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

  async function saveLegacyCount(tier, n, leaderId) {
    const countCol = tier === 'prerelease' ? 'legacy_prerelease_wins' : 'legacy_locals_wins'
    const leaderCol = tier === 'prerelease' ? 'legacy_prerelease_leader_id' : 'legacy_locals_leader_id'
    const { error } = await supabase.from('profiles').update({ [countCol]: n, [leaderCol]: leaderId ?? null }).eq('id', session.user.id)
    if (!error) setProfile(prev => ({ ...prev, [countCol]: n, [leaderCol]: leaderId ?? null }))
    return error
  }

  // Turns the single "+N before tracking" tally into N individual is_legacy
  // tournament rows (tier locals/prerelease, placement 1, blank name/art) —
  // each then renders as its own real Trophy Wall square via wallItems,
  // editable/deletable/settable-with-art one at a time exactly like any
  // other legacy entry. The aggregate count + its representative leader are
  // zeroed out afterward since the individual rows now carry that weight.
  async function splitLegacyCount(tier) {
    const n = tier === 'prerelease' ? legacyPrereleaseWins : legacyLocalsWins
    if (n <= 0) return null
    const fallbackDate = profile?.created_at ? new Date(profile.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    const label = tier === 'prerelease' ? 'Pre-Release win before tracking' : 'Locals win before tracking'
    const rows = Array.from({ length: n }, () => ({
      tier, placement: 1, name: label, date: fallbackDate, deck_name: label,
      user_id: session.user.id, is_legacy: true, is_practice: false, wins: 0, losses: 0,
      leader_id: null, leader_name: null, leader_color: null,
    }))
    const { data, error } = await supabase.from('tournaments').insert(rows).select()
    if (error) return error
    setTournaments(prev => [...data.map(d => ({ ...d, tournament_rounds: [] })), ...prev])

    const countCol = tier === 'prerelease' ? 'legacy_prerelease_wins' : 'legacy_locals_wins'
    const leaderCol = tier === 'prerelease' ? 'legacy_prerelease_leader_id' : 'legacy_locals_leader_id'
    const { error: countErr } = await supabase.from('profiles').update({ [countCol]: 0, [leaderCol]: null }).eq('id', session.user.id)
    if (!countErr) setProfile(prev => ({ ...prev, [countCol]: 0, [leaderCol]: null }))
    return countErr
  }

  async function saveLegacyTrophy({ tier, placement, name, date, leader_id, leader_name, leader_color }) {
    const isEditing = editingLegacyTrophy?.id
    // deck_name mirrors the event name — every other insert path (Log Result)
    // always sets it, so this plays it safe in case the column is required.
    const payload = { tier, placement, name, date, leader_id, leader_name, leader_color, deck_name: name, user_id: session.user.id, is_legacy: true, is_practice: false, wins: 0, losses: 0 }
    if (isEditing) {
      const { data, error } = await supabase.from('tournaments').update(payload).eq('id', editingLegacyTrophy.id).select().single()
      if (!error) setTournaments(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t))
      return error
    }
    const { data, error } = await supabase.from('tournaments').insert(payload).select().single()
    if (!error) setTournaments(prev => [{ ...data, tournament_rounds: [] }, ...prev])
    return error
  }

  async function deleteLegacyTrophy() {
    if (!editingLegacyTrophy?.id) return null
    const { error } = await supabase.from('tournaments').delete().eq('id', editingLegacyTrophy.id)
    if (!error) setTournaments(prev => prev.filter(t => t.id !== editingLegacyTrophy.id))
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
  const legacyPrereleaseWins = profile?.legacy_prerelease_wins ?? 0
  const totalPrereleaseWins = prereleaseWinsList.length + legacyPrereleaseWins
  const localsWinCount = useCountUp(totalLocalsWins)
  const prereleaseWinCount = useCountUp(totalPrereleaseWins)
  // Locals + Pre-Release wins share one "Trophy Wall" of compact badges,
  // interleaved by date rather than shown as two separate card grids.
  const wallItems = [...localsWinsList, ...prereleaseWinsList].sort((a, b) => new Date(b.date) - new Date(a.date))
  const wallLoggedCount = localsWinsList.length + prereleaseWinsList.length
  const wallEventCount = localsEvents.length + prereleaseEvents.length
  const wallLegacyCount = legacyLocalsWins + legacyPrereleaseWins

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
            Set an event's tier (Locals / Pre-Release / Regional / Major) from <Link to="/log" style={{ color: colors.oceanBright, fontWeight: 600 }}>Log Result</Link> — Regional and Major podiums show up here as trophies, Locals and Pre-Release wins are each tallied separately above. Didn't track something on PirateTracker at the time? Use the ✎ on a wins tile, or <b>+ Add Past Result</b> below for a Regional/Major placement.
          </div>
        )}
      </div>

      {/* Manifest strip — one joined panel instead of five stat cards */}
      <StatStrip
        isMobile={isMobile}
        items={[
          { label: 'Locals Wins', value: `🏅 ${localsWinCount}`, accent: colors.emerald, onEdit: isOwner ? () => setEditingLegacyTier('locals') : undefined },
          { label: 'Pre-Release Wins', value: `🎁 ${prereleaseWinCount}`, accent: colors.orange, onEdit: isOwner ? () => setEditingLegacyTier('prerelease') : undefined },
          { label: 'Podium Finishes', value: podiumBig, accent: colors.gold },
          { label: 'Best Finish', value: bestFinish ? placementLabel(bestFinish) : '—' },
          { label: 'Total Events', value: ranked.length },
        ]}
      />

      {/* Featured — the rare stuff (Regional/Major) still earns a full plaque */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.gold }}>★ Featured — Regional Performance</div>
          {isOwner && <button onClick={() => setEditingLegacyTrophy({ defaultTier: 'regional' })} style={{ ...btnGhost, fontSize: 12, padding: '6px 12px' }}>+ Add Past Result</button>}
        </div>
        {bigResults.length === 0 ? (
          <EmptyCase
            message="No Regional or Major podiums logged yet."
            isOwner={isOwner}
            actions={[{ label: 'Add a Past Result', onClick: () => setEditingLegacyTrophy({ defaultTier: 'regional' }) }]}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
            {bigResults.map((t, i) => (
              <TrophyCard
                key={t.id}
                t={t}
                index={i}
                onOpen={tourney => {
                  if (tourney.is_legacy) { if (isOwner) setEditingLegacyTrophy(tourney); return }
                  setSelectedTournament(tourney)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trophy Wall — every Locals/Pre-Release win as one compact badge each,
          instead of two more full-card grids. */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: colors.text }}>🏆 Trophy Wall — {totalLocalsWins + totalPrereleaseWins} wins</div>
            <div style={{ fontSize: 11, color: colors.faint }}>{wallLoggedCount} logged of {wallEventCount} events{wallLegacyCount > 0 ? ` · ${wallLegacyCount} before tracking` : ''}</div>
          </div>
          {isOwner && <button onClick={() => setEditingLegacyTrophy({ defaultTier: 'locals' })} style={{ ...btnGhost, fontSize: 12, padding: '6px 12px' }}>+ Add Past Win</button>}
        </div>
        {wallItems.length === 0 && wallLegacyCount === 0 ? (
          <EmptyCase
            message="No Locals or Pre-Release wins logged yet."
            isOwner={isOwner}
            actions={[{ label: 'Add a Past Win', onClick: () => setEditingLegacyTrophy({ defaultTier: 'locals' }) }]}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
            {wallItems.map((t, i) => (
              <TrophyBadge
                key={t.id}
                t={t}
                index={i}
                isOwner={isOwner}
                onOpen={tourney => {
                  if (tourney.is_legacy) { if (isOwner) setEditingLegacyTrophy(tourney); return }
                  setSelectedTournament(tourney)
                }}
              />
            ))}
            {legacyLocalsWins > 0 && (
              <GhostBadge icon="🏅" label={`+${legacyLocalsWins} before tracking`} leaderId={profile.legacy_locals_leader_id} isOwner={isOwner} onClick={() => isOwner && setEditingLegacyTier('locals')} />
            )}
            {legacyPrereleaseWins > 0 && (
              <GhostBadge icon="🎁" label={`+${legacyPrereleaseWins} before tracking`} leaderId={profile.legacy_prerelease_leader_id} isOwner={isOwner} onClick={() => isOwner && setEditingLegacyTier('prerelease')} />
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
        prereleaseWins={totalPrereleaseWins}
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

      {editingLegacyTier && (
        <LegacyCountModal
          title={editingLegacyTier === 'prerelease' ? 'Pre-Release Wins Before PirateTracker' : 'Locals Wins Before PirateTracker'}
          description={`Add wins from before you started tracking (or ones you never logged individually). This adds straight onto your ${editingLegacyTier === 'prerelease' ? 'Pre-Release' : 'Locals'} Wins tally — it doesn't create tournament entries or affect your win rate or event count.`}
          initialValue={editingLegacyTier === 'prerelease' ? legacyPrereleaseWins : legacyLocalsWins}
          initialLeaderId={editingLegacyTier === 'prerelease' ? profile.legacy_prerelease_leader_id : profile.legacy_locals_leader_id}
          onClose={() => setEditingLegacyTier(null)}
          onSave={(n, leaderId) => saveLegacyCount(editingLegacyTier, n, leaderId)}
          onSplit={() => splitLegacyCount(editingLegacyTier)}
        />
      )}

      {editingLegacyTrophy && (
        <LegacyTrophyModal
          initial={editingLegacyTrophy.id ? editingLegacyTrophy : null}
          defaultTier={editingLegacyTrophy.defaultTier}
          onClose={() => setEditingLegacyTrophy(null)}
          onSave={saveLegacyTrophy}
          onDelete={deleteLegacyTrophy}
        />
      )}
    </div>
  )
}
