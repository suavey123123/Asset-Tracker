import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner } from './UI'

const EMPTY_FORM = {
  name: '', vendor: '', license_key: '', license_type: 'Perpetual',
  seats_total: '', seats_used: '', purchase_date: '', expiry_date: '',
  purchase_cost: '', support_expiry: '', notes: '',
}

const LICENSE_TYPES = ['Perpetual', 'Subscription', 'Volume', 'OEM', 'Open Source', 'Trial', 'Freeware']

export default function Licenses() {
  const { isAdmin } = useAuth()
  const [fetchError, setFetchError] = useState('')
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editLic, setEditLic] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => { fetchLicenses() }, [])

  async function fetchLicenses() {
    setLoading(true)
    const [{ data: l }, { data: a }] = await Promise.all([
      supabase.from('licenses').select('*').order('name'),
      supabase.from('asset_license_assignments').select('*, asset:asset_id(id, name, asset_tag, assigned_to)'),
    ])
    setLicenses(l || [])
    setAssignments(a || [])
    setLoading(false)
  }

  function openAdd() { setEditLic(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true) }
  function openEdit(l) {
    setEditLic(l)
    setForm({
      name: l.name||'', vendor: l.vendor||'', license_key: l.license_key||'',
      license_type: l.license_type||'Perpetual', seats_total: l.seats_total||'',
      seats_used: l.seats_used||'', purchase_date: l.purchase_date||'',
      expiry_date: l.expiry_date||'', purchase_cost: l.purchase_cost||'',
      support_expiry: l.support_expiry||'', notes: l.notes||'',
    })
    setError(''); setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('License name is required.'); return }
    setSaving(true); setError('')
    const payload = {
      ...form,
      seats_total: form.seats_total ? parseInt(form.seats_total) : null,
      seats_used: form.seats_used ? parseInt(form.seats_used) : null,
      purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
      purchase_date: form.purchase_date || null,
      expiry_date: form.expiry_date || null,
      support_expiry: form.support_expiry || null,
    }
    let err
    if (editLic) {
      const { error: e } = await supabase.from('licenses').update(payload).eq('id', editLic.id)
      err = e
    } else {
      const { error: e } = await supabase.from('licenses').insert(payload)
      err = e
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); fetchLicenses()
  }

  async function deleteLic(l) {
    if (!confirm(`Delete "${l.name}" license?`)) return
    await supabase.from('licenses').delete().eq('id', l.id)
    fetchLicenses()
  }

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate() + 30)
  const in90 = new Date(); in90.setDate(today.getDate() + 90)

  function getExpiryStatus(date) {
    if (!date) return null
    const d = new Date(date)
    if (d < today) return { label: 'EXPIRED', color: 'var(--red)' }
    if (d < in30) return { label: 'EXPIRING SOON', color: 'var(--red)' }
    if (d < in90) return { label: 'EXPIRING', color: 'var(--amber)' }
    return { label: 'ACTIVE', color: 'var(--green)' }
  }

  function getSeatStatus(used, total) {
    if (!total) return null
    const pct = used / total
    if (pct >= 1) return { color: 'var(--red)', label: 'Full' }
    if (pct >= 0.8) return { color: 'var(--amber)', label: `${used}/${total}` }
    return { color: 'var(--green)', label: `${used}/${total}` }
  }

  const filtered = licenses.filter(l => {
    if (filterType && l.license_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${l.name} ${l.vendor} ${l.license_type}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = {
    total: licenses.length,
    active: licenses.filter(l => !l.expiry_date || new Date(l.expiry_date) > today).length,
    expiring: licenses.filter(l => l.expiry_date && new Date(l.expiry_date) > today && new Date(l.expiry_date) < in30).length,
    expired: licenses.filter(l => l.expiry_date && new Date(l.expiry_date) < today).length,
    totalCost: licenses.reduce((s, l) => s + (parseFloat(l.purchase_cost) || 0), 0),
  }

  const thStyle = { padding:'10px 14px', textAlign:'left', fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }
  const tdStyle = { padding:'10px 14px' }

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:'1.5rem' }}>
        {[
          ['Total', stats.total, 'var(--text)'],
          ['Active', stats.active, 'var(--green)'],
          ['Expiring (30d)', stats.expiring, 'var(--red)'],
          ['Expired', stats.expired, 'var(--text2)'],
          ['Total cost', '$'+stats.totalCost.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}), 'var(--accent)'],
        ].map(([l,v,c]) => (
          <div key={l} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:l==='Total cost'?16:22, fontWeight:500, color:c, fontFamily:'var(--mono)' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search licenses…" style={{ width:200 }} />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ width:160 }}>
          <option value="">All types</option>
          {LICENSE_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <div style={{ flex:1 }} />
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add license</Btn>}
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        {loading ? <div style={{ padding:'2rem' }}><Spinner /></div> :
         filtered.length===0 ? <EmptyState message="No licenses yet. Add your first software license." /> : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Name','Vendor','Type','Seats used','Seats left','Expiry','Status','Cost','Assigned to','Actions'].map(h=><th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(l => {
                const expStatus = getExpiryStatus(l.expiry_date)
                const seatStatus = getSeatStatus(l.seats_used, l.seats_total)
                return (
                  <tr key={l.id} style={{ borderBottom:'1px solid var(--border)', borderLeft:`3px solid ${expStatus?.color||'transparent'}` }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight:500, fontSize:13 }}>{l.name}</div>
                      {l.license_key && <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>{l.license_key.slice(0,20)}…</div>}
                    </td>
                    <td style={{ ...tdStyle, fontSize:13, color:'var(--text2)' }}>{l.vendor||'—'}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:'var(--bg3)', color:'var(--text2)', fontFamily:'var(--mono)' }}>{l.license_type}</span>
                    </td>
                    <td style={tdStyle}>
                      {l.seats_total ? (
                        <div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                            <span style={{ color:seatStatus?.color||'var(--text2)', fontFamily:'var(--mono)', fontWeight:500 }}>{l.seats_used||0}/{l.seats_total}</span>
                          </div>
                          <div style={{ height:4, background:'var(--bg4)', borderRadius:2, overflow:'hidden', width:80 }}>
                            <div style={{ width:`${Math.min(100,Math.round((l.seats_used||0)/l.seats_total*100))}%`, height:'100%', background:seatStatus?.color||'var(--green)', borderRadius:2 }} />
                          </div>
                        </div>
                      ) : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      {l.seats_total ? (
                        <span style={{ fontSize:13, fontFamily:'var(--mono)', fontWeight:500, color: (l.seats_total-(l.seats_used||0))===0?'var(--red)':(l.seats_total-(l.seats_used||0))<=(l.seats_total*0.2)?'var(--amber)':'var(--green)' }}>
                          {l.seats_total-(l.seats_used||0)}
                        </span>
                      ) : <span style={{ color:'var(--text3)', fontSize:12 }}>∞</span>}
                    </td>
                    <td style={{ ...tdStyle, fontSize:12, color:expStatus?.color||'var(--text2)' }}>
                      {l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : '—'}
                    </td>
                    <td style={tdStyle}>
                      {expStatus ? <span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:500, color:expStatus.color }}>{expStatus.label}</span> : <span style={{ fontSize:11, color:'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, fontSize:13, fontFamily:'var(--mono)' }}>
                      {l.purchase_cost ? '$'+parseFloat(l.purchase_cost).toFixed(2) : '—'}
                    </td>
                    <td style={{ ...tdStyle, maxWidth:200 }}>
                      {(() => {
                        const licAssignments = assignments.filter(a => a.license_id === l.id)
                        return licAssignments.length === 0
                          ? <span style={{ fontSize:12, color:'var(--text3)' }}>None</span>
                          : <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                              {licAssignments.map(a => a.asset && (
                                <span key={a.id} style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:'var(--bg4)', color:'var(--text2)', fontFamily:'var(--mono)', display:'inline-flex', gap:4 }}>
                                  {a.asset.asset_tag}
                                  {a.asset.assigned_to && <span style={{ color:'var(--blue)' }}>· {a.asset.assigned_to}</span>}
                                </span>
                              ))}
                            </div>
                      })()}
                    </td>
                    <td style={tdStyle}>
                      {isAdmin && <div style={{ display:'flex', gap:4 }}>
                        <Btn size="sm" onClick={()=>openEdit(l)}>Edit</Btn>
                        <Btn size="sm" variant="danger" onClick={()=>deleteLic(l)}>Del</Btn>
                      </div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editLic?'Edit license':'Add software license'} width={560}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Software name" required><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Microsoft 365" /></FormField>
            <FormField label="Vendor"><input value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="e.g. Microsoft" /></FormField>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="License type"><select value={form.license_type} onChange={e=>setForm(f=>({...f,license_type:e.target.value}))}>{LICENSE_TYPES.map(t=><option key={t}>{t}</option>)}</select></FormField>
            <FormField label="License key"><input value={form.license_key} onChange={e=>setForm(f=>({...f,license_key:e.target.value}))} placeholder="XXXXX-XXXXX-XXXXX" /></FormField>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Total seats"><input type="number" min="1" value={form.seats_total} onChange={e=>setForm(f=>({...f,seats_total:e.target.value}))} placeholder="e.g. 25" /></FormField>
            <FormField label="Seats in use"><input type="number" min="0" value={form.seats_used} onChange={e=>setForm(f=>({...f,seats_used:e.target.value}))} placeholder="e.g. 18" /></FormField>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Purchase date"><input type="date" value={form.purchase_date} onChange={e=>setForm(f=>({...f,purchase_date:e.target.value}))} /></FormField>
            <FormField label="Purchase cost ($)"><input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e=>setForm(f=>({...f,purchase_cost:e.target.value}))} /></FormField>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="License expiry"><input type="date" value={form.expiry_date} onChange={e=>setForm(f=>({...f,expiry_date:e.target.value}))} /></FormField>
            <FormField label="Support expiry"><input type="date" value={form.support_expiry} onChange={e=>setForm(f=>({...f,support_expiry:e.target.value}))} /></FormField>
          </div>
          <FormField label="Notes"><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any additional info…" /></FormField>
          {error && <div style={{ color:'var(--red)', fontSize:12 }}>{error}</div>}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Btn onClick={()=>setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save license'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
