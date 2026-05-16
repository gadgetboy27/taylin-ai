import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { ThemeProvider } from '@/context/ThemeContext'

SplashScreen.preventAutoHideAsync()

// ─── DEV FLAG — flip to false when you're ready to require login ──────────────
// When true, app opens directly to tabs with no auth check.
const DEV_SKIP_AUTH = true

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            {DEV_SKIP_AUTH ? (
              // Dev: straight to tabs, no auth wall
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            ) : (
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            )}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="result/[searchId]" options={{ presentation: 'card' }} />
            <Stack.Screen name="result/approve" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
