import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { ResultList } from '@/components/ResultList'
import { ResearchPanel } from '@/components/ResearchPanel'
import { fetchResults, askResearch, type ResearchAnswer } from '@/lib/ai'

export default function ResultsScreen() {
  const { searchId, query } = useLocalSearchParams<{ searchId: string; query?: string }>()
  const { theme } = useTheme()
  const c = theme.colors
  const [results, setResults] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [research, setResearch] = useState<ResearchAnswer | null>(null)
  const styles = makeStyles(c)

  useEffect(() => {
    if (!searchId) return

    fetchResults(searchId)
      .then(setResults)
      .catch(() => setError('Search failed. Please try again.'))
      .finally(() => setLoading(false))

    if (query) {
      askResearch(query)
        .then(setResearch)
        .catch(() => {/* research is best-effort */})
    }
  }, [searchId, query])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back to search"
        >
          ← Search
        </Text>
      </View>

      {loading ? (
        <View style={styles.center} accessibilityLabel="Loading results. Please wait.">
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={styles.loadingText}>Finding the best options...</Text>
        </View>
      ) : error ? (
        <View style={styles.center} accessibilityLabel={error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ResultList results={results} searchId={searchId!} research={research} />
      )}
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    backBtn: { color: c.accent, fontSize: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    loadingText: { color: c.textMuted, fontSize: 15, marginTop: 16, textAlign: 'center' },
    errorText: { color: c.error, fontSize: 15, textAlign: 'center' },
  })
}
