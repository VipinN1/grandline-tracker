import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors, font, radius, input, label, btnPrimary, btnPrimaryText } from '../theme'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSignup() {
    setLoading(true)
    setError('')

    if (!username.trim()) {
      setError('Username is required')
      setLoading(false)
      return
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim(), location: location.trim() },
      },
    })

    if (error) setError(error.message)
    else setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.abyss, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ maxWidth: 400, alignItems: 'center' }}>
          <Text style={{ fontSize: 40, color: colors.emerald, marginBottom: 16 }}>✓</Text>
          <Text style={{ fontSize: 20, fontFamily: font.bold, color: colors.text, marginBottom: 8 }}>Check your email</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 24, textAlign: 'center', fontFamily: font.body }}>
            We sent a confirmation link to <Text style={{ color: colors.text }}>{email}</Text>. Click it to activate your account.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={{ color: colors.ocean, fontSize: 13, fontFamily: font.semi }}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#07121f' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ fontSize: 30, marginBottom: 8 }}>🧭</Text>
            <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.parchment, letterSpacing: 0.2 }}>PirateTracker</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6, fontFamily: font.body }}>Create your account and set sail</Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(140,176,208,0.16)', borderRadius: radius.lg, padding: 28, gap: 16 }}>
            <View>
              <Text style={label}>Username</Text>
              <TextInput
                placeholder="e.g. OPTCG_Gamer"
                placeholderTextColor={colors.faint}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                style={input}
              />
            </View>
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
                style={input}
              />
            </View>
            <View>
              <Text style={label}>Location (optional)</Text>
              <TextInput
                placeholder="e.g. Houston, TX"
                placeholderTextColor={colors.faint}
                value={location}
                onChangeText={setLocation}
                onSubmitEditing={handleSignup}
                style={input}
              />
            </View>

            {error ? (
              <View style={{ backgroundColor: 'rgba(210,74,58,0.08)', borderWidth: 1, borderColor: 'rgba(210,74,58,0.2)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 12, color: colors.crimson, fontFamily: font.body }}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={handleSignup} disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.6 : 1 }}>
              <Text style={btnPrimaryText}>{loading ? 'Creating account...' : 'Create Account'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 5 }}>
            <Text style={{ fontSize: 13, color: colors.muted, fontFamily: font.body }}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ fontSize: 13, color: colors.ocean, fontFamily: font.semi }}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
