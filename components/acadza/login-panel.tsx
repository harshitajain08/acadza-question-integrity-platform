"use client"

import { useState } from "react"
import { ArrowRight, GraduationCap, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBrowserSupabase } from "@/lib/acadza/client-auth"
import type { Role } from "@/lib/acadza/types"

type Props = { onLogin: (role: Role, token?: string, id?: string) => void }

export function LoginPanel({ onLogin }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const demoEnabled = process.env.NODE_ENV !== "production"

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const client = getBrowserSupabase()
    if (!client) return setError("Authentication is not configured for this deployment.")
    setLoading(true)
    const { data, error: authError } = await client.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError || !data.user) return setError("Unable to sign in. Check your credentials and try again.")
    const role = data.user.app_metadata?.role
    if (role !== "student" && role !== "faculty") return setError("Your account does not have an Acadza access role. Ask an administrator to assign one.")
    onLogin(role, data.session?.access_token, data.user.id)
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
          <h2 id="signin-title">Sign in to continue</h2>
          <p className="login-description">Choose your workspace and get back to learning or reviewing.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {demoEnabled ? (
            <div className="role-options">
              <button type="button" className="role-card" onClick={() => onLogin("student", undefined, "demo-student")}>
                <span className="role-symbol student-symbol"><GraduationCap size={20} /></span><span className="role-copy"><strong>Student portal</strong><small>Browse questions and report an issue</small></span><ArrowRight size={17} className="role-arrow" />
              </button>
              <button type="button" className="role-card" onClick={() => onLogin("faculty", undefined, "demo-faculty")}>
                <span className="role-symbol faculty-symbol"><ShieldCheck size={20} /></span><span className="role-copy"><strong>Faculty workspace</strong><small>Investigate and review reported cases</small></span><ArrowRight size={17} className="role-arrow" />
              </button>
              <div className="demo-note"><span className="demo-dot" /> Demo mode · separate student and faculty views</div>
            </div>
          ) : (
            <form className="signin-form" onSubmit={signIn}>
              <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@acadza.com" />
              <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
              <Button type="submit" className="signin-button" disabled={loading}>{loading ? "Signing in…" : "Sign in"}<ArrowRight data-icon="inline-end" /></Button>
              <p className="secure-note"><LockKeyhole size={13} /> Secured with Acadza authentication</p>
            </form>
          )}
          <div className="login-footer">By continuing, you agree to use the platform responsibly and report issues in good faith.</div>
        </div>
        <div className="login-copyright">© 2026 Acadza · Precision in every question</div>
      </section>
    </main>
  )
}
