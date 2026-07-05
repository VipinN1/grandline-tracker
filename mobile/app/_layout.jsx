import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider, DarkTheme } from '@react-navigation/native'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces'
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono'
import { AuthProvider } from '../lib/auth'
import { BlocksProvider } from '../lib/blocks'
import { colors } from '../theme'

SplashScreen.preventAutoHideAsync()

// Native tab scenes take their background from the navigation theme —
// without this they default to system white.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.abyss,
    card: '#08101b',
    text: colors.text,
    primary: colors.gold,
    border: 'rgba(200,162,74,0.16)',
  },
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceMono_400Regular,
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <BlocksProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.abyss },
            }}
          />
        </BlocksProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
