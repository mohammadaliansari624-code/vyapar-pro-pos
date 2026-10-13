
import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { api, errorText } from '../api'
import { Field } from '../ui'
import type { User } from '../types'

type Mode = 'login' | 'register'
type Errors = Partial<Record<'name' | 'email' | 'password', string>>

export function AuthScreen({
  initialNotice,
  onAuthenticated,
}: {
  initialNotice?: string
  onAuthenticated: (u: User) => void
}) {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState(initialNotice ?? '')
  const [busy, setBusy] = useState(false)

  function validate(): Errors {
    const e: Errors = {}

    if (mode === 'register' && name.trim().length < 2) {
      e.name = 'Enter your full name (at least 2 characters).'
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      e.email = 'Enter a valid email address.'
    }

    if (mode === 'register' ? password.length < 10 : !password) {
      e.password =
        mode === 'register'
          ? 'Use at least 10 characters.'
          : 'Enter your password.'
    }

    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()

    if (busy) return

    const found = validate()
    setErrors(found)
    setFormError('')

    if (Object.keys(found).length) return

    setBusy(true)

    try {
      const credentials = {
        email: email.trim(),
        password,
        remember_me: remember,
      }

      if (mode === 'register') {
        await api<User>('/api/auth/register', {
          method: 'POST',
          json: {
            name: name.trim(),
            email: email.trim(),
            password,
          },
        })
      }

      const user = await api<User>('/api/auth/login', {
        method: 'POST',
        json: credentials,
      })

      onAuthenticated(user)
    } catch (e) {
      setFormError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login')
    setErrors({})
    setFormError('')
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">V</span>
          <span className="brand-name">Vyapar Pro</span>
        </div>

        <h1>
          {mode === 'login'
            ? 'Sign in to your shop'
            : 'Create your account'}
        </h1>

        <p className="muted">
          {mode === 'login'
            ? 'Manage products, sales and invoices in one place.'
            : 'New accounts are reviewed by an administrator before use.'}
        </p>

        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={submit} noValidate className="form-stack">
          {mode === 'register' && (
            <Field label="Full name" error={errors.name}>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={120}
              />
            </Field>
          )}

          <Field label="Email address" error={errors.email}>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>

          <Field
            label="Password"
            error={errors.password}
            hint={
              mode === 'register'
                ? 'Use at least 10 characters.'
                : undefined
            }
          >
            <span className="password-wrap">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />

              <button
                type="button"
                className="icon-btn password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </Field>

          {mode === 'login' && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me signed in on this device
            </label>
          )}

          <button
            className="btn btn-primary btn-block"
            disabled={busy}
            type="submit"
          >
            {busy && <LoaderCircle size={16} className="spin" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button className="link-btn" onClick={switchMode} type="button">
          {mode === 'login'
            ? "Don't have an account? Create one"
            : 'Already registered? Sign in'}
        </button>
      </div>
    </main>
  )
}

export function PendingScreen({
  user,
  onRefresh,
  onLogout,
}: {
  user: User
  onRefresh: () => Promise<void>
  onLogout: () => void
}) {
  const [busy, setBusy] = useState(false)

  return (
    <main className="auth-screen">
      <div className="auth-card auth-card-center">
        <span className="icon-circle">
          <ShieldCheck size={26} />
        </span>

        <h1>Waiting for approval</h1>

        <p className="muted">
          Hi {user.name.split(' ')[0]}, your account ({user.email}) was
          created. An administrator needs to approve it before you can use
          billing and inventory.
        </p>

        <button
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onRefresh()
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Check approval status
        </button>

        <button className="link-btn" onClick={onLogout} type="button">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </main>
  )
}
