import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, Badge } from './UI'
import ImportEmployeesCSV from './ImportEmployeesCSV'

const EMPTY_FORM = {
  name: '', email: '', department: '', title: '', phone: '', location: '', notes: '', site_id: null, hire_date: null,
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
  const [empHistory, setEmpHistory] = useState({ log: [], current: [] })
  const [selected, setSelected] = useState([])
  const [filterSite, setFilterSite] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [offboardEmp, setOffboardEmp] = useState(null)
  const [offboarding, setOffboarding] = useState(false)
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [showColPicker, setShowColPicker] = useState(false)

  // Safer visibleCols with better fallback
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('emp_cols')
      if (!saved) return ['name', 'email', 'department', 'site', 'phone', 'hire_date', 'assets', 'actions']

      const parsed = JSON.parse(saved)
      const valid = ['name', 'email', 'title', 'department', 'site', 'phone', 'hire_date', 'assets', 'actions']

      if (!Array.isArray(parsed) || !parsed.every(c => valid.includes(c))) {
        return ['name', 'email', 'department', 'site', 'phone', 'hire_date', 'assets', 'actions']
      }
      return parsed
    } catch {
      return ['name', 'email', 'department', 'site', 'phone', 'hire_date', 'assets', 'actions']
    }
  })

  const ALL_EMP_COLS = [
    { id: 'name', label: 'Name', fixed: true },
    { id: 'email', label: 'Email', fixed: false },
    { id: 'title', label: 'Job Title', fixed: false },
    { id: 'department', label: 'Department', fixed: false },
    { id: 'site', label: 'Site', fixed: false },
    { id: 'phone', label: 'Phone', fixed: false },
    { id: 'hire_date', label: 'Date of hire', fixed: false },
    { id: 'assets', label: 'Assets', fixed: false },
    { id: 'actions', label: 'Actions', fixed: true },
  ]

  function toggleEmpCol(id) {
    if (ALL_EMP_COLS.find(c => c.id === id)?.fixed) return
    setVisibleCols(prev => {
      const updated = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
      localStorage.setItem('emp_cols', JSON.stringify(updated))
      return [...updated]
    })
  }

  function hasCol(id) {
    return visibleCols.includes(id)
  }

  // Column picker outside click
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

  function handleSort(col) {
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
    setError('')
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
      console.error('Fetch employees error:', err)
      setError('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  // ... rest of your functions (openAdd, openEdit, save, deleteEmp, offboard, etc.) stay the same

  function getEmployeeAssets(empName) {
    if (!empName) return []
    return assets.filter(a => a.assigned_to?.toLowerCase() === empName.toLowerCase())
  }

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort()

  const filtered = employees.filter(e => {
    if (filterSite && String(e.site_id) !== String(filterSite)) return false
    if (filterDept && e.department !== filterDept) return false
    if (search) {
      const q = search.toLowerCase()
      return `${e.name || ''} ${e.email || ''} ${e.department || ''} ${e.title || ''}`.toLowerCase().includes(q)
    }
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortCol === 'assets') {
      const av = getEmployeeAssets(a.name).length
      const bv = getEmployeeAssets(b.name).length
      return sortDir === 'asc' ? av - bv : bv - av
    }
    if (sortCol === 'site') {
      const av = sites.find(s => s.id === a.site_id)?.name || ''
      const bv = sites.find(s => s.id === b.site_id)?.name || ''
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }

    const fieldMap = { name: 'name', email: 'email', title: 'title', department: 'department', phone: 'phone', hire_date: 'hire_date' }
    const field = fieldMap[sortCol] || 'name'
    const av = String(a[field] || '').toLowerCase()
    const bv = String(b[field] || '').toLowerCase()
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {/* Stats - unchanged */}

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
        {isAdmin && <Btn size="sm" onClick={() => setImportOpen(true)}>⬆ Import CSV</Btn>}
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add employee</Btn>}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem' }}><Spinner /></div>
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
                        {canSort && <span style={{ fontSize: 10, opacity: isActive ? 1 : 0.3 }}>{isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
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
                        <button onClick={() => { setViewEmp(emp); fetchEmpHistory(emp) }} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{emp.name}</div>
                          {hasCol('title') && emp.title && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{emp.title}</div>}
                        </button>
                      </td>
                    )}

                    {hasCol('email') && <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{emp.email || '—'}</td>}

                    {!hasCol('name') && hasCol('title') && (
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{emp.title || '—'}</td>
                    )}

                    {hasCol('department') && <td style={{ padding: '10px 14px' }}>
                      {emp.department ? <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: 'var(--blue-bg)', color: 'var(--blue)', fontFamily: 'var(--mono)' }}>{emp.department}</span> : '—'}
                    </td>}

                    {hasCol('site') && <td style={{ padding: '10px 14px' }}>
                      {site ? <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: 'var(--accent-bg)', color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{site.name}</span> : '—'}
                    </td>}

                    {hasCol('phone') && <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{emp.phone || '—'}</td>}
                    {hasCol('hire_date') && <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '—'}</td>}
                    {hasCol('assets') && <td style={{ padding: '10px 14px' }}>
                      {empAssets.length > 0 ? (
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: 'var(--green-bg)', color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 500 }}>
                          {empAssets.length} asset{empAssets.length !== 1 ? 's' : ''}
                        </span>
                      ) : <span style={{ fontSize: 12, color: 'var(--text3)' }}>None</span>}
                    </td>}

                    {/* FIXED: Only render if column is visible */}
                    {hasCol('actions') && (
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Btn size="sm" onClick={() => { setViewEmp(emp); fetchEmpHistory(emp) }}>View</Btn>
                          {isAdmin && <Btn size="sm" onClick={() => openEdit(emp)}>Edit</Btn>}
                          {isAdmin && <Btn size="sm" variant="danger" onClick={() => deleteEmp(emp)}>Del</Btn>}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Rest of your modals (View, Add/Edit, Offboard, Import) remain the same */}
      {/* ... */}

    </div>
  )
}