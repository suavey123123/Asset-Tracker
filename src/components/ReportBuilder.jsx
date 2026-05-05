import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Spinner } from './UI'

const FIELDS = [
  { id: 'asset_tag', label: 'Asset Tag', table: 'assets', type: 'text' },
  { id: 'model', label: 'Model', table: 'assets', type: 'text' },
  { id: 'category', label: 'Category', table: 'assets', type: 'text' },
  { id: 'status', label: 'Status', table: 'assets', type: 'text' },
  { id: 'assigned_to', label: 'Assigned To', table: 'assets', type: 'text' },
  { id: 'assigned_to_team', label: 'Assigned Team', table: 'assets', type: 'text' },
  { id: 'location', label: 'Site / Location', table: 'assets', type: 'text' },
  { id: 'purchase_date', label: 'Purchase Date', table: 'assets', type: 'date' },
  { id: 'provision_date', label: 'Provision Date', table: 'assets', type: 'date' },
  { id: 'purchase_cost', label: 'Purchase Cost', table: 'assets', type: 'number' },
  { id: 'warranty_expiry', label: 'Warranty Expiry', table: 'assets', type: 'date' },
  { id: 'serial_number', label: 'Serial Number', table: 'assets', type: 'text' },
  { id: 'notes', label: 'Notes', table: 'assets', type: 'text' },
]

const FILTERS = [
  { id: 'status', label: 'Status', options: ['Available', 'Checked Out', 'Maintenance', 'Retired'] },
  { id: 'category', label: 'Category', options: [] },
  { id: 'assigned_to', label: 'Assigned To', type: 'text' },
  { id: 'location', label: 'Site', type: 'text' },
]

const SAVED_KEY = 'custom_reports_v1'

export default function ReportBuilder() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedFields, setSelectedFields] = useState(['asset_tag', 'model', 'category', 'status', 'assigned_to', 'purchase_cost'])
  const [filters, setFilters] = useState({ status: 'Checked Out', category: '', assigned_to: '', location: '' })
  const [sortField, setSortField] = useState('asset_tag')
  const [sortDir, setSortDir] = useState('asc')
  const [savedReports, setSavedReports] = useState(() => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] } })
  const [reportName, setReportName] = useState('')
  const [categories, setCategories] = useState([])

  useEffect(() => { fetchCategories().then(() => runReport()) }, [])

  async function fetchCategories() {
    const { data } = await supabase.from('assets').select('category').limit(500)
    setCategories([...new Set((data||[]).map(a=>a.category).filter(Boolean))].sort())
  }

  async function runReport() {
    setLoading(true)
    let query = supabase.from('assets').select(selectedFields.join(',')).limit(500)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.category) query = query.eq('category', filters.category)
    if (filters.assigned_to) query = query.ilike('assigned_to', `%${filters.assigned_to}%`)
    if (filters.location) query = query.ilike('location', `%${filters.location}%`)
    query = query.order(sortField, { ascending: sortDir === 'asc' })
    const { data } = await query
    setAssets(data || [])
    setLoading(false)
  }

  function toggleField(id) {
    setSelectedFields(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])
  }

  function saveReport() {
    if (!reportName.trim()) return
    const report = { name: reportName.trim(), fields: selectedFields, filters, sortField, sortDir, id: Date.now() }
    const updated = [...savedReports, report]
    setSavedReports(updated)
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated))
    setReportName('')
  }

  function loadReport(r) {
    setSelectedFields(r.fields)
    setFilters(r.filters)
    setSortField(r.sortField)
    setSortDir(r.sortDir)
  }

  function deleteReport(id) {
    const updated = savedReports.filter(r => r.id !== id)
    setSavedReports(updated)
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated))
  }

  function exportCSV() {
    if (!assets.length) return
    const headers = selectedFields.map(f => FIELDS.find(x => x.id === f)?.label || f)
    const rows = assets.map(a => selectedFields.map(f => { const v = a[f] ?? ''; return String(v).includes(',') ? `"${v}"` : v }))
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a'); el.href = url; el.download = `report-${Date.now()}.csv`; el.click()
    URL.revokeObjectURL(url)
  }

  const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer' }
  const tdStyle = { padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const card = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Left panel - builder */}
        <div>
          {/* Saved reports */}
          {savedReports.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Saved reports</div>
              {savedReports.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <button onClick={() => loadReport(r)} style={{ flex: 1, textAlign: 'left', fontSize: 12, padding: '5px 8px', borderRadius: 'var(--radius)', background: 'var(--bg3)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)' }}>{r.name}</button>
                  <button onClick={() => deleteReport(r.id)} style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Fields */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Columns</div>
            {FIELDS.map(f => (
              <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={selectedFields.includes(f.id)} onChange={() => toggleField(f.id)} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                {f.label}
              </label>
            ))}
          </div>

          {/* Filters */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Filters</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Status</div>
                <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', fontSize: 12 }}>
                  <option value="">All</option>
                  {['Available', 'Checked Out', 'Maintenance', 'Retired'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Category</div>
                <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', fontSize: 12 }}>
                  <option value="">All</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Assigned to</div>
                <input value={filters.assigned_to} onChange={e => setFilters(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Name…" style={{ width: '100%', fontSize: 12 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>Site</div>
                <input value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} placeholder="Location…" style={{ width: '100%', fontSize: 12 }} />
              </div>
            </div>
          </div>

          {/* Sort */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Sort</div>
            <select value={sortField} onChange={e => setSortField(e.target.value)} style={{ width: '100%', fontSize: 12, marginBottom: 6 }}>
              {FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              {['asc', 'desc'].map(d => (
                <button key={d} onClick={() => setSortDir(d)} style={{ flex: 1, padding: '4px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid', borderColor: sortDir === d ? 'var(--accent)' : 'var(--border2)', background: sortDir === d ? 'var(--accent-bg)' : 'var(--bg3)', color: sortDir === d ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  {d === 'asc' ? '▲ Ascending' : '▼ Descending'}
                </button>
              ))}
            </div>
          </div>

          <Btn variant="primary" onClick={runReport} style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}>▶ Run report</Btn>
        </div>

        {/* Right panel - results */}
        <div>
          {/* Actions bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            {assets.length > 0 && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{assets.length} results</span>}
            {assets.length > 0 && <Btn size="sm" onClick={exportCSV}>⬇ Export CSV</Btn>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <input value={reportName} onChange={e => setReportName(e.target.value)} placeholder="Report name…" style={{ width: 160, fontSize: 12 }} />
              <Btn size="sm" onClick={saveReport} disabled={!reportName.trim()}>💾 Save</Btn>
            </div>
          </div>

          {loading ? <Spinner /> : assets.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '3rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Configure your columns and filters, then click Run report
            </div>
          ) : (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg3)' }}>
                  {selectedFields.map(f => {
                    const field = FIELDS.find(x => x.id === f)
                    return (
                      <th key={f} onClick={() => { setSortField(f); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }} style={thStyle}>
                        {field?.label || f} {sortField === f ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                    )
                  })}
                </tr></thead>
                <tbody>
                  {assets.map((a, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      {selectedFields.map(f => (
                        <td key={f} style={{ ...tdStyle, fontFamily: f === 'asset_tag' || f === 'serial_number' ? 'var(--mono)' : 'inherit', color: f === 'asset_tag' ? 'var(--accent)' : 'var(--text)' }}>
                          {f === 'purchase_cost' && a[f] ? `$${parseFloat(a[f]).toFixed(2)}` :
                           f.includes('date') && a[f] ? new Date(a[f]).toLocaleDateString() :
                           a[f] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
