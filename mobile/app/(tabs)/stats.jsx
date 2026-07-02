import { useState, useEffect, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { getCardImageUrl } from '../../lib/optcgapi'
import { colors, font, radius } from '../../theme'

const LEADER_COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }

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

// Same aggregation as the web Stats page — see src/pages/Stats.jsx.
function buildMatrix(tournaments, symmetric) {
  const rowLeaders = new Map()
  const colLeaders = new Map()
  const matrix = new Map()
  const rowTotals = new Map()

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

      addObs(myKey, myLeader, oKey, oppLeader, win, r.went_first, r.won_dice_roll)

      if (symmetric) {
        const invFirst = (r.went_first === true || r.went_first === false) ? !r.went_first : null
        const invDice = (r.won_dice_roll === true || r.won_dice_roll === false) ? !r.won_dice_roll : null
        addObs(oKey, oppLeader, myKey, myLeader, 1 - win, invFirst, invDice)
      }
    }
  }

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

// Crimson (low) → emerald (high) tint.
function cellBg(wr) {
  const t = (wr - 0.5) * 2
  if (t >= 0) return `rgba(59,178,126,${(0.1 + t * 0.5).toFixed(3)})`
  return `rgba(210,74,58,${(0.1 + (-t) * 0.5).toFixed(3)})`
}

