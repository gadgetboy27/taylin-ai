import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { THEMES, DEFAULT_THEME, type Theme, type ThemeMode } from '@/constants/themes'

type ThemeContextValue = {
  theme: Theme
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = '@taylin/theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_THEME)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && stored in THEMES) {
          setThemeModeState(stored as ThemeMode)
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode)
    AsyncStorage.setItem(STORAGE_KEY, mode)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme: THEMES[themeMode],
        themeMode,
        setThemeMode,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
