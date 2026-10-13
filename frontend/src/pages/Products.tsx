import { useMemo, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, Pencil, Search, Trash2 } from 'lucide-react'
import { api, errorText } from '../api'
import { money, qty, stockState } from '../format'
import { ConfirmDialog, EmptyState, Field, PageHeader, Panel, useToast } from '../ui'
import { UNITS, type Product } from '../types'

type Form = { code: string; name: string; price: string; stock: string; unit: string }
const blank: Form = { code: '', name: '', price: '', stock: '', unit: 'Piece' }
type Errors = Partial<Record<keyof Form, string>>

export function Products({ products, onChanged }: { products: Product[]; onChanged: () => Promise<void> }) {
  const toast = useToast()
  const [form, setForm] = useState<Form>(blank)
  const [errors, setErrors] = useState<Errors>({})
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      const state = stockState(p)
      return (!q || `${p.name} ${p.code}`.toLowerCase().includes(q)) &&
        (filter === 'all' || (filter === 'out' ? state === 'out' : state !== 'ok'))
    })
  }, [products, query, filter])

  function validate(): Errors {
    const e: Errors = {}
    if (!form.name.trim()) e.name = 'Enter a product name.'
    const price = Number(form.price), stock = Number(form.stock)
    if (form.price === '' || !Number.isFinite(price) || price < 0) e.price = 'Enter a price of 0 or more.'
    if (form.stock === '' || !Number.isFinite(stock) || stock < 0) e.stock = 'Enter a stock of 0 or more.'
    return e
  }

  async function save(ev: FormEvent) {
    ev.preventDefault()
    if (saving) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      await api(editId ? `/api/products/${editId}` : '/api/products', {
        method: editId ? 'PUT' : 'POST',
        json: { code: form.code.trim(), name: form.name.trim(), price: Number(form.price), stock: Number(form.stock), unit: form.unit },
      })
      toast.success(editId ? 'Product updated.' : 'Product added.')
      reset()
      await onChanged()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  function reset() { setForm(blank); setEditId(null); setErrors({}) }

  function edit(p: Product) {
    setEditId(p.id); setErrors({})
    setForm({ code: p.code, name: p.name, price: String(Number(p.price)), stock: String(Number(p.stock)), unit: p.unit })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function confirmDelete() {
    if (!toDelete || deleting) return
    setDeleting(true)
    try {
      await api(`/api/products/${toDelete.id}`, { method: 'DELETE' })
      toast.success(`${toDelete.name} deleted.`)
      if (editId === toDelete.id) reset()
      await onChanged()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setDeleting(false); setToDelete(null)
    }
  }

  return (
    <>
      <PageHeader title="Products" subtitle="Keep prices and stock up to date." />
      <div className="products-grid">
        <div ref={formRef} className="form-anchor">
          <Panel title={editId ? 'Edit product' : 'Add product'} subtitle={editId ? 'Update the details and save.' : 'New items appear in Billing right away.'}>
            <form className="form-stack" onSubmit={save} noValidate>
              <Field label="Product name" error={errors.name}><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={180} /></Field>
              <Field label="Code or serial" hint="Optional. Must be unique in your shop.">
                <input className="input" value={form.code} onChange={(e) => set({ code: e.target.value })} maxLength={100} />
              </Field>
              <div className="form-row">
                <Field label="Price (₹)" error={errors.price}><input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={form.price} onChange={(e) => set({ price: e.target.value })} /></Field>
                <Field label="Stock" error={errors.stock}><input className="input" type="number" inputMode="decimal" min={0} step="0.001" value={form.stock} onChange={(e) => set({ stock: e.target.value })} /></Field>
              </div>
              <Field label="Unit"><select className="input" value={form.unit} onChange={(e) => set({ unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
              <div className="button-row">
                <button className="btn btn-primary" disabled={saving}>{saving && <LoaderCircle size={16} className="spin" />}{editId ? 'Save changes' : 'Add product'}</button>
                {editId && <button type="button" className="btn btn-secondary" onClick={reset} disabled={saving}>Cancel</button>}
              </div>
            </form>
          </Panel>
        </div>

        <Panel title="Inventory" subtitle={`${products.length} ${products.length === 1 ? 'product' : 'products'}`}>
          <div className="toolbar">
            <label className="search-box"><Search size={16} /><input className="input" placeholder="Search inventory" aria-label="Search inventory" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <select className="input select-auto" aria-label="Filter by stock" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All stock levels</option><option value="low">Low or out of stock</option><option value="out">Out of stock</option>
            </select>
          </div>
          {visible.length === 0 ? (
            <EmptyState title={products.length ? 'No matching products' : 'No products yet'} text={products.length ? 'Change the search or filter.' : 'Add your first product using the form.'} />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Product</th><th className="num">Price</th><th>Stock</th><th className="actions-col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {visible.map((p) => {
                    const state = stockState(p)
                    return (
                      <tr key={p.id}>
                        <td className="cell-wrap"><b>{p.name}</b><small className="block muted">{p.code || 'No code'}</small></td>
                        <td className="num">{money(p.price)}</td>
                        <td><span className={`badge ${state === 'out' ? 'badge-blocked' : state === 'low' ? 'badge-pending' : 'badge-approved'}`}>{state === 'out' ? 'Out of stock' : `${qty(p.stock)} ${p.unit}`}</span></td>
                        <td className="actions-col">
                          <div className="row-actions">
                            <button className="icon-btn" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => edit(p)}><Pencil size={16} /></button>
                            <button className="icon-btn icon-btn-danger" aria-label={`Delete ${p.name}`} title="Delete" onClick={() => setToDelete(p)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
      {toDelete && (
        <ConfirmDialog title="Delete product?" confirmLabel="Delete product" danger busy={deleting} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
          <p><b>{toDelete.name}</b> will be removed from your inventory. Products that already appear on invoices cannot be deleted.</p>
        </ConfirmDialog>
      )}
    </>
  )
}
