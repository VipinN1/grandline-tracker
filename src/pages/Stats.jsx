import { useState, useEffect, useMemo } from 'react'
import { getCardImageUrl } from '../lib/optcgapi'
import { supabase } from '../lib/supabase'
import { useWindowSize } from '../hooks/useWindowSize'

const COLORS = { Red: '#f05252', Blue: '#3d7fff', Green: '#34d399', Purple: '#a78bfa', Yellow: '#fbbf24', Black: '#94a3b8' }

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

const MAX_AXIS = 18 // cap rows/cols so the grid stays readable

function emptyAgg() {
  return { overall: [0, 0], first: [0, 0], second: [0, 0], diceWon: [0, 0], diceLost: [0, 0] }
}

function bump(pair, win) { pair[0] += win; pair[1] += 1 }

function buildMatrix(tournaments) {
  const my = new Map()        // baseKey -> { key, id, name, color }
  const opp = new Map()
  const matrix = new Map()    // `${myKey}|${oppKey}` -> agg
  const myTotals = new Map()  // myKey -> [wins, total] (overall, for row summary)

  for (const t of tournaments) {
    if (!t.leader_id) continue
    const myKey = baseId(t.leader_id)
    if (!my.has(myKey)) my.set(myKey, { key: myKey, id: t.leader_id, name: cleanName(t.leader_name) || 'Unknown', color: t.leader_color })
    let mt = myTotals.get(myKey) ?? [0, 0]

    for (const r of (t.tournament_rounds ?? [])) {
      if (r.result !== 'win' && r.result !== 'loss') continue
      const oKey = r.opponent_leader_id ? baseId(r.opponent_leader_id) : (r.opponent_leader_name ? `n:${cleanName(r.opponent_leader_name)}` : null)
      if (!oKey) continue
      if (!opp.has(oKey)) opp.set(oKey, { key: oKey, id: r.opponent_leader_id, name: cleanName(r.opponent_leader_name) || 'Unknown', color: r.opponent_leader_color })

      const win = r.result === 'win' ? 1 : 0
      bump(mt, win)

      const mk = `${myKey}|${oKey}`
      const agg = matrix.get(mk) ?? emptyAgg()
      bump(agg.overall, win)
      if (r.went_first === true) bump(agg.first, win)
      else if (r.went_first === false) bump(agg.second, win)
      if (r.won_dice_roll === true) bump(agg.diceWon, win)
      else if (r.won_dice_roll === false) bump(agg.diceLost, win)
      matrix.set(mk, agg)
    }
    myTotals.set(myKey, mt)
  }

  const myLeaders = [...my.values()]
    .filter(m => (myTotals.get(m.key)?.[1] ?? 0) > 0)
    .sort((a, b) => (myTotals.get(b.key)?.[1] ?? 0) - (myTotals.get(a.key)?.[1] ?? 0))
    .slice(0, MAX_AXIS)

  const oppTotals = new Map()
  for (const [mk, agg] of matrix) {
    const oKey = mk.slice(mk.indexOf('|') + 1)
    oppTotals.set(oKey, (oppTotals.get(oKey) ?? 0) + agg.overall[1])
  }
  const oppLeaders = [...opp.values()]
    .sort((a, b) => (oppTotals.get(b.key) ?? 0) - (oppTotals.get(a.key) ?? 0))
    .slice(0, MAX_AXIS)

  return { myLeaders, oppLeaders, matrix, myTotals }
}

// Red (low) → green (high) tint, layered over the dark grid.
function cellBg(wr) {
  const t = (wr - 0.5) * 2 // -1 .. 1
  if (t >= 0) return `rgba(52,211,153,${(0.1 + t * 0.5).toFixed(3)})`
  return `rgba(240,82,82,${(0.1 + (-t) * 0.5).toFixed(3)})`
}

