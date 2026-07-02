import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useSession } from '../lib/auth'
import { colors } from '../theme'

export default function Index() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  return <Redirect href={session ? '/(tabs)/dashboard' : '/login'} />
}
