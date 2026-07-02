import { useState, useEffect, useMemo } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'
import { colors, radius, shadow, font, eyebrow, pageHeader, input } from '../theme'

const COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }

function cleanName(name) {
  if (!name) return ''
  return name.replace(/\s*-\s*[A-Z]{1,3}\d*-\d+.*$/, '').replace(/\s*\([^)]*\)$/, '').trim()
}

// Group leader variants (parallels, alt art) under one base card id.
function baseId(id) {
  return id?.match(/^[A-Z]{1,3}[0-9]{0,3}-[0-9]+/i)?.[0] ?? id ?? ''
}

const METRICS = [
  { key: 'overall', label: 'Overall' },
  { key: 'first', label: 'Going 1st' },
  { key: 'second', label: 'Going 2nd' },
  { key: 'diceWon', label: 'Won Dice' },
  { key: 'diceLost', label: 'Lost Dice' },
]

function emptyAgg() {
  return { overall: [0, 0], first: [0, 0], second: [0, 0], diceWon: [0, 0], diceLost: [0, 0] }
}

function bump(pair, win) { pair[0] += win; pair[1] += 1 }

// When `symmetric` is true (Global), each game is counted from BOTH sides:
// A-beats-B also records B-loses-to-A, with dice/first-second inverted for the
// mirror. When false (Mine), it's directional — rows are decks you piloted,
// columns are opponents you faced.
function buildMatrix(tournaments, symmetric) {
  const rowLeaders = new Map() // rowKey -> { key, id, name, color }
  const colLeaders = new Map() // colKey -> { key, id, name, color }
  const matrix = new Map()     // `${rowKey}|${colKey}` -> agg
  const rowTotals = new Map()  // rowKey -> [wins, total] (overall, for row summary)

  function addObs(rowKey, rowLeader, colKey, colLeader, win, wentFirst, wonDice) {
    if (!rowLeaders.has(rowKey)) rowLeaders.set(rowKey, rowLeader)
    if (!colLeaders.has(colKey)) colLeaders.set(colKey, colLeader)
    const rt = rowTotals.get(rowKey) ?? [0, 0]; bump(rt, win); rowTotals.set(rowKey, rt)
    const mk = `${rowKey}|${colKey}`
    const agg = matrix.get(mk) ?? emptyAgg()
    bump(agg.overall, win)
    if (wentFirst === true) bump(agg.first, win)
    else if (wentFirst === false) bump(agg.second, win)
    if (wonDice === true) bump(agg.diceWon, win)
    else if (wonDice === false) bump(agg.diceLost, win)
    matrix.set(mk, agg)
  }

  for (const t of tournaments) {
    if (!t.leader_id) continue
    const myKey = baseId(t.leader_id)
    const myLeader = { key: myKey, id: t.leader_id, name: cleanName(t.leader_name) || 'Unknown', color: t.leader_color }

    for (const r of (t.tournament_rounds ?? [])) {
      if (r.result !== 'win' && r.result !== 'loss') continue
      const oKey = r.opponent_leader_id ? baseId(r.opponent_leader_id) : (r.opponent_leader_name ? `n:${cleanName(r.opponent_leader_name)}` : null)
      if (!oKey) continue
      const oppLeader = { key: oKey, id: r.opponent_leader_id, name: cleanName(r.opponent_leader_name) || 'Unknown', color: r.opponent_leader_color }
      const win = r.result === 'win' ? 1 : 0

      // Your perspective
      addObs(myKey, myLeader, oKey, oppLeader, win, r.went_first, r.won_dice_roll)

      // Opponent's perspective (Global only) — invert result, dice and order
      if (symmetric) {
        const invFirst = (r.went_first === true || r.went_first === false) ? !r.went_first : null
        const invDice = (r.won_dice_roll === true || r.won_dice_roll === false) ? !r.won_dice_roll : null
        addObs(oKey, oppLeader, myKey, myLeader, 1 - win, invFirst, invDice)
      }
    }
  }

  // No cap — show every leader on both axes for Mine and Global alike.
  const myLeaders = [...rowLeaders.values()]
    .filter(m => (rowTotals.get(m.key)?.[1] ?? 0) > 0)
    .sort((a, b) => (rowTotals.get(b.key)?.[1] ?? 0) - (rowTotals.get(a.key)?.[1] ?? 0))

  const colTotals = new Map()
  for (const [mk, agg] of matrix) {
    const oKey = mk.slice(mk.indexOf('|') + 1)
    colTotals.set(oKey, (colTotals.get(oKey) ?? 0) + agg.overall[1])
  }
  const oppLeaders = [...colLeaders.values()]
    .sort((a, b) => (colTotals.get(b.key) ?? 0) - (colTotals.get(a.key) ?? 0))

  return { myLeaders, oppLeaders, matrix, myTotals: rowTotals }
}

