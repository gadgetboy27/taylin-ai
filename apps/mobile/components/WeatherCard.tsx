import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/context/ThemeContext'
import { cToF, type Condition, type DayForecast } from '@/lib/weather-api'

/**
 * Ionicons rather than bespoke SVGs: the set already ships with the app and
 * carries every condition worth distinguishing, so this adds no bytes and
 * matches the icon language used everywhere else.
 */
const ICON: Record<Condition, keyof typeof Ionicons.glyphMap> = {
  clear: 'sunny',
  partly: 'partly-sunny',
  cloudy: 'cloud',
  fog: 'cloudy',
  drizzle: 'rainy',
  rain: 'rainy',
  snow: 'snow',
  thunder: 'thunderstorm',
}

const TINT: Record<Condition, string> = {
  clear: '#F59E0B',
  partly: '#F59E0B',
  cloudy: '#94A3B8',
  fog: '#94A3B8',
  drizzle: '#38BDF8',
  rain: '#0EA5E9',
  snow: '#7DD3FC',
  thunder: '#8B5CF6',
}

export function WeatherCard({ day, label, place, onDismiss }: {
  day: DayForecast
  label: string
  place: string
  onDismiss: () => void
}) {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  // Celsius by default — this is a New Zealand app. Tapping swaps to
  // Fahrenheit rather than burying a unit setting somewhere.
  const [fahrenheit, setFahrenheit] = useState(false)
  const unit = fahrenheit ? '°F' : '°C'
  const hi = fahrenheit ? cToF(day.maxC) : day.maxC
  const lo = fahrenheit ? cToF(day.minC) : day.minC

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Ionicons name={ICON[day.condition]} size={38} color={TINT[day.condition]} />
        <View style={styles.textBlock}>
          <Text style={styles.label}>{label} · {place}</Text>
          <Text style={styles.desc}>{day.description}</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss forecast">
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => setFahrenheit((f) => !f)}
        accessibilityRole="button"
        accessibilityLabel={`${hi} ${fahrenheit ? 'Fahrenheit' : 'Celsius'} high, ${lo} low. Tap to switch units.`}
        style={styles.tempRow}
      >
        <Text style={styles.temp}>{hi}{unit}</Text>
        <Text style={styles.low}>/ {lo}{unit}</Text>
        {day.rainChance > 10 && (
          <Text style={styles.rain}>· {day.rainChance}% rain</Text>
        )}
        <Text style={styles.tapHint}>tap for {fahrenheit ? '°C' : '°F'}</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginBottom: 16,
      gap: 10,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    textBlock: { flex: 1 },
    label: { fontSize: 12, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    desc: { fontSize: 16, fontWeight: '700', color: c.text, marginTop: 2 },
    tempRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    temp: { fontSize: 30, fontWeight: '800', color: c.text },
    low: { fontSize: 16, color: c.textSecondary },
    rain: { fontSize: 13, color: c.textSecondary },
    tapHint: { fontSize: 11, color: c.textMuted, marginLeft: 'auto' },
  })
}
