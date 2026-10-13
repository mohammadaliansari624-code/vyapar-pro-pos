import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart3, LayoutDashboard, LogOut, Menu, Package, ReceiptText, Settings as SettingsIcon, ShieldCheck, ShoppingCart, X } from 'lucide-react'
import { api, ApiError, errorText, setUnauthorizedHandler } from './api'
import { ErrorState, LoadingBlock, ToastProvider, useToast } from './ui'
import { AuthScreen, PendingScreen } from './pages/AuthScreen'
import { Dashboard } from './pages/Dashboard'
import { Billing } from './pages/Billing'
import { Products } from './pages/Products'
import { Invoices } from './pages/Invoices'
import { Analytics } from './pages/Analytics'
import { SettingsPage } from './pages/SettingsPage'
import { Users } from './pages/Users'
import type { AdminUser, Invoice, Product, ShopSettings, Summary, User } from './types'

export const ROUTES = ['dashboard', 'billing', 'products', 'invoices', 'analytics', 'settings', 'users'] as const
export type Route = (typeof ROUTES)[number]

const NAV: { route: Route; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'billing', label: 'Billing / POS', icon: ShoppingCart },
  { route: 'products', label: 'Products / Inventory', icon: Package },
  { route: 'invoices', label: 'Invoices', icon: ReceiptText },
  { route: 'analytics', label: 'Analytics', icon: BarChart3 },
  { route: 'settings', label: 'Settings', icon: SettingsIcon },
  { route: 'users', label: 'User management', icon: ShieldCheck, adminOnly: true },
]

