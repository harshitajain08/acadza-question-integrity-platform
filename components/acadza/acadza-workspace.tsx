"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, Clock3, FileSearch, Filter, FlaskConical, GraduationCap, History, LayoutDashboard, LockKeyhole, LogOut, MessageSquareWarning, MoreHorizontal, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Tags, X } from "lucide-react"
import { LoginPanel } from "./login-panel"
import { getBrowserSupabase } from "@/lib/acadza/client-auth"
import type { Investigation, Question, Report, Role, Taxonomy } from "@/lib/acadza/types"

const subjects = ["All subjects", "Physics", "Chemistry", "Mathematics", "Biology"]
type Props = { questions: Question[]; reports: Report[]; taxonomy: Taxonomy; initialInvestigations: Investigation[]; openRouterConfigured: boolean; openRouterModel: string }
type Area = "overview" | "queue" | "reports" | "questions" | "resolved" | "audit" | "settings"
type Session = { role: Role; token?: string; id: string }

const navItems: { id: Area; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "queue", label: "Review queue", icon: ClipboardCheck },
  { id: "reports", label: "All reports", icon: MessageSquareWarning },
  { id: "questions", label: "Questions", icon: BookOpen },
  { id: "resolved", label: "Resolved cases", icon: CheckCheck },
  { id: "audit", label: "Audit history", icon: History },
  { id: "settings", label: "AI configuration", icon: SlidersHorizontal },
]

function headerFor(session: Session): Record<string, string> {
  return session.token ? { Authorization: `Bearer ${session.token}` } : { "x-acadza-demo-role": session.role }
}
function formatTime(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) }
function stripHtml(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim() }
function initials(value: string) { return value.slice(0, 2).toUpperCase() }

