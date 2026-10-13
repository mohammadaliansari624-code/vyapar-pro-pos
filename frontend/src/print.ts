import { money, qty } from './format'
import type { Invoice, ShopSettings } from './types'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))

function receiptHtml(inv: Invoice, shop: ShopSettings): string {
  const width = shop.receipt_width === 'A4' ? '210mm' : shop.receipt_width
  const bodyWidth = shop.receipt_width === 'A4' ? '190mm' : `calc(${width} - 8mm)`
  const rows = inv.items
    .map((i) => `<tr><td>${escapeHtml(i.product_name)}<small>${qty(i.quantity)} ${escapeHtml(i.unit)} × ${money(i.unit_price)}</small></td><td>${money(i.line_total)}</td></tr>`)
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(inv.invoice_number)}</title><style>
@page{size:${width} auto;margin:4mm}
body{font:${shop.receipt_font_size}px Arial,sans-serif;width:${bodyWidth};margin:auto;color:#111}
h2,p{text-align:center;margin:5px 0}
table{width:100%;border-collapse:collapse}
td{padding:5px 0;border-bottom:1px dashed #aaa;vertical-align:top}
td:last-child{text-align:right;white-space:nowrap;padding-left:8px}
small{display:block}
.total{font-weight:bold;border-top:1px solid #111;padding-top:8px}
.muted{font-size:10px}
</style></head><body>
<h2>${escapeHtml(shop.name)}</h2><p>${escapeHtml(shop.address)}</p><p>${escapeHtml(shop.phone)}</p><hr>
<p>${escapeHtml(inv.invoice_number)}</p><p>${new Date(inv.created_at).toLocaleString('en-IN')}</p>
<p>${escapeHtml(inv.customer_name)} ${escapeHtml(inv.customer_phone)}</p>
<table>${rows}</table>
<p>Subtotal: ${money(inv.subtotal)}</p><p>Discount: ${money(inv.discount)}</p>
<p class="total">TOTAL: ${money(inv.total)}</p><p>Payment: ${escapeHtml(inv.payment_method)}</p>
<p class="muted">Thank you for shopping!</p></body></html>`
}

// Prints through a hidden frame, so browsers do not block it like a pop-up window.
export function printInvoice(inv: Invoice, shop: ShopSettings): void {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const win = frame.contentWindow
  if (!win) { frame.remove(); return }
  win.document.open()
  win.document.write(receiptHtml(inv, shop))
  win.document.close()
  const remove = () => window.setTimeout(() => frame.remove(), 500)
  win.addEventListener('afterprint', remove)
  window.setTimeout(() => { win.focus(); win.print() }, 250)
  window.setTimeout(() => frame.remove(), 120000) // safety clean-up
}
