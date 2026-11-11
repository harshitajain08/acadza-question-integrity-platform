import "server-only"
import { createClient } from "@supabase/supabase-js"
import type { Role } from "./types"

export async function requireRole(request: Request, allowed: Role[]) {
  const demoRole = request.headers.get("x-acadza-demo-role")
  if (process.env.NODE_ENV !== "production" && (demoRole === "student" || demoRole === "faculty")) {
    if (allowed.includes(demoRole)) return { id: `demo-${demoRole}`, role: demoRole, demo: true as const }
    throw new Response("Forbidden", { status: 403 })
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!token || !url || !serviceKey) throw new Response("Authentication required", { status: 401 })

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Response("Authentication required", { status: 401 })
  const role = data.user.app_metadata?.role
  if (!allowed.includes(role)) throw new Response("Forbidden", { status: 403 })
  return { id: data.user.id, role: role as Role, demo: false as const }
}

export function serverSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
