import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { usePreferences } from '@/hooks/usePreferences'
import { useSearch } from '@/hooks/useSearch'
import { useVoice } from '@/context/VoiceContext'
import { PromptBar } from '@/components/PromptBar'
import { PreferencePills } from '@/components/PreferencePills'
import { ScreenHeader } from '@/components/ScreenHeader'
import { LocationPrompt } from '@/components/LocationPrompt'
import { getAddress } from '@/lib/profile-api'
import { WeatherCard } from '@/components/WeatherCard'
import { detectWeatherQuery, getForecast, type DayForecast } from '@/lib/weather-api'
import { matchLocalityByPostcode, matchLocalityByName } from '@/lib/nz-localities'

export default function PromptScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const [prompt, setPrompt] = useState('')
  const { preferences, recentSearches, reload: reloadPreferences } = usePreferences()
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

    // Answer weather here rather than sending it to /intent: that costs a model
    // round trip and writes a `searches` row, neither of which fits a question
    // about the sky. `new Date()` is the phone's clock, so "tomorrow" means
    // tomorrow where the user is.
    const wq = detectWeatherQuery(trimmed)
    if (wq) {
      try {
        const addr = await getAddress()
        const loc =
          (addr?.postcode && matchLocalityByPostcode(addr.postcode)) ||
          (addr?.suburb && matchLocalityByName(addr.suburb)) ||
          (addr?.city && matchLocalityByName(addr.city)) || null
        if (!loc) {
          speak('Tell me where you are first and I can check the weather.', 'high')
          setNeedsLocation(true)
          return
        }
        const days = await getForecast({ lat: loc.lat, lng: loc.lng, days: wq.dayOffset + 1 })
        const day = days[wq.dayOffset] ?? days[days.length - 1]
        setWeather({ day, label: wq.label, place: loc.suburb })
        speak(`${wq.label} in ${loc.suburb}: ${day.description}, ${day.maxC} degrees.`)
      } catch {
        speak("Couldn't get the forecast just now.", 'high')
      }
      return
    }

    speak(`Searching for ${trimmed}. Please wait.`)

    try {
      const searchId = await startSearch(trimmed)
      router.push({ pathname: '/result/[searchId]', params: { searchId, query: trimmed } })
    } catch {
      speak('Search failed. Please try again.', 'high')
    }
  }, [isSearching, startSearch, speak])

  // Pull down to reset — the iOS convention, and the fastest way to clear a
  // half-finished prompt and pick up anything that changed server-side
  // (a new deal, a search from another device) without hunting for a button.
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    // Haptic on the pull, not on completion: the tick should land when the
    // gesture is recognised, which is what makes it feel native.
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
    setPrompt('')
    try {
      await Promise.all([
        reloadPreferences(),
        getAddress()
          .then((a) => setNeedsLocation(!a?.suburb && !a?.postcode))
          .catch(() => {}),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [reloadPreferences])

  const styles = makeStyles(c)

  // Prompt only when we genuinely can't place them. Anyone with a suburb on
  // file never sees this, and dismissing it lasts the session — nagging a buyer
  // who declined is worse than ranking nationally.
  const [weather, setWeather] = useState<{ day: DayForecast; label: string; place: string } | null>(null)
  const [needsLocation, setNeedsLocation] = useState(false)
  const [locationDismissed, setLocationDismissed] = useState(false)
  useEffect(() => {
    getAddress()
      .then((a) => setNeedsLocation(!a?.suburb && !a?.postcode))
      .catch(() => {/* offline or signed out — stay quiet */})
  }, [])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScreenHeader
          right={
            <>
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
            </>
          }
        />

        {/* ── Scrollable content area — blurs under the PromptBar ───── */}
        <ScrollView
          style={[
            styles.scroll,
            // Mobile browsers run their own pull-to-refresh, which swallows the
            // gesture and reloads the page before RefreshControl ever sees it.
            // Containing the overscroll keeps the pull inside the app.
            Platform.OS === 'web'
              ? ({ overscrollBehaviorY: 'contain' } as object)
              : null,
          ]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={c.textMuted}
              colors={[c.primary]}
              progressBackgroundColor={c.surface}
            />
          }
        >
          {/* Hero. Long-press resets — pull-to-refresh needs the content to
              overscroll, and with flexGrow:1 a short page has nothing to pull
              against, so on mobile web the gesture rarely registers. A press
              and hold always works, on every platform. */}
          <View style={styles.hero} accessibilityElementsHidden={false}>
            <Pressable
              onLongPress={handleRefresh}
              delayLongPress={450}
              accessibilityRole="header"
              accessibilityLabel="Hey Taylin — your personal buying agent"
              accessibilityHint="Press and hold to reset the screen"
            >
              <Text style={styles.wordmark}>Hey Taylin</Text>
            </Pressable>
            <Text style={styles.tagline}>
              {refreshing ? 'Resetting...' : isSearching ? 'Searching...' : theme.tagline}
            </Text>
          </View>

          {weather && (
            <View style={styles.locationSlot}>
              <WeatherCard
                day={weather.day}
                label={weather.label}
                place={weather.place}
                onDismiss={() => setWeather(null)}
              />
            </View>
          )}

          {needsLocation && !locationDismissed && (
            <View style={styles.locationSlot}>
              <LocationPrompt
                onSaved={() => setNeedsLocation(false)}
                onDismiss={() => setLocationDismissed(true)}
              />
            </View>
          )}

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
    locationSlot: { paddingHorizontal: 20, paddingBottom: 16 },
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
