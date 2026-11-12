"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
let browserClient: SupabaseClient | undefined

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Prefer the current browser-safe publishable key. Keep the legacy anon key
  // only as a fallback for deployments that have not migrated yet.
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  browserClient ??= createClient(url, key)
  return browserClient
}
