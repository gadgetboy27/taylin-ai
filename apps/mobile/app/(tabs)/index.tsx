import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { usePreferences } from '@/hooks/usePreferences'
import { useSearch } from '@/hooks/useSearch'
import { PromptBar } from '@/components/PromptBar'
import { PreferencePills } from '@/components/PreferencePills'
import { ThemeSelector } from '@/components/ThemeSelector'

export default function PromptScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const [prompt, setPrompt] = useState('')
  const { preferences, recentSearches } = usePreferences()
  const { startSearch, status } = useSearch()

  const isSearching = status === 'parsing' || status === 'searching'

  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSearching) return

    AccessibilityInfo.announceForAccessibility(`Searching for ${trimmed}. Please wait.`)

    try {
      const searchId = await startSearch(trimmed)
      router.push(`/result/${searchId}`)
    } catch {
      AccessibilityInfo.announceForAccessibility('Search failed. Please try again.')
    }
  }, [isSearching, startSearch])

  const styles = makeStyles(c)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* Top row: theme selector + wallet balance */}
        <View style={styles.topRow}>
          <ThemeSelector />
          <Pressable
            style={styles.balanceChip}
            onPress={() => router.push('/wallet')}
            accessibilityLabel="Wallet balance. Tap to manage your wallet."
            accessibilityRole="button"
          >
            <Text style={styles.balanceText}>$842.50</Text>
          </Pressable>
        </View>

        {/* ── Hero — centered app identity ─────────────────────────── */}
        <View style={styles.hero} accessibilityElementsHidden={false}>
          <Text
            style={styles.wordmark}
            accessibilityRole="header"
            accessibilityLabel="taylin dot ai — your personal buying agent"
          >
            taylin.ai
          </Text>

          {theme.rhyme ? (
            <Text style={styles.rhyme} accessibilityElementsHidden={true}>
              {theme.rhyme}
            </Text>
          ) : null}

          <Text style={styles.tagline}>
            {isSearching ? 'Searching...' : theme.tagline}
          </Text>
        </View>

        {/* ── Preference pills ──────────────────────────────────────── */}
        {preferences.length > 0 && (
          <PreferencePills preferences={preferences} />
        )}

        {/* ── THE PROMPT BAR ────────────────────────────────────────── */}
        <PromptBar
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          isLoading={isSearching}
          placeholder="e.g. Ethiopian coffee, flights to Sydney under $400..."
        />

        {/* ── Recent searches ───────────────────────────────────────── */}
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

      </View>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      marginBottom: 8,
    },
    balanceChip: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 44,
      justifyContent: 'center',
    },
    balanceText: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
    },

    // ── Hero ──────────────────────────────────────────────────────────
    hero: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 24,
    },
    wordmark: {
      fontSize: 48,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -1.5,
      textAlign: 'center',
    },
    rhyme: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 6,
      fontStyle: 'italic',
      letterSpacing: 0.3,
    },
    tagline: {
      fontSize: 18,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      fontWeight: '400',
    },

    // ── Recent searches ───────────────────────────────────────────────
    recentSection: {
      marginTop: 16,
    },
    recentLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    recentScroll: {
      gap: 8,
    },
    recentChip: {
      backgroundColor: c.chipBg,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
      maxWidth: 200,
      minHeight: 44,
      justifyContent: 'center',
    },
    recentChipText: {
      color: c.chipText,
      fontSize: 13,
      fontWeight: '500',
    },
  })
}