function Toggle({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${value === o.key ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
            background: value === o.key ? 'rgba(139,92,246,0.16)' : 'transparent',
            color: value === o.key ? '#c4b5fd' : '#7c6fa0',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const HEAD_BG = '#0f0b1e'

export default function Stats({ session }) {
  const [scope, setScope] = useState('mine')
  const [metric, setMetric] = useState('overall')
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

  const { myLeaders, oppLeaders, matrix, myTotals } = useMemo(() => buildMatrix(rows), [rows])

  const ROW_W = isMobile ? 128 : 152
  const CELL_W = isMobile ? 58 : 66
  const CELL_H = 52

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b5cf6', marginBottom: 4 }}>Analytics</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.4px', marginBottom: 2 }}>Stats</div>
        <div style={{ fontSize: 13, color: '#7c6fa0' }}>Your leaders (rows) vs leaders you've faced (columns). Cell = your win rate in that matchup.</div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#3d2d6e', marginBottom: 6 }}>Data</div>
          <Toggle options={[{ key: 'mine', label: 'Mine' }, { key: 'global', label: 'Global' }]} value={scope} onChange={setScope} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#3d2d6e', marginBottom: 6 }}>Condition</div>
          <Toggle options={METRICS} value={metric} onChange={setMetric} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#7c6fa0', fontSize: 13 }}>Loading matchups…</div>
      ) : myLeaders.length === 0 || oppLeaders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#7c6fa0' }}>Not enough matchup data yet</div>
          <div style={{ fontSize: 13, color: '#3d2d6e', marginTop: 6 }}>Log tournaments with round-by-round opponents to build your matchup chart.</div>
        </div>
      ) : (
        <>
          <div style={{ overflow: 'auto', maxHeight: '72vh', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 4, background: HEAD_BG, width: ROW_W, minWidth: ROW_W, borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: 10, color: '#3d2d6e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 10px', textAlign: 'left' }}>You ↓ / vs →</div>
                  </th>
                  {oppLeaders.map(o => (
                    <th key={o.key} style={{ position: 'sticky', top: 0, zIndex: 3, background: HEAD_BG, width: CELL_W, minWidth: CELL_W, padding: '6px 2px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <img src={getCardImageUrl(o.id)} alt={o.name} style={{ width: 34, height: 47, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, border: `1.5px solid ${(COLORS[o.color] ?? '#94a3b8')}66` }} onError={e => { e.target.style.opacity = '0.2' }} />
                        <div style={{ fontSize: 9, color: '#9b8fc4', fontWeight: 600, maxWidth: CELL_W - 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{o.name}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myLeaders.map(m => {
                  const lt = myTotals.get(m.key) ?? [0, 0]
                  const lwr = lt[1] > 0 ? Math.round(lt[0] / lt[1] * 100) : 0
                  return (
                    <tr key={m.key}>
                      <th style={{ position: 'sticky', left: 0, zIndex: 2, background: HEAD_BG, width: ROW_W, minWidth: ROW_W, padding: '6px 10px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img src={getCardImageUrl(m.id)} alt={m.name} style={{ width: 30, height: 41, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, flexShrink: 0, border: `1.5px solid ${(COLORS[m.color] ?? '#94a3b8')}66` }} onError={e => { e.target.style.opacity = '0.2' }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f2f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: ROW_W - 50 }}>{m.name}</div>
                            <div style={{ fontSize: 10, color: '#7c6fa0', fontFamily: 'monospace' }}>{lwr}% · {lt[0]}-{lt[1] - lt[0]}</div>
                          </div>
                        </div>
                      </th>
                      {oppLeaders.map(o => {
                        const agg = matrix.get(`${m.key}|${o.key}`)
                        const pair = agg ? agg[metric] : [0, 0]
                        const [w, tot] = pair
                        const wr = tot > 0 ? w / tot : null
                        return (
                          <td key={o.key} style={{ padding: 0, borderRight: '1px solid rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(0,0,0,0.25)' }}>
                            <div style={{ width: CELL_W, height: CELL_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: wr !== null ? cellBg(wr) : 'rgba(255,255,255,0.015)', opacity: wr !== null && tot < 3 ? 0.4 : 1 }} title={m.name + ' vs ' + o.name + (tot > 0 ? ` — ${w}W ${tot - w}L` : ' — no games')}>
                              {wr !== null ? (
                                <>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f2f5' }}>{Math.round(wr * 100)}%</div>
                                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{w}-{tot - w}</div>
                                </>
                              ) : (
                                <div style={{ fontSize: 12, color: '#2a1f4a' }}>—</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 11, color: '#7c6fa0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Lower</span>
              <div style={{ width: 120, height: 10, borderRadius: 5, background: 'linear-gradient(to right, rgba(240,82,82,0.6), rgba(240,82,82,0.12), rgba(52,211,153,0.12), rgba(52,211,153,0.6))' }} />
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
