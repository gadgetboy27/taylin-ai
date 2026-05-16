import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/context/ThemeContext'

interface AgentNudgeProps {
  remaining: number
  onReveal: () => void
}

export function AgentNudge({ remaining, onReveal }: AgentNudgeProps) {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={`${remaining} more results available.`}
    >
      <Text style={styles.text}>
        +{remaining} more option{remaining !== 1 ? 's' : ''} found
      </Text>
      <Pressable
        style={styles.btn}
        onPress={onReveal}
        accessibilityLabel={`Show all ${remaining} more results`}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>Show all</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.chipBg,
      borderRadius: 14,
      padding: 16,
      minHeight: 52,
    },
    text: { color: c.textSecondary, fontSize: 14 },
    btn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 44,
      justifyContent: 'center',
    },
    btnText: { color: c.textOnPrimary, fontSize: 13, fontWeight: '600' },
  })
}
