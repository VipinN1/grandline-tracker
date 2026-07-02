import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { colors, font, radius, input, label, btnPrimary, btnPrimaryText } from '../theme'

export default function Login() {
  const { session } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    if (session) router.replace('/(tabs)/dashboard')
  }, [session])

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first.')
      return
    }
    setResetLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://piratetracker.vercel.app/reset-password',
    })
    setResetLoading(false)
    if (error) setError(error.message)
    else setResetSent(true)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#07121f' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ fontSize: 30, marginBottom: 8 }}>🧭</Text>
            <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.parchment, letterSpacing: 0.2 }}>PirateTracker</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6, fontFamily: font.body }}>Sign in to chart your course</Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(140,176,208,0.16)', borderRadius: radius.lg, padding: 28, gap: 16 }}>
            <View>
              <Text style={label}>Email</Text>
              <TextInput
                placeholder="you@email.com"
                placeholderTextColor={colors.faint}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={input}
              />
            </View>
            <View>
              <Text style={label}>Password</Text>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor={colors.faint}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                onSubmitEditing={handleLogin}
                style={input}
              />
            </View>

            {error ? (
              <View style={{ backgroundColor: 'rgba(210,74,58,0.08)', borderWidth: 1, borderColor: 'rgba(210,74,58,0.2)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={handleLogin} disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.6 : 1 }}>
              <Text style={btnPrimaryText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>

            {resetSent ? (
              <Text style={{ fontSize: 12, color: colors.oceanBright, textAlign: 'center', fontFamily: font.body }}>
                Password reset email sent — check your inbox.
              </Text>
            ) : (
              <TouchableOpacity onPress={handleForgotPassword} disabled={resetLoading}>
                <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', fontFamily: font.body }}>
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 5 }}>
            <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={{ fontSize: 13, color: colors.ocean, fontFamily: font.semi }}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
