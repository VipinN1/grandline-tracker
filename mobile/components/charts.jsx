// Native SVG charts for the dashboard — RN ports of the recharts views in
// src/pages/Dashboard.jsx (placement trend line, leader usage donut,
// win-rate gradient bars). The trend chart supports touch-drag scrubbing
// with a dot-by-dot tooltip, mirroring the web hover tooltip.
import { useState } from 'react'
import { View, Text } from 'react-native'
import Svg, { Polyline, Circle, Line as SvgLine, Path, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, font } from '../theme'

export const LEADER_COLORS = { Red: '#e05545', Blue: '#3f8fd6', Green: '#3bb27e', Purple: '#8d7ae6', Yellow: '#e6b84f', Black: '#94a3b8' }
const FALLBACK = colors.ocean

export function leaderColorList(leaderColor) {
  return (leaderColor ?? '').split(/[\s/]+/).map(c => LEADER_COLORS[c.trim()]).filter(Boolean)
}

function dotColor(placement) {
  if (placement === 1) return colors.gold
  if (placement <= 3) return colors.orange
  if (placement <= 8) return colors.ocean
  return colors.faint
}

function placementLabel(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

// ─── Placement trend ─────────────────────────────────────────────────────────
// data: [{ date, placement, name?, players?, location? }] oldest → newest.
// Y axis reversed (1st on top). Touch and drag across the chart to scrub
// dot-by-dot; a tooltip follows the active dot (web parity: date,
// "Nth of N players", tournament name — plus location on mobile).
const TOOLTIP_W = 200

export function PlacementTrendChart({ data, height = 190 }) {
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(null)

  const PAD_L = 40
  const PAD_R = 14
  const PAD_T = 12
  const PAD_B = 26

  const maxP = Math.max(4, Math.ceil(Math.max(...data.map(d => d.placement)) / 4) * 4)
  const yTicks = []
  for (let v = 4; v <= maxP; v += 4) yTicks.push(v)

  const plotW = width - PAD_L - PAD_R
  const plotH = height - PAD_T - PAD_B
  const xAt = i => PAD_L + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const yAt = p => PAD_T + ((p - 1) / (maxP - 1)) * plotH

  const labelStep = Math.max(1, Math.ceil(data.length / 6))
  const labeled = data.map((_, i) => i % labelStep === 0 || i === data.length - 1)

  // Snap a touch x-position to the nearest dot.
  function scrubTo(x) {
    if (plotW <= 0 || data.length === 0) return
    const t = (x - PAD_L) / plotW
    const i = Math.min(data.length - 1, Math.max(0, Math.round(t * (data.length - 1))))
    setActive(i)
  }

  const d = active !== null ? data[active] : null
  // Keep the tooltip inside the chart, centered on the dot when possible.
  const tooltipLeft = d ? Math.min(Math.max(xAt(active) - TOOLTIP_W / 2, 0), Math.max(width - TOOLTIP_W, 0)) : 0

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {width > 0 && (
        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={e => scrubTo(e.nativeEvent.locationX)}
          onResponderMove={e => scrubTo(e.nativeEvent.locationX)}
          onResponderRelease={() => setActive(null)}
          onResponderTerminate={() => setActive(null)}
          onResponderTerminationRequest={() => false}
        >
          <Svg width={width} height={height}>
            {yTicks.map(v => (
              <SvgLine key={v} x1={PAD_L} y1={yAt(v)} x2={width - PAD_R} y2={yAt(v)} stroke="rgba(140,176,208,0.09)" strokeWidth={1} strokeDasharray="3 3" />
            ))}
            {data.map((_, i) => labeled[i] ? (
              <SvgLine key={i} x1={xAt(i)} y1={PAD_T} x2={xAt(i)} y2={height - PAD_B} stroke="rgba(140,176,208,0.06)" strokeWidth={1} strokeDasharray="3 3" />
            ) : null)}
            {yTicks.map(v => (
              <SvgText key={v} x={PAD_L - 8} y={yAt(v) + 4} fill={colors.muted} fontSize={11} textAnchor="end">{`#${v}`}</SvgText>
            ))}
            {data.map((d2, i) => labeled[i] ? (
              <SvgText key={i} x={xAt(i)} y={height - 8} fill={colors.muted} fontSize={10} textAnchor="middle">{d2.date}</SvgText>
            ) : null)}
            {active !== null && (
              <SvgLine x1={xAt(active)} y1={PAD_T} x2={xAt(active)} y2={height - PAD_B} stroke="rgba(220,179,94,0.45)" strokeWidth={1.5} />
            )}
            <Polyline
              points={data.map((d2, i) => `${xAt(i)},${yAt(d2.placement)}`).join(' ')}
              fill="none"
              stroke={colors.oceanBright}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {data.map((d2, i) => (
              <Circle key={i} cx={xAt(i)} cy={yAt(d2.placement)} r={i === active ? 7 : 5} fill={dotColor(d2.placement)}
                stroke={i === active ? '#fff' : 'none'} strokeWidth={i === active ? 1.5 : 0} />
            ))}
          </Svg>
          {/* Tooltip floats over the chart while scrubbing — no reserved space. */}
          {d ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 2, left: tooltipLeft, width: TOOLTIP_W, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 11, color: colors.muted, fontFamily: font.body }}>{d.date}</Text>
              <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.text, marginTop: 2 }}>
                {placementLabel(d.placement)}{d.players ? ` of ${d.players} players` : ''}
              </Text>
              {d.name ? <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: font.body }}>{d.name}</Text> : null}
              {d.location ? <Text numberOfLines={1} style={{ fontSize: 11, color: colors.faint, marginTop: 2, fontFamily: font.body }}>📍 {d.location}</Text> : null}
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

