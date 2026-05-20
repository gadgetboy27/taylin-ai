import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
// Prefer the newer publishable key format; fall back to legacy anon JWT
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

const DEV_FALLBACK_URL = 'https://placeholder.supabase.co'
const DEV_FALLBACK_KEY = 'placeholder-anon-key'

export const supabase = createClient(
  supabaseUrl || DEV_FALLBACK_URL,
  supabaseKey || DEV_FALLBACK_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // On web, detect the auth code in the URL after magic-link redirect
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
)

export const isDevMode = !supabaseUrl || supabaseUrl === DEV_FALLBACK_URL
