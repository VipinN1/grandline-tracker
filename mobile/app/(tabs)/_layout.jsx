import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs'
import { Redirect } from 'expo-router'
import { useSession } from '../../lib/auth'
import { colors } from '../../theme'

// Native UITabBar — renders as floating Liquid Glass on iOS 26+,
// classic translucent tab bar on older iOS.
export default function TabsLayout() {
  const { session, loading } = useSession()

  if (loading) return null
  if (!session) return <Redirect href="/login" />

  return (
    <NativeTabs tintColor={colors.gold} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="dashboard">
        <Icon sf="house.fill" />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <Icon sf="chart.bar.fill" />
        <Label>Stats</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="log">
        <Icon sf="plus.circle.fill" />
        <Label>Log</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="decklists">
        <Icon sf="rectangle.stack.fill" />
        <Label>Decklists</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <Icon sf="ellipsis" />
        <Label>More</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
