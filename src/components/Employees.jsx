import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner } from './UI'
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

  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterSite, setFilterSite] = useState('')
  const [selected, setSelected] = useState([])
  const [viewEmp, setViewEmp] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editEmp, setEditEmp] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError('')
    try {
      const [empRes, assetRes, siteRes] = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('assets').select('id,name,asset_tag,category,status,assigned_to').eq('status', 'Checked Out'),
        supabase.from('sites').select('id,name').order('name'),
      ])

      setEmployees(empRes.data || [])
      setAssets(assetRes.data || [])
      setSites(siteRes.data || [])
    } catch (err) {
      console.error("Fetch error:", err)
      setError("Failed to load employees")
    } finally {
      setLoading(false)
    }
  }

  function getEmployeeAssets(empName) {
    if (!empName) return []
    return assets.filter(a => a.assigned_to?.toLowerCase() === empName.toLowerCase())
  }

  const filtered = employees.filter(e => {
    if (filterSite && String(e.site_id) !== String(filterSite)) return false
    if (filterDept && e.department !== filterDept) return false
    if (search) {
      const q = search.toLowerCase()
      return `${e.name || ''} ${e.email || ''} ${e.department || ''}`.toLowerCase().includes(q)
    }
    return true
  })

  const allSelected = filtered.length > 0 && filtered.every(e => selected.includes(e?.id))

  const handleSelectAll = (checked) => {
    setSelected(checked ? filtered.map(e => e.id) : [])
  }

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {error && (
        <div style={{ padding: 12, background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search employees…"
          style={{ width: 220 }}
        />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 180 }}>
          <option value="">All departments</option>
          {[...new Set(employees.map(e => e?.department).filter(Boolean))].sort().map(d => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ width: 180 }}>
          <option value="">All sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {isAdmin && <Btn variant="primary" onClick={() => { setEditEmp(null); setForm(EMPTY_FORM); setModalOpen(true) }}>
          + Add employee
        </Btn>}
        {isAdmin && <Btn size="sm" onClick={() => setImportOpen(true)}>⬆ Import CSV</Btn>}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', minHeight: 400 }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState message="No employees found" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', width: 32 }}>
                  <input type="checkbox" checked={allSelected} onChange={e => handleSelectAll(e.target.checked)} />
                </th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Department</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Assets</th>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const empAssets = getEmployeeAssets(emp.name)
                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="checkbox"
                        checked={selected.includes(emp.id)}
                        onChange={() => setSelected(prev =>
                          prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                        )}
                      />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => setViewEmp(emp)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}
                      >
                        {emp.name}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{emp.email || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{emp.department || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {empAssets.length > 0 ? (
                        <span style={{ padding: '2px 10px', borderRadius: 999, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 12, fontWeight: 500 }}>
                          {empAssets.length} asset{empAssets.length > 1 ? 's' : ''}
                        </span>
                      ) : 'None'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Btn size="sm" onClick={() => setViewEmp(emp)}>View</Btn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Simple View Modal */}
      <Modal open={!!viewEmp} onClose={() => setViewEmp(null)} title={viewEmp?.name || ''}>
        {viewEmp && (
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <p><strong>Email:</strong> {viewEmp.email || '—'}</p>
            <p><strong>Department:</strong> {viewEmp.department || '—'}</p>
            <p><strong>Assets Assigned:</strong> {getEmployeeAssets(viewEmp.name).length}</p>
          </div>
        )}
      </Modal>

      <ImportEmployeesCSV open={importOpen} onClose={() => setImportOpen(false)} onDone={fetchAll} sites={sites} />
    </div>
  )
}