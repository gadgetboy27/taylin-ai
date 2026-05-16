import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/context/ThemeContext'
import { ThemeSelector } from '@/components/ThemeSelector'

export default function AgentScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Your agent
        </Text>
        <Text style={styles.subtitle}>
          Preferences and appearance
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <Text style={styles.sectionDesc}>
            Choose how taylin.ai looks and feels.
          </Text>
          <ThemeSelector expanded />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your preference graph</Text>
          <Text style={styles.sectionDesc}>
            taylin.ai learns from every search, skip, and purchase.
            The longer you use it, the better it knows you.
          </Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Purchases</Text>
            <Text style={styles.infoValue}>—</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Categories tracked</Text>
            <Text style={styles.infoValue}>—</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    container: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: '700', color: c.text },
    subtitle: { fontSize: 15, color: c.textMuted, marginTop: 4, marginBottom: 28 },
    section: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 16,
    },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 6 },
    sectionDesc: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.borderLight },
    infoLabel: { fontSize: 14, color: c.textSecondary },
    infoValue: { fontSize: 14, fontWeight: '600', color: c.text },
  })
}
