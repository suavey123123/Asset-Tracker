import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, Badge } from './UI'

const FREQUENCIES = ['One-time', 'Monthly', 'Quarterly', 'Every 6 months', 'Yearly']

export default function ScheduledMaintenance({ onViewAsset }) {
  const { isAdmin, profile } = useAuth()
  const [saveError, setSaveError] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [schedules, setSchedules] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ asset_id: '', maintenance_type: 'Inspection', frequency: 'Yearly', next_date: '', notes: '', assigned_to: '' })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('upcoming')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from('maintenance_schedules').select('*, asset:asset_id(id, asset_tag, model, category, status)').order('next_date'),
      supabase.from('assets').select('id, asset_tag, model, category').order('asset_tag'),
    ])
    setSchedules(s || [])
    setAssets(a || [])
    setLoading(false)
  }

  async function save() {
    if (!form.asset_id || !form.next_date) return
    setSaving(true)
    await supabase.from('maintenance_schedules').insert({ ...form, created_by: profile?.email })
    setSaving(false); setModalOpen(false)
    setForm({ asset_id: '', maintenance_type: 'Inspection', frequency: 'Yearly', next_date: '', notes: '', assigned_to: '' })
    fetchAll()
  }

  async function markDone(schedule) {
    // Log actual maintenance record
    await supabase.from('maintenance_records').insert({
      asset_id: schedule.asset_id, maintenance_type: schedule.maintenance_type,
      performed_date: new Date().toISOString().slice(0, 10),
      performed_by: profile?.email, notes: `Scheduled: ${schedule.frequency}`,
    })
    await supabase.from('activity_log').insert({
      asset_id: schedule.asset_id, asset_tag: schedule.asset?.asset_tag, asset_name: schedule.asset?.model || schedule.asset?.asset_tag,
      type: 'maintenance', message: `Scheduled maintenance completed: ${schedule.maintenance_type}`, performed_by: profile?.email,
    })

    // Calculate next date based on frequency
    if (schedule.frequency !== 'One-time') {
      const next = new Date(schedule.next_date)
      if (schedule.frequency === 'Monthly') next.setMonth(next.getMonth() + 1)
      else if (schedule.frequency === 'Quarterly') next.setMonth(next.getMonth() + 3)
      else if (schedule.frequency === 'Every 6 months') next.setMonth(next.getMonth() + 6)
      else if (schedule.frequency === 'Yearly') next.setFullYear(next.getFullYear() + 1)
      await supabase.from('maintenance_schedules').update({ next_date: next.toISOString().slice(0, 10), last_done: new Date().toISOString().slice(0, 10) }).eq('id', schedule.id)
    } else {
      await supabase.from('maintenance_schedules').delete().eq('id', schedule.id)
    }
    fetchAll()
  }

  async function deleteSchedule(id) {
    if (!confirm('Delete this maintenance schedule?')) return
    await supabase.from('maintenance_schedules').delete().eq('id', id)
    fetchAll()
  }

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate() + 30)

  function getStatus(s) {
    const d = new Date(s.next_date)
    if (d < today) return { label: 'OVERDUE', color: 'var(--red)' }
    if (d <= in30) return { label: 'DUE SOON', color: 'var(--amber)' }
    return { label: 'UPCOMING', color: 'var(--green)' }
  }

  const filtered = schedules.filter(s => {
    const d = new Date(s.next_date)
    if (filter === 'overdue') return d < today
    if (filter === 'upcoming') return d >= today && d <= in30
    if (filter === 'future') return d > in30
    return true
  })

  const counts = {
    overdue: schedules.filter(s => new Date(s.next_date) < today).length,
    upcoming: schedules.filter(s => { const d = new Date(s.next_date); return d >= today && d <= in30 }).length,
    future: schedules.filter(s => new Date(s.next_date) > in30).length,
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: 'fit-content' }}>
          {[['all', 'All', 'var(--text2)'], ['overdue', `Overdue (${counts.overdue})`, 'var(--red)'], ['upcoming', `Due soon (${counts.upcoming})`, 'var(--amber)'], ['future', `Scheduled (${counts.future})`, 'var(--green)']].map(([id, label, color]) => (
            <button key={id} onClick={() => setFilter(id)} style={{
              padding: '6px 14px', fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'var(--font)',
              background: filter === id ? 'var(--bg4)' : 'transparent',
              color: filter === id ? color : 'var(--text2)',
              border: filter === id ? '1px solid var(--border2)' : '1px solid transparent',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {isAdmin && <Btn variant="primary" onClick={() => setModalOpen(true)}>+ Schedule maintenance</Btn>}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         filtered.length === 0 ? <EmptyState message="No maintenance schedules in this category." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Asset', 'Type', 'Frequency', 'Next due', 'Status', 'Assigned to', 'Notes', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(s => {
                const st = getStatus(s)
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${st.color}` }}>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => s.asset && onViewAsset?.(s.asset)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font)' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{s.asset?.asset_tag}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{s.asset?.model || s.asset?.category}</div>
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{s.maintenance_type}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{s.frequency}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: st.color, fontWeight: 500 }}>{new Date(s.next_date).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 500, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{s.assigned_to || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)', maxWidth: 160 }}>{s.notes || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Btn size="sm" variant="success" onClick={() => markDone(s)}>✓ Done</Btn>
                          <Btn size="sm" variant="danger" onClick={() => deleteSchedule(s.id)}>Del</Btn>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule maintenance" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Asset" required>
            <select value={form.asset_id} onChange={e => setForm(f => ({ ...f, asset_id: e.target.value }))}>
              <option value="">Select asset…</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.model || a.category}</option>)}
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Maintenance type">
              <select value={form.maintenance_type} onChange={e => setForm(f => ({ ...f, maintenance_type: e.target.value }))}>
                <option>Inspection</option><option>Repair</option><option>Calibration</option><option>Cleaning</option><option>Replacement</option><option>Upgrade</option><option>Other</option>
              </select>
            </FormField>
            <FormField label="Frequency">
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCIES.map(fr => <option key={fr}>{fr}</option>)}
              </select>
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Next due date" required>
              <input type="date" value={form.next_date} onChange={e => setForm(f => ({ ...f, next_date: e.target.value }))} />
            </FormField>
            <FormField label="Assign to">
              <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Tech / vendor" />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What needs to be done?" />
          </FormField>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving || !form.asset_id || !form.next_date}>{saving ? 'Saving…' : 'Save schedule'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
