import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, Badge } from './UI'
import ImportEmployeesCSV from './ImportEmployeesCSV'

const EMPTY_FORM = {
  name: '', email: '', department: '', title: '', phone: '', location: '', notes: '', site_id: null, hire_date: null,
}

export default function Employees() {
  const { isAdmin } = useAuth()

  const [employees, setEmployees] = useState([])
  const [assets, setAssets] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editEmp, setEditEmp] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [selected, setSelected] = useState([])

  const [viewEmp, setViewEmp] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const [visibleCols] = useState(['name', 'email', 'department', 'site', 'phone', 'hire_date', 'assets', 'actions'])

  const ALL_EMP_COLS = [
    { id: 'name', label: 'Name', fixed: true },
    { id: 'email', label: 'Email', fixed: false },
    { id: 'title', label: 'Job Title', fixed: false },
    { id: 'department', label: 'Department', fixed: false },
    { id: 'site', label: 'Site', fixed: false },
    { id: 'phone', label: 'Phone', fixed: false },
    { id: 'hire_date', label: 'Hire Date', fixed: false },
    { id: 'assets', label: 'Assets', fixed: false },
    { id: 'actions', label: 'Actions', fixed: true },
  ]

  function hasCol(id) {
    return visibleCols.includes(id)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError('')
    try {
      const [empRes, assetRes, siteRes] = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('assets').select('id, name, asset_tag, category, status, assigned_to').eq('status', 'Checked Out'),
        supabase.from('sites').select('id, name').order('name'),
      ])

      setEmployees(empRes.data || [])
      setAssets(assetRes.data || [])
      setSites(siteRes.data || [])
    } catch (err) {
      console.error(err)
      setError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  function getEmployeeAssets(empName) {
    if (!empName) return []
    return assets.filter(a => a.assigned_to?.toLowerCase() === empName.toLowerCase())
  }

  const departments = [...new Set(employees.map(e => e?.department).filter(Boolean))].sort()

  const filtered = employees.filter(e => {
    if (filterSite && String(e.site_id) !== String(filterSite)) return false
    if (filterDept && e.department !== filterDept) return false
    if (search) {
      const q = search.toLowerCase()
      return `${e.name || ''} ${e.email || ''} ${e.title || ''} ${e.department || ''}`.toLowerCase().includes(q)
    }
    return true
  })

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
    const valA = String(a[sortCol] || '').toLowerCase()
    const valB = String(b[sortCol] || '').toLowerCase()
    return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
  })

  // Select All
  const allSelected = filtered.length > 0 && filtered.every(e => selected.includes(e.id))

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelected(filtered.map(e => e.id))
    } else {
      setSelected([])
    }
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
    setModalOpen(true)
  }

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {error && <div style={{ color: 'var(--red)', padding: 12, background: 'var(--red-bg)', marginBottom: 16 }}>{error}</div>}

      {/* Filters & Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…" style={{ width: 220 }} />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 180 }}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ width: 180 }}>
          <option value="">All sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {isAdmin && selected.length > 0 && <Btn variant="danger">Delete {selected.length} selected</Btn>}
        {isAdmin && <Btn size="sm" onClick={() => setImportOpen(true)}>⬆ Import CSV</Btn>}
        {isAdmin && <Btn variant="primary" onClick={() => { setEditEmp(null); setForm(EMPTY_FORM); setModalOpen(true) }}>+ Add employee</Btn>}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '4rem', textAlign: 'center' }}><Spinner /></div> : sorted.length === 0 ? (
          <EmptyState message="No employees found." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                {ALL_EMP_COLS.filter(c => hasCol(c.id)).map(col => (
                  <th key={col.id} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(emp => {
                const empAssets = getEmployeeAssets(emp.name)
                const site = sites.find(s => s.id === emp.site_id)

                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="checkbox"
                        checked={selected.includes(emp.id)}
                        onChange={() => {
                          setSelected(prev =>
                            prev.includes(emp.id)
                              ? prev.filter(id => id !== emp.id)
                              : [...prev, emp.id]
                          )
                        }}
                      />
                    </td>

                    {hasCol('name') && (
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={() => setViewEmp(emp)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                        >
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{emp.name}</div>
                        </button>
                      </td>
                    )}

                    {hasCol('email') && <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{emp.email || '—'}</td>}
                    {hasCol('department') && <td style={{ padding: '10px 14px' }}>{emp.department || '—'}</td>}
                    {hasCol('site') && <td style={{ padding: '10px 14px' }}>{site?.name || '—'}</td>}
                    {hasCol('phone') && <td style={{ padding: '10px 14px' }}>{emp.phone || '—'}</td>}
                    {hasCol('hire_date') && <td style={{ padding: '10px 14px' }}>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '—'}</td>}

                    {hasCol('assets') && (
                      <td style={{ padding: '10px 14px' }}>
                        {empAssets.length > 0 ? (
                          <span style={{ 
                            fontSize: 12, 
                            padding: '2px 8px', 
                            borderRadius: 100, 
                            background: 'var(--green-bg)', 
                            color: 'var(--green)', 
                            fontFamily: 'var(--mono)', 
                            fontWeight: 500 
                          }}>
                            {empAssets.length} asset{empAssets.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>None</span>
                        )}
                      </td>
                    )}

                    {hasCol('actions') && (
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn size="sm" onClick={() => setViewEmp(emp)}>View</Btn>
                          {isAdmin && <Btn size="sm" onClick={() => openEdit(emp)}>Edit</Btn>}
                          {isAdmin && <Btn size="sm" variant="danger">Del</Btn>}
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

      {/* View Modal - Basic version */}
      <Modal open={!!viewEmp} onClose={() => setViewEmp(null)} title={viewEmp?.name || ''}>
        {viewEmp && (
          <div style={{ padding: '10px 0' }}>
            <p><strong>Email:</strong> {viewEmp.email || '—'}</p>
            <p><strong>Department:</strong> {viewEmp.department || '—'}</p>
            <p><strong>Assets:</strong> {getEmployeeAssets(viewEmp.name).length}</p>
          </div>
        )}
      </Modal>

      <ImportEmployeesCSV open={importOpen} onClose={() => setImportOpen(false)} onDone={fetchAll} sites={sites} />

      {/* Add/Edit Modal - You can keep your original one here */}
    </div>
  )
}