import type { Investigation, Question, Report, Taxonomy } from "./types"

export const PROMPT_VERSION: string
export const investigationSchema: {
  safeParse(value: unknown): { success: true; data: unknown } | { success: false; error: unknown }
}
export function buildInvestigationPrompt(input: { question: Question; report: Report; relatedReports: Report[]; taxonomy: Taxonomy }): string
export function validateAndConstrain(candidate: unknown, question: Question, report: Report, taxonomy: Taxonomy, model: string): Investigation
export function requestOpenRouter(input: { prompt: string; apiKey: string; model?: string }): Promise<{ object: unknown; model: string }>
