import { TriangleAlert as AlertTriangle, CircleDollarSign, FileText, Package, Plus, ReceiptText, TrendingUp } from 'lucide-react'
import { LOW_STOCK_LIMIT, formatDate, money, qty, stockState } from '../format'
import { EmptyState, Panel, PageHeader, StatCard } from '../ui'
import { InvoiceTable } from './Invoices'
import type { Invoice, Product, ShopSettings, Summary, User } from '../types'
import type { Route } from '../App'

export function Dashboard({ user, summary, products, invoices, settings, go }: {
  user: User; summary: Summary; products: Product[]; invoices: Invoice[]; settings: ShopSettings; go: (r: Route) => void
}) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const lowStock = products.filter((p) => stockState(p) !== 'ok').sort((a, b) => Number(a.stock) - Number(b.stock))
  return (
    <>
      <PageHeader title={`${greeting}, ${user.name.split(' ')[0]}`} subtitle="Here is how your shop is doing." />
      <div className="stats-grid stats-grid-6">
        <StatCard label="Today's revenue" value={money(summary.today_revenue)} icon={<CircleDollarSign size={20} />} />
        <StatCard label="Last 7 days" value={money(summary.last_7_days_revenue)} icon={<TrendingUp size={20} />} tone="green" />
        <StatCard label="Lifetime revenue" value={money(summary.lifetime_revenue)} icon={<ReceiptText size={20} />} tone="slate" />
        <StatCard label="Invoices" value={String(summary.invoice_count)} icon={<FileText size={20} />} tone="amber" />
        <StatCard label="Products" value={String(products.length)} icon={<Package size={20} />} />
        <StatCard label="Low or out of stock" value={String(lowStock.length)} hint={lowStock.length ? 'Needs restocking' : 'All stocked'} icon={<AlertTriangle size={20} />} tone={lowStock.length ? 'red' : 'green'} />
      </div>
      <div className="dashboard-grid">
        <Panel title="Recent invoices" subtitle="Your latest sales" actions={<button className="btn btn-secondary btn-sm" onClick={() => go('invoices')}>View all</button>}>
          <InvoiceTable invoices={invoices.slice(0, 6)} settings={settings} compact />
        </Panel>
        <div className="stack">
          <Panel title="Low stock" subtitle={`Items at or below ${LOW_STOCK_LIMIT} units`} actions={<button className="btn btn-secondary btn-sm" onClick={() => go('products')}>Manage</button>}>
            {lowStock.length === 0 ? (
              <EmptyState title="Nothing is running low" text={`Items appear here when stock drops to ${LOW_STOCK_LIMIT} or less.`} />
            ) : (
              <ul className="plain-list">
                {lowStock.slice(0, 6).map((p) => (
                  <li key={p.id} className="plain-list-row">
                    <span className="truncate">{p.name}</span>
                    <span className={`badge ${stockState(p) === 'out' ? 'badge-blocked' : 'badge-pending'}`}>
                      {stockState(p) === 'out' ? 'Out of stock' : `${qty(p.stock)} ${p.unit} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Quick actions">
            <div className="quick-actions">
              <button className="btn btn-primary" onClick={() => go('billing')}><ReceiptText size={16} />New bill</button>
              <button className="btn btn-secondary" onClick={() => go('products')}><Plus size={16} />Add product</button>
            </div>
            {invoices[0] && <p className="muted small-note">Last sale: {formatDate(invoices[0].created_at)}</p>}
          </Panel>
        </div>
      </div>
    </>
  )
}
