import { useMemo, useState } from 'react'
import { Download, Eye, LoaderCircle, Printer, Search } from 'lucide-react'
import { downloadInvoicesCsv, errorText } from '../api'
import { formatDate, formatTime, money, qty } from '../format'
import { printInvoice } from '../print'
import { EmptyState, Modal, PageHeader, Panel, useToast } from '../ui'
import { PAYMENT_METHODS, type Invoice, type ShopSettings } from '../types'

export function ExportCsvButton() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function run() {
    if (busy) return
    setBusy(true)
    try { await downloadInvoicesCsv() } catch (e) { toast.error(errorText(e)) } finally { setBusy(false) }
  }
  return <button className="btn btn-secondary" onClick={run} disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}Export CSV</button>
}

export function InvoiceDetail({ invoice, settings, onClose }: { invoice: Invoice; settings: ShopSettings; onClose: () => void }) {
  return (
    <Modal
      title={`Invoice ${invoice.invoice_number}`}
      onClose={onClose}
      wide
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={() => printInvoice(invoice, settings)} data-autofocus><Printer size={16} />Print receipt</button>
      </>}
    >
      <dl className="detail-grid">
        <div><dt>Customer</dt><dd>{invoice.customer_name}{invoice.customer_phone ? ` · ${invoice.customer_phone}` : ''}</dd></div>
        <div><dt>Date</dt><dd>{formatDate(invoice.created_at)}, {formatTime(invoice.created_at)}</dd></div>
        <div><dt>Payment</dt><dd>{invoice.payment_method}</dd></div>
      </dl>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {invoice.items.map((i, idx) => (
              <tr key={`${i.product_id ?? 'x'}-${idx}`}>
                <td className="cell-wrap">{i.product_name}</td>
                <td className="num">{qty(i.quantity)} {i.unit}</td>
                <td className="num">{money(i.unit_price)}</td>
                <td className="num">{money(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals">
        <div><span>Subtotal</span><b>{money(invoice.subtotal)}</b></div>
        <div><span>Discount</span><b>− {money(invoice.discount)}</b></div>
        <div className="grand-total"><span>Total</span><strong>{money(invoice.total)}</strong></div>
      </div>
    </Modal>
  )
}

export function InvoiceTable({ invoices, settings, compact }: { invoices: Invoice[]; settings: ShopSettings; compact?: boolean }) {
  const [selected, setSelected] = useState<Invoice | null>(null)
  if (!invoices.length) return <EmptyState title="No invoices yet" text="Invoices appear here after your first checkout." />
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th><th>Customer</th>{!compact && <th>Date</th>}{!compact && <th>Payment</th>}<th className="num">Total</th><th className="actions-col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td><b className="mono">{i.invoice_number}</b>{compact && <small className="block muted">{formatDate(i.created_at)}</small>}</td>
                <td className="cell-wrap">{i.customer_name}{i.customer_phone && !compact && <small className="block muted">{i.customer_phone}</small>}</td>
                {!compact && <td>{formatDate(i.created_at)}<small className="block muted">{formatTime(i.created_at)}</small></td>}
                {!compact && <td><span className="badge badge-neutral">{i.payment_method}</span></td>}
                <td className="num"><b>{money(i.total)}</b></td>
                <td className="actions-col">
                  <div className="row-actions">
                    <button className="icon-btn" aria-label={`View ${i.invoice_number}`} title="View details" onClick={() => setSelected(i)}><Eye size={16} /></button>
                    <button className="icon-btn" aria-label={`Print ${i.invoice_number}`} title="Print receipt" onClick={() => printInvoice(i, settings)}><Printer size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <InvoiceDetail invoice={selected} settings={settings} onClose={() => setSelected(null)} />}
    </>
  )
}

const PAGE = 50

export function Invoices({ invoices, settings }: { invoices: Invoice[]; settings: ShopSettings }) {
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState('')
  const [shown, setShown] = useState(PAGE)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return invoices.filter((i) =>
      (!payment || i.payment_method === payment) &&
      (!q || `${i.invoice_number} ${i.customer_name} ${i.customer_phone}`.toLowerCase().includes(q)))
  }, [invoices, query, payment])
  return (
    <>
      <PageHeader title="Invoices" subtitle="Every bill you have created, newest first." actions={<ExportCsvButton />} />
      <Panel>
        <div className="toolbar">
          <label className="search-box">
            <Search size={16} />
            <input className="input" placeholder="Search invoice, customer or phone" aria-label="Search invoices" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }} />
          </label>
          <select className="input select-auto" aria-label="Filter by payment method" value={payment} onChange={(e) => { setPayment(e.target.value); setShown(PAGE) }}>
            <option value="">All payment methods</option>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <span className="muted toolbar-count">{filtered.length} of {invoices.length}</span>
        </div>
        <InvoiceTable invoices={filtered.slice(0, shown)} settings={settings} />
        {filtered.length > shown && <div className="load-more"><button className="btn btn-secondary" onClick={() => setShown(shown + PAGE)}>Show more</button></div>}
      </Panel>
    </>
  )
}