// ─── Leader usage donut ──────────────────────────────────────────────────────
// Slices start at 12 o'clock, clockwise. Dual-color leaders get a gradient
// swept along the ring (same construction as the web dashboard).
const DONUT = { size: 150, r: 70, inner: 42, padDeg: 3 }

function polar(cx, cy, r, theta) {
  return [cx + r * Math.sin(theta), cy - r * Math.cos(theta)]
}

function arcPath(cx, cy, rOuter, rInner, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [ox0, oy0] = polar(cx, cy, rOuter, a0)
  const [ox1, oy1] = polar(cx, cy, rOuter, a1)
  const [ix0, iy0] = polar(cx, cy, rInner, a0)
  const [ix1, iy1] = polar(cx, cy, rInner, a1)
  return `M ${ox0} ${oy0} A ${rOuter} ${rOuter} 0 ${large} 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${rInner} ${rInner} 0 ${large} 0 ${ix0} ${iy0} Z`
}

export function LeaderDonut({ leaders }) {
  const { size, r, inner, padDeg } = DONUT
  const cx = size / 2
  const cy = size / 2
  const total = leaders.reduce((s, l) => s + l.count, 0)
  if (total === 0) return null

  const pad = (padDeg * Math.PI) / 180
  const rMid = (inner + r) / 2

  let angle = 0
  const slices = leaders.map((l, i) => {
    const sweep = (l.count / total) * 2 * Math.PI
    const a0 = angle + (leaders.length > 1 ? pad / 2 : 0)
    const a1 = angle + sweep - (leaders.length > 1 ? pad / 2 : 0)
    const mid = angle + sweep / 2
    angle += sweep
    return { ...l, i, a0, a1, mid, pct: l.count / total }
  })

  return (
    <Svg width={size} height={size}>
      <Defs>
        {slices.map(s => {
          const cols = leaderColorList(s.leaderColor)
          if (cols.length < 2) return null
          const [mx, my] = polar(cx, cy, rMid, s.mid)
          const dx = Math.cos(s.mid)
          const dy = Math.sin(s.mid)
          return (
            <SvgGradient key={s.i} id={`donut-${s.i}`} gradientUnits="userSpaceOnUse"
              x1={mx - r * dx} y1={my - r * dy} x2={mx + r * dx} y2={my + r * dy}>
              <Stop offset="0" stopColor={cols[0]} />
              <Stop offset="1" stopColor={cols[1]} />
            </SvgGradient>
          )
        })}
      </Defs>
      {slices.length === 1 ? (
        <Circle cx={cx} cy={cy} r={rMid} fill="none" strokeWidth={r - inner}
          stroke={leaderColorList(slices[0].leaderColor)[0] ?? FALLBACK} />
      ) : (
        slices.map(s => {
          const cols = leaderColorList(s.leaderColor)
          const fill = cols.length > 1 ? `url(#donut-${s.i})` : (cols[0] ?? FALLBACK)
          return <Path key={s.i} d={arcPath(cx, cy, r, inner, s.a0, s.a1)} fill={fill} />
        })
      )}
      {slices.map(s => {
        if (s.pct < 0.08) return null
        const [tx, ty] = polar(cx, cy, rMid, s.mid)
        return (
          <SvgText key={`t${s.i}`} x={tx} y={ty + 4} fill="#fff" fontSize={11} fontWeight="700" textAnchor="middle">
            {`${Math.round(s.pct * 100)}%`}
          </SvgText>
        )
      })}
    </Svg>
  )
}

// Legend swatch — gradient dot for dual-color leaders.
export function LeaderDot({ leaderColor, size = 8 }) {
  const cols = leaderColorList(leaderColor)
  if (cols.length > 1) {
    return (
      <LinearGradient colors={[cols[0], cols[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2 }} />
    )
  }
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: cols[0] ?? FALLBACK }} />
}

// ─── Win-rate bar ────────────────────────────────────────────────────────────
export function WinRateBar({ pct }) {
  return (
    <View style={{ height: 7, backgroundColor: 'rgba(140,176,208,0.08)', borderRadius: 4, overflow: 'hidden' }}>
      {pct > 0 && (
        <LinearGradient colors={[colors.teal, colors.oceanBright]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 4 }} />
      )}
    </View>
  )
}
