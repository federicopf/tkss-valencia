import { createClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const url = configuredUrl ? new URL(configuredUrl, window.location.origin).toString().replace(/\/$/, '') : null

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  : null