export function AcadzaWorkspace({ questions, reports: initialReports, taxonomy, initialInvestigations, openRouterConfigured, openRouterModel }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    const client = getBrowserSupabase()
    if (!client) return
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, authSession) => {
      const role = authSession?.user.app_metadata?.role
      if (authSession && (role === "student" || role === "faculty")) {
        setSession({ role, token: authSession.access_token, id: authSession.user.id })
      } else if (!authSession) setSession(null)
    })
    return () => subscription.unsubscribe()
  }, [])
  const [area, setArea] = useState<Area>("overview")
  const [reports, setReports] = useState(initialReports)
  const [investigations, setInvestigations] = useState<Record<string, Investigation>>(() => Object.fromEntries(initialInvestigations.map((result) => [result.reportId, result])))
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null)
  const [activeCase, setActiveCase] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportText, setReportText] = useState("")
  const [reportCategory, setReportCategory] = useState("Not sure")
  const [filterSubject, setFilterSubject] = useState("All subjects")
  const [filterStatus, setFilterStatus] = useState("All statuses")
  const [search, setSearch] = useState("")
  const [toast, setToast] = useState("")
  const [pending, setPending] = useState(false)
  const [audit, setAudit] = useState<Record<string, unknown>[]>([])
  const [page, setPage] = useState(0)
  const [mobileNav, setMobileNav] = useState(false)

  const questionById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions])
  const grouped = useMemo(() => {
    const map = new Map<string, Report[]>()
    reports.forEach((report) => map.set(report.questionId, [...(map.get(report.questionId) ?? []), report]))
    return [...map.entries()].map(([questionId, items]) => ({ questionId, items: items.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)), question: questionById.get(questionId) })).filter((item) => item.question)
  }, [reports, questionById])
  const activeReports = reports.filter((item) => item.questionId === activeCase).sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
  const activeQuestionForCase = activeCase ? questionById.get(activeCase) : null
  const myReports = session?.role === "student" ? reports.filter((item) => item.studentId === session.id) : []
  const filteredCases = grouped.filter((item) => {
    const q = item.question!
    const query = search.toLowerCase()
    const matchesSearch = !query || [q.id, q.qid ?? "", q.chapter, q.subject, ...item.items.map((r) => r.comment)].join(" ").toLowerCase().includes(query)
    const matchesSubject = filterSubject === "All subjects" || q.subject === filterSubject
    const unresolved = item.items.some((r) => !["resolved", "rejected"].includes(r.status))
    const status = !unresolved ? "Resolved" : item.items.some((r) => r.status === "faculty_review" || r.investigation) ? "In review" : "Pending"
    const matchesStatus = filterStatus === "All statuses" || status === filterStatus
    return matchesSearch && matchesSubject && matchesStatus
  }).sort((a, b) => b.items.length - a.items.length || b.items[0].reportedAt.localeCompare(a.items[0].reportedAt))

  async function api(path: string, body?: unknown) {
    const response = await fetch(path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...headerFor(session!) }, body: body ? JSON.stringify(body) : undefined })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? "Something went wrong.")
    return result
  }
  function flash(message: string) { setToast(message); window.setTimeout(() => setToast(""), 3200) }
  function enter(role: Role, token?: string, id?: string) { setSession({ role, token, id: id ?? (role === "faculty" ? "demo-faculty" : "demo-student") }); setArea("overview") }
  async function signOut() {
    if (session?.token) await getBrowserSupabase()?.auth.signOut()
    setSession(null); setActiveCase(null); setActiveQuestion(null)
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || !activeQuestion) return
    setPending(true)
    try {
      const result = await api("/api/reports", { questionId: activeQuestion.id, comment: reportText, category: reportCategory })
      setReports((current) => [result.report, ...current])
      setReportText(""); setReportOpen(false); flash("Your report was received. Thank you for helping improve this question.")
    } catch (error) { flash(error instanceof Error ? error.message : "Could not submit your report.") }
    setPending(false)
  }

  async function investigate(report: Report) {
    if (!session) return
    setPending(true)
    try {
      const result: Investigation = await api("/api/investigate", { reportId: report.reportId })
      setInvestigations((current) => ({ ...current, [report.reportId]: result }))
      setReports((current) => current.map((item) => item.reportId === report.reportId ? { ...item, status: "faculty_review", verdict: result.verdict, route: result.route, investigation: result } : item))
      flash("Investigation saved. Faculty approval is required before any repair.")
    } catch (error) { flash(error instanceof Error ? error.message : "Investigation unavailable.") }
    setPending(false)
  }

  async function review(report: Report, action: "approved" | "edited" | "rejected" | "needs_investigation") {
    if (!session) return
    const investigation = investigations[report.reportId] ?? report.investigation
    let edit = investigation?.edit
    if (action === "edited") {
      if (!edit) { flash("There is no proposed edit to revise."); return }
      const replacement = window.prompt(`Review the replacement for ${edit.field}:`, edit.replace)
      if (replacement === null) return
      edit = { ...edit, replace: replacement }
    }
    if (!window.confirm(`${action === "approved" ? "Approve" : action === "rejected" ? "Reject" : action === "edited" ? "Save edited repair for" : "Return to investigation:"} ${report.reportId}?`)) return
    setPending(true)
    try {
      await api("/api/review", { reportId: report.reportId, action, edit: action === "edited" ? edit : undefined })
      setReports((current) => current.map((item) => item.reportId === report.reportId ? { ...item, status: action === "rejected" ? "rejected" : action === "needs_investigation" ? "investigating" : "resolved" } : item))
      flash(action === "approved" ? "Repair approved and recorded in the audit trail." : "Review decision recorded.")
      setActiveCase(null)
    } catch (error) { flash(error instanceof Error ? error.message : "Review action failed.") }
    setPending(false)
  }

  async function loadAudit() {
    if (!session || session.role !== "faculty") return
    try { const result = await api("/api/cases?offset=0&limit=25"); setAudit(result.items ?? []) }
    catch (error) { flash(error instanceof Error ? error.message : "Could not load audit history.") }
  }

  if (!session) return <LoginPanel onLogin={enter} />
  const isFaculty = session.role === "faculty"
  const pendingReports = reports.filter((item) => !["resolved", "rejected"].includes(item.status))

  function navigate(next: Area) { setArea(next); setMobileNav(false); if (next === "audit") void loadAudit() }
  function showQuestion(question: Question) { setActiveQuestion(question); setSearch("") }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a className="brand-lockup sidebar-brand" href="#dashboard"><span className="brand-mark">a</span><span>acadza</span><span className="brand-divider" /><span className="brand-subtitle">INTEGRITY</span></a>
        <div className="workspace-label">WORKSPACE</div>
        <div className={`workspace-switcher ${isFaculty ? "faculty-workspace" : "student-workspace"}`}><span className="workspace-avatar">{isFaculty ? <ShieldCheck size={16} /> : <GraduationCap size={16} />}</span><span><strong>{isFaculty ? "Faculty review" : "Student portal"}</strong><small>{isFaculty ? "Question quality team" : "JEE · NEET preparation"}</small></span><ChevronDown size={15} /></div>
        <nav className="side-nav" aria-label="Main navigation">
          <div className="nav-group-title">{isFaculty ? "REVIEW DESK" : "LEARNING"}</div>
          {(isFaculty ? navItems : navItems.filter((item) => ["overview", "questions", "reports"].includes(item.id))).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${area === id ? "nav-active" : ""}`} onClick={() => navigate(id)}><Icon size={17} /><span>{isFaculty ? label : id === "overview" ? "My dashboard" : id === "questions" ? "Browse questions" : "My reports"}</span>{isFaculty && id === "queue" && pendingReports.length > 0 && <span className="nav-count">{pendingReports.length}</span>}</button>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="integrity-card"><span className="integrity-icon"><ShieldCheck size={16} /></span><strong>Integrity first</strong><p>Every reported issue is reviewed with care. Your feedback matters.</p></div><button className="profile-row" onClick={signOut}><span className="profile-avatar">{isFaculty ? "FR" : "ST"}</span><span className="profile-meta"><strong>{session.id.startsWith("demo-") ? isFaculty ? "Faculty reviewer" : "Demo student" : session.id.slice(0, 8)}</strong><small>{isFaculty ? "Faculty" : "Student"} · {session.id.startsWith("demo-") ? "Demo workspace" : "Secure workspace"}</small></span><LogOut size={15} /></button></div>
      </aside>
      {mobileNav && <button className="nav-backdrop" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><MoreHorizontal size={21} /></button><div className="breadcrumbs"><span>Acadza</span><ChevronRight size={14} /><strong>{isFaculty ? navItems.find((item) => item.id === area)?.label ?? "Overview" : area === "questions" ? "Browse questions" : area === "reports" ? "My reports" : "My dashboard"}</strong></div><div className="topbar-actions"><span className="mode-pill"><span /> {process.env.NODE_ENV === "production" ? "Secure workspace" : "Demo mode"}</span><button className="help-button" title="Question Integrity help" onClick={() => flash("Need help? Contact your Acadza subject team.")}><CircleHelp size={18} /></button></div></header>
        <div className="page-content">
          {activeQuestion ? <QuestionDetail question={activeQuestion} onBack={() => setActiveQuestion(null)} onReport={() => setReportOpen(true)} /> : activeCase && activeQuestionForCase ? <CaseDetail question={activeQuestionForCase} reports={activeReports} investigations={investigations} pending={pending} onBack={() => setActiveCase(null)} onInvestigate={investigate} onReview={review} /> : (
            <>
              {area === "overview" && <Overview isFaculty={isFaculty} questions={questions} reports={reports} groups={grouped} myReports={myReports} onNavigate={navigate} onOpenCase={setActiveCase} onOpenQuestion={showQuestion} />}
              {area === "queue" && isFaculty && <Queue cases={filteredCases} search={search} setSearch={setSearch} subject={filterSubject} setSubject={setFilterSubject} status={filterStatus} setStatus={setFilterStatus} onOpenCase={setActiveCase} page={page} setPage={setPage} />}
              {area === "reports" && <Reports reports={isFaculty ? reports : myReports} questions={questionById} isFaculty={isFaculty} onOpenCase={setActiveCase} onOpenQuestion={showQuestion} onInvestigate={investigate} pending={pending} />}
              {area === "questions" && <Questions questions={questions} search={search} setSearch={setSearch} subject={filterSubject} setSubject={setFilterSubject} onOpen={showQuestion} />}
              {area === "resolved" && <Reports reports={reports.filter((item) => ["resolved", "rejected"].includes(item.status))} questions={questionById} isFaculty onOpenCase={setActiveCase} onOpenQuestion={showQuestion} onInvestigate={investigate} pending={pending} />}
              {area === "audit" && <Audit items={audit} />}
              {area === "settings" && <Settings taxonomy={taxonomy} openRouterConfigured={openRouterConfigured} openRouterModel={openRouterModel} />}
            </>
          )}
        </div>
      </main>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification"><X size={15} /></button></div>}
      {reportOpen && activeQuestion && <ReportDialog question={activeQuestion} text={reportText} setText={setReportText} category={reportCategory} setCategory={setReportCategory} pending={pending} onClose={() => setReportOpen(false)} onSubmit={submitReport} />}
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow muted-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Overview({ isFaculty, questions, reports, groups, myReports, onNavigate, onOpenCase, onOpenQuestion }: { isFaculty: boolean; questions: Question[]; reports: Report[]; groups: { questionId: string; items: Report[]; question?: Question }[]; myReports: Report[]; onNavigate: (area: Area) => void; onOpenCase: (id: string) => void; onOpenQuestion: (question: Question) => void }) {
  if (!isFaculty) return <>
    <div className="student-welcome"><div className="welcome-copy"><div className="eyebrow muted-eyebrow">STUDENT PORTAL</div><h1>Your voice makes<br /><span>questions better.</span></h1><p>Found something that doesn&apos;t look right? Report it in a few taps and help every student learn with confidence.</p><button className="primary-button" onClick={() => onNavigate("questions")}>Browse questions <ArrowRight size={16} /></button></div><div className="welcome-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-center"><BookOpen size={32} /></div><div className="orbit-chip chip-top"><Check size={14} /> Reviewed</div><div className="orbit-chip chip-bottom"><Sparkles size={14} /> Better learning</div></div></div>
    <div className="section-title-row"><div><h2>My reports</h2><p>Track your feedback and updates</p></div><button className="text-button" onClick={() => onNavigate("reports")}>View all <ArrowRight size={15} /></button></div>
    {myReports.length === 0 ? <div className="empty-state"><span className="empty-icon"><MessageSquareWarning size={22} /></span><strong>No reports yet</strong><p>Your submitted reports and investigation updates will appear here.</p><button className="secondary-button" onClick={() => onNavigate("questions")}>Find a question to review</button></div> : <div className="report-list">{myReports.slice(0, 5).map((r) => <ReportRow key={r.reportId} report={r} question={questions.find((q) => q.id === r.questionId)} onOpen={() => onOpenCase(r.questionId)} />)}</div>}
    <div className="student-tip"><span className="tip-icon"><ShieldCheck size={19} /></span><div><strong>Every report gets a careful review</strong><p>Our subject team checks the original question and the supporting solution before making a change.</p></div><button onClick={() => onNavigate("questions")} className="icon-button" aria-label="Browse questions"><ArrowRight size={17} /></button></div>
  </>

  const metrics = [
    { label: "Total reports", value: reports.length, icon: MessageSquareWarning, detail: `${groups.length} questions flagged`, tone: "blue" },
    { label: "Verified defects", value: reports.filter((r) => r.verdict === "defect" && r.status === "resolved").length, icon: ShieldCheck, detail: "Faculty-confirmed cases", tone: "green" },
    { label: "Awaiting review", value: reports.filter((r) => !["resolved", "rejected"].includes(r.status)).length, icon: Clock3, detail: "Across the review queue", tone: "amber" },
    { label: "No defect found", value: reports.filter((r) => r.verdict === "no_error").length, icon: CheckCheck, detail: "Checked and correct", tone: "gray" },
  ]
  const highPriority = [...groups].sort((a, b) => b.items.length - a.items.length).slice(0, 5)
  return <>
    <PageHeading eyebrow="FACULTY REVIEW DESK" title="Question integrity overview" description="A clear view of student-reported issues across the question bank." action={<span className="date-chip"><Activity size={15} /> Live review queue</span>} />
    <section className="metric-grid" aria-label="Dashboard metrics">{metrics.map(({ label, value, icon: Icon, detail, tone }) => <article className="metric-card" key={label}><div className={`metric-icon metric-${tone}`}><Icon size={18} /></div><div className="metric-label">{label}</div><strong className="metric-value">{value.toLocaleString("en-IN")}</strong><div className="metric-detail">{detail}</div><span className="metric-trend"><ArrowUpRight size={14} /></span></article>)}</section>
    <div className="dashboard-grid"><section className="panel queue-panel"><div className="panel-header"><div><h2>Priority review queue</h2><p>Grouped by question · Most reported first</p></div><button className="text-button" onClick={() => onNavigate("queue")}>Open queue <ArrowRight size={15} /></button></div>{highPriority.length === 0 ? <EmptyInline title="Queue is clear" message="New student reports will appear here." /> : highPriority.map(({ questionId, items, question }) => question && <CaseRow key={questionId} question={question} reports={items} onClick={() => onOpenCase(questionId)} />)}</section><aside className="panel workflow-panel"><div className="panel-header"><div><h2>Review workflow</h2><p>Built for evidence, not guesswork</p></div><span className="workflow-shield"><ShieldCheck size={18} /></span></div><div className="workflow-steps"><div className="workflow-step"><span className="step-number">01</span><span><strong>Report received</strong><small>Student flags a concern</small></span><Check size={15} className="step-done" /></div><div className="workflow-step"><span className="step-number">02</span><span><strong>Evidence checked</strong><small>AI helps triage the claim</small></span><ArrowDownRight size={15} className="step-arrow" /></div><div className="workflow-step"><span className="step-number">03</span><span><strong>Faculty decides</strong><small>Every change needs approval</small></span><LockIcon /></div></div><div className="workflow-note"><Sparkles size={15} /> AI suggestions are never applied automatically.</div></aside></div>
    <div className="section-title-row recent-heading"><div><h2>Recently reported</h2><p>Latest student feedback</p></div><button className="text-button" onClick={() => onNavigate("reports")}>All reports <ArrowRight size={15} /></button></div><div className="report-list">{reports.slice(0, 4).map((r) => <ReportRow key={r.reportId} report={r} question={questions.find((q) => q.id === r.questionId)} onOpen={() => onOpenCase(r.questionId)} />)}</div>
  </>
}

function LockIcon() { return <span className="lock-icon"><ShieldCheck size={14} /></span> }
function EmptyInline({ title, message }: { title: string; message: string }) { return <div className="empty-inline"><span className="empty-icon"><ClipboardCheck size={21} /></span><strong>{title}</strong><p>{message}</p></div> }

function CaseRow({ question, reports, onClick }: { question: Question; reports: Report[]; onClick: () => void }) {
  const isUrgent = reports.length >= 3
  return <button className="case-row" onClick={onClick}><div className={`case-severity ${isUrgent ? "severity-high" : "severity-normal"}`}><FileSearch size={17} /></div><div className="case-main"><div className="case-meta"><strong>{question.qid ?? question.id.slice(-8)}</strong><span className="subject-chip">{question.subject}</span><span className="chapter-label">{question.chapter}</span></div><p>{reports[0]?.comment ?? "Report submitted"}</p><small>Reported {formatTime(reports[0]?.reportedAt ?? new Date().toISOString())}</small></div><div className="case-count"><strong>{reports.length}</strong><small>{reports.length === 1 ? "report" : "reports"}</small></div><span className={`status-pill ${isUrgent ? "status-amber" : "status-blue"}`}>{isUrgent ? "Priority" : "Pending"}</span><ChevronRight size={17} className="row-chevron" /></button>
}

function ReportRow({ report, question, onOpen }: { report: Report; question?: Question; onOpen: () => void }) {
  return <button className="report-row" onClick={onOpen}><span className="report-row-icon"><MessageSquareWarning size={17} /></span><span className="report-row-copy"><strong>{question ? `${question.qid ?? question.id.slice(-8)} · ${question.chapter}` : report.questionId}</strong><small>{report.comment}</small></span><span className={`status-pill ${report.status === "resolved" ? "status-green" : report.status === "rejected" ? "status-gray" : report.status === "investigating" ? "status-amber" : "status-blue"}`}>{report.status.replaceAll("_", " ")}</span><span className="report-time">{formatTime(report.reportedAt)}</span><ChevronRight size={16} className="row-chevron" /></button>
}

function Queue({ cases, search, setSearch, subject, setSubject, status, setStatus, onOpenCase, page, setPage }: { cases: { questionId: string; items: Report[]; question?: Question }[]; search: string; setSearch: (s: string) => void; subject: string; setSubject: (s: string) => void; status: string; setStatus: (s: string) => void; onOpenCase: (id: string) => void; page: number; setPage: (p: number) => void }) {
  const pageSize = 8
  const pageCount = Math.max(1, Math.ceil(cases.length / pageSize))
  return <><PageHeading eyebrow="FACULTY REVIEW DESK" title="Review queue" description="Investigate reported questions, grouped by question ID." action={<span className="queue-total"><span /> {cases.length} cases</span>} /><div className="filter-bar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Search question, chapter or comment" aria-label="Search the review queue" /></label><label className="filter-select"><Filter size={15} /><select value={subject} onChange={(event) => { setSubject(event.target.value); setPage(0) }} aria-label="Filter by subject">{subjects.map((s) => <option key={s}>{s}</option>)}</select></label><label className="filter-select"><SlidersHorizontal size={15} /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }} aria-label="Filter by status">{["All statuses", "Pending", "In review", "Resolved"].map((s) => <option key={s}>{s}</option>)}</select></label><button className="filter-clear" onClick={() => { setSearch(""); setSubject("All subjects"); setStatus("All statuses") }}>Clear</button></div><div className="queue-table-wrap"><div className="queue-table-head"><span>QUESTION / CHAPTER</span><span>STUDENT SIGNAL</span><span>REPORTS</span><span>STATUS</span><span /></div>{cases.slice(page * pageSize, (page + 1) * pageSize).map(({ questionId, items, question }) => question && <CaseTableRow key={questionId} question={question} reports={items} onClick={() => onOpenCase(questionId)} />)}{cases.length === 0 && <EmptyInline title="No cases match these filters" message="Try another search or clear the filters." />}</div><div className="pagination"><span>Showing {cases.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, cases.length)} of {cases.length} grouped cases</span><div><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))}><ChevronLeft size={16} /></button><span>{page + 1} / {pageCount}</span><button aria-label="Next page" disabled={page + 1 >= pageCount} onClick={() => setPage(Math.min(pageCount - 1, page + 1))}><ChevronRight size={16} /></button></div></div></>
}
function CaseTableRow({ question, reports, onClick }: { question: Question; reports: Report[]; onClick: () => void }) { return <button className="queue-table-row" onClick={onClick}><span className="queue-q"><strong>{question.qid ?? question.id.slice(-8)}</strong><small>{question.subject} · {question.chapter}</small></span><span className="queue-signal">{reports.length >= 2 && <span className="signal-dot" />}{reports[0]?.comment}</span><span className="queue-reports">{reports.length} <small>{reports.length === 1 ? "report" : "reports"}</small></span><span><span className={`status-pill ${reports[0]?.status === "resolved" ? "status-green" : reports[0]?.status === "faculty_review" ? "status-amber" : "status-blue"}`}>{reports[0]?.status === "faculty_review" ? "In review" : reports[0]?.status === "resolved" ? "Resolved" : "Pending"}</span></span><ChevronRight size={16} className="row-chevron" /></button> }

function Reports({ reports, questions, isFaculty, onOpenCase, onOpenQuestion, onInvestigate, pending }: { reports: Report[]; questions: Map<string, Question>; isFaculty: boolean; onOpenCase: (id: string) => void; onOpenQuestion: (q: Question) => void; onInvestigate: (r: Report) => void; pending: boolean }) {
  return <><PageHeading eyebrow={isFaculty ? "FACULTY REVIEW DESK" : "STUDENT PORTAL"} title={isFaculty ? "All reports" : "My reports"} description={isFaculty ? "Every report, with its linked question and current review status." : "Track the questions you have flagged and see the latest update."} /><div className="report-list full-report-list">{reports.map((report) => { const question = questions.get(report.questionId); return <article className="report-card" key={report.reportId}><div className="report-card-top"><span className="report-id">{report.reportId}</span><span className={`status-pill ${report.status === "resolved" ? "status-green" : report.status === "rejected" ? "status-gray" : report.status === "faculty_review" ? "status-amber" : "status-blue"}`}>{report.status.replaceAll("_", " ")}</span></div><p className="report-card-comment">“{report.comment}”</p><div className="report-card-bottom"><span>{question?.subject} · {question?.chapter} · {formatTime(report.reportedAt)}</span><div>{isFaculty && report.status === "pending" && <button className="small-button" disabled={pending} onClick={() => onInvestigate(report)}><Sparkles size={14} /> Investigate</button>}{question && <button className="small-button" onClick={() => isFaculty ? onOpenCase(report.questionId) : onOpenQuestion(question)}>{isFaculty ? "Open case" : "View question"}<ArrowRight size={14} /></button>}</div></div></article> })}{reports.length === 0 && <EmptyInline title="No reports to show" message="Reports will appear here after a student flags a question." />}</div></>
}

function Questions({ questions, search, setSearch, subject, setSubject, onOpen }: { questions: Question[]; search: string; setSearch: (s: string) => void; subject: string; setSubject: (s: string) => void; onOpen: (q: Question) => void }) {
  const filtered = questions.filter((question) => (subject === "All subjects" || question.subject === subject) && (!search || [question.id, question.qid ?? "", question.subject, question.chapter, stripHtml(question.question)].join(" ").toLowerCase().includes(search.toLowerCase())))
  return <><PageHeading eyebrow="QUESTION BANK" title="Browse questions" description="Search the supplied question set and open any question to report a concern." action={<span className="count-chip"><BookOpen size={15} /> {questions.length} questions</span>} /><div className="filter-bar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search question, topic or ID" aria-label="Search questions" /></label><label className="filter-select"><Filter size={15} /><select value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Filter by subject">{subjects.map((s) => <option key={s}>{s}</option>)}</select></label></div><div className="question-grid">{filtered.map((q) => <button className="question-card" key={q.id} onClick={() => onOpen(q)}><div className="question-card-top"><span className="subject-chip">{q.subject}</span><span className="difficulty-chip">{q.level.toLowerCase()}</span></div><strong>{q.qid ?? `Question ${q.id.slice(-6)}`}</strong><span className="question-chapter">{q.chapter}</span><p>{stripHtml(q.question).slice(0, 130)}…</p><span className="question-open">Open question <ArrowRight size={14} /></span></button>)}{filtered.length === 0 && <EmptyInline title="No matching questions" message="Try a different search or subject." />}</div></>
}

function QuestionDetail({ question, onBack, onReport }: { question: Question; onBack: () => void; onReport: () => void }) {
  return <><button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Back to questions</button><PageHeading eyebrow={`${question.subject} · ${question.chapter}`} title={question.qid ?? `Question ${question.id.slice(-8)}`} description={`${question.questionType === "integerQuestion" ? "Integer type" : question.questionType.toUpperCase()} · ${question.level.toLowerCase()} difficulty`} action={<button className="primary-button" onClick={onReport}><MessageSquareWarning size={16} /> Report an issue</button>} /><article className="question-detail-card"><div className="question-section-heading"><span>QUESTION</span><span className="subtle-tag">{question.level}</span></div><div className="rendered-question" dangerouslySetInnerHTML={{ __html: question.question }} />{question.quesImages?.map((image, i) => <img className="question-image" key={i} src={image} alt={`Question diagram ${i + 1}`} />)}<details className="answer-details"><summary><span>Answer &amp; solution</span><ChevronDown size={16} /></summary><div className="answer-block"><div className="answer-line"><strong>Stored answer</strong><span>{Array.isArray(question.answer) ? question.answer.filter(Boolean).join(", ") : question.answer}</span></div><div className="rendered-question" dangerouslySetInnerHTML={{ __html: question.solution }} />{question.solutionImages?.map((image, i) => <img className="question-image" key={i} src={image} alt={`Solution diagram ${i + 1}`} />)}</div></details></article><div className="student-note"><ShieldCheck size={18} /><span><strong>Think something is wrong?</strong><small>Reports are reviewed by subject experts before corrections are made.</small></span><button className="secondary-button" onClick={onReport}>Report issue</button></div></>
}

function CaseDetail({ question, reports, investigations, pending, onBack, onInvestigate, onReview }: { question: Question; reports: Report[]; investigations: Record<string, Investigation>; pending: boolean; onBack: () => void; onInvestigate: (r: Report) => void; onReview: (r: Report, action: "approved" | "edited" | "rejected" | "needs_investigation") => void }) {
  const lead = reports[0]
  const result = lead ? investigations[lead.reportId] ?? lead.investigation : null
  const answer = Array.isArray(question.answer) ? question.answer.filter(Boolean).join(", ") : question.answer
  return <><button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Back to review queue</button><div className="case-detail-heading"><div><div className="eyebrow muted-eyebrow">CASE INVESTIGATION</div><h1>{question.qid ?? question.id.slice(-8)} <span className="subject-chip">{question.subject}</span></h1><p>{question.chapter} · {question.level.toLowerCase()} · {reports.length} student {reports.length === 1 ? "report" : "reports"}</p></div><span className="status-pill status-amber">{lead?.status === "resolved" ? "Resolved" : "Faculty review"}</span></div><div className="investigation-layout"><section className="panel original-panel"><div className="case-panel-title"><div><span className="panel-kicker">01 · SOURCE MATERIAL</span><h2>Original question</h2></div><span className="subtle-tag">Unchanged source</span></div><div className="question-meta-line"><span>{question.questionType.toUpperCase()}</span><span>{question.subject}</span><span>{question.chapter}</span></div><div className="rendered-question case-question" dangerouslySetInnerHTML={{ __html: question.question }} /><div className="stored-answer"><span>STORED ANSWER</span><strong>{answer}</strong></div><div className="solution-section"><span className="panel-kicker">ORIGINAL SOLUTION</span><div className="rendered-question" dangerouslySetInnerHTML={{ __html: question.solution }} /></div><div className="student-comments"><div className="case-panel-title"><div><span className="panel-kicker">STUDENT SIGNAL</span><h2>Reported comments</h2></div><span className="count-chip">{reports.length}</span></div>{reports.map((report) => <div className="comment-card" key={report.reportId}><span className="comment-avatar">{initials(report.studentId)}</span><div><div className="comment-meta"><strong>{report.reportId}</strong><small>{formatTime(report.reportedAt)}</small></div><p>{report.comment}</p><small>Source: {report.source}</small></div></div>)}</div></section><section className="panel analysis-panel"><div className="case-panel-title"><div><span className="panel-kicker">02 · AI-ASSISTED TRIAGE</span><h2>Investigation findings</h2></div><span className="ai-mark"><Sparkles size={15} /> AI</span></div>{!result ? <div className="analysis-empty"><span className="analysis-empty-icon"><FlaskConical size={24} /></span><strong>Ready to investigate</strong><p>Analyze the student&apos;s claim against the source question and other reports. Results remain suggestions until faculty review.</p><button className="primary-button" disabled={pending || !lead} onClick={() => lead && onInvestigate(lead)}><Sparkles size={16} /> {pending ? "Investigating…" : "Run investigation"}</button></div> : <><div className="verdict-banner"><span className={`verdict-symbol ${result.verdict === "defect" ? "verdict-danger" : result.verdict === "no_error" ? "verdict-good" : "verdict-warn"}`}>{result.verdict === "defect" ? <AlertCircle size={18} /> : result.verdict === "no_error" ? <Check size={18} /> : <CircleHelp size={18} />}</span><div><span className="panel-kicker">AI VERDICT · {Math.round(result.confidence * 100)}% MODEL CONFIDENCE</span><strong>{result.verdict.replaceAll("_", " ")}</strong><small>Model confidence is not proof or independent verification.</small></div></div><section className="evidence-block"><h3>Explainable evidence</h3>{Object.entries({"Student claim": result.evidence.claim, "Question evidence": result.evidence.questionEvidence, "Independent verification": result.evidence.independentVerification, "Stored answer comparison": result.evidence.storedAnswerComparison, "Classification reasoning": result.evidence.reasoning, "Repair safety": result.evidence.safety, "Routing": result.evidence.routing}).map(([title, value]) => <div className="evidence-row" key={title}><span>{title}</span><p>{value}</p></div>)}</section>{result.verificationChecks?.length ? <section className="verification-block"><h3>Verification checks</h3>{result.verificationChecks.map((check, i) => <div key={i}><Check size={14} />{check}</div>)}</section> : null}<section className="repair-card"><div className="repair-card-header"><span className="panel-kicker">SUGGESTED REPAIR</span><span className="status-pill status-amber">Faculty approval required</span></div>{result.repair ? <><strong>{result.repair.replaceAll("_", " ")}</strong>{result.edit ? <div className="diff-block"><div className="diff-before"><span>BEFORE · {result.edit.field}</span><p>{result.edit.find}</p></div><div className="diff-arrow"><ArrowDownRight size={15} /></div><div className="diff-after"><span>AFTER</span><p>{result.edit.replace}</p></div></div> : <p>{result.evidence.safety}</p>}</> : <p>No repair proposed. No changes have been applied.</p>}</section><div className="reply-preview"><span className="panel-kicker">STUDENT REPLY PREVIEW</span><p>“{result.student_reply}”</p></div><div className="faculty-actions"><button className="secondary-button" disabled={pending} onClick={() => lead && onReview(lead, "needs_investigation")}>Needs more review</button><button className="danger-button" disabled={pending} onClick={() => lead && onReview(lead, "rejected")}>Reject</button><button className="primary-button" disabled={pending} onClick={() => lead && onReview(lead, "approved")}><Check size={15} /> Approve repair</button></div><p className="action-warning"><ShieldCheck size={14} /> Your decision is recorded in the audit history. Approval applies only a validated field-level change.</p></>}</section></div></>
}

function Audit({ items }: { items: Record<string, unknown>[] }) {
  return <><PageHeading eyebrow="GOVERNANCE" title="Audit history" description="A paginated record of faculty review decisions and before/after values." /><div className="panel audit-panel"><div className="audit-head"><span>REVIEWER / ACTION</span><span>CASE</span><span>RECORDED AT</span></div>{items.map((item) => <div className="audit-row" key={String(item.id)}><span><strong>{String(item.reviewer)}</strong><small>{String(item.action).replaceAll("_", " ")}</small></span><span>{String(item.report_id)}<small>{String(item.question_id)}</small></span><span>{formatTime(String(item.created_at))}</span></div>)}{items.length === 0 && <EmptyInline title="No review actions yet" message="Faculty decisions will appear here with their change history." />}</div><p className="audit-note"><ShieldCheck size={15} /> Audit events are append-only in the application workflow.</p></>
}
function Settings({ taxonomy, openRouterConfigured, openRouterModel }: { taxonomy: Taxonomy; openRouterConfigured: boolean; openRouterModel: string }) { return <><PageHeading eyebrow="SYSTEM SETTINGS" title="AI configuration" description="Triage guardrails and the closed classification set used by this workspace." /><div className="settings-grid"><section className="panel settings-card"><div className="panel-header"><div><h2>Investigation provider</h2><p>OpenRouter · server-side only</p></div><span className={`status-pill ${openRouterConfigured ? "status-green" : "status-amber"}`}>{openRouterConfigured ? "Connected" : "OPENROUTER_API_KEY required"}</span></div><div className="setting-line"><span>Model</span><strong>{openRouterModel}</strong></div><div className="setting-line"><span>Structured response</span><strong>Zod validated</strong></div><div className="setting-line"><span>Repair policy</span><strong>Faculty approval required</strong></div><div className="setting-callout"><ShieldCheck size={17} /><p>API credentials are used only by server routes. The model cannot apply edits or override the repair allowlist.</p></div></section><section className="panel settings-card"><div className="panel-header"><div><h2>Allowed verdicts</h2><p>Closed set from taxonomy.json</p></div><Tags size={18} className="muted-icon" /></div><div className="taxonomy-list">{Object.entries(taxonomy.verdicts).map(([key, label]) => <div key={key}><span className="taxonomy-dot" /><span><strong>{key.replaceAll("_", " ")}</strong><small>{label}</small></span></div>)}</div></section><section className="panel settings-card"><div className="panel-header"><div><h2>Repair permissions</h2><p>Only taxonomy-listed fields can be edited</p></div></div><div className="taxonomy-list">{Object.entries(taxonomy.repairs).map(([key, value]) => <div key={key}><span className={`permission-dot ${value.auto ? "permission-auto" : "permission-human"}`} /><span><strong>{key.replaceAll("_", " ")}</strong><small>{value.label} · {value.auto ? "Eligible for validation" : "Faculty-only"}</small></span></div>)}</div></section><section className="panel settings-card safety-settings"><div className="panel-header"><div><h2>Safety defaults</h2><p>Human-led decisions for high-stakes content</p></div><LockKeyhole size={18} className="muted-icon" /></div><ul><li>Answer-key changes require independent faculty verification.</li><li>Model confidence never triggers automatic application.</li><li>Student comments are treated as untrusted data.</li><li>HTML is sanitized and prompt input is bounded.</li><li>Audit records include the old and new status values.</li></ul></section></div></> }

function ReportDialog({ question, text, setText, category, setCategory, pending, onClose, onSubmit }: { question: Question; text: string; setText: (s: string) => void; category: string; setCategory: (s: string) => void; pending: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title"><div className="dialog-top"><span className="dialog-icon"><MessageSquareWarning size={18} /></span><button className="icon-button" aria-label="Close report form" onClick={onClose}><X size={18} /></button></div><h2 id="report-title">Report a question issue</h2><p className="dialog-description">{question.qid ?? question.id} · {question.subject} · {question.chapter}</p><form onSubmit={onSubmit}><label htmlFor="report-category">What seems wrong? <span>Optional</span></label><select id="report-category" value={category} onChange={(event) => setCategory(event.target.value)}><option>Not sure</option><option>Question or options</option><option>Answer key</option><option>Solution</option><option>Image or display</option><option>App behaviour</option><option>Language</option></select><label htmlFor="report-comment">Tell us a little more</label><textarea id="report-comment" value={text} onChange={(event) => setText(event.target.value)} required minLength={8} maxLength={1200} rows={4} placeholder="What did you notice? A short note is enough." /><small className="form-hint">Please don&apos;t include personal details. {text.length}/1200</small><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={pending || text.trim().length < 8}>{pending ? "Sending…" : "Submit report"}<ArrowRight size={15} /></button></div></form><div className="dialog-foot"><ShieldCheck size={14} /> Reviewed by Acadza subject experts</div></section></div>
}
