// ─────────────────────────────────────────────────────────────────────────────
// Grand Line design system — nautical / Grand Line exploration theme.
//
// One source of truth for colors, spacing, typography, shadows, radii and
// transitions, plus a set of reusable style helpers so every page composes the
// same primitives. The app is inline-styled, so components import these objects
// directly. Global CSS variables mirroring these tokens live in index.css for
// use in base element styling and class-based utilities.
// ─────────────────────────────────────────────────────────────────────────────

// ── Color palette ────────────────────────────────────────────────────────────
// Deep ocean navy base, brass/gold accents, parchment, with sparing crimson /
// emerald / orange. Tuned for AA contrast on the dark surfaces below.
export const colors = {
  // Layered dark-ocean backgrounds (deepest → raised surface)
  abyss:      '#06101b', // app background base
  deep:       '#0a1626', // deep panel
  surface:    '#0f1f33', // standard card / surface
  surface2:   '#13273f', // raised / hover surface
  surface3:   '#1a3251', // input / inset surface
  line:       'rgba(140,176,208,0.12)', // hairline divider
  lineStrong: 'rgba(140,176,208,0.20)', // stronger border

  // Ocean blues / teal (primary brand)
  ocean:      '#2f7da3', // primary ocean blue
  oceanBright:'#52a9cd', // lighter ocean
  oceanDeep:  '#1b4a66', // deep navy-blue
  teal:       '#127f76', // dark teal

  // Brass / gold (premium accents, sparing)
  brass:      '#c8a24a', // brass
  gold:       '#dcb35e', // gold
  goldBright: '#f0cd82', // gold highlight
  goldSoft:   'rgba(200,162,74,0.14)', // gold tint fill
  goldLine:   'rgba(200,162,74,0.34)', // gold border

  // Parchment / sand (secondary surfaces, special text)
  parchment:  '#e9ddc4',
  sand:       '#ccb98f',

  // Accents
  crimson:    '#d24a3a',
  emerald:    '#3bb27e',
  orange:     '#e08a3c',

  // Text
  text:       '#e9f1f8', // primary text
  textSoft:   '#c2d2e0', // softened primary
  muted:      '#9db2c6', // secondary text (AA on surface)
  faint:      '#67809a', // tertiary / disabled
  onAccent:   '#0a1626', // text on gold/brass fills
}

// Status → semantic color (used for badges, pills, etc.)
export const status = {
  open:      { color: colors.oceanBright, fill: 'rgba(82,169,205,0.12)',  line: 'rgba(82,169,205,0.32)' },
  active:    { color: colors.emerald,     fill: 'rgba(59,178,126,0.12)',  line: 'rgba(59,178,126,0.32)' },
  closed:    { color: colors.orange,      fill: 'rgba(224,138,60,0.12)',  line: 'rgba(224,138,60,0.32)' },
  completed: { color: colors.muted,       fill: 'rgba(157,178,198,0.10)', line: 'rgba(157,178,198,0.26)' },
  danger:    { color: colors.crimson,     fill: 'rgba(210,74,58,0.12)',   line: 'rgba(210,74,58,0.34)' },
  gold:      { color: colors.gold,        fill: colors.goldSoft,          line: colors.goldLine },
}

// ── Spacing — strict 8px system (with 4px half-step) ─────────────────────────
export const space = {
  px: 1, 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32,
  10: 40, 12: 48, 14: 56, 16: 64, 20: 80, 24: 96,
}

// ── Border radius ────────────────────────────────────────────────────────────
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, pill: 999 }

// ── Typography ───────────────────────────────────────────────────────────────
export const font = {
  display: "'Fraunces', 'Iowan Old Style', Georgia, serif", // headers / logbook
  body:    "'Inter', system-ui, -apple-system, sans-serif",  // body / UI
  mono:    "'Space Mono', ui-monospace, monospace",          // stats / numerals
}

// Type scale (px). Display sizes pair with font.display, the rest with font.body.
export const type = {
  eyebrow: { fontSize: 11, fontWeight: 600, letterSpacing: '1.6px', textTransform: 'uppercase' },
  display: { fontFamily: font.display, fontWeight: 600, letterSpacing: '-0.3px', lineHeight: 1.1 },
}

// ── Shadows (subtle, layered — never harsh) ──────────────────────────────────
export const shadow = {
  sm:   '0 1px 2px rgba(0,0,0,0.35)',
  md:   '0 8px 24px rgba(0,0,0,0.38)',
  lg:   '0 20px 48px rgba(0,0,0,0.50)',
  inset:'inset 0 1px 0 rgba(255,255,255,0.04)',
  gold: '0 0 0 1px rgba(200,162,74,0.30), 0 10px 30px rgba(200,162,74,0.10)',
  hover:'0 14px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
}

// ── Transitions ──────────────────────────────────────────────────────────────
export const ease = 'cubic-bezier(0.4, 0, 0.2, 1)'
export const transition = {
  fast: `all 0.15s ${ease}`,
  base: `all 0.22s ${ease}`,
  slow: `all 0.35s ${ease}`,
}

// ── Reusable style helpers ───────────────────────────────────────────────────
// Composable inline-style objects. Spread them and override per use site.

export const eyebrow = {
  ...type.eyebrow,
  color: colors.gold,
}

export function pageHeader() {
  return {
    fontFamily: font.display,
    fontWeight: 600,
    fontSize: 26,
    letterSpacing: '-0.3px',
    color: colors.text,
    lineHeight: 1.12,
  }
}

export const card = {
  background: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.deep} 100%)`,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  boxShadow: shadow.md,
}

export const panel = {
  background: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.md,
}

export const input = {
  width: '100%',
  background: colors.surface3,
  border: `1px solid ${colors.lineStrong}`,
  borderRadius: radius.sm,
  padding: '10px 13px',
  color: colors.text,
  fontSize: 14,
  fontFamily: font.body,
  outline: 'none',
  boxSizing: 'border-box',
  colorScheme: 'dark',
  transition: transition.fast,
}

export const label = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  color: colors.muted,
  marginBottom: 6,
  display: 'block',
}

export const btnPrimary = {
  fontFamily: font.body,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.2px',
  padding: '10px 18px',
  borderRadius: radius.sm,
  border: `1px solid ${colors.goldLine}`,
  background: `linear-gradient(135deg, ${colors.gold}, ${colors.brass})`,
  color: colors.onAccent,
  cursor: 'pointer',
  transition: transition.base,
  boxShadow: shadow.sm,
  whiteSpace: 'nowrap',
}

export const btnGhost = {
  fontFamily: font.body,
  fontSize: 13,
  fontWeight: 600,
  padding: '10px 16px',
  borderRadius: radius.sm,
  border: `1px solid ${colors.lineStrong}`,
  background: 'transparent',
  color: colors.textSoft,
  cursor: 'pointer',
  transition: transition.base,
  whiteSpace: 'nowrap',
}

export function badge(s = status.open) {
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    padding: '3px 9px',
    borderRadius: radius.pill,
    background: s.fill,
    color: s.color,
    border: `1px solid ${s.line}`,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  }
}

// Default export for convenient `import t from '../theme'`
const theme = {
  colors, status, space, radius, font, type, shadow, ease, transition,
  eyebrow, pageHeader, card, panel, input, label, btnPrimary, btnGhost, badge,
}
export default theme
