import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Badge, Spinner, Modal, FormField } from './UI'
import { useToast } from './Toast'

const STATUS = {
  pending:  { color: 'var(--amber)', bg: 'var(--amber-bg,rgba(251,191,36,0.1))', label: 'Pending' },
  approved: { color: 'var(--green)',  bg: 'var(--green-bg)',  label: 'Approved' },
  denied:   { color: 'var(--red)',    bg: 'var(--red-bg)',    label: 'Denied' },
}

function EmployeeAutocomplete({ value, onChange, employees }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const ref = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    function handler(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? employees.filter(e => e.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : employees.slice(0, 8)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Type to search employees…"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{ position:'fixed', zIndex:9999, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', boxShadow:'0 8px 24px rgba(0,0,0,0.5)', maxHeight:220, overflowY:'auto', minWidth:300 }}
          ref={el => {
            if (el && ref.current) {
              const r = ref.current.getBoundingClientRect()
              el.style.top = (r.bottom + 4) + 'px'
              el.style.left = r.left + 'px'
              el.style.width = r.width + 'px'
            }
          }}>
          {filtered.map(emp => (
            <div key={emp.id}
              onMouseDown={e => { e.preventDefault(); setQuery(emp.name); onChange(emp.name); setOpen(false) }}
              style={{ padding:'9px 12px', fontSize:13, cursor:'pointer', borderBottom:'1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background=''}>
              {emp.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AssetRequests() {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [tab, setTab] = useState('pending')
  const [form, setForm] = useState({ requester_name: '', category: '', notes: '', urgency: 'Normal' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [reviewModal, setReviewModal] = useState(null)
  const [assignAssetId, setAssignAssetId] = useState('')
  const [availableAssets, setAvailableAssets] = useState([])

  useEffect(() => { fetchRequests(); fetchEmployees() }, [])

  async function fetchRequests() {
    setLoading(true)
    const { data } = await supabase.from('asset_requests').select('*').order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('id, name').order('name')
    setEmployees(data || [])
  }

  async function submitRequest() {
    if (!form.requester_name.trim()) return
    setSaving(true)
    await supabase.from('asset_requests').insert({
      requester_name: form.requester_name.trim(),
      category: form.category || null,
      notes: form.notes || null,
      urgency: form.urgency,
      status: 'pending',
      requested_by: profile?.id,
    })
    setSaving(false)
    setShowForm(false)
    setForm({ requester_name: '', category: '', notes: '', urgency: 'Normal' })
    fetchRequests()
  }

  async function openReview(r) {
    setReviewModal(r)
    const { data } = await supabase.from('assets').select('id, asset_tag, model, category').eq('status', 'Available')
    setAvailableAssets(data || [])
    setAssignAssetId('')
  }

  async function reviewRequest(status) {
    setSaving(true)
    const updates = { status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }
    if (status === 'approved' && assignAssetId) {
      const asset = availableAssets.find(a => a.id === assignAssetId)
      updates.assigned_asset_tag = asset?.asset_tag
      await supabase.from('assets').update({ status: 'Checked Out', assigned_to: reviewModal.requester_name }).eq('id', assignAssetId)
      await supabase.from('activity_log').insert({ asset_id: assignAssetId, asset_tag: asset.asset_tag, asset_name: asset.model || asset.asset_tag, type: 'checkout', message: `Assigned via asset request to ${reviewModal.requester_name}`, performed_by: profile?.email })
    }
    await supabase.from('asset_requests').update(updates).eq('id', reviewModal.id)
    setSaving(false)
    setReviewModal(null)
    fetchRequests()
  }

  async function deleteRequest(id) {
    if (!confirm('Delete this request?')) return
    const { error } = await supabase.from('asset_requests').delete().eq('id', id)
    if (error) { toast('Delete failed: ' + error.message, 'error'); return }
    fetchRequests()
  }

  const filtered = requests.filter(r => r.status === tab)
  const thStyle = { padding:'10px 14px', textAlign:'left', fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }
  const tdStyle = { padding:'10px 14px', fontSize:13, borderBottom:'1px solid var(--border)' }

  return (
    <div className="fade-in">
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        <Btn variant="primary" onClick={() => setShowForm(true)}>+ New request</Btn>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'var(--bg2)', padding:4, borderRadius:'var(--radius)', border:'1px solid var(--border)', marginBottom:'1rem', width:'fit-content' }}>
        {['pending','approved','denied'].map(t => {
          const count = requests.filter(r => r.status === t).length
          return (
            <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 14px', fontSize:13, borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'var(--font)', background:tab===t?'var(--bg4)':'transparent', color:tab===t?'var(--text)':'var(--text2)', border:tab===t?'1px solid var(--border2)':'1px solid transparent' }}>
              {STATUS[t].label} {count > 0 && <span style={{ marginLeft:4, fontSize:11, fontFamily:'var(--mono)', color:STATUS[t].color }}>({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        {loading ? <div style={{ padding:'2rem' }}><Spinner /></div> : filtered.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'var(--text3)', fontSize:13 }}>No {tab} requests.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Requested for','Category','Urgency','Date','Status','Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight:500 }}>{r.requester_name}</td>
                  <td style={{ ...tdStyle, color:'var(--text2)' }}>{r.category || '—'}</td>
                  <td style={tdStyle}><span style={{ fontSize:11, fontFamily:'var(--mono)', color:r.urgency==='High'?'var(--red)':r.urgency==='Low'?'var(--text3)':'var(--text2)' }}>{r.urgency}</span></td>
                  <td style={{ ...tdStyle, color:'var(--text2)', fontSize:12 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}><span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:600, color:STATUS[r.status]?.color, background:STATUS[r.status]?.bg, padding:'2px 8px', borderRadius:100 }}>{STATUS[r.status]?.label}</span></td>
                  <td style={tdStyle}>
                    <div style={{ display:'flex', gap:4 }}>
                      {isAdmin && r.status === 'pending' && <Btn size="sm" variant="primary" onClick={() => openReview(r)}>Review</Btn>}
                      {r.assigned_asset_tag && <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--accent)' }}>{r.assigned_asset_tag}</span>}
                      {r.status === 'denied' && isAdmin && <Btn size="sm" variant="danger" onClick={() => deleteRequest(r.id)}>Delete</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Submit request modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Submit asset request" width={440}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <FormField label="Requested for (employee name)" required>
            <EmployeeAutocomplete value={form.requester_name} onChange={v => setForm(f => ({ ...f, requester_name: v }))} employees={employees} />
          </FormField>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Asset category needed">
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. LAPTOP, PHONE" />
            </FormField>
            <FormField label="Urgency">
              <select value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}>
                {['Low','Normal','High'].map(u => <option key={u}>{u}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Notes / Reason">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Why is this needed?" style={{ minHeight:80 }} />
          </FormField>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Btn onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={submitRequest} disabled={saving || !form.requester_name.trim()}>{saving ? 'Submitting…' : 'Submit request'}</Btn>
          </div>
        </div>
      </Modal>

      {/* Review modal */}
      <Modal open={!!reviewModal} onClose={() => setReviewModal(null)} title={`Review request — ${reviewModal?.requester_name}`} width={480}>
        {reviewModal && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13 }}>
              <div><div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>Requested for</div><strong>{reviewModal.requester_name}</strong></div>
              <div><div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>Category</div>{reviewModal.category || '—'}</div>
              <div><div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>Urgency</div>{reviewModal.urgency}</div>
              <div><div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>Date</div>{new Date(reviewModal.created_at).toLocaleDateString()}</div>
            </div>
            {reviewModal.notes && <div style={{ background:'var(--bg3)', borderRadius:'var(--radius)', padding:'10px 12px', fontSize:13, color:'var(--text2)' }}>{reviewModal.notes}</div>}
            <FormField label="Assign available asset (optional)">
              <select value={assignAssetId} onChange={e => setAssignAssetId(e.target.value)}>
                <option value="">— Don't assign an asset —</option>
                {availableAssets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.model || a.category}</option>)}
              </select>
            </FormField>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
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
