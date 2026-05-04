import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, Badge } from './UI'
import ImportEmployeesCSV from './ImportEmployeesCSV'

const EMPTY_FORM = {
  name: '', email: '', department: '', title: '', phone: '', location: '', notes: '', 
  site_id: null, hire_date: null,
}

export default function Employees({ onViewEmployee }) {
  const { isAdmin } = useAuth()
  
  const [employees, setEmployees] = useState([])
  const [assets, setAssets] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editEmp, setEditEmp] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterSite, setFilterSite] = useState('')

  const [viewEmp, setViewEmp] = useState(null)
  const [empHistory, setEmpHistory] = useState({ log: [], current: [] })

  const [selected, setSelected] = useState([])
  const [importOpen, setImportOpen] = useState(false)
  const [offboardEmp, setOffboardEmp] = useState(null)
  const [offboarding, setOffboarding] = useState(false)

  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const [showColPicker, setShowColPicker] = useState(false)
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('emp_cols')
      if (!saved) return ['name', 'email', 'department', 'site', 'phone', 'hire_date', 'assets', 'actions']
      const parsed = JSON.parse(saved)
      const valid = ['name','email','title','department','site','phone','hire_date','assets','actions']
      return Array.isArray(parsed) && parsed.every(c => valid.includes(c)) 
        ? parsed 
        : ['name','email','department','site','phone','hire_date','assets','actions']
    } catch {
      return ['name','email','department','site','phone','hire_date','assets','actions']
    }
  })

  const ALL_EMP_COLS = [
    { id: 'name',       label: 'Name',          fixed: true },
    { id: 'email',      label: 'Email',         fixed: false },
    { id: 'title',      label: 'Job Title',     fixed: false },
    { id: 'department', label: 'Department',    fixed: false },
    { id: 'site',       label: 'Site',          fixed: false },
    { id: 'phone',      label: 'Phone',         fixed: false },
    { id: 'hire_date',  label: 'Hire Date',     fixed: false },
    { id: 'assets',     label: 'Assets',        fixed: false },
    { id: 'actions',    label: 'Actions',       fixed: true },
  ]

  const hasCol = (id) => visibleCols.includes(id)

  const toggleEmpCol = (id) => {
    if (ALL_EMP_COLS.find(c => c.id === id)?.fixed) return
    setVisibleCols(prev => {
      const updated = prev.includes(id) 
        ? prev.filter(c => c !== id) 
        : [...prev, id]
      localStorage.setItem('emp_cols', JSON.stringify(updated))
      return updated
    })
  }

  // Close column picker on outside click
  useEffect(() => {
    if (!showColPicker) return
    const close = (e) => {
      if (!e.target.closest('[data-colpicker]')) setShowColPicker(false)
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', close), 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', close)
    }
  }, [showColPicker])

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [{ data: e }, { data: a }, { data: s }] = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('assets').select('id, name, asset_tag, category, status, assigned_to').eq('status', 'Checked Out'),
        supabase.from('sites').select('id, name').order('name'),
      ])
      setEmployees(e || [])
      setAssets(a || [])
      setSites(s || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditEmp(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  function openEdit(emp) {
    setEditEmp(emp)
    setForm({
      name: emp.name || '',
      email: emp.email || '',
      department: emp.department || '',
      title: emp.title || '',
      phone: emp.phone || '',
      location: emp.location || '',
      notes: emp.notes || '',
      site_id: emp.site_id || null,
      hire_date: emp.hire_date || '',
    })
    setError('')
    setModalOpen(true)
  }

  async function fetchEmpHistory(emp) {
    const [{ data: log }, { data: current }] = await Promise.all([
      supabase.from('activity_log')
        .select('*')
        .ilike('message', `%${emp.name}%`)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('assets')
        .select('id, asset_tag, model, category, status, purchase_date')
        .eq('assigned_to', emp.name),
    ])
    setEmpHistory({ log: log || [], current: current || [] })
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      ...form,
      name: form.name.trim(),
      hire_date: form.hire_date || null,
      site_id: form.site_id || null,
    }

    const { error: err } = editEmp
      ? await supabase.from('employees').update(payload).eq('id', editEmp.id)
      : await supabase.from('employees').insert(payload)

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    setModalOpen(false)
    fetchAll()
  }

  async function deleteEmp(emp) {
    if (!confirm(`Delete ${emp.name}?`)) return
    await supabase.from('employees').delete().eq('id', emp.id)
    fetchAll()
  }

  async function offboard(emp) {
    if (!emp) return
    setOffboarding(true)

    const { data: empAssets } = await supabase
      .from('assets')
      .select('id, name, asset_tag')
      .eq('assigned_to', emp.name)
      .eq('status', 'Checked Out')

    if (empAssets?.length) {
      for (const a of empAssets) {
        await supabase.from('assets')
          .update({ status: 'Available', assigned_to: null, expected_return: null })
          .eq('id', a.id)

        await supabase.from('activity_log').insert({
          asset_id: a.id,
          asset_tag: a.asset_tag,
          asset_name: a.name,
          type: 'checkin',
          message: `Checked in during offboarding of ${emp.name}`,
          performed_by: 'system'
        })

        // Release licenses
        const { data: assignments } = await supabase
          .from('asset_license_assignments')
          .select('*, license:license_id(id)')
          .eq('asset_id', a.id)

        if (assignments?.length) {
          for (const asgn of assignments) {
            if (asgn.license) {
              await supabase.rpc('decrement_license_seats', { license_id: asgn.license.id })
            }
          }
          await supabase.from('asset_license_assignments').delete().eq('asset_id', a.id)
        }
      }
    }

    setOffboarding(false)
    setOffboardEmp(null)
    setViewEmp(null)
    fetchAll()
    alert(`✓ Offboarding complete for ${emp.name}. ${empAssets?.length || 0} asset(s) checked in.`)
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.length} employee(s)?`)) return
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
      return `${e.name} ${e.email} ${e.department} ${e.title}`.toLowerCase().includes(q)
    }
    return true
  })

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let av, bv

    if (sortCol === 'assets') {
      av = getEmployeeAssets(a.name).length
      bv = getEmployeeAssets(b.name).length
      return sortDir === 'asc' ? av - bv : bv - av
    }

    if (sortCol === 'site') {
      av = sites.find(s => s.id === a.site_id)?.name || ''
      bv = sites.find(s => s.id === b.site_id)?.name || ''
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }

    const fieldMap = { name: 'name', email: 'email', title: 'title', department: 'department', phone: 'phone', hire_date: 'hire_date' }
    const field = fieldMap[sortCol] || 'name'
    av = String(a[field] || '').toLowerCase()
    bv = String(b[field] || '').toLowerCase()
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          ['Total employees', employees.length],
          ['With assets', [...new Set(assets.map(a => a.assigned_to).filter(Boolean))].length],
          ['Departments', departments.length],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, fontFamily: 'var(--mono)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search employees…"
          style={{ width: 220 }}
        />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 180 }}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ width: 180 }}>
          <option value="">All sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        <Btn size="sm" onClick={() => setShowColPicker(true)}>Columns</Btn>

        {isAdmin && selected.length > 0 && (
          <Btn variant="danger" onClick={bulkDelete}>Delete {selected.length}</Btn>
        )}
        {isAdmin && <Btn size="sm" onClick={() => setImportOpen(true)}>⬆ Import CSV</Btn>}
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add employee</Btn>}
      </div>

      {/* Column Picker */}
      {showColPicker && (
        <div data-colpicker style={{ position: 'absolute', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, zIndex: 100, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Visible Columns</div>
          {ALL_EMP_COLS.filter(c => !c.fixed).map(col => (
            <label key={col.id} style={{ display: 'block', padding: '4px 0' }}>
              <input
                type="checkbox"
                checked={hasCol(col.id)}
                onChange={() => toggleEmpCol(col.id)}
              /> {col.label}
            </label>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message="No employees found." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', width: 32 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every(e => selected.includes(e.id))}
                    onChange={ev => setSelected(ev.target.checked ? filtered.map(e => e.id) : [])}
                  />
                </th>
                {ALL_EMP_COLS.filter(c => hasCol(c.id)).map(c => {
                  const isActive = sortCol === c.id
                  const canSort = !['actions'].includes(c.id)
                  return (
                    <th
                      key={c.id}
                      onClick={() => canSort && handleSort(c.id)}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: 11,
                        color: isActive ? 'var(--accent)' : 'var(--text2)',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        cursor: canSort ? 'pointer' : 'default',
                        userSelect: 'none',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {c.label}
                        {canSort && <span style={{ fontSize: 10, opacity: isActive ? 1 : 0.4 }}>
                          {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map(emp => {
                const empAssets = getEmployeeAssets(emp.name)
                const site = sites.find(s => s.id === emp.site_id)
                const isSelected = selected.includes(emp.id)

                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)', background: isSelected ? 'var(--accent-bg)' : undefined }}>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => setSelected(s => e.target.checked ? [...s, emp.id] : s.filter(x => x !== emp.id))}
                      />
                    </td>

                    {hasCol('name') && (
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={() => { setViewEmp(emp); fetchEmpHistory(emp) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                        >
                          <div style={{ fontWeight: 500 }}>{emp.name}</div>
                          {hasCol('title') && emp.title && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{emp.title}</div>}
                        </button>
                      </td>
                    )}

                    {hasCol('email') && <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>{emp.email || '—'}</td>}
                    {hasCol('department') && (
                      <td style={{ padding: '10px 14px' }}>
                        {emp.department ? <Badge>{emp.department}</Badge> : '—'}
                      </td>
                    )}
                    {hasCol('site') && (
                      <td style={{ padding: '10px 14px' }}>
                        {site ? <Badge>{site.name}</Badge> : '—'}
                      </td>
                    )}
                    {hasCol('phone') && <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)' }}>{emp.phone || '—'}</td>}
                    {hasCol('hire_date') && (
                      <td style={{ padding: '10px 14px' }}>
                        {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '—'}
                      </td>
                    )}
                    {hasCol('assets') && (
                      <td style={{ padding: '10px 14px' }}>
                        {empAssets.length > 0 ? (
                          <span style={{ color: 'var(--green)', fontWeight: 500 }}>{empAssets.length} asset{empAssets.length > 1 ? 's' : ''}</span>
                        ) : '—'}
                      </td>
                    )}

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Btn size="sm" onClick={() => { setViewEmp(emp); fetchEmpHistory(emp) }}>View</Btn>
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

      {/* View Modal + Offboard */}
      <Modal open={!!viewEmp} onClose={() => setViewEmp(null)} title={viewEmp?.name} width={580}>
        {/* ... existing view modal content ... */}
        {viewEmp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Info grid + assets (your existing code) */}

            {isAdmin && (
              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <Btn onClick={() => { setViewEmp(null); openEdit(viewEmp) }}>Edit</Btn>
                <Btn variant="danger" onClick={() => setOffboardEmp(viewEmp)}>
                  Offboard Employee
                </Btn>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ImportEmployeesCSV open={importOpen} onClose={() => setImportOpen(false)} onDone={fetchAll} sites={sites} />

      {/* Add/Edit Modal - your existing code is fine */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEmp ? 'Edit Employee' : 'Add Employee'}>
        {/* ... your existing form ... */}
      </Modal>

      {/* Offboard Confirmation */}
      <Modal open={!!offboardEmp} onClose={() => setOffboardEmp(null)} title="Offboard Employee" width={440}>
        <div style={{ color: 'var(--red)', background: 'var(--red-bg)', padding: 14, borderRadius: 'var(--radius)', marginBottom: 16 }}>
          This action will check in all assets and release all licenses for <strong>{offboardEmp?.name}</strong>.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn onClick={() => setOffboardEmp(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => offboard(offboardEmp)} disabled={offboarding}>
            {offboarding ? 'Processing...' : 'Confirm Offboard'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}