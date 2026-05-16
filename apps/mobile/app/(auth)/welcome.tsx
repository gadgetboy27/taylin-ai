import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { ThemeSelector } from '@/components/ThemeSelector'

export default function WelcomeScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <View style={styles.top}>
          <ThemeSelector />
        </View>

        <View style={styles.hero}>
          <Text style={styles.wordmark} accessibilityRole="header">
            taylin.ai
          </Text>
          {theme.rhyme ? (
            <Text style={styles.rhyme} accessibilityElementsHidden>
              {theme.rhyme}
            </Text>
          ) : null}
          <Text style={styles.pitch}>
            Your personal buying agent.{'\n'}
            Speak or type what you need.{'\n'}
            We find it, verify it, protect it.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/(auth)/verify')}
            accessibilityLabel="Get started. Create your account."
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Get started</Text>
          </Pressable>
          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>

      </View>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, paddingHorizontal: 24 },
    top: { paddingTop: 16, alignItems: 'flex-end' },
    hero: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    wordmark: {
      fontSize: 52,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -2,
      textAlign: 'center',
    },
    rhyme: {
      fontSize: 13,
      color: c.textMuted,
      fontStyle: 'italic',
      marginTop: 8,
      letterSpacing: 0.3,
    },
    pitch: {
      fontSize: 18,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 28,
      marginTop: 20,
    },
    actions: { paddingBottom: 32 },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: c.textOnPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    legal: {
      fontSize: 12,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 18,
    },
  })
}
