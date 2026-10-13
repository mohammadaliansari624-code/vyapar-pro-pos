import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { api, errorText } from '../api'
import { Field, PageHeader, Panel, useToast } from '../ui'
import { RECEIPT_WIDTHS, type ShopSettings } from '../types'

const FONT_SIZES = [8, 10, 11, 12, 14, 16, 18, 20, 22, 24]
type Errors = Partial<Record<'name' | 'phone', string>>

export function SettingsPage({ settings, onSaved }: { settings: ShopSettings; onSaved: (s: ShopSettings) => void }) {
  const toast = useToast()
  const [draft, setDraft] = useState<ShopSettings>(settings)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(settings), [settings])
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const set = (patch: Partial<ShopSettings>) => setDraft((d) => ({ ...d, ...patch }))

  async function save(ev: FormEvent) {
    ev.preventDefault()
    if (saving) return
    const e: Errors = {}
    if (!draft.name.trim()) e.name = 'Enter your shop name.'
    if (!/^[0-9+()\-\s]*$/.test(draft.phone)) e.phone = 'Use digits, spaces, + ( ) or - only.'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      await api('/api/settings', { method: 'PUT', json: draft })
      onSaved({ ...draft, name: draft.name.trim(), address: draft.address.trim(), phone: draft.phone.trim() })
      toast.success('Shop settings saved.')
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="These details appear on printed receipts." />
      <Panel title="Shop and receipt" className="settings-panel">
        <form className="form-stack" onSubmit={save} noValidate>
          <Field label="Shop name" error={errors.name}><input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={180} /></Field>
          <Field label="Address"><textarea className="input" rows={3} value={draft.address} onChange={(e) => set({ address: e.target.value })} maxLength={500} /></Field>
          <Field label="Phone" error={errors.phone}><input className="input" type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={40} /></Field>
          <div className="form-row">
            <Field label="Receipt width"><select className="input" value={draft.receipt_width} onChange={(e) => set({ receipt_width: e.target.value })}>{RECEIPT_WIDTHS.map((w) => <option key={w}>{w}</option>)}</select></Field>
            <Field label="Receipt font size"><select className="input" value={draft.receipt_font_size} onChange={(e) => set({ receipt_font_size: Number(e.target.value) })}>{FONT_SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}</select></Field>
          </div>
          <div className="button-row">
            <button className="btn btn-primary" disabled={!dirty || saving}>{saving && <LoaderCircle size={16} className="spin" />}Save settings</button>
            {dirty && <button type="button" className="btn btn-secondary" onClick={() => { setDraft(settings); setErrors({}) }} disabled={saving}>Discard changes</button>}
          </div>
        </form>
      </Panel>
    </>
  )
}
