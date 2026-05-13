import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, Badge } from './UI'
import ImportEmployeesCSV from './ImportEmployeesCSV'

const EMPTY_FORM = {
  name: '', email: '', department: '', title: '', phone: '', location: '', notes: '', site_id: null, hire_date: null,
}

export default function Employees({ onViewAsset, highlightEmployee, onClearHighlight }) {
  const { isAdmin, isAdminOrManager } = useAuth()
  const [employees, setEmployees] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEmp, setEditEmp] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [sites, setSites] = useState([])
  const [viewEmp, setViewEmp] = useState(null)
  const [empHistory, setEmpHistory] = useState({ log: [], current: [] })
  const [selected, setSelected] = useState([])
  const [filterSite, setFilterSite] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportSite, setExportSite] = useState('')
  const [exportCategory, setExportCategory] = useState('')
  const [offboardEmp, setOffboardEmp] = useState(null)
  const [offboarding, setOffboarding] = useState(false)
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [showColPicker, setShowColPicker] = useState(false)
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('emp_cols')
      if (!saved) return ['name','email','department','site','phone','hire_date','assets','actions']
      const parsed = JSON.parse(saved)
      const valid = ['name','email','title','department','site','phone','hire_date','assets','actions']
      if (!Array.isArray(parsed) || !parsed.every(c => valid.includes(c))) return ['name','email','department','site','phone','hire_date','assets','actions']
      return parsed
    } catch { return ['name','email','department','site','phone','hire_date','assets','actions'] }
  })

  const ALL_EMP_COLS = [
    { id:'name',       label:'Name',             fixed:true },
    { id:'email',      label:'Email',            fixed:false },
    { id:'title',      label:'Job Title',        fixed:false },
    { id:'department', label:'Department',       fixed:false },
    { id:'site',       label:'Site',             fixed:false },
    { id:'phone',      label:'Phone',            fixed:false },
    { id:'hire_date',  label:'Date of hire',     fixed:false },
    { id:'assets',     label:'Assets',           fixed:false },
    { id:'actions',    label:'Actions',          fixed:true },
  ]

  function toggleEmpCol(id) {
    if (ALL_EMP_COLS.find(c=>c.id===id)?.fixed) return
    setVisibleCols(prev => {
      const updated = prev.includes(id) ? prev.filter(c=>c!==id) : [...prev, id]
      localStorage.setItem('emp_cols', JSON.stringify(updated))
      return [...updated]
    })
  }

  function hasCol(id) { return visibleCols.includes(id) }

  useEffect(() => {
    if (!showColPicker) return
    function close(e) { if (!e.target.closest('[data-colpicker]')) setShowColPicker(false) }
    setTimeout(() => document.addEventListener('mousedown', close), 100)
    return () => document.removeEventListener('mousedown', close)
  }, [showColPicker])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d==='asc'?'desc':'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (highlightEmployee) { setSearch(highlightEmployee.name || ''); onClearHighlight?.() } }, [highlightEmployee])

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
  async function fetchEmpHistory(emp) {
    const [{ data: log }, { data: current }] = await Promise.all([
      supabase.from('activity_log').select('*').ilike('message', `%${emp.name}%`).order('created_at', { ascending: false }).limit(50),
      supabase.from('assets').select('id, asset_tag, model, category, status, purchase_date').eq('assigned_to', emp.name),
    ])
    setEmpHistory({ log: log || [], current: current || [] })
  }

  function openEdit(emp) { setEditEmp(emp); setForm({ name: emp.name||'', email: emp.email||'', department: emp.department||'', title: emp.title||'', phone: emp.phone||'', location: emp.location||'', notes: emp.notes||'', site_id: emp.site_id||null, hire_date: emp.hire_date||'' }); setError(''); setModalOpen(true) }

  async function save() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    const payload = { ...form, name: form.name.trim(), hire_date: form.hire_date && form.hire_date !== '' ? form.hire_date : null, site_id: form.site_id || null }
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

  async function offboard(emp) {
    setOffboarding(true)
    // Check in all assets assigned to this employee
    const { data: empAssets } = await supabase.from('assets').select('id, name, asset_tag').eq('assigned_to', emp.name).eq('status', 'Checked Out')
    if (empAssets?.length) {
      for (const a of empAssets) {
        await supabase.from('assets').update({ status: 'Available', assigned_to: null, expected_return: null }).eq('id', a.id)
        await supabase.from('activity_log').insert({ asset_id: a.id, asset_tag: a.asset_tag, asset_name: a.name, type: 'checkin', message: `Checked in during offboarding of ${emp.name}`, performed_by: 'system' })
        // Release licenses
        const { data: assignments } = await supabase.from('asset_license_assignments').select('*, license:license_id(id, seats_used)').eq('asset_id', a.id)
        if (assignments?.length) {
          for (const asgn of assignments) {
            if (asgn.license) await supabase.rpc('decrement_license_seats', { license_id: asgn.license.id })
          }
          await supabase.from('asset_license_assignments').delete().eq('asset_id', a.id)
        }
      }
    }
    setOffboarding(false)
    setOffboardEmp(null)
    setViewEmp(null)
    fetchAll()
    alert(`✓ Offboarding complete. ${empAssets?.length || 0} asset${empAssets?.length !== 1 ? 's' : ''} checked in and all licenses freed.`)
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.length} employee${selected.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    for (const id of selected) {
      await supabase.from('employees').delete().eq('id', id)
    }
    setSelected([])
    fetchAll()
  }

  async function exportEmployeesAssets() {
    const { data: allAssets } = await supabase.from('assets').select('*').limit(2000)
    const filteredAssets = (allAssets||[]).filter(a => {
      if (exportSite && a.location !== exportSite) return false
      if (exportCategory && a.category?.toUpperCase() !== exportCategory.toUpperCase()) return false
      return true
    })
    // Use filtered employees if site filter is set (via site_id on employee)
    const exportEmployees = exportSite
      ? employees.filter(e => sites.find(s => s.id === e.site_id)?.name === exportSite)
      : employees
    const rows = []
    exportEmployees.forEach(emp => {
      const empAssets = filteredAssets.filter(a => a.assigned_to?.toLowerCase() === emp.name?.toLowerCase())
      if (empAssets.length === 0) {
        rows.push({ name: emp.name, email: emp.email||'', title: emp.title||'', department: emp.department||'', phone: emp.phone||'', hire_date: emp.hire_date||'', asset_tag: '', asset_category: '', asset_model: '', asset_serial: '', purchase_date: '', provision_date: '', purchase_cost: '', cpu: '', gpu: '', ram: '', ssd: '', hdd: '', mac_wifi: '', mac_lan: '', os_version: '', resolution: '', size: '', locked_status: '', carrier: '', imei: '', seat_number: '' })
      } else {
        empAssets.forEach(a => {
          rows.push({ name: emp.name, email: emp.email||'', title: emp.title||'', department: emp.department||'', phone: emp.phone||'', hire_date: emp.hire_date||'', asset_tag: a.asset_tag||'', asset_category: a.category||'', asset_model: a.model||'', asset_serial: a.serial_number||'', purchase_date: a.purchase_date||'', provision_date: a.provision_date||'', purchase_cost: a.purchase_cost||'', cpu: a.specs?.CPU||'', gpu: a.specs?.GPU||'', ram: a.specs?.RAM||'', ssd: a.specs?.SSD||'', hdd: a.specs?.HDD||'', mac_wifi: a.specs?.['MAC ADDRESS (WIFI)']||'', mac_lan: a.specs?.['MAC ADDRESS (LAN)']||'', os_version: a.specs?.['OS VERSION']||'', resolution: a.specs?.RESOLUTION||'', size: a.specs?.SIZE||'', locked_status: a.locked_status||'', carrier: a.carrier||'', imei: a.imei ? `=\"${a.imei}\"` : '', seat_number: a.seat_number||'' })
        })
      }
    })
    const headers = Object.keys(rows[0] || {})
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => { const v = String(r[h]||''); return v.includes(',') ? `"${v}"` : v }).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `employees-assets-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
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

  // Sort
  const fieldMap = { name:'name', email:'email', title:'title', department:'department', phone:'phone', hire_date:'hire_date' }
  const sorted = [...filtered].sort((a, b) => {
    if (sortCol === 'assets') {
      const av = getEmployeeAssets(a.name).length
      const bv = getEmployeeAssets(b.name).length
      return sortDir==='asc' ? av-bv : bv-av
    }
    if (sortCol === 'site') {
      const av = sites.find(s=>s.id===a.site_id)?.name || ''
      const bv = sites.find(s=>s.id===b.site_id)?.name || ''
      return sortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const field = fieldMap[sortCol] || 'name'
    const av = String(a[field]||'').toLowerCase()
    const bv = String(b[field]||'').toLowerCase()
    return sortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av)
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
        <Btn size="sm" onClick={() => setExportModalOpen(true)}>⬇ Export CSV</Btn>
        {isAdminOrManager && <Btn size="sm" onClick={() => setImportOpen(true)}>⬆ Import CSV</Btn>}
        {isAdminOrManager && <Btn variant="primary" onClick={openAdd}>+ Add employee</Btn>}
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
              {ALL_EMP_COLS.filter(c=>hasCol(c.id)).map(c => {
                  const isActive = sortCol === c.id
                  const canSort = !['actions'].includes(c.id)
                  return (
                    <th key={c.id} onClick={()=>canSort&&handleSort(c.id)} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:isActive?'var(--accent)':'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', cursor:canSort?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        {c.label}
                        {canSort && <span style={{ fontSize:10, opacity:isActive?1:0.3 }}>{isActive?(sortDir==='asc'?'▲':'▼'):'⇅'}</span>}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map(emp => {
                const empAssets = getEmployeeAssets(emp.name)
                const isSelected = selected.includes(emp.id)
                const site = sites.find(s => s.id === emp.site_id)
                return (
                  <tr key={emp.id} style={{ borderBottom:'1px solid var(--border)', background:isSelected?'var(--accent-bg)':undefined }}>
                    <td style={{ padding:'10px 14px' }}>
                      <input type="checkbox" checked={isSelected} onChange={e=>setSelected(s=>e.target.checked?[...s,emp.id]:s.filter(x=>x!==emp.id))} style={{ width:'auto', cursor:'pointer' }} />
                    </td>
                    {hasCol('name') && <td style={{ padding:'10px 14px' }}>
                      <button onClick={()=>{setViewEmp(emp);fetchEmpHistory(emp)}} style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0, fontFamily:'var(--font)' }}>
                        <div style={{ fontWeight:500, fontSize:13 }}>{emp.name}</div>
                        {hasCol('title') && emp.title && <div style={{ fontSize:11, color:'var(--text2)' }}>{emp.title}</div>}
                      </button>
                    </td>}
                    {hasCol('email') && <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{emp.email||'—'}</td>}
                    {!hasCol('name') && hasCol('title') && <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{emp.title||'—'}</td>}
                    {hasCol('department') && <td style={{ padding:'10px 14px' }}>
                      {emp.department ? <span style={{ fontSize:12, padding:'2px 8px', borderRadius:100, background:'var(--blue-bg)', color:'var(--blue)', fontFamily:'var(--mono)' }}>{emp.department}</span> : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>}
                    </td>}
                    {hasCol('site') && <td style={{ padding:'10px 14px' }}>
                      {site ? <span style={{ fontSize:12, padding:'2px 8px', borderRadius:100, background:'var(--accent-bg)', color:'var(--accent)', fontFamily:'var(--mono)' }}>{site.name}</span> : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>}
                    </td>}
                    {hasCol('phone') && <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)' }}>{emp.phone||'—'}</td>}
                    {hasCol('hire_date') && <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{emp.hire_date?new Date(emp.hire_date).toLocaleDateString():'—'}</td>}
                    {hasCol('assets') && <td style={{ padding:'10px 14px' }}>
                      {empAssets.length>0 ? <span style={{ fontSize:12, padding:'2px 8px', borderRadius:100, background:'var(--green-bg)', color:'var(--green)', fontFamily:'var(--mono)', fontWeight:500 }}>{empAssets.length} asset{empAssets.length!==1?'s':''}</span> : <span style={{ fontSize:12, color:'var(--text3)' }}>None</span>}
                    </td>}
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:4 }}>
                        <Btn size="sm" onClick={()=>{setViewEmp(emp);fetchEmpHistory(emp)}}>View</Btn>
                        {isAdminOrManager && <Btn size="sm" onClick={()=>openEdit(emp)}>Edit</Btn>}
                        {isAdminOrManager && <Btn size="sm" variant="danger" onClick={()=>deleteEmp(emp)}>Del</Btn>}
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
                {[['Email', viewEmp.email], ['Title', viewEmp.title], ['Department', viewEmp.department], ['Phone', viewEmp.phone], ['Location', viewEmp.location], ['Date of hire', viewEmp.hire_date ? new Date(viewEmp.hire_date).toLocaleDateString() : null]].map(([l, v]) => v ? (
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
                      <div key={a.id}
                        onClick={() => { setViewEmp(null); if (onViewAsset && a?.id) onViewAsset(a) }}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg3)', borderRadius:'var(--radius)', border:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg4)'}
                        onMouseLeave={e=>e.currentTarget.style.background='var(--bg3)'}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:500 }}>{a.model || a.name}</div>
                          <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>{a.asset_tag} · {a.category}</div>
                        </div>
                        <Badge status={a.status} />
                        <span style={{ fontSize:12, color:'var(--text3)' }}>→</span>
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

      <ImportEmployeesCSV open={importOpen} onClose={()=>setImportOpen(false)} onDone={fetchAll} sites={sites} />

      {exportModalOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.5rem', width:360 }}>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:'1rem' }}>Export CSV</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:'1.25rem' }}>
              <div>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Filter by site</div>
                <select value={exportSite} onChange={e=>setExportSite(e.target.value)} style={{ width:'100%' }}>
                  <option value="">All sites</option>
                  {sites.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Filter by category</div>
                <select value={exportCategory} onChange={e=>setExportCategory(e.target.value)} style={{ width:'100%' }}>
                  <option value="">All categories</option>
                  {[...new Set((assets||[]).map(a=>a.category).filter(Boolean))].sort().map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', background:'var(--bg3)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
                {exportSite || exportCategory
                  ? `Exporting employees${exportSite ? ` at ${exportSite}` : ''}${exportCategory ? ` with ${exportCategory} assets` : ''}`
                  : 'Exporting all employees and assets'}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={()=>{ setExportModalOpen(false); setExportSite(''); setExportCategory('') }} style={{ padding:'7px 14px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background:'var(--bg3)', cursor:'pointer', fontFamily:'var(--font)', fontSize:13, color:'var(--text)' }}>Cancel</button>
              <button onClick={()=>{ exportEmployeesAssets(); setExportModalOpen(false) }} style={{ padding:'7px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', cursor:'pointer', fontFamily:'var(--font)', fontSize:13, fontWeight:600, color:'#000' }}>⬇ Export</button>
            </div>
          </div>
        </div>
      )}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Site">
              <select value={form.site_id||''} onChange={e => setForm(f => ({ ...f, site_id: e.target.value || null }))}>
                <option value="">No site assigned</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Date of hire">
              <input type="date" value={form.hire_date||''} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Notes"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional info…" /></FormField>
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save employee'}</Btn>
          </div>
        </div>
      </Modal>
      {/* Offboard confirmation */}
      <Modal open={!!offboardEmp} onClose={() => setOffboardEmp(null)} title="Offboard employee" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 13, color: 'var(--red)' }}>
            ⚠ This will check in ALL assets assigned to <strong>{offboardEmp?.name}</strong> and free their software licenses.
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            Assets checked out to this employee will be marked Available. License seat counts will update automatically.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setOffboardEmp(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => offboard(offboardEmp)} disabled={offboarding}>
              {offboarding ? 'Offboarding…' : '🚪 Confirm offboard'}
            </Btn>
          </div>
        </div>
      </Modal>

    </div>
  )
}
