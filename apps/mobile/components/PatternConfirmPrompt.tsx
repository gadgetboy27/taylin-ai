/**
 * Lightweight confirm/deny overlay for a pending pattern candidate. Not
 * built on @gorhom/bottom-sheet — that dependency is listed but unused
 * anywhere else in the app yet, and wiring up its provider/gesture-root
 * plumbing is more than a simple yes/no prompt needs. A transparent Modal
 * gets the same "doesn't interrupt navigation" effect with far less setup.
 */
import React from 'react'
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/context/ThemeContext'
import { usePatterns } from '@/context/PatternContext'
import type { CandidatePattern } from '@/lib/patterns/detector'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function promptCopy(candidate: CandidatePattern): string {
  const day = DAY_NAMES[candidate.dayOfWeek]
  const hour = candidate.hourBucket
  const time = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? 'am' : 'pm'}`

  if (candidate.type === 'biometric_deviation') {
    return `I'm noticing something around ${day}s at ${time} — is everything okay?`
  }
  return `Looks like "${candidate.category}" comes up most ${day}s around ${time}. Want me to remember that?`
}

export function PatternConfirmPrompt() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)
  const { pendingConfirmations, confirm } = usePatterns()

  const current = pendingConfirmations[0]
  if (!current) return null

  return (
    <Modal transparent animationType="slide" visible statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.body}>{promptCopy(current)}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => confirm(current.id, false)}
              accessibilityRole="button"
              accessibilityLabel="No"
            >
              <Text style={styles.btnSecondaryText}>Not really</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => confirm(current.id, true)}
              accessibilityRole="button"
              accessibilityLabel="Yes"
            >
              <Text style={styles.btnPrimaryText}>Yes</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    card: {
      backgroundColor: c.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderColor: c.glassBorder,
    },
    body: {
      fontSize: 16,
      color: c.text,
      lineHeight: 23,
      marginBottom: 20,
    },
    row: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    btnPrimary: { backgroundColor: c.primary },
    btnPrimaryText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '700' },
    btnSecondary: { backgroundColor: c.glassBackground, borderWidth: 1, borderColor: c.glassBorder },
    btnSecondaryText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  })
}
