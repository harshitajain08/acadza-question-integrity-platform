export type Role = "student" | "faculty"
export type Verdict = "defect" | "no_error" | "display_issue" | "app_issue" | "language_mode" | "already_fixed" | "not_actionable"
export type Route = "auto_apply" | "faculty_review" | "no_change"
export type Repair = string | null

export type Question = {
  id: string
  qid: string | null
  questionType: "scq" | "mcq" | "integerQuestion"
  subject: string
  chapter: string
  concept: string | null
  level: string
  question: string
  solution: string
  answer: string | string[]
  quesImages: string[]
  solutionImages: string[]
}

export type Report = {
  reportId: string
  questionId: string
  studentId: string
  source: string
  reportedAt: string
  comment: string
  category?: string
  status: "pending" | "investigating" | "faculty_review" | "resolved" | "rejected"
  verdict?: Verdict
  route?: Route
  investigation?: Investigation
}

export type Investigation = {
  reportId: string
  questionId: string
  verdict: Verdict
  repair: Repair
  edit: { field: string; find: string; replace: string } | null
  route: Route
  confidence: number
  evidence: {
    claim: string
    questionEvidence: string
    independentVerification: string
    storedAnswerComparison: string
    reasoning: string
    safety: string
    routing: string
  }
  student_reply: string
  repairCategory?: string | null
  verificationChecks?: string[]
  status?: string
  model?: string
  promptVersion?: string
}

export type Taxonomy = {
  verdicts: Record<Verdict, string>
  repairs: Record<string, { fields: string[]; auto: boolean; label: string }>
}
