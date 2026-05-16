import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key'

const isConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

if (!isConfigured) {
  console.warn('[supabase] Running without credentials — DB calls will fail gracefully')
}

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export function createUserClient(jwt: string) {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
