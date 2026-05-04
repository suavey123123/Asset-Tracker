import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, Badge } from './UI'

const EMPTY_FORM = {
  name: '', email: '', department: '', title: '', phone: '', location: '', notes: '', site_id: null,
}

export default function Employees({ onViewEmployee }) {
  const { isAdmin } = useAuth()
  const [employees, setEmployees] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editEmp, setEditEmp] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [sites, setSites] = useState([])
  const [viewEmp, setViewEmp] = useState(null)
  const [selected, setSelected] = useState([])
  const [filterSite, setFilterSite] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: e }, { data: a }, { data: s }] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('assets').select('id, name, asset_tag, category, status, assigned_to').eq('status', 'Checked Out'),
      supabase.from('sites').select('id, name').order('name'),
    ])
    setEmployees(e || [])
    setAssets(a || [])
    setSites(s || [])
    setLoading(false)
  }

  function openAdd() { setEditEmp(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true) }
  function openEdit(emp) { setEditEmp(emp); setForm({ name: emp.name||'', email: emp.email||'', department: emp.department||'', title: emp.title||'', phone: emp.phone||'', location: emp.location||'', notes: emp.notes||'', site_id: emp.site_id||null }); setError(''); setModalOpen(true) }

  async function save() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    const payload = { ...form, name: form.name.trim() }
    let err
    if (editEmp) {
      const { error: e } = await supabase.from('employees').update(payload).eq('id', editEmp.id)
      err = e
    } else {
      const { error: e } = await supabase.from('employees').insert(payload)
      err = e
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); fetchAll()
  }

  async function deleteEmp(emp) {
    if (!confirm(`Delete ${emp.name}? This won't remove their assigned assets.`)) return
    await supabase.from('employees').delete().eq('id', emp.id)
    fetchAll()
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.length} employee${selected.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    for (const id of selected) {
      await supabase.from('employees').delete().eq('id', id)
    }
    setSelected([])
    fetchAll()
  }

  function getEmployeeAssets(empName) {
    return assets.filter(a => a.assigned_to?.toLowerCase() === empName?.toLowerCase())
  }

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort()

  const filtered = employees.filter(e => {
    if (filterSite && e.site_id !== filterSite) return false
    if (filterDept && e.department !== filterDept) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${e.name} ${e.email} ${e.department} ${e.title}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          ['Total employees', employees.length, 'var(--text)'],
          ['With assets', [...new Set(assets.map(a => a.assigned_to).filter(Boolean))].length, 'var(--blue)'],
          ['Departments', departments.length, 'var(--accent)'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: c, fontFamily: 'var(--mono)' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…" style={{ width: 200 }} />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 180 }}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ width: 180 }}>
          <option value="">All sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {isAdmin && selected.length > 0 && (
          <Btn variant="danger" onClick={bulkDelete}>Delete {selected.length} selected</Btn>
        )}
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add employee</Btn>}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         filtered.length === 0 ? <EmptyState message="No employees yet. Add your first employee." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding:'10px 14px', width:32 }}>
                  <input type="checkbox"
                    checked={filtered.length > 0 && filtered.every(e => selected.includes(e.id))}
                    onChange={ev => setSelected(ev.target.checked ? filtered.map(e => e.id) : [])}
                    style={{ width:'auto', cursor:'pointer' }}
                  />
                </th>
              {['Name', 'Email', 'Department', 'Site', 'Assets checked out', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const empAssets = getEmployeeAssets(emp.name)
                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => setViewEmp(emp)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font)' }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{emp.name}</div>
                        {emp.email && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{emp.email}</div>}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: emp.title ? 'var(--text)' : 'var(--text3)' }}>{emp.title || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {emp.department ? (
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: 'var(--blue-bg)', color: 'var(--blue)', fontFamily: 'var(--mono)' }}>{emp.department}</span>
                      ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{sites.find(s=>s.id===emp.site_id)?.name || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {empAssets.length > 0 ? (
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: 'var(--green-bg)', color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 500 }}>{empAssets.length} asset{empAssets.length !== 1 ? 's' : ''}</span>
                      ) : <span style={{ fontSize: 12, color: 'var(--text3)' }}>None</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn size="sm" onClick={() => setViewEmp(emp)}>View</Btn>
                        {isAdmin && <Btn size="sm" onClick={() => openEdit(emp)}>Edit</Btn>}
                        {isAdmin && <Btn size="sm" variant="danger" onClick={() => deleteEmp(emp)}>Del</Btn>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Employee detail modal */}
      <Modal open={!!viewEmp} onClose={() => setViewEmp(null)} title={viewEmp?.name || ''} width={560}>
        {viewEmp && (() => {
          const empAssets = getEmployeeAssets(viewEmp.name)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                {[['Email', viewEmp.email], ['Title', viewEmp.title], ['Department', viewEmp.department], ['Phone', viewEmp.phone], ['Location', viewEmp.location]].map(([l, v]) => v ? (
                  <div key={l}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 13 }}>{v}</div>
                  </div>
                ) : null)}
              </div>
              {viewEmp.notes && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>{viewEmp.notes}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Assigned assets ({empAssets.length})</div>
                {empAssets.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>No assets currently assigned.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {empAssets.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{a.asset_tag} · {a.category}</div>
                        </div>
                        <Badge status={a.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <Btn onClick={() => { setViewEmp(null); openEdit(viewEmp) }}>Edit employee</Btn>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Add/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEmp ? 'Edit employee' : 'Add employee'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Full name" required><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" /></FormField>
            <FormField label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@company.com" /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Job title"><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Engineer" /></FormField>
            <FormField label="Department"><input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. IT, Operations" /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Phone"><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 555-1234" /></FormField>
            <FormField label="Location"><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Floor 3, Desk 12" /></FormField>
          </div>
          <FormField label="Site">
            <select value={form.site_id||''} onChange={e => setForm(f => ({ ...f, site_id: e.target.value || null }))}>
              <option value="">No site assigned</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Notes"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional info…" /></FormField>
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save employee'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
