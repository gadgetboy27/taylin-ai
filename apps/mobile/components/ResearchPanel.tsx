import React, { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { useTheme } from '@/context/ThemeContext'
import { askResearch, type ResearchAnswer } from '@/lib/ai'

interface ResearchPanelProps {
  answer: ResearchAnswer
}

export function ResearchPanel({ answer: initial }: ResearchPanelProps) {
  const { theme } = useTheme()
  const c = theme.colors
  const [current, setCurrent] = useState(initial)
  const [loading, setLoading] = useState(false)
  const styles = makeStyles(c)

  const handleFollowUp = async (q: string) => {
    if (loading) return
    setLoading(true)
    try {
      const result = await askResearch(q)
      setCurrent(result)
    } catch {
      // leave existing answer in place on failure
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Market Intel</Text>

      {loading ? (
        <ActivityIndicator size="small" color={c.accent} style={styles.spinner} />
      ) : (
        <Text style={styles.answer}>{current.answer}</Text>
      )}

      {current.followUps.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {current.followUps.map((q) => (
            <Pressable
              key={q}
              style={styles.chip}
              onPress={() => handleFollowUp(q)}
              accessibilityLabel={`Follow-up: ${q}`}
              accessibilityRole="button"
            >
              <Text style={styles.chipText}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {current.sources.length > 0 && (
        <View style={styles.sources}>
          {current.sources.map((s) => {
            let domain = s.url
            try { domain = new URL(s.url).hostname.replace(/^www\./, '') } catch {}
            return (
              <Pressable
                key={s.url}
                onPress={() => Linking.openURL(s.url)}
                accessibilityLabel={`Source: ${s.title}`}
                accessibilityRole="link"
              >
                <Text style={styles.sourceText} numberOfLines={1}>{domain}</Text>
              </Pressable>
            )
          })}
        </View>
      )}
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
      padding: 16,
      marginBottom: 12,
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: c.accent,
      marginBottom: 8,
    },
    answer: {
      fontSize: 15,
      color: c.text,
      lineHeight: 22,
    },
    spinner: {
      marginVertical: 8,
      alignSelf: 'flex-start',
    },
    chips: {
      gap: 8,
      marginTop: 12,
    },
    chip: {
      backgroundColor: c.chipBg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipText: {
      fontSize: 12,
      color: c.chipText,
    },
    sources: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    sourceText: {
      fontSize: 11,
      color: c.textMuted,
      textDecorationLine: 'underline',
    },
  })
}
