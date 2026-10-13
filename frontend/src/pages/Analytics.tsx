import { useMemo, useState } from 'react'
import { CircleDollarSign, FileText, ReceiptText, TrendingUp } from 'lucide-react'
import { money, qty } from '../format'
import { EmptyState, PageHeader, Panel, StatCard } from '../ui'
import { ExportCsvButton } from './Invoices'
import type { Invoice, Summary } from '../types'

const INVOICE_FETCH_LIMIT = 1000 // the invoices API returns at most this many

const dayKey = (d: Date) => d.toLocaleDateString('en-CA') // YYYY-MM-DD in the browser's timezone

export function Analytics({ summary, invoices }: { summary: Summary; invoices: Invoice[] }) {
  const [days, setDays] = useState<7 | 30>(7)

  const { series, inRange, paymentRows, productRows } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const keys: string[] = []
    for (let i = days - 1; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); keys.push(dayKey(d)) }
    const perDay = new Map(keys.map((k) => [k, 0]))
    const range = invoices.filter((inv) => perDay.has(dayKey(new Date(inv.created_at))))
    for (const inv of range) { const k = dayKey(new Date(inv.created_at)); perDay.set(k, (perDay.get(k) ?? 0) + Number(inv.total)) }
    const byPayment = new Map<string, number>()
    const byProduct = new Map<string, { amount: number; quantity: number; unit: string }>()
    for (const inv of range) {
      byPayment.set(inv.payment_method, (byPayment.get(inv.payment_method) ?? 0) + Number(inv.total))
      for (const it of inv.items) {
        const row = byProduct.get(it.product_name) ?? { amount: 0, quantity: 0, unit: it.unit }
        row.amount += Number(it.line_total); row.quantity += Number(it.quantity)
        byProduct.set(it.product_name, row)
      }
    }
    return {
      series: keys.map((k) => ({ key: k, amount: perDay.get(k) ?? 0 })),
      inRange: range,
      paymentRows: [...byPayment.entries()].sort((a, b) => b[1] - a[1]),
      productRows: [...byProduct.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 5),
    }
  }, [invoices, days])

  const rangeTotal = series.reduce((s, d) => s + d.amount, 0)
  const peak = Math.max(...series.map((d) => d.amount), 1)
  const average = summary.invoice_count > 0 ? Number(summary.lifetime_revenue) / summary.invoice_count : 0
  const truncated = invoices.length >= INVOICE_FETCH_LIMIT

  return (
    <>
      <PageHeader title="Analytics" subtitle="Sales trends from your invoices." actions={<ExportCsvButton />} />
      <div className="stats-grid">
        <StatCard label="Today's revenue" value={money(summary.today_revenue)} icon={<CircleDollarSign size={20} />} />
        <StatCard label="Last 7 days" value={money(summary.last_7_days_revenue)} icon={<TrendingUp size={20} />} tone="green" />
        <StatCard label="Lifetime revenue" value={money(summary.lifetime_revenue)} icon={<ReceiptText size={20} />} tone="slate" />
        <StatCard label="Invoices" value={String(summary.invoice_count)} hint={summary.invoice_count ? `Average ${money(average)}` : undefined} icon={<FileText size={20} />} tone="amber" />
      </div>

      <Panel title="Daily revenue" subtitle={`${money(rangeTotal)} over the last ${days} days · ${inRange.length} invoices`}
        actions={
          <div className="segmented" role="group" aria-label="Date range">
            {([7, 30] as const).map((d) => <button key={d} className={days === d ? 'active' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>)}
          </div>
        }>
        {inRange.length === 0 ? (
          <EmptyState title="No sales in this period" text="Revenue bars appear after you create bills." />
        ) : (
          <div className="bar-chart" role="img" aria-label={`Daily revenue for the last ${days} days. Highest day ${money(peak)}.`}>
            {series.map((d, i) => (
              <div className="bar-col" key={d.key} title={`${d.key}: ${money(d.amount)}`}>
                <div className="bar-track"><div className="bar" style={{ height: `${Math.max(d.amount > 0 ? 3 : 0, (d.amount / peak) * 100)}%` }} /></div>
                <span className="bar-label">{days === 7 || i % 5 === 0 ? new Date(`${d.key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
              </div>
            ))}
          </div>
        )}
        {truncated && <p className="muted small-note">Charts use your latest {INVOICE_FETCH_LIMIT} invoices.</p>}
      </Panel>

      <div className="two-col">
        <Panel title="Top products" subtitle={`By revenue, last ${days} days`}>
          {productRows.length === 0 ? <EmptyState title="No product sales yet" /> : (
            <ul className="plain-list">
              {productRows.map(([name, r]) => (
                <li key={name} className="plain-list-row"><span className="truncate">{name}<small className="block muted">{qty(r.quantity.toFixed(3))} {r.unit} sold</small></span><b>{money(r.amount)}</b></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Payment methods" subtitle={`Share of revenue, last ${days} days`}>
          {paymentRows.length === 0 ? <EmptyState title="No payments yet" /> : (
            <ul className="plain-list">
              {paymentRows.map(([method, amount]) => (
                <li key={method} className="meter-row">
                  <div className="meter-head"><span>{method}</span><b>{money(amount)}</b></div>
                  <div className="meter"><div style={{ width: `${rangeTotal ? (amount / rangeTotal) * 100 : 0}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
