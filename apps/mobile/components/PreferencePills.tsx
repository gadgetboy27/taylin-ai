import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from '@/context/ThemeContext'
import type { Preference } from '@/hooks/usePreferences'

interface PreferencePillsProps {
  preferences: Preference[]
}

export function PreferencePills({ preferences }: PreferencePillsProps) {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const pills = preferences
    .flatMap((p) => p.positive_signals.slice(-2).map((s) => ({ label: s, category: p.category })))
    .slice(0, 6)

  if (pills.length === 0) return null

  return (
    <View
      accessible={true}
      accessibilityLabel="Your saved preferences. These shape your search results."
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {pills.map((pill, i) => (
          <View key={i} style={styles.pill}>
            <Text style={styles.pillText} numberOfLines={1}>
              {pill.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    row: { gap: 8, paddingBottom: 4 },
    pill: {
      backgroundColor: c.chipBg,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
      maxWidth: 160,
    },
    pillText: {
      color: c.chipText,
      fontSize: 12,
      fontWeight: '500',
    },
  })
}
