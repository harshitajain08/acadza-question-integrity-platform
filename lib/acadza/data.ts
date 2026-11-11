import questionsData from "@/acadza-report-fix/data/questions.json"
import reportsData from "@/acadza-report-fix/data/reports.json"
import taxonomyData from "@/acadza-report-fix/data/taxonomy.json"
import investigationsData from "@/acadza-report-fix/investigations.json"
import type { Investigation, Question, Report, Taxonomy } from "./types"
import { cleanQuestionHtml } from "./sanitize"

const questionRows = questionsData as Array<Record<string, any>>
const reportRows = reportsData as Array<Record<string, any>>

export const taxonomy = taxonomyData as Taxonomy

export function getQuestions(): Question[] {
  return questionRows.map((row) => {
    const payload = row[row.questionType] ?? {}
    return {
      id: String(row._id),
      qid: row.qid ?? null,
      questionType: row.questionType,
      subject: row.subject ?? "Uncategorized",
      chapter: row.chapter ?? "Uncategorized",
      concept: row.concept ?? null,
      level: row.level ?? "—",
      question: cleanQuestionHtml(payload.question ?? ""),
      solution: cleanQuestionHtml(payload.solution ?? ""),
      answer: payload.answer ?? "—",
      quesImages: Array.isArray(payload.quesImages) ? payload.quesImages : [],
      solutionImages: Array.isArray(payload.solutionImages) ? payload.solutionImages : [],
    }
  })
}

export function getReports(): Report[] {
  const byReport = new Map(getInitialInvestigations().map((result) => [result.reportId, result]))
  return reportRows.map((row) => {
    const investigation = byReport.get(String(row.reportId))
    return {
      reportId: String(row.reportId),
      questionId: String(row.questionId),
      studentId: String(row.studentId ?? "student"),
      source: String(row.source ?? "web"),
      reportedAt: String(row.reportedAt ?? new Date().toISOString()),
      comment: String(row.comment ?? ""),
      category: row.category ? String(row.category) : undefined,
      status: investigation ? "faculty_review" : "pending",
      verdict: investigation?.verdict,
      route: investigation?.route,
      investigation,
    }
  })
}

export function getQuestion(questionId: string) {
  return getQuestions().find((question) => question.id === questionId) ?? null
}

export function getInitialInvestigations(): Investigation[] {
  return investigationsData as Investigation[]
}
