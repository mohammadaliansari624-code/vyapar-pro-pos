import { useMemo, useState } from 'react'
import { ArrowRight, Ban, BadgeCheck, Crown, RotateCcw, Search, ShieldOff, UserCheck, Users as UsersIcon } from 'lucide-react'
import { api, errorText } from '../api'
import { formatDate } from '../format'
import { ConfirmDialog, EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, StatCard, StatusBadge, useToast } from '../ui'
import type { AccountStatus, AdminUser, Role, User } from '../types'

type Action =
  | { kind: 'status'; user: AdminUser; to: AccountStatus }
  | { kind: 'role'; user: AdminUser; to: Role }

const roleLabel = (r: Role) => (r === 'admin' ? 'Administrator' : 'User')

function describe(a: Action) {
  const name = a.user.name
  if (a.kind === 'role') {
    return a.to === 'admin'
      ? { title: 'Make administrator?', confirm: 'Make administrator', danger: false, text: `${name} will be able to approve, block and manage other users.` }
      : { title: 'Remove administrator access?', confirm: 'Remove access', danger: true, text: `${name} will lose access to user management immediately.` }
  }
  if (a.to === 'approved') {
    return a.user.status === 'blocked'
      ? { title: 'Unblock user?', confirm: 'Unblock', danger: false, text: `${name} will be able to sign in and use the shop again.` }
      : { title: 'Approve user?', confirm: 'Approve', danger: false, text: `${name} will get access to billing, products and invoices.` }
  }
  return { title: 'Block user?', confirm: 'Block user', danger: true, text: `${name} will be signed out right away and cannot sign in until unblocked.` }
}

