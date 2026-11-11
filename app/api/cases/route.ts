import { NextResponse } from "next/server"
import { requireRole, serverSupabase } from "@/lib/acadza/auth"

export async function GET(request: Request) {
  try {
    await requireRole(request, ["faculty"])
    const url = new URL(request.url)
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 25)))
    const db = serverSupabase()
    if (!db) return NextResponse.json({ items: [], offset, limit, total: 0 })
    const { data, error, count } = await db.from("acadza_audit_events").select("id, report_id, question_id, reviewer, action, old_value, new_value, created_at", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: "Could not load audit history." }, { status: 503 })
    return NextResponse.json({ items: data, offset, limit, total: count ?? 0 })
  } catch (error) {
    if (error instanceof Response) return error
    return NextResponse.json({ error: "Could not load audit history." }, { status: 500 })
  }
}
