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
      console.error("Failed to fetch data:", err)
      setError("Failed to load employees. Please refresh.")
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
    if (!e) return false
    if (filterSite && String(e.site_id) !== String(filterSite)) return false
    if (filterDept && e.department !== filterDept) return false
    if (search) {
      const q = search.toLowerCase()
      const text = `${e.name || ''} ${e.email || ''} ${e.title || ''} ${e.department || ''}`
      return text.toLowerCase().includes(q)
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortCol === 'assets') {
      const countA = getEmployeeAssets(a.name).length
      const countB = getEmployeeAssets(b.name).length
      return (countA - countB) * (sortDir === 'asc' ? 1 : -1)
    }
    if (sortCol === 'site') {
      const nameA = sites.find(s => s.id === a.site_id)?.name || ''
      const nameB = sites.find(s => s.id === b.site_id)?.name || ''
      return nameA.localeCompare(nameB) * (sortDir === 'asc' ? 1 : -1)
    }

    const valA = String(a[sortCol] || '').toLowerCase()
    const valB = String(b[sortCol] || '').toLowerCase()
    return valA.localeCompare(valB) * (sortDir === 'asc' ? 1 : -1)
  })

  function openAdd() {
    setEditEmp(null)
    setForm(EMPTY_FORM)
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
    setModalOpen(true)
  }

  // Add your other functions here (save, deleteEmp, offboard, etc.)

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {error && <div style={{ color: 'var(--red)', padding: 12, background: 'var(--red-bg)', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      {/* Stats, Search, Filters, Buttons - keep your original ones here */}

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}><Spinner /></div>
        ) : sorted.length === 0 ? (
          <EmptyState message="No employees found." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', width: 32 }}>
                  <input type="checkbox" />
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
                if (!emp?.id) return null
                const empAssets = getEmployeeAssets(emp.name)
                const site = sites.find(s => s.id === emp.site_id)

                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <input type="checkbox" />
                    </td>

                    {hasCol('name') && (
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => setViewEmp(emp)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ fontWeight: 500 }}>{emp.name}</div>
                        </button>
                      </td>
                    )}

                    {hasCol('email') && <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{emp.email || '—'}</td>}
                    {hasCol('department') && <td style={{ padding: '10px 14px' }}>{emp.department || '—'}</td>}
                    {hasCol('site') && <td style={{ padding: '10px 14px' }}>{site?.name || '—'}</td>}
                    {hasCol('phone') && <td style={{ padding: '10px 14px' }}>{emp.phone || '—'}</td>}
                    {hasCol('hire_date') && <td style={{ padding: '10px 14px' }}>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '—'}</td>}
                    {hasCol('assets') && <td style={{ padding: '10px 14px' }}>{empAssets.length} asset{empAssets.length !== 1 ? 's' : ''}</td>}

                    {hasCol('actions') && (
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn size="sm" onClick={() => setViewEmp(emp)}>View</Btn>
                          {isAdmin && <Btn size="sm" onClick={() => openEdit(emp)}>Edit</Btn>}
                          {isAdmin && <Btn size="sm" variant="danger" onClick={() => {/* deleteEmp(emp) */}}>Del</Btn>}
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

      {/* Add your Modal components here (Add/Edit, View, Import, etc.) */}
    </div>
  )
}