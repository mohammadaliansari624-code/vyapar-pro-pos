import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import type { AccountStatus } from './types'

/* ---------- Toasts ---------- */
type Toast = { id: number; kind: 'success' | 'error'; text: string }
type ToastApi = { success: (text: string) => void; error: (text: string) => void }
const ToastContext = createContext<ToastApi>({ success() {}, error() {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef<number[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, kind, text }])
    timers.current.push(window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000))
  }, [])
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  const api = useMemo<ToastApi>(() => ({ success: (t) => push('success', t), error: (t) => push('error', t) }), [push])
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.kind === 'success' ? <Check size={18} /> : <TriangleAlert size={18} />}
            <span>{t.text}</span>
            <button className="icon-btn" aria-label="Dismiss message" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ---------- Modal and confirmation ---------- */
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = box.current?.querySelector<HTMLElement>('[data-autofocus]') ?? box.current
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return }
      if (e.key !== 'Tab' || !box.current) return
      const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!items.length) return
      const firstItem = items[0], lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) { e.preventDefault(); lastItem.focus() }
      else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); firstItem.focus() }
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
      previous?.focus()
    }
  }, [])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={box} tabIndex={-1}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, children, confirmLabel, danger, busy, onConfirm, onCancel }: {
  title: string; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={() => { if (!busy) onCancel() }}
      footer={<>
        <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`} onClick={onConfirm} disabled={busy} data-autofocus>
          {busy && <LoaderCircle size={16} className="spin" />}{confirmLabel}
        </button>
      </>}
    >
      {children}
    </Modal>
  )
}

/* ---------- Small building blocks ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div className="page-heading-text">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  )
}

export function Panel({ title, subtitle, actions, children, className = '' }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-heading">
          <div className="panel-heading-text">
            {title && <h2>{title}</h2>}
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {actions && <div className="panel-heading-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, hint, icon, tone = 'indigo' }: { label: string; value: string; hint?: string; icon: ReactNode; tone?: 'indigo' | 'green' | 'amber' | 'red' | 'slate' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`}>{icon}</div>
      <div className="stat-text">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Info size={20} /></div>
      <p className="empty-title">{title}</p>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <TriangleAlert size={22} />
      <p><strong>Could not load your data.</strong></p>
      <p className="muted">{message}</p>
      {onRetry && <button className="btn btn-secondary" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading-block" role="status"><LoaderCircle className="spin" size={20} />{label}</div>
}

const STATUS_LABEL: Record<AccountStatus, string> = { pending: 'Pending', approved: 'Approved', blocked: 'Blocked' }
export function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
