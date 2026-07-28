import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { usePreferences } from '@/hooks/usePreferences'
import { useSearch } from '@/hooks/useSearch'
import { useVoice } from '@/context/VoiceContext'
import { PromptBar } from '@/components/PromptBar'
import { PreferencePills } from '@/components/PreferencePills'
import { ProfileMenu } from '@/components/ProfileMenu'

export default function PromptScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const [prompt, setPrompt] = useState('')
  const { preferences, recentSearches } = usePreferences()
  const { startSearch, status } = useSearch()
  const { startWakeWord } = useVoice()

  // Start passively listening for "Taylin" as soon as the home screen mounts
  useEffect(() => {
    startWakeWord()
  }, [startWakeWord])

  const isSearching = status === 'parsing' || status === 'searching'

  const { speak } = useVoice()

  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSearching) return

    speak(`Searching for ${trimmed}. Please wait.`)

    try {
      const searchId = await startSearch(trimmed)
      router.push({ pathname: '/result/[searchId]', params: { searchId, query: trimmed } })
    } catch {
      speak('Search failed. Please try again.', 'high')
    }
  }, [isSearching, startSearch, speak])

  const styles = makeStyles(c)

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Minimal top bar ───────────────────────────────────────── */}
        <View style={styles.topRow}>
          <View />
          <View style={styles.topRowRight}>
            <Pressable
              style={styles.dealsChip}
              onPress={() => router.push('/deals')}
              accessibilityLabel="Local deals. Tap to see time-limited offers near you."
              accessibilityRole="button"
            >
              <Text style={styles.dealsText}>Deals</Text>
            </Pressable>
            <Pressable
              style={styles.balanceChip}
              onPress={() => router.push('/wallet')}
              accessibilityLabel="Wallet balance. Tap to manage your wallet."
              accessibilityRole="button"
            >
              <Text style={styles.balanceText}>$842.50</Text>
            </Pressable>
            <ProfileMenu />
          </View>
        </View>

        {/* ── Scrollable content area — blurs under the PromptBar ───── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero} accessibilityElementsHidden={false}>
            <Text
              style={styles.wordmark}
              accessibilityRole="header"
              accessibilityLabel="taylin dot ai — your personal buying agent"
            >
              taylin.ai
            </Text>
            <Text style={styles.tagline}>
              {isSearching ? 'Searching...' : theme.tagline}
            </Text>
          </View>

          {/* Preference pills */}
          {preferences.length > 0 && (
            <PreferencePills preferences={preferences} />
          )}

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <View
              style={styles.recentSection}
              accessible={true}
              accessibilityLabel="Recent searches"
            >
              <Text style={styles.recentLabel}>Recent</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentScroll}
                keyboardShouldPersistTaps="handled"
              >
                {recentSearches.map((search) => (
                  <Pressable
                    key={search.id}
                    style={styles.recentChip}
                    onPress={() => handleSubmit(search.raw_prompt)}
                    accessibilityLabel={`Repeat search: ${search.raw_prompt}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.recentChipText} numberOfLines={1}>
                      {search.raw_prompt}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        {/* ── Floating glass PromptBar ──────────────────────────────── */}
        <View style={styles.promptWrapper}>
          <PromptBar
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSubmit}
            isLoading={isSearching}
            placeholder="e.g. Ethiopian coffee, flights to Sydney under $400..."
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.background,
    },
    kav: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 8,
    },
    topRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dealsChip: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      minHeight: 36,
      justifyContent: 'center',
    },
    dealsText: {
      color: c.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    balanceChip: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      minHeight: 36,
      justifyContent: 'center',
    },
    balanceText: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },

    // ── Scroll area ─────────────────────────────────────────────────
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      flexGrow: 1,
    },

    // ── Hero — ambient, not dominant ────────────────────────────────
    hero: {
      paddingTop: 48,
      paddingBottom: 40,
      alignItems: 'center',
    },
    wordmark: {
      fontSize: 36,
      fontWeight: '700',
      color: c.text,
      letterSpacing: -1,
      textAlign: 'center',
    },
    tagline: {
      fontSize: 14,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 6,
      fontWeight: '400',
    },

    // ── Recent searches ──────────────────────────────────────────────
    recentSection: {
      marginTop: 20,
    },
    recentLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    recentScroll: {
      gap: 8,
    },
    recentChip: {
      backgroundColor: c.chipBg,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      maxWidth: 200,
      minHeight: 36,
      justifyContent: 'center',
    },
    recentChipText: {
      color: c.chipText,
      fontSize: 13,
      fontWeight: '500',
    },

    // ── Prompt wrapper (glass bar lives here) ───────────────────────
    promptWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      paddingTop: 4,
    },
  })
}