const readRoute = (): Route => {
  const id = window.location.hash.replace(/^#\/?/, '')
  return (ROUTES as readonly string[]).includes(id) ? (id as Route) : 'dashboard'
}

const emptySettings: ShopSettings = { name: 'My Shop', address: '', phone: '', receipt_width: '80mm', receipt_font_size: 12 }
const emptySummary: Summary = { today_revenue: '0', last_7_days_revenue: '0', lifetime_revenue: '0', invoice_count: 0 }
type Load = 'loading' | 'ready' | 'error'

export default function App() {
  return <ToastProvider><Root /></ToastProvider>
}

function Root() {
  const toast = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootNotice, setBootNotice] = useState('')

  useEffect(() => {
    let ignore = false
    api<User>('/api/auth/me')
      .then((u) => { if (!ignore) setUser(u) })
      .catch((e) => { if (!ignore && e instanceof ApiError && e.status === 403) setBootNotice(e.message) })
      .finally(() => { if (!ignore) setBooting(false) })
    return () => { ignore = true }
  }, [])

  // If the session expires while the app is open, go back to the sign-in screen.
  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); setBootNotice('Your session expired. Please sign in again.') })
    return () => setUnauthorizedHandler(null)
  }, [])

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch { /* the cookie is cleared server-side when possible */ }
    window.history.replaceState(null, '', window.location.pathname)
    setBootNotice('')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try { setUser(await api<User>('/api/auth/me')) }
    catch (e) { toast.error(errorText(e)); if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setUser(null) }
  }, [toast])

  if (booting) return <div className="boot-screen"><LoadingBlock label="Loading Vyapar Pro…" /></div>
  if (!user) return <AuthScreen initialNotice={bootNotice} onAuthenticated={(u) => { setBootNotice(''); setUser(u) }} />
  if (user.status === 'pending') return <PendingScreen user={user} onRefresh={refreshUser} onLogout={logout} />
  if (user.status !== 'approved') return <AuthScreen initialNotice="This account cannot be used right now." onAuthenticated={setUser} />
  return <Workspace user={user} onLogout={logout} />
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const isAdmin = user.role === 'admin'
  const [route, setRoute] = useState<Route>(readRoute)
  const [drawer, setDrawer] = useState(false)
  const [load, setLoad] = useState<Load>('loading')
  const [loadError, setLoadError] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [settings, setSettings] = useState<ShopSettings>(emptySettings)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoad, setUsersLoad] = useState<Load>('loading')
  const [usersError, setUsersError] = useState('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const go = useCallback((r: Route) => { window.location.hash = `#/${r}`; setDrawer(false) }, [])
  useEffect(() => {
    const onHash = () => { setRoute(readRoute()); setDrawer(false); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open') }
  }, [drawer])

  const loadShop = useCallback(async () => {
    try {
      const [p, i, s, st] = await Promise.all([
        api<Product[]>('/api/products'), api<Invoice[]>('/api/invoices'),
        api<Summary>('/api/analytics/summary'), api<ShopSettings>('/api/settings'),
      ])
      if (!mounted.current) return
      setProducts(p); setInvoices(i); setSummary(s); setSettings(st); setLoad('ready')
    } catch (e) {
      if (!mounted.current) return
      setLoadError(errorText(e)); setLoad((old) => (old === 'ready' ? 'ready' : 'error'))
      throw e
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const list = await api<AdminUser[]>('/api/admin/users')
      if (mounted.current) { setUsers(list); setUsersLoad('ready') }
    } catch (e) {
      if (mounted.current) { setUsersError(errorText(e)); setUsersLoad('error') }
      throw e
    }
  }, [])

  useEffect(() => { loadShop().catch(() => undefined) }, [loadShop])
  useEffect(() => { if (isAdmin) loadUsers().catch(() => undefined) }, [isAdmin, loadUsers])

  const current: Route = route === 'users' && !isAdmin ? 'dashboard' : route
  const pendingCount = users.filter((u) => u.status === 'pending').length
  const title = NAV.find((n) => n.route === current)?.label ?? 'Dashboard'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${drawer ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark">V</span>
          <span className="brand-text"><b>Vyapar Pro</b><small>Billing &amp; Analytics</small></span>
          <button className="icon-btn sidebar-close" aria-label="Close menu" onClick={() => setDrawer(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav">
          {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ route: r, label, icon: Icon }) => (
            <a key={r} href={`#/${r}`} className={`nav-item ${current === r ? 'active' : ''}`} aria-current={current === r ? 'page' : undefined}>
              <Icon size={18} /><span>{label}</span>
              {r === 'users' && pendingCount > 0 && <span className="nav-count" aria-label={`${pendingCount} pending approvals`}>{pendingCount}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="user-chip-text"><b>{user.name}</b><small>{isAdmin ? 'Administrator' : 'Shop owner'}</small></span>
          </div>
          <button className="nav-item nav-button" onClick={onLogout}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={22} /></button>
          <span className="topbar-title">{title}</span>
          <span className="topbar-date">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </header>
        <main className="page-content" id="content">
          {current === 'users' ? (
            <Users users={users} me={user} state={usersLoad} error={usersError} reload={loadUsers} />
          ) : load === 'loading' ? (
            <LoadingBlock label="Loading your shop…" />
          ) : load === 'error' ? (
            <ErrorState message={loadError} onRetry={() => { setLoad('loading'); loadShop().catch(() => undefined) }} />
          ) : (
            <>
              {current === 'dashboard' && <Dashboard user={user} summary={summary} products={products} invoices={invoices} settings={settings} go={go} />}
              {current === 'billing' && <Billing products={products} settings={settings} onCreated={loadShop} />}
              {current === 'products' && <Products products={products} onChanged={loadShop} />}
              {current === 'invoices' && <Invoices invoices={invoices} settings={settings} />}
              {current === 'analytics' && <Analytics summary={summary} invoices={invoices} />}
              {current === 'settings' && <SettingsPage settings={settings} onSaved={setSettings} />}
            </>
          )}
        </main>
        <footer className="footer"><span>© {new Date().getFullYear()} Vyapar Pro POS</span></footer>
      </div>
    </div>
  )
}
