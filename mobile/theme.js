// ─────────────────────────────────────────────────────────────────────────────
// Grand Line design system — React Native port of src/theme.js (web).
// Same color/spacing/radius tokens; helpers adapted to RN style objects.
// Custom fonts are loaded in app/_layout.jsx — use font.* names, never
// fontWeight with those families (RN silently falls back to system).
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  abyss:      '#06101b',
  deep:       '#0a1626',
  surface:    '#0f1f33',
  surface2:   '#13273f',
  surface3:   '#1a3251',
  line:       'rgba(140,176,208,0.12)',
  lineStrong: 'rgba(140,176,208,0.20)',

  ocean:      '#2f7da3',
  oceanBright:'#52a9cd',
  oceanDeep:  '#1b4a66',
  teal:       '#127f76',

  brass:      '#c8a24a',
  gold:       '#dcb35e',
  goldBright: '#f0cd82',
  goldSoft:   'rgba(200,162,74,0.14)',
  goldLine:   'rgba(200,162,74,0.34)',

  parchment:  '#e9ddc4',
  sand:       '#ccb98f',

  crimson:    '#d24a3a',
  emerald:    '#3bb27e',
  orange:     '#e08a3c',

  text:       '#e9f1f8',
  textSoft:   '#c2d2e0',
  muted:      '#9db2c6',
  faint:      '#67809a',
  onAccent:   '#0a1626',
}

export const status = {
  open:      { color: colors.oceanBright, fill: 'rgba(82,169,205,0.12)',  line: 'rgba(82,169,205,0.32)' },
  active:    { color: colors.emerald,     fill: 'rgba(59,178,126,0.12)',  line: 'rgba(59,178,126,0.32)' },
  closed:    { color: colors.orange,      fill: 'rgba(224,138,60,0.12)',  line: 'rgba(224,138,60,0.32)' },
  completed: { color: colors.muted,       fill: 'rgba(157,178,198,0.10)', line: 'rgba(157,178,198,0.26)' },
  danger:    { color: colors.crimson,     fill: 'rgba(210,74,58,0.12)',   line: 'rgba(210,74,58,0.34)' },
  gold:      { color: colors.gold,        fill: colors.goldSoft,          line: colors.goldLine },
}

export const space = {
  px: 1, 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32,
  10: 40, 12: 48, 14: 56, 16: 64, 20: 80, 24: 96,
}

export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, pill: 999 }

// Loaded via expo-font in app/_layout.jsx. One family name per weight.
export const font = {
  display:  'Fraunces_600SemiBold',
  body:     'Inter_400Regular',
  semi:     'Inter_600SemiBold',
  bold:     'Inter_700Bold',
  mono:     'SpaceMono_400Regular',
}

export const eyebrow = {
  fontSize: 11,
  fontFamily: font.semi,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  color: colors.gold,
}

export const pageHeader = {
  fontFamily: font.display,
  fontSize: 26,
  letterSpacing: -0.3,
  color: colors.text,
  lineHeight: 30,
}

export const card = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.lg,
}

export const panel = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.md,
}

export const input = {
  width: '100%',
  backgroundColor: colors.surface3,
  borderWidth: 1,
  borderColor: colors.lineStrong,
  borderRadius: radius.sm,
  paddingVertical: 11,
  paddingHorizontal: 13,
  color: colors.text,
  fontSize: 14,
  fontFamily: font.body,
}

export const label = {
  fontSize: 11,
  fontFamily: font.semi,
  textTransform: 'uppercase',
  letterSpacing: 0.7,
  color: colors.muted,
  marginBottom: 6,
}

export const btnPrimary = {
  paddingVertical: 12,
  paddingHorizontal: 18,
  borderRadius: radius.sm,
  borderWidth: 1,
  borderColor: colors.goldLine,
  backgroundColor: colors.gold,
  alignItems: 'center',
  justifyContent: 'center',
}

export const btnPrimaryText = {
  fontFamily: font.bold,
  fontSize: 14,
  letterSpacing: 0.2,
  color: colors.onAccent,
}

export const btnGhost = {
  paddingVertical: 11,
  paddingHorizontal: 16,
  borderRadius: radius.sm,
  borderWidth: 1,
  borderColor: colors.lineStrong,
  backgroundColor: 'transparent',
  alignItems: 'center',
  justifyContent: 'center',
}

export const btnGhostText = {
  fontFamily: font.semi,
  fontSize: 13,
  color: colors.textSoft,
}

export function badge(s = status.open) {
  return {
    wrap: {
      paddingVertical: 3,
      paddingHorizontal: 9,
      borderRadius: radius.pill,
      backgroundColor: s.fill,
      borderWidth: 1,
      borderColor: s.line,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    text: {
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: s.color,
    },
  }
}

const theme = {
  colors, status, space, radius, font,
  eyebrow, pageHeader, card, panel, input, label,
  btnPrimary, btnPrimaryText, btnGhost, btnGhostText, badge,
}
export default theme