export function Users({ users, me, state, error, reload }: {
  users: AdminUser[]; me: User; state: 'loading' | 'ready' | 'error'; error: string; reload: () => Promise<void>
}) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | AccountStatus>('all')
  const [role, setRole] = useState<'all' | Role>('all')
  const [pending, setPending] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)

  const counts = useMemo(() => ({
    total: users.length,
    pending: users.filter((u) => u.status === 'pending').length,
    approved: users.filter((u) => u.status === 'approved').length,
    blocked: users.filter((u) => u.status === 'blocked').length,
    admins: users.filter((u) => u.role === 'admin').length,
  }), [users])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const order: Record<AccountStatus, number> = { pending: 0, approved: 1, blocked: 2 }
    return users
      .filter((u) => (status === 'all' || u.status === status) && (role === 'all' || u.role === role) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)))
      .sort((a, b) => order[a.status] - order[b.status] || b.created_at.localeCompare(a.created_at))
  }, [users, query, status, role])

  async function confirm() {
    if (!pending || busy) return
    setBusy(true)
    try {
      if (pending.kind === 'status') {
        await api(`/api/admin/users/${pending.user.id}/status?status=${encodeURIComponent(pending.to)}`, { method: 'PATCH' })
        toast.success(`${pending.user.name} is now ${pending.to}.`)
      } else {
        await api(`/api/admin/users/${pending.user.id}/role`, { method: 'PATCH', json: { role: pending.to } })
        toast.success(`${pending.user.name} is now ${roleLabel(pending.to).toLowerCase()}.`)
      }
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false); setPending(null)
      await reload().catch(() => undefined) // always show the server's current truth
    }
  }

  const info = pending ? describe(pending) : null
  const filterChips: { id: 'all' | AccountStatus; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: counts.total }, { id: 'pending', label: 'Pending', n: counts.pending },
    { id: 'approved', label: 'Approved', n: counts.approved }, { id: 'blocked', label: 'Blocked', n: counts.blocked },
  ]

  return (
    <>
      <PageHeader title="User management" subtitle="Approve accounts, block access and manage administrators." />
      <div className="stats-grid">
        <StatCard label="Total users" value={String(counts.total)} hint={`${counts.admins} administrator${counts.admins === 1 ? '' : 's'}`} icon={<UsersIcon size={20} />} />
        <StatCard label="Pending approval" value={String(counts.pending)} icon={<UserCheck size={20} />} tone="amber" />
        <StatCard label="Approved" value={String(counts.approved)} icon={<BadgeCheck size={20} />} tone="green" />
        <StatCard label="Blocked" value={String(counts.blocked)} icon={<Ban size={20} />} tone="red" />
      </div>

      <Panel>
        {state === 'error' ? <ErrorState message={error} onRetry={() => void reload()} /> : state === 'loading' && users.length === 0 ? <LoadingBlock label="Loading users…" /> : (
          <>
            <div className="toolbar">
              <label className="search-box"><Search size={16} /><input className="input" placeholder="Search name or email" aria-label="Search users" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
              <div className="segmented" role="group" aria-label="Filter by status">
                {filterChips.map((c) => <button key={c.id} className={status === c.id ? 'active' : ''} aria-pressed={status === c.id} onClick={() => setStatus(c.id)}>{c.label} <span className="chip-count">{c.n}</span></button>)}
              </div>
              <select className="input select-auto" aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                <option value="all">All roles</option><option value="admin">Administrators</option><option value="user">Users</option>
              </select>
            </div>
            {visible.length === 0 ? <EmptyState title="No users match" text="Change the search or filters." /> : (
              <div className="table-wrap">
                <table className="users-table">
                  <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Registered</th><th className="actions-col">Actions</th></tr></thead>
                  <tbody>
                    {visible.map((u) => {
                      const self = u.id === me.id
                      return (
                        <tr key={u.id}>
                          <td className="cell-wrap"><b>{u.name}</b>{self && <span className="badge badge-neutral you-badge">You</span>}<small className="block muted">{u.email}</small></td>
                          <td>{u.role === 'admin' ? <span className="badge badge-admin"><Crown size={12} />Administrator</span> : <span className="badge badge-neutral">User</span>}</td>
                          <td><StatusBadge status={u.status} /></td>
                          <td>{formatDate(u.created_at)}</td>
                          <td className="actions-col">
                            {self ? <span className="muted">Your account</span> : (
                              <div className="row-actions">
                                {u.status === 'pending' && <button className="btn btn-secondary btn-sm" onClick={() => setPending({ kind: 'status', user: u, to: 'approved' })}><UserCheck size={14} />Approve</button>}
                                {u.status === 'blocked' && <button className="btn btn-secondary btn-sm" onClick={() => setPending({ kind: 'status', user: u, to: 'approved' })}><RotateCcw size={14} />Unblock</button>}
                                {u.status !== 'blocked' && u.role !== 'admin' && <button className="btn btn-danger btn-sm" onClick={() => setPending({ kind: 'status', user: u, to: 'blocked' })}><Ban size={14} />Block</button>}
                                {u.status === 'approved' && u.role === 'user' && <button className="btn btn-secondary btn-sm" onClick={() => setPending({ kind: 'role', user: u, to: 'admin' })}><Crown size={14} />Make admin</button>}
                                {u.role === 'admin' && <button className="btn btn-secondary btn-sm" onClick={() => setPending({ kind: 'role', user: u, to: 'user' })}><ShieldOff size={14} />Remove admin</button>}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Panel>

      {pending && info && (
        <ConfirmDialog title={info.title} confirmLabel={info.confirm} danger={info.danger} busy={busy} onConfirm={confirm} onCancel={() => setPending(null)}>
          <p><b>{pending.user.name}</b> <span className="muted">({pending.user.email})</span></p>
          <p>{info.text}</p>
          <div className="change-preview" aria-label="Change summary">
            {pending.kind === 'role'
              ? <><span>Role</span><span className="badge badge-neutral">{roleLabel(pending.user.role)}</span><ArrowRight size={16} /><span className="badge badge-admin">{roleLabel(pending.to)}</span></>
              : <><span>Status</span><StatusBadge status={pending.user.status} /><ArrowRight size={16} /><StatusBadge status={pending.to} /></>}
          </div>
        </ConfirmDialog>
      )}
    </>
  )
}
