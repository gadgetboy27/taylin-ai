import React, { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/context/ThemeContext'
import { ResultCard, type Product } from './ResultCard'
import { AgentNudge } from './AgentNudge'
import { ResearchPanel } from './ResearchPanel'
import { SEARCH_CONFIG } from '@/constants/models'
import type { ResearchAnswer } from '@/lib/ai'

interface ResultListProps {
  results: unknown[]
  searchId: string
  research?: ResearchAnswer | null
}

export function ResultList({ results, searchId, research }: ResultListProps) {
  const { theme } = useTheme()
  const c = theme.colors
  const [showAll, setShowAll] = useState(false)
  const styles = makeStyles(c)

  const products = (results as Product[]).map((r) => ({ ...r, searchId }))
  const shown = showAll ? products : products.slice(0, SEARCH_CONFIG.maxResultsShown)
  const remaining = products.length - SEARCH_CONFIG.maxResultsShown

  if (products.length === 0) {
    return (
      <View style={styles.empty} accessibilityLabel="No results found">
        <Text style={styles.emptyText}>No results found.</Text>
        <Text style={styles.emptyHint}>Try a different search or broader terms.</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {research && <ResearchPanel answer={research} />}

      <Text style={styles.count} accessibilityLabel={`Showing top ${shown.length} of ${products.length} results`}>
        Top {shown.length} of {products.length}
      </Text>

      {shown.map((product, i) => (
        <ResultCard key={product.id} product={product} rank={i + 1} />
      ))}

      {!showAll && remaining > 0 && (
        <AgentNudge
          remaining={remaining}
          onReveal={() => setShowAll(true)}
        />
      )}
    </ScrollView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    list: { padding: 20, gap: 12 },
    count: { fontSize: 12, color: c.textMuted, marginBottom: 4 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { fontSize: 18, fontWeight: '600', color: c.text, textAlign: 'center' },
    emptyHint: { fontSize: 14, color: c.textMuted, marginTop: 8, textAlign: 'center' },
  })
}