// Crimson (low) → emerald (high) tint, layered over the dark grid.
function cellBg(wr) {
  const t = (wr - 0.5) * 2 // -1 .. 1
  if (t >= 0) return `rgba(59,178,126,${(0.1 + t * 0.5).toFixed(3)})`
  return `rgba(210,74,58,${(0.1 + (-t) * 0.5).toFixed(3)})`
}

function Toggle({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="gl-btn"
          style={{
            fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${value === o.key ? colors.goldLine : colors.lineStrong}`,
            background: value === o.key ? colors.goldSoft : 'transparent',
            color: value === o.key ? colors.gold : colors.muted,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const HEAD_BG = '#0b1828'

export default function Stats({ session }) {
  const [scope, setScope] = useState('mine')
  const [metric, setMetric] = useState('overall')
  const [rowSearch, setRowSearch] = useState('')
  const [colSearch, setColSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const { isMobile } = useWindowSize()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (scope === 'mine' && !session) { setRows([]); setLoading(false); return }
      let q = supabase
        .from('tournaments')
        .select('leader_id, leader_name, leader_color, tournament_rounds(opponent_leader_id, opponent_leader_name, opponent_leader_color, won_dice_roll, went_first, result)')
        .eq('is_practice', false)
        .limit(5000)
      if (scope === 'mine') q = q.eq('user_id', session.user.id)
      const { data } = await q
      if (cancelled) return
      setRows(data ?? [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [scope, session])

  const { myLeaders, oppLeaders, matrix, myTotals } = useMemo(() => buildMatrix(rows, scope === 'global'), [rows, scope])

  const shownMy = useMemo(() => {
    const q = rowSearch.trim().toLowerCase()
    return q ? myLeaders.filter(m => m.name.toLowerCase().includes(q)) : myLeaders
  }, [myLeaders, rowSearch])
  const shownOpp = useMemo(() => {
    const q = colSearch.trim().toLowerCase()
    return q ? oppLeaders.filter(o => o.name.toLowerCase().includes(q)) : oppLeaders
  }, [oppLeaders, colSearch])

  const ROW_W = isMobile ? 128 : 152
  const CELL_W = isMobile ? 58 : 66
  const CELL_H = 52

  return (
    <div className="gl-page-enter">
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...eyebrow, marginBottom: 8 }}>⚓ Navigator's Charts</div>
        <div style={{ ...pageHeader(), fontSize: 30, marginBottom: 6 }}>Stats</div>
        <div style={{ fontSize: 14, color: colors.muted }}>Your leaders (rows) vs leaders you've faced (columns). Cell = your win rate in that matchup.</div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: colors.faint, marginBottom: 7 }}>Data</div>
          <Toggle options={[{ key: 'mine', label: 'Mine' }, { key: 'global', label: 'Global' }]} value={scope} onChange={setScope} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: colors.faint, marginBottom: 7 }}>Condition</div>
          <Toggle options={METRICS} value={metric} onChange={setMetric} />
        </div>
        <div style={{ flex: 1, minWidth: isMobile ? '100%' : 320 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: colors.faint, marginBottom: 7 }}>Search</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="text" placeholder={scope === 'mine' ? 'Your leaders...' : 'Leaders (rows)...'} value={rowSearch} onChange={e => setRowSearch(e.target.value)} style={{ ...input, width: 'auto', flex: 1, minWidth: 140, padding: '7px 12px', fontSize: 13 }} />
            <input type="text" placeholder={scope === 'mine' ? 'Opponent leaders...' : 'Opponents (columns)...'} value={colSearch} onChange={e => setColSearch(e.target.value)} style={{ ...input, width: 'auto', flex: 1, minWidth: 140, padding: '7px 12px', fontSize: 13 }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 320, borderRadius: radius.lg }} />
      ) : myLeaders.length === 0 || oppLeaders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.7 }}>🗺️</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: font.display, color: colors.textSoft }}>Not enough matchup data yet</div>
          <div style={{ fontSize: 13, color: colors.faint, marginTop: 6 }}>Log tournaments with round-by-round opponents to build your matchup chart.</div>
        </div>
      ) : shownMy.length === 0 || shownOpp.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.7 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: font.display, color: colors.textSoft }}>No leaders match your search</div>
          <button onClick={() => { setRowSearch(''); setColSearch('') }} className="gl-btn" style={{ marginTop: 12, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${colors.lineStrong}`, background: 'transparent', color: colors.muted }}>Clear search</button>
        </div>
      ) : (
        <>
          <div style={{ overflow: 'auto', maxHeight: '72vh', border: `1px solid ${colors.line}`, borderRadius: radius.lg, boxShadow: shadow.md }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 4, background: HEAD_BG, width: ROW_W, minWidth: ROW_W, borderRight: '1px solid rgba(140,176,208,0.16)', borderBottom: '1px solid rgba(140,176,208,0.16)' }}>
                    <div style={{ fontSize: 10, color: '#67809a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 10px', textAlign: 'left' }}>You ↓ / vs →</div>
                  </th>
                  {shownOpp.map(o => (
                    <th key={o.key} style={{ position: 'sticky', top: 0, zIndex: 3, background: HEAD_BG, width: CELL_W, minWidth: CELL_W, padding: '6px 2px', borderBottom: '1px solid rgba(140,176,208,0.16)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <img src={getCardImageUrl(o.id)} alt={o.name} style={{ width: 34, height: 47, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: `1.5px solid ${(COLORS[o.color] ?? '#94a3b8')}66` }} onError={e => { e.target.style.opacity = '0.2' }} />
                        <div style={{ fontSize: 9, color: '#9db2c6', fontWeight: 600, maxWidth: CELL_W - 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{o.name}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownMy.map(m => {
                  const lt = myTotals.get(m.key) ?? [0, 0]
                  const lwr = lt[1] > 0 ? Math.round(lt[0] / lt[1] * 100) : 0
                  return (
                    <tr key={m.key}>
                      <th style={{ position: 'sticky', left: 0, zIndex: 2, background: HEAD_BG, width: ROW_W, minWidth: ROW_W, padding: '6px 10px', textAlign: 'left', borderRight: '1px solid rgba(140,176,208,0.16)', borderBottom: '1px solid rgba(140,176,208,0.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img src={getCardImageUrl(m.id)} alt={m.name} style={{ width: 30, height: 41, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0, border: `1.5px solid ${(COLORS[m.color] ?? '#94a3b8')}66` }} onError={e => { e.target.style.opacity = '0.2' }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#e9f1f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: ROW_W - 50 }}>{m.name}</div>
                            <div style={{ fontSize: 10, color: '#9db2c6', fontFamily: 'monospace' }}>{lwr}% · {lt[0]}-{lt[1] - lt[0]}</div>
                          </div>
                        </div>
                      </th>
                      {shownOpp.map(o => {
                        const agg = matrix.get(`${m.key}|${o.key}`)
                        const pair = agg ? agg[metric] : [0, 0]
                        const [w, tot] = pair
                        const wr = tot > 0 ? w / tot : null
                        return (
                          <td key={o.key} style={{ padding: 0, borderRight: '1px solid rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(0,0,0,0.25)' }}>
                            <div style={{ width: CELL_W, height: CELL_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: wr !== null ? cellBg(wr) : 'rgba(140,176,208,0.015)', opacity: wr !== null && tot < 3 ? 0.4 : 1 }} title={m.name + ' vs ' + o.name + (tot > 0 ? ` — ${w}W ${tot - w}L` : ' — no games')}>
                              {wr !== null ? (
                                <>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e9f1f8' }}>{Math.round(wr * 100)}%</div>
                                  <div style={{ fontSize: 9, color: 'rgba(140,176,208,0.5)', fontFamily: 'monospace' }}>{w}-{tot - w}</div>
                                </>
                              ) : (
                                <div style={{ fontSize: 12, color: '#3a526a' }}>—</div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 11, color: '#9db2c6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Lower</span>
              <div style={{ width: 120, height: 10, borderRadius: 5, background: 'linear-gradient(to right, rgba(210,74,58,0.6), rgba(210,74,58,0.12), rgba(59,178,126,0.12), rgba(59,178,126,0.6))' }} />
              <span>Higher win rate</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.4 }}>50%</span>
              <span>= fewer than 3 games (faded)</span>
            </div>
            <div>Row label shows that leader's overall win rate · record.</div>
          </div>
        </>
      )}
    </div>
  )
}
