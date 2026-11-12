import { createClient } from "@supabase/supabase-js"
import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { buildInvestigationPrompt, PROMPT_VERSION, requestOpenRouter, validateAndConstrain } from "../lib/acadza/engine.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataRoot = path.join(root, "acadza-question-integrity-platform", "data")
const [rawQuestions, rawReports, taxonomy] = await Promise.all([
  readFile(path.join(dataRoot, "questions.json"), "utf8").then(JSON.parse),
  readFile(path.join(dataRoot, "reports.json"), "utf8").then(JSON.parse),
  readFile(path.join(dataRoot, "taxonomy.json"), "utf8").then(JSON.parse),
])

const apiKey = process.env.OPENROUTER_API_KEY
if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured; no model results were generated.")
const model = process.env.OPENROUTER_MODEL || "openrouter/auto"
const questions = new Map(rawQuestions.map((record) => {
  const payload = record[record.questionType] ?? {}
  return [String(record._id), {
    id: String(record._id), questionType: record.questionType, subject: record.subject, chapter: record.chapter,
    question: payload.question ?? "", answer: payload.answer ?? null, solution: payload.solution ?? "",
  }]
}))
const reports = rawReports.map((record) => ({
  reportId: String(record.reportId), questionId: String(record.questionId), studentId: String(record.studentId ?? ""),
  source: String(record.source ?? "web"), reportedAt: String(record.reportedAt ?? ""), comment: String(record.comment ?? ""), category: record.category ?? "Not sure",
}))
if (reports.length !== 44) throw new Error(`Expected 44 reports, found ${reports.length}.`)

const results = new Array(reports.length)
let nextIndex = 0
async function worker() {
  while (nextIndex < reports.length) {
    const index = nextIndex++
    const report = reports[index]
    const question = questions.get(report.questionId)
    if (!question) throw new Error(`Missing question ${report.questionId} for ${report.reportId}.`)
    const relatedReports = reports.filter((item) => item.questionId === report.questionId)
    let lastError
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const prompt = buildInvestigationPrompt({ question, report, relatedReports, taxonomy })
        const completion = await requestOpenRouter({ prompt, apiKey, model })
        results[index] = validateAndConstrain(completion.object, question, report, taxonomy, completion.model)
        break
      } catch (error) {
        lastError = error
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750 * (2 ** attempt)))
      }
    }
    if (!results[index]) throw new Error(`Investigation failed for ${report.reportId}: ${lastError?.message ?? "unknown error"}`)
  }
}

await Promise.all(Array.from({ length: Math.min(3, reports.length) }, () => worker()))
const delivered = results.map((result) => {
  const evidence = result.evidence
  const evidenceText = [evidence.claim, evidence.questionEvidence, evidence.storedAnswerComparison, evidence.reasoning, evidence.safety, evidence.routing]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 600)
  return {
    reportId: result.reportId,
    questionId: result.questionId,
    verdict: result.verdict,
    repair: result.repair,
    edit: result.edit,
    route: result.route,
    confidence: result.confidence,
    evidence: evidenceText,
    student_reply: result.student_reply,
  }
})

const resultsPath = path.join(root, "acadza-report-fix", "results.json")
const investigationsPath = path.join(root, "acadza-report-fix", "investigations.json")
await Promise.all([
  writeFile(resultsPath, `${JSON.stringify(delivered, null, 2)}\n`),
  writeFile(investigationsPath, `${JSON.stringify(results, null, 2)}\n`),
])

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Results were written locally, but Supabase persistence is unavailable.")
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const saved = await db.from("acadza_investigations").upsert(results.map((result) => ({
  report_id: result.reportId, result, model: result.model, prompt_version: PROMPT_VERSION,
})), { onConflict: "report_id" })
if (saved.error) throw new Error("Supabase could not save the investigation batch.")
for (const result of results) {
  const update = await db.from("acadza_reports").update({
    status: "faculty_review", verdict: result.verdict, route: result.route, investigation: result, updated_at: new Date().toISOString(),
  }).eq("report_id", result.reportId)
  if (update.error) throw new Error(`Supabase could not update ${result.reportId}.`)
}
console.info(`Processed ${delivered.length} reports and persisted the results to results.json, investigations.json, and Supabase.`)
