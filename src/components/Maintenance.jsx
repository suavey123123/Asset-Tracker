import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner } from './UI'

export default function Maintenance() {
  const { isAdmin, profile } = useAuth()
  const [saveError, setSaveError] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [records, setRecords] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ asset_id: '', maintenance_type: 'Inspection', performed_date: '', performed_by: '', cost: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from('maintenance_records').select('*').order('performed_date', { ascending: false }),
      supabase.from('assets').select('id, asset_tag, name').order('name'),
    ])
    setRecords(r || [])
    setAssets(a || [])
    setLoading(false)
  }

  async function save() {
    if (!form.asset_id || !form.performed_date) { setError('Asset and date are required.'); return }
    setSaving(true); setError('')
    const asset = assets.find(a => a.id === form.asset_id)
    const payload = { ...form, cost: form.cost ? parseFloat(form.cost) : null }
    const { error: e } = await supabase.from('maintenance_records').insert(payload)
    if (!e) {
      await supabase.from('activity_log').insert({ asset_id: form.asset_id, asset_tag: asset?.asset_tag, asset_name: asset?.name, type: 'maintenance', message: `Maintenance: ${form.maintenance_type}${form.performed_by ? ' by ' + form.performed_by : ''}`, performed_by: profile?.email })
    }
    setSaving(false)
    if (e) { setError(e.message); return }
    setModalOpen(false)
    fetchAll()
  }

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: 14, fontWeight: 500 }}>Maintenance records</h2>
        {canWriteAssets && <Btn variant="primary" onClick={() => { setForm({ asset_id: '', maintenance_type: 'Inspection', performed_date: new Date().toISOString().slice(0, 10), performed_by: '', cost: '', notes: '' }); setError(''); setModalOpen(true) }}>+ Log maintenance</Btn>}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         records.length === 0 ? <EmptyState message="No maintenance records yet." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Asset', 'Type', 'Date', 'Performed By', 'Cost', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const asset = assets.find(a => a.id === r.asset_id)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{asset?.name || r.asset_id}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{asset?.asset_tag}</div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{r.maintenance_type}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{r.performed_date ? new Date(r.performed_date).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: r.performed_by ? 'var(--text)' : 'var(--text3)' }}>{r.performed_by || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{r.cost != null ? '$' + parseFloat(r.cost).toFixed(2) : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)', maxWidth: 200 }}>{r.notes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log maintenance">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Asset" required>
            <select value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}>
              <option value="">Select asset…</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Type"><select value={form.maintenance_type} onChange={e => setForm(f => ({ ...f, maintenance_type: e.target.value }))}><option>Inspection</option><option>Repair</option><option>Calibration</option><option>Cleaning</option><option>Replacement</option><option>Upgrade</option><option>Other</option></select></FormField>
            <FormField label="Date" required><input type="date" value={form.performed_date} onChange={e => setForm(f => ({ ...f, performed_date: e.target.value }))} /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Performed by"><input value={form.performed_by} onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))} placeholder="Tech / vendor" /></FormField>
            <FormField label="Cost ($)"><input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></FormField>
          </div>
          <FormField label="Notes"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What was done?" /></FormField>
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save record'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
