export type ThemeMode = 'light' | 'dark' | 'boys' | 'girls'

export type ThemeColors = {
  background: string
  backgroundAlt: string
  surface: string
  surfaceElevated: string
  primary: string
  primaryLight: string
  secondary: string
  accent: string
  text: string
  textSecondary: string
  textMuted: string
  textOnPrimary: string
  border: string
  borderLight: string
  error: string
  success: string
  warning: string
  overlay: string
  promptBg: string
  promptBorder: string
  chipBg: string
  chipText: string
  micActive: string
  micInactive: string
  escrowBadge: string
}

export type Theme = {
  id: ThemeMode
  name: string
  shortName: string
  tagline: string
  rhyme: string
  emoji: string
  colors: ThemeColors
}

// ─── Light mode ───────────────────────────────────────────────────────────────
const light: Theme = {
  id: 'light',
  name: 'Light',
  shortName: 'Light',
  tagline: 'What do you need?',
  rhyme: '',
  emoji: '☀️',
  colors: {
    background: '#FFFFFF',
    backgroundAlt: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#111827',
    primaryLight: '#374151',
    secondary: '#6B7280',
    accent: '#3B82F6',
    text: '#111827',
    textSecondary: '#374151',
    textMuted: '#9CA3AF',
    textOnPrimary: '#FFFFFF',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    overlay: 'rgba(0,0,0,0.5)',
    promptBg: '#F9FAFB',
    promptBorder: '#D1D5DB',
    chipBg: '#F3F4F6',
    chipText: '#374151',
    micActive: '#3B82F6',
    micInactive: '#9CA3AF',
    escrowBadge: '#DBEAFE',
  },
}

// ─── Dark mode ────────────────────────────────────────────────────────────────
const dark: Theme = {
  id: 'dark',
  name: 'Dark',
  shortName: 'Dark',
  tagline: 'What do you need?',
  rhyme: '',
  emoji: '🌙',
  colors: {
    background: '#0D0D0D',
    backgroundAlt: '#141414',
    surface: '#1A1A1A',
    surfaceElevated: '#222222',
    primary: '#F9FAFB',
    primaryLight: '#E5E7EB',
    secondary: '#9CA3AF',
    accent: '#60A5FA',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textMuted: '#6B7280',
    textOnPrimary: '#0D0D0D',
    border: '#2A2A2A',
    borderLight: '#1F1F1F',
    error: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    overlay: 'rgba(0,0,0,0.7)',
    promptBg: '#1A1A1A',
    promptBorder: '#3A3A3A',
    chipBg: '#222222',
    chipText: '#D1D5DB',
    micActive: '#60A5FA',
    micInactive: '#4B5563',
    escrowBadge: '#1E3A5F',
  },
}

// ─── Boys mode — "Snails & Puppy Dog Tails" ──────────────────────────────────
// Earthy, adventurous: forest greens, puppy browns, muddy amber, sky blues
const boys: Theme = {
  id: 'boys',
  name: 'Snails & Tails',
  shortName: 'Boys',
  tagline: "What are we after?",
  rhyme: 'Made of snails & puppy dog tails',
  emoji: '🐾',
  colors: {
    background: '#F5F0E8',          // warm parchment
    backgroundAlt: '#EDE8DE',
    surface: '#FFFCF7',
    surfaceElevated: '#FFFFFF',
    primary: '#1B4D3E',             // deep forest green
    primaryLight: '#2D6A55',
    secondary: '#6B4226',           // puppy brown
    accent: '#5B8C5A',              // sage green
    text: '#1A1A1A',
    textSecondary: '#2D2D2D',
    textMuted: '#7A6A5A',
    textOnPrimary: '#FFFFFF',
    border: '#D4C8B0',
    borderLight: '#EDE8DE',
    error: '#C0392B',
    success: '#1B4D3E',
    warning: '#C87941',             // amber/rust
    overlay: 'rgba(26,26,20,0.6)',
    promptBg: '#EDE8DE',
    promptBorder: '#B8AC98',
    chipBg: '#D4C8B0',
    chipText: '#1B4D3E',
    micActive: '#1B4D3E',
    micInactive: '#8A7A6A',
    escrowBadge: '#C8DCC4',
  },
}

// ─── Girls mode — "Sugar & Spice & All Things Nice" ──────────────────────────
// Warm, vibrant: rose pinks, lavender purples, gold, soft cream
const girls: Theme = {
  id: 'girls',
  name: 'Sugar & Spice',
  shortName: 'Girls',
  tagline: "What can I find for you?",
  rhyme: 'Made of sugar & spice & all things nice',
  emoji: '🌸',
  colors: {
    background: '#FFF0F5',          // blush cream
    backgroundAlt: '#FFE4EE',
    surface: '#FFFBFD',
    surfaceElevated: '#FFFFFF',
    primary: '#B5006E',             // deep rose
    primaryLight: '#D81B8A',
    secondary: '#7B1FA2',           // spice purple
    accent: '#F48FB1',              // soft pink
    text: '#1A1A1A',
    textSecondary: '#2D1A26',
    textMuted: '#9E7A90',
    textOnPrimary: '#FFFFFF',
    border: '#F0BDD5',
    borderLight: '#FFE4EE',
    error: '#C62828',
    success: '#2E7D32',
    warning: '#F9A825',             // golden honey
    overlay: 'rgba(26,10,20,0.6)',
    promptBg: '#FFE4EE',
    promptBorder: '#E8A0C0',
    chipBg: '#F9D0E3',
    chipText: '#B5006E',
    micActive: '#B5006E',
    micInactive: '#C48AAA',
    escrowBadge: '#F9D0E3',
  },
}

export const THEMES: Record<ThemeMode, Theme> = { light, dark, boys, girls }

export const THEME_ORDER: ThemeMode[] = ['light', 'dark', 'boys', 'girls']

export const DEFAULT_THEME: ThemeMode = 'light'
