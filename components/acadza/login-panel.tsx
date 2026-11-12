"use client"

import { useState } from "react"
import { ArrowRight, GraduationCap, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBrowserSupabase } from "@/lib/acadza/client-auth"
import type { Role } from "@/lib/acadza/types"

type Props = { onLogin: (role: Role, token?: string, id?: string) => void }
type Mode = "signin" | "signup"

async function ensureStudentRole(token: string) {
  const response = await fetch("/api/auth/ensure-student-role", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error ?? "Could not prepare your student account.")
  return result.role as Role
}

export function LoginPanel({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)
  const demoEnabled = process.env.NODE_ENV !== "production"

  function switchMode(next: Mode) {
    setMode(next); setError(""); setNotice(""); setPassword(""); setConfirmPassword("")
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("")
    const client = getBrowserSupabase()
    if (!client) return setError("Authentication is not configured for this deployment.")
    setLoading(true)
    try {
      const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (authError || !data.user || !data.session) throw new Error("Unable to sign in. Check your credentials and try again.")
      let role = data.user.app_metadata?.role as Role | undefined
      if (!role) {
        role = await ensureStudentRole(data.session.access_token)
        await client.auth.refreshSession()
      }
      if (role !== "student" && role !== "faculty") throw new Error("Your account does not have an Acadza access role. Ask an administrator to assign one.")
      onLogin(role, data.session.access_token, data.user.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.")
    } finally { setLoading(false) }
  }

  async function signUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("")
    if (password.length < 8) return setError("Use a password with at least 8 characters.")
    if (password !== confirmPassword) return setError("The passwords do not match.")
    const client = getBrowserSupabase()
    if (!client) return setError("Authentication is not configured for this deployment.")
    setLoading(true)
    try {
      const { data, error: authError } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      })
      if (authError) throw authError
      if (data.session && data.user) {
        const role = await ensureStudentRole(data.session.access_token)
        await client.auth.refreshSession()
        onLogin(role, data.session.access_token, data.user.id)
        return
      }
      setNotice("Account created. Check your email for the confirmation link. After confirming, sign in here to enter your student workspace.")
      setMode("signin"); setPassword(""); setConfirmPassword("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create your account. Please try again.")
    } finally { setLoading(false) }
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <a className="brand-lockup" href="#home" aria-label="Acadza Question Integrity home">
          <span className="brand-mark">a</span><span>acadza</span><span className="brand-divider" /><span className="brand-subtitle">QUESTION INTEGRITY</span>
        </a>
        <div className="login-story-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> TRUST EVERY QUESTION</div>
          <h1>Better questions.<br /><span>Fairer outcomes.</span></h1>
          <p>A careful review system that helps students speak up, and gives faculty the evidence to act with confidence.</p>
          <div className="login-proof"><span className="proof-icon"><ShieldCheck size={19} /></span><span>Every proposed change is reviewed.<br /><strong>Nothing changes without faculty approval.</strong></span></div>
        </div>
        <div className="story-foot"><span>ACADZA · QUESTION QUALITY SYSTEM</span><span>BUILT FOR JEE &amp; NEET</span></div>
      </section>
      <section className="login-main" aria-labelledby="signin-title">
        <div className="login-card">
          <div className="login-mobile-brand"><span className="brand-mark">a</span><span>acadza</span></div>
          <div className="login-heading"><span className="login-icon"><Sparkles size={18} /></span><span>WELCOME TO ACADZA</span></div>
          <h2 id="signin-title">{mode === "signin" ? "Sign in to continue" : "Create your account"}</h2>
          <p className="login-description">{mode === "signin" ? "Choose your workspace and get back to learning or reviewing." : "Create a student account to report and track question issues."}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-success" role="status">{notice}</p>}
          {demoEnabled ? (
            <div className="role-options">
              <button type="button" className="role-card" onClick={() => onLogin("student", undefined, "demo-student")}><span className="role-symbol student-symbol"><GraduationCap size={20} /></span><span className="role-copy"><strong>Student portal</strong><small>Browse questions and report an issue</small></span><ArrowRight size={17} className="role-arrow" /></button>
              <button type="button" className="role-card" onClick={() => onLogin("faculty", undefined, "demo-faculty")}><span className="role-symbol faculty-symbol"><ShieldCheck size={20} /></span><span className="role-copy"><strong>Faculty workspace</strong><small>Investigate and review reported cases</small></span><ArrowRight size={17} className="role-arrow" /></button>
              <div className="demo-note"><span className="demo-dot" /> Demo mode · separate student and faculty views</div>
            </div>
          ) : (
            <>
              <div className="auth-mode-switch" role="group" aria-label="Authentication mode">
                <button type="button" className={mode === "signin" ? "auth-mode-active" : ""} onClick={() => switchMode("signin")}>Sign in</button>
                <button type="button" className={mode === "signup" ? "auth-mode-active" : ""} onClick={() => switchMode("signup")}>Sign up</button>
              </div>
              <form className="signin-form" onSubmit={mode === "signin" ? signIn : signUp}>
                {mode === "signup" && <><label htmlFor="full-name">Full name</label><input id="full-name" type="text" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" /></>}
                <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                <label htmlFor="password">Password</label><input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} />
                {mode === "signup" && <><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></>}
                <Button type="submit" className="signin-button" disabled={loading}>{loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}<ArrowRight data-icon="inline-end" /></Button>
                {mode === "signin" ? <p className="auth-helper">New to Acadza? <button type="button" onClick={() => switchMode("signup")}>Create a student account</button></p> : <p className="auth-helper">Already have an account? <button type="button" onClick={() => switchMode("signin")}>Sign in</button></p>}
                <p className="secure-note"><LockKeyhole size={13} /> Secured with Acadza authentication</p>
              </form>
              {mode === "signup" && <p className="signup-policy">Student registration is open. Faculty accounts require administrator authorisation.</p>}
            </>
          )}
          <div className="login-footer">By continuing, you agree to use the platform responsibly and report issues in good faith.</div>
        </div>
        <div className="login-copyright">© 2026 Acadza · Precision in every question</div>
      </section>
    </main>
  )
}
