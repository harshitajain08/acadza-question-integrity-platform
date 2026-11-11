import { AcadzaWorkspace } from "@/components/acadza/acadza-workspace"
import { getInitialInvestigations, getQuestions, getReports, taxonomy } from "@/lib/acadza/data"
import { seedAssignmentData } from "@/lib/acadza/seed"

export const dynamic = "force-dynamic"

export default async function Page() {
  await seedAssignmentData()
  return <AcadzaWorkspace questions={getQuestions()} reports={getReports()} taxonomy={taxonomy} initialInvestigations={getInitialInvestigations()} openRouterConfigured={Boolean(process.env.OPENROUTER_API_KEY)} openRouterModel={process.env.OPENROUTER_MODEL ?? "openrouter/auto"} />
}
