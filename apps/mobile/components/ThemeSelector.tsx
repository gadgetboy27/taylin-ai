import React from 'react'
import { View, Pressable, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/context/ThemeContext'
import { THEMES, THEME_ORDER, type ThemeMode } from '@/constants/themes'

interface ThemeSelectorProps {
  expanded?: boolean
}

export function ThemeSelector({ expanded = false }: ThemeSelectorProps) {
  const { themeMode, setThemeMode, theme } = useTheme()
  const c = theme.colors

  if (expanded) {
    return (
      <View style={styles.expandedGrid} accessibilityLabel="Theme selector">
        {THEME_ORDER.map((mode) => {
          const t = THEMES[mode]
          const isActive = themeMode === mode
          return (
            <Pressable
              key={mode}
              style={[
                styles.expandedCard,
                { borderColor: isActive ? c.primary : c.border },
                isActive && { backgroundColor: c.primary + '12' },
              ]}
              onPress={() => setThemeMode(mode as ThemeMode)}
              accessibilityLabel={`${t.name} theme${isActive ? ', currently selected' : ''}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={styles.expandedEmoji}>{t.emoji}</Text>
              <Text style={[styles.expandedName, { color: isActive ? c.primary : c.text }]}>
                {t.name}
              </Text>
              {t.rhyme ? (
                <Text style={[styles.expandedRhyme, { color: c.textMuted }]} numberOfLines={2}>
                  {t.rhyme}
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    )
  }

  // Compact pill row
  return (
    <View style={styles.pillRow} accessibilityLabel="Theme selector">
      {THEME_ORDER.map((mode) => {
        const t = THEMES[mode]
        const isActive = themeMode === mode
        return (
          <Pressable
            key={mode}
            // Active state is a ring plus a faint tint, never a solid c.primary
            // fill. Emoji are fixed-colour glyphs that can't invert with the
            // theme, and c.primary is near-black in Light and near-white in
            // Dark — so a solid fill made 🐾 and 🌙 vanish in Light and washed
            // ☀️ out in Dark. A tint keeps whatever contrast the emoji has
            // against the page background, in every theme.
            style={[
              styles.pill,
              { borderColor: isActive ? c.primary : c.border },
              isActive && { backgroundColor: c.primary + '1F', borderWidth: 2 },
            ]}
            onPress={() => setThemeMode(mode as ThemeMode)}
            accessibilityLabel={`Switch to ${t.name} theme`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            hitSlop={4}
          >
            <Text style={styles.pillEmoji}>{t.emoji}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillEmoji: {
    fontSize: 16,
  },
  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  expandedCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    gap: 6,
  },
  expandedEmoji: {
    fontSize: 24,
  },
  expandedName: {
    fontSize: 15,
    fontWeight: '700',
  },
  expandedRhyme: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
})
