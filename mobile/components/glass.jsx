// Shared Liquid Glass primitives — official UIGlassEffect via expo-glass-effect
// on iOS 26+, with flat nautical fallbacks everywhere else.
import { useSyncExternalStore } from 'react'
import { View, Text, TextInput, Pressable, TouchableOpacity, AppState } from 'react-native'
import { GlassView, GlassContainer, isLiquidGlassAvailable } from 'expo-glass-effect'
import { useIsFocused } from '@react-navigation/native'
import { colors, font, radius, card } from '../theme'

export const hasGlass = isLiquidGlassAvailable()

// UIGlassEffect layers fail to attach when the GlassView is created while its
// scene is off-window — which happens on cold start because the native tab bar
// pre-mounts every tab scene — and can also detach when the app is
// backgrounded. Remount glass views whenever (a) their screen gains/loses
// focus or (b) the app returns to the foreground, so the effect is always
// recreated while actually visible.
let glassEpoch = 0
const epochListeners = new Set()
AppState.addEventListener('change', state => {
  if (state === 'active') {
    glassEpoch++
    epochListeners.forEach(l => l())
  }
})

export function useGlassEpoch() {
  return useSyncExternalStore(
    cb => { epochListeners.add(cb); return () => epochListeners.delete(cb) },
    () => glassEpoch,
  )
}

// Key for glass views: changes on screen focus and foreground transitions.
export function useGlassKey() {
  const epoch = useGlassEpoch()
  const focused = useIsFocused()
  return `g${epoch}-${focused ? 1 : 0}`
}

export function Glass({ style, children }) {
  const epoch = useGlassKey()
  if (hasGlass) {
    return (
      <GlassView key={epoch} glassEffectStyle="regular" style={{ borderRadius: radius.lg, overflow: 'hidden', ...style }}>
        {children}
      </GlassView>
    )
  }
  return <View style={{ ...card, ...style }}>{children}</View>
}

// ─── GlassButton ─────────────────────────────────────────────────────────────
// Interactive glass (scales/shimmers on touch). `tint` gives Apple's tinted
// glass; omit it for a clear glass button. Caller provides the Text child so
// each site keeps its own typography. `style` sizes the outer wrapper
// (flex, margins); `pad` sizes the button surface itself.
const BTN_PAD = { paddingVertical: 10, paddingHorizontal: 16 }

export function GlassButton({ onPress, disabled, tint, effect = 'regular', borderRadius = 999, pad, style, children }) {
  const padding = pad ?? BTN_PAD
  const epoch = useGlassKey()
  if (hasGlass) {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={{ opacity: disabled ? 0.45 : 1, ...style }}>
        <GlassView
          key={epoch}
          isInteractive
          glassEffectStyle={effect}
          tintColor={tint}
          style={{ borderRadius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, ...padding }}
        >
          {children}
        </GlassView>
      </Pressable>
    )
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        borderRadius,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        backgroundColor: tint ?? 'transparent',
        borderWidth: tint ? 0 : 1,
        borderColor: colors.lineStrong,
        opacity: disabled ? 0.45 : 1,
        ...padding,
        ...style,
      }}
    >
      {children}
    </TouchableOpacity>
  )
}

// ─── GlassPills ──────────────────────────────────────────────────────────────
// Segmented pill row. On iOS 26 the pills live in a GlassContainer so
// neighboring glass merges/morphs as Apple intends; the active pill is
// gold-tinted glass.
export function GlassPills({ items, activeKey, onSelect, spacing = 18, pad = { paddingVertical: 8, paddingHorizontal: 14 }, textSize = 12, style }) {
  const epoch = useGlassKey()
  if (hasGlass) {
    return (
      <GlassContainer key={epoch} spacing={spacing} style={{ flexDirection: 'row', gap: 6, ...style }}>
        {items.map(it => {
          const active = it.key === activeKey
          return (
            <GlassView
              key={it.key}
              isInteractive
              glassEffectStyle="regular"
              tintColor={active ? 'rgba(200,162,74,0.55)' : undefined}
              style={{ borderRadius: 999, overflow: 'hidden' }}
            >
              <Pressable onPress={() => onSelect(it.key)} style={pad}>
                <Text style={{ fontSize: textSize, fontFamily: font.semi, color: active ? colors.goldBright : colors.textSoft }}>
                  {it.label}
                </Text>
              </Pressable>
            </GlassView>
          )
        })}
      </GlassContainer>
    )
  }
  return (
    <View style={{ flexDirection: 'row', gap: 6, ...style }}>
      {items.map(it => {
        const active = it.key === activeKey
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => onSelect(it.key)}
            style={{ ...pad, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.goldLine : colors.lineStrong, backgroundColor: active ? colors.goldSoft : 'transparent' }}
          >
            <Text style={{ fontSize: textSize, fontFamily: font.semi, color: active ? colors.gold : colors.muted }}>{it.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ─── GlassInput ──────────────────────────────────────────────────────────────
// TextInput on a glass surface. `style` sizes the wrapper, `inputStyle` the
// text itself (minHeight, mono font, etc.).
export function GlassInput({ style, inputStyle, ...props }) {
  const textStyle = { paddingVertical: 12, paddingHorizontal: 14, color: colors.text, fontSize: 14, fontFamily: font.body, ...inputStyle }
  const epoch = useGlassKey()
  if (hasGlass) {
    return (
      <GlassView key={epoch} glassEffectStyle="regular" style={{ borderRadius: radius.md, overflow: 'hidden', ...style }}>
        <TextInput placeholderTextColor={colors.faint} {...props} style={textStyle} />
      </GlassView>
    )
  }
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      style={{ backgroundColor: 'rgba(26,50,81,0.92)', borderWidth: 1, borderColor: 'rgba(200,162,74,0.35)', borderRadius: radius.md, ...textStyle, ...style }}
    />
  )
}
