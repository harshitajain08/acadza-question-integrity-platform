import "server-only"
import { getQuestions } from "./data"
import { serverSupabase } from "./auth"
import reportsData from "@/acadza-report-fix/data/reports.json"
import initialInvestigations from "@/acadza-report-fix/investigations.json"

let seedPromise: Promise<void> | undefined

export function seedAssignmentData() {
  if (!seedPromise) seedPromise = seed().catch((error) => {
    console.error("[acadza] assignment seed unavailable", error instanceof Error ? error.message : "unknown")
  })
  return seedPromise
}

async function seed() {
  const db = serverSupabase()
  if (!db) return
  const questions = getQuestions()
  for (let index = 0; index < questions.length; index += 50) {
    const batch = questions.slice(index, index + 50).map((question) => ({ question_id: question.id, question }))
    const { error } = await db.from("acadza_questions").upsert(batch, { onConflict: "question_id", ignoreDuplicates: true })
    if (error) throw error
  }
  const rows = (reportsData as Array<Record<string, unknown>>).map((report) => ({
    report_id: String(report.reportId),
    question_id: String(report.questionId),
    student_id: String(report.studentId ?? "student"),
    source: String(report.source ?? "web"),
    reported_at: String(report.reportedAt ?? new Date().toISOString()),
    comment: String(report.comment ?? ""),
    category: report.category ? String(report.category) : null,
    status: "pending",
  }))
  for (let index = 0; index < rows.length; index += 50) {
    const { error } = await db.from("acadza_reports").upsert(rows.slice(index, index + 50), { onConflict: "report_id", ignoreDuplicates: true })
    if (error) throw error
  }
  const results = initialInvestigations as Array<Record<string, any>>
  for (let index = 0; index < results.length; index += 50) {
    const batch = results.slice(index, index + 50).map((result) => ({ report_id: String(result.reportId), result, model: String(result.model ?? ""), prompt_version: String(result.promptVersion ?? "v1") }))
    const { error } = await db.from("acadza_investigations").upsert(batch, { onConflict: "report_id", ignoreDuplicates: true })
    if (error) throw error
  }
  for (const result of results) {
    const { error } = await db.from("acadza_reports").update({ status: "faculty_review", verdict: result.verdict, route: result.route, investigation: result }).eq("report_id", String(result.reportId)).eq("status", "pending")
    if (error) throw error
  }
}
