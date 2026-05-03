import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner } from './UI'

const EMPTY_FORM = {
  asset_tag: '', name: '', category: 'IT Equipment', status: 'Available',
  model: '', serial_number: '', location: '', purchase_date: '',
  purchase_cost: '', warranty_expiry: '', notes: '',
}

export default function Inventory({ onViewAsset, editAssetProp, onEditDone }) {
  const { isAdmin, profile } = useAuth()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editAsset, setEditAsset] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchAssets() }, [])

  useEffect(() => {
    if (editAssetProp) {
      openEditModal(editAssetProp)
      onEditDone?.()
    }
  }, [editAssetProp])

  async function fetchAssets() {
    setLoading(true)
    const { data } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
    setAssets(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditAsset(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  function openEditModal(asset) {
    setEditAsset(asset)
    setForm({
      asset_tag: asset.asset_tag || '',
      name: asset.name || '',
      category: asset.category || 'IT Equipment',
      status: asset.status || 'Available',
      model: asset.model || '',
      serial_number: asset.serial_number || '',
      location: asset.location || '',
      purchase_date: asset.purchase_date || '',
      purchase_cost: asset.purchase_cost || '',
      warranty_expiry: asset.warranty_expiry || '',
      notes: asset.notes || '',
    })
    setError('')
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim() || !form.asset_tag.trim()) { setError('Name and Asset Tag are required.'); return }
    setSaving(true); setError('')
    const payload = { ...form, purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null }
    let err
    if (editAsset) {
      const { error: e } = await supabase.from('assets').update(payload).eq('id', editAsset.id)
      err = e
      if (!e) await logActivity(editAsset.id, editAsset.asset_tag, editAsset.name, 'updated', `Asset updated by ${profile?.email}`)
    } else {
      const { data, error: e } = await supabase.from('assets').insert(payload).select().single()
      err = e
      if (!e && data) await logActivity(data.id, data.asset_tag, data.name, 'created', `Asset added by ${profile?.email}`)
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false)
    fetchAssets()
  }

  async function deleteAsset(asset) {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return
    await supabase.from('assets').delete().eq('id', asset.id)
    fetchAssets()
  }

  async function logActivity(assetId, assetTag, assetName, type, message) {
    await supabase.from('activity_log').insert({ asset_id: assetId, asset_tag: assetTag, asset_name: assetName, type, message, performed_by: profile?.email })
  }

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate() + 30)

  const filtered = assets.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false
    if (filterCat && a.category !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${a.name} ${a.asset_tag} ${a.model} ${a.location} ${a.serial_number} ${a.assigned_to}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = {
    total: assets.length,
    available: assets.filter(a => a.status === 'Available').length,
    out: assets.filter(a => a.status === 'Checked Out').length,
    maintenance: assets.filter(a => a.status === 'Maintenance').length,
  }

  function rowWarning(a) {
    if (a.status === 'Checked Out' && a.expected_return && new Date(a.expected_return) < today) return 'var(--red)'
    if (a.warranty_expiry && new Date(a.warranty_expiry) <= in30 && new Date(a.warranty_expiry) >= today) return 'var(--amber)'
    return null
  }

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[['Total', stats.total, 'var(--text)'], ['Available', stats.available, 'var(--green)'], ['Checked Out', stats.out, 'var(--blue)'], ['Maintenance', stats.maintenance, 'var(--amber)']].map(([l, v, c]) => (
          <div key={l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: c, fontFamily: 'var(--mono)' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" style={{ width: 200 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 150 }}>
          <option value="">All statuses</option>
          <option>Available</option><option>Checked Out</option><option>Maintenance</option><option>Retired</option>
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 160 }}>
          <option value="">All categories</option>
          <option>IT Equipment</option><option>Tools & Equipment</option>
        </select>
        <div style={{ flex: 1 }} />
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add asset</Btn>}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message={assets.length === 0 ? 'No assets yet. Add your first asset to get started.' : 'No assets match your filters.'} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Tag', 'Name', 'Category', 'Status', 'Assigned To', 'Location', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const warn = rowWarning(a)
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', borderLeft: warn ? `3px solid ${warn}` : '3px solid transparent' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{a.asset_tag}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => onViewAsset?.(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font)' }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{a.name}</div>
                        {a.model && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{a.model}</div>}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}><Badge status={a.category} /></td>
                    <td style={{ padding: '10px 14px' }}><Badge status={a.status} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: a.assigned_to ? 'var(--text)' : 'var(--text3)' }}>{a.assigned_to || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: a.location ? 'var(--text)' : 'var(--text3)' }}>{a.location || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn size="sm" onClick={() => onViewAsset?.(a)}>View</Btn>
                        {isAdmin && <Btn size="sm" onClick={() => openEditModal(a)}>Edit</Btn>}
                        {isAdmin && <Btn size="sm" variant="danger" onClick={() => deleteAsset(a)}>Delete</Btn>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editAsset ? 'Edit asset' : 'Add new asset'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Asset name" required><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></FormField>
            <FormField label="Asset tag / ID" required><input value={form.asset_tag} onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))} placeholder="e.g. IT-0042" /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Category"><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option>IT Equipment</option><option>Tools & Equipment</option></select></FormField>
            <FormField label="Status"><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option>Available</option><option>Checked Out</option><option>Maintenance</option><option>Retired</option></select></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Brand / Model"><input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></FormField>
            <FormField label="Serial number"><input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Location"><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></FormField>
            <FormField label="Purchase cost ($)"><input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))} /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Purchase date"><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></FormField>
            <FormField label="Warranty expiry"><input type="date" value={form.warranty_expiry} onChange={e => setForm(f => ({ ...f, warranty_expiry: e.target.value }))} /></FormField>
          </div>
          <FormField label="Notes"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save asset'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
