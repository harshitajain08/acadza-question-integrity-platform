import { z } from "zod"
import { requireRole, serverSupabase } from "@/lib/acadza/auth"
import { getQuestion } from "@/lib/acadza/data"
import taxonomy from "@/acadza-report-fix/data/taxonomy.json"

const reviewSchema = z.object({
  reportId: z.string().min(1).max(128),
  action: z.enum(["approved", "edited", "rejected", "needs_investigation"]),
  edit: z.object({
    field: z.string().min(1).max(64),
    find: z.string().min(1).max(3000),
    replace: z.string().max(3000),
  }).optional(),
})

export async function POST(request: Request) {
  const actor = await requireRole(request, ["faculty"])
  if (actor instanceof Response) return actor

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid review request." }, { status: 400 })

  const { reportId, action } = parsed.data
  const db = serverSupabase()
  if (!db) return Response.json({ error: "Review storage is not configured." }, { status: 503 })

  const { data: report, error: reportError } = await db
    .from("acadza_reports")
    .select("report_id,question_id,investigation,status")
    .eq("report_id", reportId)
    .maybeSingle()
  if (reportError || !report) return Response.json({ error: "Report not found." }, { status: 404 })

  let edit = action === "edited" ? parsed.data.edit : undefined
  if (action === "approved" || action === "edited") {
    const { data: savedInvestigation } = await db
      .from("acadza_investigations")
      .select("result")
      .eq("report_id", reportId)
      .maybeSingle()
    const result = savedInvestigation?.result as { edit?: typeof edit; repair?: string } | undefined
    if (action === "approved") edit = result?.edit ?? (report.investigation as { edit?: typeof edit } | null)?.edit
    const repair = result?.repair ?? (report.investigation as { repair?: string } | null)?.repair
    const rule = repair ? taxonomy.repairs[repair as keyof typeof taxonomy.repairs] : undefined

    if (edit) {
      if (!rule?.fields.includes(edit.field as never)) {
        return Response.json({ error: "This repair field is not permitted by the taxonomy." }, { status: 400 })
      }
      const question = getQuestion(report.question_id)
      const source = question?.[edit.field as keyof typeof question]
      const hasExactSource = Array.isArray(source)
        ? source.some((item) => typeof item === "string" && item.includes(edit!.find))
        : typeof source === "string" && source.includes(edit.find)
      if (!hasExactSource) return Response.json({ error: "The source text no longer matches the question." }, { status: 409 })
    }
  }

  const newValue = edit ? { edit } : {}
  const { data, error } = await db.rpc("acadza_review_case", {
    p_report_id: reportId,
    p_action: action,
    p_reviewer: actor.id,
    p_new_value: newValue,
  })
  if (error) return Response.json({ error: "The review could not be saved. Refresh and try again." }, { status: 500 })

  return Response.json({ ok: true, status: data?.status })
}
