import { z } from "zod"
import { getQuestion } from "@/lib/acadza/data"
import { requireRole, serverSupabase } from "@/lib/acadza/auth"
import { allowRequest } from "@/lib/acadza/rate-limit"

const reportSchema = z.object({
  questionId: z.string().min(1).max(80),
  comment: z.string().trim().min(8).max(1200),
  category: z.string().trim().min(1).max(50).default("Not sure"),
})

export async function POST(request: Request) {
  const actor = await requireRole(request, ["student"])
  if (actor instanceof Response) return actor
  if (!allowRequest(`report:${actor.id}`, 8, 60 * 60 * 1000)) {
    return Response.json({ error: "You have reached the report limit. Try again later." }, { status: 429 })
  }

  const parsed = reportSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Add a short description (at least 8 characters) and try again." }, { status: 400 })
  const question = getQuestion(parsed.data.questionId)
  if (!question) return Response.json({ error: "Question not found." }, { status: 404 })

  const db = serverSupabase()
  if (!db) return Response.json({ error: "Report storage is not configured." }, { status: 503 })
  const { error: questionError } = await db.from("acadza_questions").upsert({ question_id: question.id, question }, { onConflict: "question_id", ignoreDuplicates: true })
  if (questionError) return Response.json({ error: "Could not load the question record. Please try again." }, { status: 503 })

  const report = {
    reportId: `R-${crypto.randomUUID()}`,
    questionId: question.id,
    studentId: actor.demo ? "demo-student" : actor.id,
    source: "web",
    reportedAt: new Date().toISOString(),
    comment: parsed.data.comment,
    category: parsed.data.category,
    status: "pending" as const,
  }

  const { error } = await db.from("acadza_reports").insert({
    report_id: report.reportId,
    question_id: report.questionId,
    student_id: report.studentId,
    source: report.source,
    reported_at: report.reportedAt,
    comment: report.comment,
    category: report.category,
    status: report.status,
  })
  if (error) return Response.json({ error: "Could not save the report. Please try again." }, { status: 503 })
  return Response.json({ report, message: "Your report is in. Our subject team will review it carefully." }, { status: 201 })
}
