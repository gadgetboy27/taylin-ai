// AI model configuration — all model calls go through the backend API, never the mobile app.
// This file is for UI display only (showing which AI is working, loading states, etc.)

export const AI_DISPLAY = {
  intentParser: 'Gemini Flash-Lite',
  fallbackParser: 'Claude Haiku',
  ranker: 'Claude Haiku',
  embedding: 'text-embedding-004',
} as const

export const SEARCH_CONFIG = {
  maxResultsShown: 3,
  maxResultsStored: 20,
  searchTimeoutMs: 8000,
  firstResultTargetMs: 800,
} as const
