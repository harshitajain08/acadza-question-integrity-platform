import type { Investigation, Report } from "./types"

const reportStatuses = new Set(["pending", "investigating", "faculty_review", "resolved", "rejected"])

export function mapDatabaseReport(row: Record<string, unknown>): Report {
  const rawStatus = String(row.status ?? "pending")
  return {
    reportId: String(row.report_id ?? ""),
    questionId: String(row.question_id ?? ""),
    studentId: String(row.student_id ?? "student"),
    source: String(row.source ?? "web"),
    reportedAt: String(row.reported_at ?? new Date().toISOString()),
    comment: String(row.comment ?? ""),
    category: typeof row.category === "string" ? row.category : undefined,
    status: (reportStatuses.has(rawStatus) ? rawStatus : "pending") as Report["status"],
    verdict: typeof row.verdict === "string" ? row.verdict as Report["verdict"] : undefined,
    route: typeof row.route === "string" ? row.route as Report["route"] : undefined,
    investigation: row.investigation && typeof row.investigation === "object" ? row.investigation as Investigation : undefined,
  }
}
