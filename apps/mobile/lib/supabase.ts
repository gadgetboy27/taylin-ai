import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// ─── Dev mode: allow app to boot without real Supabase credentials ────────────
// Hooks that call supabase will return empty data gracefully.
// Replace with your real credentials in .env when ready.
const DEV_FALLBACK_URL = 'https://placeholder.supabase.co'
const DEV_FALLBACK_KEY = 'placeholder-anon-key'

export const supabase = createClient(
  supabaseUrl || DEV_FALLBACK_URL,
  supabaseAnonKey || DEV_FALLBACK_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

export const isDevMode = !supabaseUrl || supabaseUrl === DEV_FALLBACK_URL
