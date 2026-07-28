import React, { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/context/ThemeContext'
import { useSpeech } from '@/hooks/useSpeech'
import { saveAddress } from '@/lib/profile-api'
import {
  matchLocalityByName,
  nearestLocality,
  type Locality,
} from '@/lib/nz-localities'

const confirmPhrase = (t: string) => `Got it — ${t}.`

/**
 * Asks a buyer where they are so search can prefer local sellers.
 *
 * Speaking is the primary path — this is a voice-first app, and "I'm in
 * Paihia" is faster than any form. GPS is offered as confirmation for people
 * who'd rather not say it, or who are travelling and don't know the postcode.
 *
 * Both resolve against the offline table in lib/nz-localities, so neither costs
 * an API call and GPS needs no reverse-geocoding service. That also keeps the
 * two paths consistent: they can only ever produce a locality we already know.
 */
export function LocationPrompt({ onSaved, onDismiss }: {
  onSaved: (l: Locality) => void
  onDismiss: () => void
}) {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [match, setMatch] = useState<Locality | null>(null)
  const [heard, setHeard] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onTranscript = useCallback((transcript: string) => {
    setHeard(transcript)
    const found = matchLocalityByName(transcript)
    setMatch(found)
    setError(found ? null : `I don't know "${transcript.trim()}" yet — try the nearest town, or use your location.`)
  }, [])

  const { isListening, isProcessing, startListening, stopListening } =
    useSpeech(onTranscript, { confirmPhrase })

  const useGps = useCallback(() => {
    setError(null)
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location isn\'t available here — say where you are instead.')
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        const near = nearestLocality(pos.coords.latitude, pos.coords.longitude)
        // A long distance means they're outside the table's coverage, and
        // silently snapping them to a town 300km away would be worse than
        // admitting it.
        if (!near || near.km > 60) {
          setError('Couldn\'t place you from your location — say the nearest town instead.')
          return
        }
        setHeard(null)
        setMatch(near.locality)
      },
      () => {
        setBusy(false)
        setError('Location permission declined — say where you are instead.')
      },
      { timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  const confirm = useCallback(async () => {
    if (!match) return
    setBusy(true)
    setError(null)
    try {
      await saveAddress({
        suburb: match.suburb,
        city: match.city,
        postcode: match.postcode,
        country: 'NZ',
      })
      onSaved(match)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your location')
    } finally {
      setBusy(false)
    }
  }, [match, onSaved])

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Where are you?</Text>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Not now">
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.body}>So we can show you sellers near you first.</Text>

      {match ? (
        <>
          <Text style={styles.matched}>
            {match.suburb}
            {match.city !== match.suburb ? `, ${match.city}` : ''} · {match.postcode}
          </Text>
          <Pressable
            style={[styles.primaryBtn, busy && styles.disabled]}
            onPress={confirm}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Confirm ${match.suburb}`}
          >
            {busy
              ? <ActivityIndicator color={c.textOnPrimary} />
              : <Text style={styles.primaryText}>That's right →</Text>}
          </Pressable>
          <Pressable onPress={() => { setMatch(null); setHeard(null) }} accessibilityRole="button">
            <Text style={styles.link}>Somewhere else</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable
            style={[styles.primaryBtn, isProcessing && styles.disabled]}
            onPress={isListening ? stopListening : startListening}
            disabled={isProcessing}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Stop listening' : 'Say where you are'}
          >
            {isProcessing
              ? <ActivityIndicator color={c.textOnPrimary} />
              : (
                <View style={styles.btnRow}>
                  <Ionicons name={isListening ? 'stop' : 'mic'} size={17} color={c.textOnPrimary} />
                  <Text style={styles.primaryText}>
                    {isListening ? 'Tap when done' : 'Say where you are'}
                  </Text>
                </View>
              )}
          </Pressable>

          <Pressable onPress={useGps} disabled={busy} accessibilityRole="button" accessibilityLabel="Use my current location">
            <Text style={styles.link}>{busy ? 'Locating…' : 'Or use my location'}</Text>
          </Pressable>
        </>
      )}

      {heard && !match && <Text style={styles.heard}>Heard: “{heard}”</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 18,
      gap: 10,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 16, fontWeight: '700', color: c.text },
    body: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    matched: { fontSize: 17, fontWeight: '700', color: c.primary, paddingVertical: 4 },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    primaryText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    link: { fontSize: 13, color: c.textMuted, textAlign: 'center', paddingVertical: 6 },
    heard: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },
    error: { fontSize: 13, color: c.error, lineHeight: 18 },
  })
}
