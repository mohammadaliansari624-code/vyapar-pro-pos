import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, LoaderCircle, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { api, errorText } from '../api'
import { money, qty, round2, round3, stockState } from '../format'
import { printInvoice } from '../print'
import { EmptyState, Modal, PageHeader, Panel, useToast } from '../ui'
import { PAYMENT_METHODS, type Invoice, type Product, type ShopSettings } from '../types'

type CartLine = { productId: number; quantity: number }

// Whole units for pieces, tenths for kg / litre / g / ml.
const stepFor = (p: Product) => (p.unit === 'Piece' ? 1 : 0.1)

export function Billing({ products, settings, onCreated }: { products: Product[]; settings: ShopSettings; onCreated: () => Promise<void> }) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState<string>(PAYMENT_METHODS[0])
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<Invoice | null>(null)
  const cartRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)          // blocks a second click before React re-renders
  const idempotencyKey = useRef<string | null>(null)

  // A retry of the same bill reuses one key (so the server cannot create it twice);
  // any change to the bill starts a new key.
  useEffect(() => { idempotencyKey.current = null }, [cart, customer, phone, discount, payment])

  const lines = useMemo(
    () => cart.flatMap((c) => { const product = products.find((p) => p.id === c.productId); return product ? [{ product, quantity: c.quantity }] : [] }),
    [cart, products],
  )
  const subtotal = round2(lines.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0))
  const discountValue = Math.min(subtotal, Math.max(0, Number(discount) || 0))
  const total = round2(subtotal - discountValue)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => !q || `${p.name} ${p.code}`.toLowerCase().includes(q))
  }, [products, search])

  function setQuantity(product: Product, wanted: number) {
    const stock = Number(product.stock)
    if (wanted <= 0) { setCart((c) => c.filter((l) => l.productId !== product.id)); return }
    const next = round3(Math.min(wanted, stock))
    if (wanted > stock) toast.error(`Only ${qty(stock)} ${product.unit} of ${product.name} in stock.`)
    setCart((c) => (c.some((l) => l.productId === product.id)
      ? c.map((l) => (l.productId === product.id ? { ...l, quantity: next } : l))
      : [...c, { productId: product.id, quantity: next }]))
  }
  const inCart = (p: Product) => cart.find((l) => l.productId === p.id)?.quantity ?? 0
  const addProduct = (p: Product) => setQuantity(p, round3(inCart(p) + stepFor(p)))

  async function checkout() {
    if (busy.current || !lines.length) return
    busy.current = true
    setSubmitting(true)
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID()
    try {
      const invoice = await api<Invoice>('/api/checkout', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey.current },
        json: {
          items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
          customer_name: customer.trim() || 'Walk-in Customer',
          customer_phone: phone.trim(),
          discount: discountValue,
          payment_method: payment,
        },
      })
      setCart([]); setCustomer(''); setPhone(''); setDiscount('')
      idempotencyKey.current = null
      setReceipt(invoice)
      toast.success(`Bill ${invoice.invoice_number} created.`)
      await onCreated().catch(() => undefined)
    } catch (e) {
      toast.error(errorText(e))
      await onCreated().catch(() => undefined) // stock may have changed: show fresh numbers
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  const itemCount = lines.length
  return (
    <>
      <PageHeader title="Billing" subtitle="Pick products, review the bill and check out." />
      <div className="billing-grid">
        <Panel title="Products" subtitle={`${products.length} in stock list`}>
          <label className="search-box">
            <Search size={16} />
            <input className="input" placeholder="Search by name or code" aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {visible.length === 0 ? (
            <EmptyState title={products.length ? 'No matching products' : 'No products yet'} text={products.length ? 'Try a different name or code.' : 'Add products in the Products page first.'} />
          ) : (
            <div className="product-grid">
              {visible.map((p) => {
                const state = stockState(p)
                const left = Number(p.stock) - inCart(p)
                return (
                  <button key={p.id} className="product-card" onClick={() => addProduct(p)} disabled={left <= 0} aria-label={`Add ${p.name} to bill`}>
                    <span className="product-name">{p.name}</span>
                    <span className="product-code muted">{p.code || 'No code'}</span>
                    <span className="product-foot">
                      <b className="product-price">{money(p.price)}</b>
                      <span className={`badge ${state === 'out' ? 'badge-blocked' : state === 'low' ? 'badge-pending' : 'badge-neutral'}`}>
                        {state === 'out' ? 'Out of stock' : `${qty(p.stock)} ${p.unit}`}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Panel>

        <div ref={cartRef} className="cart-anchor">
          <Panel title="Current bill" subtitle={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`} className="cart-panel"
            actions={itemCount > 0 ? <button className="btn btn-ghost btn-sm" onClick={() => setCart([])}><Trash2 size={15} />Clear</button> : undefined}>
            <div className="cart-lines">
              {lines.length === 0 ? <EmptyState title="Bill is empty" text="Select a product to add it here." /> : lines.map(({ product, quantity }) => (
                <div className="cart-line" key={product.id}>
                  <div className="cart-line-info">
                    <span className="cart-line-name">{product.name}</span>
                    <span className="muted">{money(product.price)} / {product.unit} · {qty(product.stock)} available</span>
                  </div>
                  <div className="qty-control">
                    <button className="icon-btn" aria-label={`Decrease ${product.name}`} onClick={() => setQuantity(product, round3(quantity - stepFor(product)))}><Minus size={14} /></button>
                    <input className="input qty-input" type="number" inputMode="decimal" min={0} step="any" aria-label={`Quantity of ${product.name}`} value={quantity}
                      onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) setQuantity(product, round3(n)) }} />
                    <button className="icon-btn" aria-label={`Increase ${product.name}`} onClick={() => addProduct(product)}><Plus size={14} /></button>
                  </div>
                  <b className="cart-line-total">{money(Number(product.price) * quantity)}</b>
                  <button className="icon-btn" aria-label={`Remove ${product.name}`} onClick={() => setQuantity(product, 0)}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <div className="checkout-fields">
              <label className="field"><span className="field-label">Customer name</span><input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in customer" maxLength={180} /></label>
              <label className="field"><span className="field-label">Phone</span><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" maxLength={40} /></label>
              <label className="field"><span className="field-label">Discount (₹)</span><input className="input" type="number" inputMode="decimal" min={0} max={subtotal} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></label>
              <label className="field"><span className="field-label">Payment method</span>
                <select className="input" value={payment} onChange={(e) => setPayment(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
              </label>
            </div>
            <div className="totals">
              <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
              <div><span>Discount</span><b>− {money(discountValue)}</b></div>
              <div className="grand-total"><span>Total payable</span><strong>{money(total)}</strong></div>
            </div>
            <button className="btn btn-primary btn-block btn-lg" onClick={checkout} disabled={!lines.length || submitting}>
              {submitting ? <><LoaderCircle size={18} className="spin" />Creating bill…</> : <><Check size={18} />Complete checkout</>}
            </button>
          </Panel>
        </div>
      </div>

      {itemCount > 0 && (
        <button className="mobile-cart-bar" onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <ShoppingCart size={18} /><span>View bill · {itemCount} {itemCount === 1 ? 'item' : 'items'}</span><b>{money(total)}</b>
        </button>
      )}

      {receipt && (
        <Modal title="Bill created" onClose={() => setReceipt(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => printInvoice(receipt, settings)}><Printer size={16} />Print receipt</button>
            <button className="btn btn-primary" onClick={() => setReceipt(null)} data-autofocus>Start next bill</button>
          </>}>
          <div className="success-summary">
            <span className="icon-circle icon-circle-green"><Check size={24} /></span>
            <p className="mono"><b>{receipt.invoice_number}</b></p>
            <p className="success-total">{money(receipt.total)}</p>
            <p className="muted">{receipt.customer_name} · {receipt.payment_method}</p>
          </div>
        </Modal>
      )}
    </>
  )
}
