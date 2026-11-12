import { createClient } from "@supabase/supabase-js"

type WorkspaceRole = "student" | "faculty"

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "")
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!token || !url || !serviceKey) {
    return Response.json({ error: "Authentication service is not configured." }, { status: 503 })
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return Response.json({ error: "Please sign in again." }, { status: 401 })

  const currentRole = data.user.app_metadata?.role
  if (currentRole === "student" || currentRole === "faculty") {
    return Response.json({ role: currentRole })
  }
  if (currentRole) {
    return Response.json({ error: "This account is not authorised for Acadza." }, { status: 403 })
  }

  const requestedRole = data.user.user_metadata?.requested_role as WorkspaceRole | undefined
  if (requestedRole !== "student" && requestedRole !== "faculty") {
    return Response.json({ error: "Choose Student or Faculty when creating your account." }, { status: 400 })
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { ...data.user.app_metadata, role: requestedRole },
  })
  if (updateError) {
    return Response.json({ error: "Could not finish setting up your Acadza account." }, { status: 500 })
  }
  return Response.json({ role: requestedRole })
}
