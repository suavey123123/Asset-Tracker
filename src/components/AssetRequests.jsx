import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, Badge } from './UI'

const STATUS_STYLES = {
  pending:  { color: 'var(--amber)', bg: 'var(--amber-bg)', label: 'Pending' },
  approved: { color: 'var(--green)', bg: 'var(--green-bg)', label: 'Approved' },
  denied:   { color: 'var(--red)',   bg: 'var(--red-bg)',   label: 'Denied' },
}

export default function AssetRequests() {
  const { isAdmin, profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [reviewModal, setReviewModal] = useState(null)
  const [form, setForm] = useState({ requester_name: '', category: '', notes: '', urgency: 'Normal' })
  const [employees, setEmployees] = useState([])
  const [empSuggestions, setEmpSuggestions] = useState([])
  const [reviewNote, setReviewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [assignAssetId, setAssignAssetId] = useState('')
  const [activeTab, setActiveTab] = useState('pending')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from('asset_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('assets').select('id, asset_tag, model, category, status').eq('status', 'Available').order('asset_tag'),
    ])
    setRequests(r || [])
    setAssets(a || [])
    setLoading(false)
  }

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('id, name').order('name')
    setEmployees(data || [])
  }

  async function deleteRequest(id) {
    if (!confirm('Delete this request?')) return
    await supabase.from('asset_requests').delete().eq('id', id)
    fetchRequests()
  }

  async function submitRequest() {
    if (!form.requester_name.trim()) return
    setSaving(true)
    await supabase.from('asset_requests').insert({
      requester_name: form.requester_name.trim(),
      category: form.category,
      notes: form.notes,
      urgency: form.urgency,
      status: 'pending',
      submitted_by: profile?.email,
    })
    setSaving(false)
    setModalOpen(false)
    setForm({ requester_name: '', category: '', notes: '', urgency: 'Normal' })
    fetchAll()
  }

  async function reviewRequest(status) {
    if (!reviewModal) return
    setSaving(true)
    const updates = { status, reviewed_by: profile?.email, review_note: reviewNote, reviewed_at: new Date().toISOString() }

    if (status === 'approved' && assignAssetId) {
      const asset = assets.find(a => a.id === assignAssetId)
      if (asset) {
        await supabase.from('assets').update({ status: 'Checked Out', assigned_to: reviewModal.requester_name }).eq('id', assignAssetId)
        await supabase.from('activity_log').insert({ asset_id: assignAssetId, asset_tag: asset.asset_tag, asset_name: asset.model || asset.asset_tag, type: 'checkout', message: `Assigned via asset request to ${reviewModal.requester_name}`, performed_by: profile?.email })
        updates.assigned_asset_id = assignAssetId
        updates.assigned_asset_tag = asset.asset_tag
      }
    }

    await supabase.from('asset_requests').update(updates).eq('id', reviewModal.id)
    setSaving(false)
    setReviewModal(null)
    setReviewNote('')
    setAssignAssetId('')
    fetchAll()
  }

  const filtered = requests.filter(r => r.status === activeTab)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: 'fit-content' }}>
            {['pending', 'approved', 'denied'].map(tab => {
              const count = requests.filter(r => r.status === tab).length
              const s = STATUS_STYLES[tab]
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '6px 14px', fontSize: 13, borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'var(--font)',
                  background: activeTab === tab ? 'var(--bg4)' : 'transparent',
                  color: activeTab === tab ? s.color : 'var(--text2)',
                  border: activeTab === tab ? `1px solid var(--border2)` : '1px solid transparent',
                }}>
                  {s.label} {count > 0 && <span style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>({count})</span>}
                </button>
              )
            })}
          </div>
        </div>
        <Btn variant="primary" onClick={() => setModalOpen(true)}>+ New request</Btn>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         filtered.length === 0 ? <EmptyState message={`No ${activeTab} requests.`} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Requested by', 'Category', 'Urgency', 'Notes', 'Submitted', ...(activeTab !== 'pending' ? ['Reviewed by', 'Assigned asset'] : []), 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${STATUS_STYLES[r.status]?.color}` }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 13 }}>{r.requester_name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{r.category || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, fontFamily: 'var(--mono)', background: r.urgency === 'Urgent' ? 'var(--red-bg)' : r.urgency === 'High' ? 'var(--amber-bg)' : 'var(--bg3)', color: r.urgency === 'Urgent' ? 'var(--red)' : r.urgency === 'High' ? 'var(--amber)' : 'var(--text2)' }}>{r.urgency}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)', maxWidth: 200 }}>{r.notes || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  {activeTab !== 'pending' && <>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{r.reviewed_by || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)', color: r.assigned_asset_tag ? 'var(--green)' : 'var(--text3)' }}>{r.assigned_asset_tag || '—'}</td>
                  </>}
                  <td style={{ padding: '10px 14px' }}>
                    {isAdmin && r.status === 'pending' ? (
                      <Btn size="sm" onClick={() => { setReviewModal(r); setReviewNote(''); setAssignAssetId('') }}>Review</Btn>
                    ) : r.review_note ? (
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{r.review_note}</span>
                    ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New request modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Submit asset request" width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Requested for (employee name)" required>
            <div style={{ position:'relative' }}>
              <input value={form.requester_name}
                onChange={e => {
                  const v = e.target.value
                  setForm(f => ({ ...f, requester_name: v }))
                  setEmpSuggestions(v.trim() ? employees.filter(emp => emp.name.toLowerCase().includes(v.toLowerCase())).slice(0,6) : [])
                }}
                onBlur={() => setTimeout(() => setEmpSuggestions([]), 150)}
                placeholder="Type employee name…" autoComplete="off" />
              {empSuggestions.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', zIndex:100, boxShadow:'0 4px 16px rgba(0,0,0,0.3)', maxHeight:200, overflowY:'auto' }}>
                  {empSuggestions.map(emp => (
                    <div key={emp.id} onMouseDown={()=>{ setForm(f=>({...f,requester_name:emp.name})); setEmpSuggestions([]) }}
                      style={{ padding:'8px 12px', fontSize:13, cursor:'pointer', borderBottom:'1px solid var(--border)' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      {emp.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Asset category needed">
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. LAPTOP, PHONE" />
            </FormField>
            <FormField label="Urgency">
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
                <option>Normal</option><option>High</option><option>Urgent</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes / reason">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Why is this needed?" />
          </FormField>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={submitRequest} disabled={saving || !form.requester_name.trim()}>{saving ? 'Submitting…' : 'Submit request'}</Btn>
          </div>
        </div>
      </Modal>

      {/* Review modal */}
      <Modal open={!!reviewModal} onClose={() => setReviewModal(null)} title={`Review request — ${reviewModal?.requester_name}`} width={480}>
        {reviewModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '12px', fontSize: 13 }}>
              <div><strong>Requested by:</strong> {reviewModal.requester_name}</div>
              <div><strong>Category:</strong> {reviewModal.category || '—'}</div>
              <div><strong>Urgency:</strong> {reviewModal.urgency}</div>
              {reviewModal.notes && <div><strong>Notes:</strong> {reviewModal.notes}</div>}
            </div>
            <FormField label="Assign available asset (optional)">
              <select value={assignAssetId} onChange={e => setAssignAssetId(e.target.value)}>
                <option value="">— Don't assign yet —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.model || a.category}</option>)}
              </select>
            </FormField>
            <FormField label="Review note">
              <input value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Reason for approval or denial…" />
            </FormField>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <Btn onClick={() => setReviewModal(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => reviewRequest('denied')} disabled={saving}>Deny</Btn>
              <Btn variant="primary" onClick={() => reviewRequest('approved')} disabled={saving}>{saving ? '…' : 'Approve'}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
