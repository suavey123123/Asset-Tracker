import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner } from './UI'

const EMPTY_FORM = { name: '', category: 'Batteries', quantity: '', min_quantity: '', unit: 'pcs', location: '', notes: '' }
const CATEGORIES = ['Batteries', 'Cables', 'Printer Paper', 'Toner / Ink', 'Cleaning Supplies', 'Accessories', 'Storage Media', 'Other']

export default function Consumables() {
  const { isAdmin, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [adjustModal, setAdjustModal] = useState(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustType, setAdjustType] = useState('use')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('consumables').select('*').order('name')
    setItems(data || [])
    setLoading(false)
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.quantity || isNaN(form.quantity) || parseInt(form.quantity) < 0) e.quantity = 'Valid quantity required'
    return e
  }

  async function save() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true); setErrors({})
    const payload = { ...form, quantity: parseInt(form.quantity), min_quantity: form.min_quantity ? parseInt(form.min_quantity) : 0 }
    let err
    if (editItem) {
      // Log change if quantity changed
      if (parseInt(form.quantity) !== editItem.quantity) {
        await supabase.from('consumable_log').insert({ consumable_id: editItem.id, name: editItem.name, change: parseInt(form.quantity) - editItem.quantity, new_quantity: parseInt(form.quantity), type: 'adjustment', note: 'Manual edit', performed_by: profile?.email })
      }
      const { error: e2 } = await supabase.from('consumables').update(payload).eq('id', editItem.id)
      err = e2
    } else {
      const { error: e2 } = await supabase.from('consumables').insert(payload)
      err = e2
    }
    setSaving(false)
    if (err) { setErrors({ _: err.message }); return }
    setModalOpen(false); fetchItems()
  }

  async function doAdjust() {
    const qty = parseInt(adjustQty)
    if (!qty || isNaN(qty)) return
    const item = adjustModal
    const change = adjustType === 'use' ? -Math.abs(qty) : Math.abs(qty)
    const newQty = Math.max(0, item.quantity + change)
    await supabase.from('consumables').update({ quantity: newQty }).eq('id', item.id)
    await supabase.from('consumable_log').insert({ consumable_id: item.id, name: item.name, change, new_quantity: newQty, type: adjustType, note: adjustNote || null, performed_by: profile?.email })
    setAdjustModal(null); setAdjustQty(''); setAdjustNote(''); setAdjustType('use')
    fetchItems()
  }

  async function deleteItem(item) {
    if (!confirm(`Delete "${item.name}"?`)) return
    await supabase.from('consumables').delete().eq('id', item.id)
    fetchItems()
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({ name: item.name, category: item.category, quantity: String(item.quantity), min_quantity: String(item.min_quantity || ''), unit: item.unit || 'pcs', location: item.location || '', notes: item.notes || '' })
    setErrors({}); setModalOpen(true)
  }

  const filtered = items.filter(i => {
    if (filterCat && i.category !== filterCat) return false
    if (search && !`${i.name} ${i.category} ${i.location}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const lowStock = items.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity)
  const outOfStock = items.filter(i => i.quantity === 0)

  function stockColor(item) {
    if (item.quantity === 0) return 'var(--red)'
    if (item.min_quantity > 0 && item.quantity <= item.min_quantity) return 'var(--amber)'
    return 'var(--green)'
  }

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {/* Alert banners */}
      {outOfStock.length > 0 && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>
          ⚠ {outOfStock.length} item{outOfStock.length !== 1 ? 's' : ''} out of stock: {outOfStock.map(i => i.name).join(', ')}
        </div>
      )}
      {lowStock.length > 0 && (
        <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, color: 'var(--amber)', marginBottom: 8 }}>
          ⏱ {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} running low: {lowStock.map(i => i.name).join(', ')}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[['Total items', items.length, 'var(--text)'], ['In stock', items.filter(i => i.quantity > 0).length, 'var(--green)'], ['Low stock', lowStock.length, 'var(--amber)'], ['Out of stock', outOfStock.length, 'var(--red)']].map(([l, v, c]) => (
          <div key={l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: c, fontFamily: 'var(--mono)' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search consumables…" style={{ width: 200 }} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 160 }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {isAdmin && <Btn variant="primary" onClick={() => { setEditItem(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true) }}>+ Add item</Btn>}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         filtered.length === 0 ? <EmptyState message="No consumables tracked yet." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Item', 'Category', 'Quantity', 'Min. stock', 'Location', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${stockColor(item)}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                    {item.notes && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{item.notes}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{item.category}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--mono)', color: stockColor(item) }}>{item.quantity}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{item.unit}</span>
                    </div>
                    {item.min_quantity > 0 && (
                      <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden', width: 60, marginTop: 4 }}>
                        <div style={{ width: `${Math.min(100, Math.round(item.quantity / item.min_quantity * 50))}%`, height: '100%', background: stockColor(item), borderRadius: 2 }} />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{item.min_quantity > 0 ? item.min_quantity : '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{item.location || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 500, color: stockColor(item) }}>
                      {item.quantity === 0 ? 'OUT' : item.min_quantity > 0 && item.quantity <= item.min_quantity ? 'LOW' : 'OK'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {isAdmin && <Btn size="sm" variant="primary" onClick={() => { setAdjustModal(item); setAdjustQty(''); setAdjustNote(''); setAdjustType('use') }}>± Adjust</Btn>}
                      {isAdmin && <Btn size="sm" onClick={() => openEdit(item)}>Edit</Btn>}
                      {isAdmin && <Btn size="sm" variant="danger" onClick={() => deleteItem(item)}>Del</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit consumable' : 'Add consumable'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Item name" required>
            <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })) }} style={{ borderColor: errors.name ? 'var(--red)' : '' }} placeholder="e.g. AA Batteries" />
            {errors.name && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{errors.name}</div>}
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Category"><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></FormField>
            <FormField label="Unit"><input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs, boxes, rolls…" /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Current quantity" required>
              <input type="number" min="0" value={form.quantity} onChange={e => { setForm(f => ({ ...f, quantity: e.target.value })); setErrors(er => ({ ...er, quantity: '' })) }} style={{ borderColor: errors.quantity ? 'var(--red)' : '' }} />
              {errors.quantity && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{errors.quantity}</div>}
            </FormField>
            <FormField label="Min. stock (alert below this)"><input type="number" min="0" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))} placeholder="0 = no alert" /></FormField>
          </div>
          <FormField label="Storage location"><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Storage Room B" /></FormField>
          <FormField label="Notes"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes…" /></FormField>
          {errors._ && <div style={{ color: 'var(--red)', fontSize: 12 }}>{errors._}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </div>
      </Modal>

      {/* Adjust modal */}
      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title={`Adjust — ${adjustModal?.name}`} width={380}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Current stock: <strong style={{ color: stockColor(adjustModal || {}), fontFamily: 'var(--mono)' }}>{adjustModal?.quantity} {adjustModal?.unit}</strong></div>
          <FormField label="Action">
            <select value={adjustType} onChange={e => setAdjustType(e.target.value)}>
              <option value="use">Use / consume</option>
              <option value="restock">Restock / add</option>
              <option value="adjustment">Manual adjustment</option>
            </select>
          </FormField>
          <FormField label="Quantity">
            <input type="number" min="1" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="How many?" autoFocus />
          </FormField>
          <FormField label="Note (optional)"><input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="e.g. Used for onboarding" /></FormField>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setAdjustModal(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={doAdjust} disabled={!adjustQty}>Apply</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