function Toggle({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value === o.key
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.sm,
              borderWidth: 1, borderColor: active ? colors.goldLine : colors.lineStrong,
              backgroundColor: active ? colors.goldSoft : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{o.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const HEAD_BG = '#0b1828'
const ROW_W = 128
const CELL_W = 58
const CELL_H = 52

export default function Stats() {
  const { session } = useSession()
  const [scope, setScope] = useState('mine')
  const [metric, setMetric] = useState('overall')
  const [rowSearch, setRowSearch] = useState('')
  const [colSearch, setColSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 11, fontFamily: font.semi, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.gold, marginBottom: 6 }}>⚓ Navigator's Charts</Text>
        <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>
          Your leaders (rows) vs leaders you've faced (columns). Cell = your win rate in that matchup.
        </Text>
      </View>

      <View style={{ gap: 12, marginBottom: 16 }}>
        <Toggle options={[{ key: 'mine', label: 'Mine' }, { key: 'global', label: 'Global' }]} value={scope} onChange={setScope} />
        <Toggle options={METRICS} value={metric} onChange={setMetric} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            placeholder="Your leaders..."
            placeholderTextColor={colors.faint}
            value={rowSearch}
            onChangeText={setRowSearch}
            style={{ flex: 1, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
          />
          <TextInput
            placeholder="Opponents..."
            placeholderTextColor={colors.faint}
            value={colSearch}
            onChangeText={setColSearch}
            style={{ flex: 1, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12, color: colors.text, fontSize: 13, fontFamily: font.body }}
          />
        </View>
      </View>

      {loading ? (
        <View style={{ height: 320, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : myLeaders.length === 0 || oppLeaders.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 80 }}>
          <Text style={{ fontSize: 40, marginBottom: 14 }}>🗺️</Text>
          <Text style={{ fontSize: 16, fontFamily: font.display, color: colors.textSoft }}>Not enough matchup data yet</Text>
          <Text style={{ fontSize: 13, color: colors.faint, marginTop: 6, fontFamily: font.body, textAlign: 'center' }}>
            Log tournaments with round-by-round opponents to build your matchup chart.
          </Text>
        </View>
      ) : shownMy.length === 0 || shownOpp.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 80 }}>
          <Text style={{ fontSize: 40, marginBottom: 14 }}>🔍</Text>
          <Text style={{ fontSize: 16, fontFamily: font.display, color: colors.textSoft }}>No leaders match your search</Text>
          <TouchableOpacity
            onPress={() => { setRowSearch(''); setColSearch('') }}
            style={{ marginTop: 12, paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.lineStrong }}
          >
            <Text style={{ fontSize: 12, fontFamily: font.semi, color: colors.muted }}>Clear search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg }}>
            <View>
              {/* Header row */}
              <View style={{ flexDirection: 'row', backgroundColor: HEAD_BG, borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.16)' }}>
                <View style={{ width: ROW_W, justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 6, borderRightWidth: 1, borderRightColor: 'rgba(140,176,208,0.16)' }}>
                  <Text style={{ fontSize: 10, color: colors.faint, fontFamily: font.bold, textTransform: 'uppercase', letterSpacing: 0.6 }}>You ↓ / vs →</Text>
                </View>
                {shownOpp.map(o => (
                  <View key={o.key} style={{ width: CELL_W, alignItems: 'center', paddingVertical: 6, gap: 3 }}>
                    <Image
                      source={{ uri: getCardImageUrl(o.id) }}
                      style={{ width: 34, height: 47, borderRadius: 4, borderWidth: 1.5, borderColor: (LEADER_COLORS[o.color] ?? '#94a3b8') + '66' }}
                      resizeMode="cover"
                    />
                    <Text numberOfLines={1} style={{ fontSize: 9, color: colors.muted, fontFamily: font.semi, maxWidth: CELL_W - 6, textAlign: 'center' }}>{o.name}</Text>
                  </View>
                ))}
              </View>

              {/* Data rows */}
              {shownMy.map(m => {
                const lt = myTotals.get(m.key) ?? [0, 0]
                const lwr = lt[1] > 0 ? Math.round(lt[0] / lt[1] * 100) : 0
                return (
                  <View key={m.key} style={{ flexDirection: 'row' }}>
                    <View style={{ width: ROW_W, backgroundColor: HEAD_BG, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: 'rgba(140,176,208,0.16)', borderBottomWidth: 1, borderBottomColor: 'rgba(140,176,208,0.07)' }}>
                      <Image
                        source={{ uri: getCardImageUrl(m.id) }}
                        style={{ width: 30, height: 41, borderRadius: 4, borderWidth: 1.5, borderColor: (LEADER_COLORS[m.color] ?? '#94a3b8') + '66' }}
                        resizeMode="cover"
                      />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.bold, color: colors.text }}>{m.name}</Text>
                        <Text style={{ fontSize: 10, color: colors.muted, fontFamily: font.mono }}>{lwr}% · {lt[0]}-{lt[1] - lt[0]}</Text>
                      </View>
                    </View>
                    {shownOpp.map(o => {
                      const agg = matrix.get(`${m.key}|${o.key}`)
                      const pair = agg ? agg[metric] : [0, 0]
                      const [w, tot] = pair
                      const wr = tot > 0 ? w / tot : null
                      return (
                        <View
                          key={o.key}
                          style={{
                            width: CELL_W, height: CELL_H, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: wr !== null ? cellBg(wr) : 'rgba(140,176,208,0.015)',
                            opacity: wr !== null && tot < 3 ? 0.4 : 1,
                            borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.25)',
                            borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.25)',
                          }}
                        >
                          {wr !== null ? (
                            <>
                              <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text }}>{Math.round(wr * 100)}%</Text>
                              <Text style={{ fontSize: 9, color: 'rgba(140,176,208,0.5)', fontFamily: font.mono }}>{w}-{tot - w}</Text>
                            </>
                          ) : (
                            <Text style={{ fontSize: 12, color: '#3a526a' }}>—</Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={{ marginTop: 12, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>Lower</Text>
              <View style={{ width: 120, height: 10, borderRadius: 5, backgroundColor: 'rgba(140,176,208,0.15)', overflow: 'hidden', flexDirection: 'row' }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(210,74,58,0.55)' }} />
                <View style={{ flex: 1, backgroundColor: 'rgba(210,74,58,0.18)' }} />
                <View style={{ flex: 1, backgroundColor: 'rgba(59,178,126,0.18)' }} />
                <View style={{ flex: 1, backgroundColor: 'rgba(59,178,126,0.55)' }} />
              </View>
              <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>Higher win rate</Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>Faded cells = fewer than 3 games. Row label shows overall win rate · record.</Text>
          </View>
        </View>
      )}
    </ScrollView>
  )
}
