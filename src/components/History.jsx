import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { EmptyState, Spinner, Btn } from './UI'

const TYPE_STYLES = {
  checkout:    { color: 'var(--blue)',   label: 'OUT' },
  checkin:     { color: 'var(--green)',  label: 'IN' },
  maintenance: { color: 'var(--amber)',  label: 'MNT' },
  created:     { color: 'var(--accent)', label: 'NEW' },
  updated:     { color: 'var(--text2)',  label: 'UPD' },
  deleted:     { color: 'var(--red)',    label: 'DEL' },
  note:        { color: 'var(--text3)',  label: 'NOTE' },
}

export default function History({ onViewAsset }) {
  const [fetchError, setFetchError] = useState('')
  const [log, setLog] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAsset, setFilterAsset] = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: l }, { data: a }] = await Promise.all([
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('assets').select('id, asset_tag, name').order('name'),
    ])
    setLog(l || [])
    setAssets(a || [])
    setLoading(false)
  }

  function exportCSV() {
    const headers = ['date', 'type', 'asset_name', 'asset_tag', 'message', 'performed_by']
    const rows = filtered.map(e => [
      new Date(e.created_at).toLocaleString(),
      e.type, e.asset_name || '', e.asset_tag || '',
      `"${(e.message || '').replace(/"/g, '""')}"`,
      e.performed_by || ''
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = `activity-log-${new Date().toISOString().slice(0,10)}.csv`; el.click()
    URL.revokeObjectURL(url)
  }

  const filtered = log.filter(e => {
    if (filterAsset && e.asset_id !== filterAsset) return false
    if (filterType && e.type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${e.message} ${e.asset_name} ${e.performed_by}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity…" style={{ width: 180 }} />
        <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)} style={{ width: 200 }}>
          <option value="">All assets</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 140 }}>
          <option value="">All types</option>
          <option value="checkout">Check out</option>
          <option value="checkin">Check in</option>
          <option value="maintenance">Maintenance</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
        </select>
        <div style={{ flex: 1 }} />
        <Btn size="sm" onClick={exportCSV} disabled={filtered.length === 0}>⬇ Export CSV ({filtered.length})</Btn>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         filtered.length === 0 ? <EmptyState message="No activity recorded yet." /> : (
          <div>
            {filtered.map((e, i) => {
              const ts = TYPE_STYLES[e.type] || TYPE_STYLES.note
              const asset = assets.find(a => a.id === e.asset_id)
              return (
                <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, color: ts.color, background: ts.color + '18', padding: '2px 6px', borderRadius: 3, flexShrink: 0, marginTop: 2 }}>{ts.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{e.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {e.asset_name && (
                        <button onClick={() => asset && onViewAsset?.(asset)} style={{ color: 'var(--text2)', background: 'none', border: 'none', cursor: asset ? 'pointer' : 'default', fontFamily: 'var(--font)', fontSize: 11, padding: 0, marginRight: 8 }}>
                          {e.asset_name}
                        </button>
                      )}
                      {e.performed_by && <span style={{ marginRight: 8 }}>by {e.performed_by}</span>}
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
