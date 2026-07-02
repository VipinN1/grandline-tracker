import { Tabs, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSession } from '../../lib/auth'
import { colors, font } from '../../theme'

export default function TabsLayout() {
  const { session, loading } = useSession()

  if (loading) return null
  if (!session) return <Redirect href="/login" />

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#08101b' },
        headerTitleStyle: { fontFamily: font.display, fontSize: 19, color: colors.parchment },
        headerTintColor: colors.parchment,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: '#08101b', borderTopColor: 'rgba(200,162,74,0.16)' },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontFamily: font.semi, fontSize: 10 },
        sceneStyle: { backgroundColor: colors.abyss },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log Result',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="decklists"
        options={{
          title: 'Decklists',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
