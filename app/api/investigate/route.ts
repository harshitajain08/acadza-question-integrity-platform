import "server-only"
import { z } from "zod"
import { requireRole, serverSupabase } from "@/lib/acadza/auth"
import { getInitialInvestigations, getQuestion, taxonomy } from "@/lib/acadza/data"
import { mapDatabaseReport } from "@/lib/acadza/db-mappers"
import { allowRequest } from "@/lib/acadza/rate-limit"
import { buildInvestigationPrompt, PROMPT_VERSION, requestOpenRouter, validateAndConstrain } from "@/lib/acadza/engine.mjs"

const inputSchema = z.object({ reportId: z.string().min(1).max(128) })

export async function POST(request: Request) {
  const actor = await requireRole(request, ["faculty"])
  if (actor instanceof Response) return actor
  if (!allowRequest(`investigate:${actor.id}`, 60, 60 * 60 * 1000)) {
    return Response.json({ error: "Investigation limit reached. Try again later." }, { status: 429 })
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid report." }, { status: 400 })
  const db = serverSupabase()
  if (!db) return Response.json({ error: "Investigation storage is not configured." }, { status: 503 })

  const { data: reportRow, error: reportError } = await db
    .from("acadza_reports")
    .select("report_id,question_id,student_id,source,reported_at,comment,category,status,verdict,route,investigation")
    .eq("report_id", parsed.data.reportId)
    .maybeSingle()
  if (reportError || !reportRow) return Response.json({ error: "Report not found." }, { status: 404 })
  const report = mapDatabaseReport(reportRow)

  const { data: saved } = await db.from("acadza_investigations").select("result").eq("report_id", report.reportId).maybeSingle()
  if (saved?.result) return Response.json(saved.result)

  const preparedResult = getInitialInvestigations().find((item) => item.reportId === report.reportId)
  if (preparedResult) {
    const { error: saveError } = await db.from("acadza_investigations").upsert({ report_id: report.reportId, result: preparedResult, model: preparedResult.model ?? "precomputed", prompt_version: preparedResult.promptVersion ?? "v1" }, { onConflict: "report_id", ignoreDuplicates: true })
    if (!saveError) {
      await db.from("acadza_reports").update({ status: "faculty_review", verdict: preparedResult.verdict, route: preparedResult.route, investigation: preparedResult }).eq("report_id", report.reportId)
      return Response.json(preparedResult)
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return Response.json({ error: "AI triage is not configured yet. This report remains in the faculty review queue." }, { status: 503 })

  const { data: storedQuestion } = await db
    .from("acadza_questions")
    .select("question")
    .eq("question_id", report.questionId)
    .maybeSingle()
  const question = storedQuestion?.question ?? getQuestion(report.questionId)
  if (!question) return Response.json({ error: "Question not found." }, { status: 404 })

  const { data: relatedRows, error: relatedError } = await db
    .from("acadza_reports")
    .select("report_id,question_id,student_id,source,reported_at,comment,category")
    .eq("question_id", report.questionId)
    .order("reported_at", { ascending: true })
  if (relatedError) return Response.json({ error: "Could not load related reports." }, { status: 503 })

  try {
    const prompt = buildInvestigationPrompt({ question, report, relatedReports: (relatedRows ?? []).map(mapDatabaseReport), taxonomy })
    const model = process.env.OPENROUTER_MODEL || "openrouter/auto"
    const completion = await requestOpenRouter({ prompt, apiKey, model })
    const result = validateAndConstrain(completion.object, question, report, taxonomy, completion.model)
    const fullResult = { ...result, reportId: report.reportId, questionId: report.questionId, promptVersion: PROMPT_VERSION, model: completion.model }

    const { error: saveError } = await db.from("acadza_investigations").upsert({
      report_id: report.reportId,
      result: fullResult,
      model,
      prompt_version: PROMPT_VERSION,
    }, { onConflict: "report_id" })
    if (saveError) throw saveError

    const { error: updateError } = await db.from("acadza_reports").update({
      status: "faculty_review",
      verdict: fullResult.verdict,
      route: fullResult.route,
      investigation: fullResult,
      updated_at: new Date().toISOString(),
    }).eq("report_id", report.reportId)
    if (updateError) throw updateError
    return Response.json(fullResult)
  } catch {
    return Response.json({ error: "The model could not complete this investigation. The report remains available for manual review." }, { status: 502 })
  }
}
