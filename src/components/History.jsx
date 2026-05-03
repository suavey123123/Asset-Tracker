import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { EmptyState, Spinner } from './UI'

const TYPE_STYLES = {
  checkout:    { color: 'var(--blue)',   label: 'OUT' },
  checkin:     { color: 'var(--green)',  label: 'IN' },
  maintenance: { color: 'var(--amber)',  label: 'MNT' },
  created:     { color: 'var(--accent)', label: 'NEW' },
  updated:     { color: 'var(--text2)',  label: 'UPD' },
  deleted:     { color: 'var(--red)',    label: 'DEL' },
  note:        { color: 'var(--text3)',  label: 'NOTE' },
}

export default function History() {
  const [log, setLog] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAsset, setFilterAsset] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: l }, { data: a }] = await Promise.all([
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('assets').select('id, asset_tag, name').order('name'),
    ])
    setLog(l || [])
    setAssets(a || [])
    setLoading(false)
  }

  const filtered = filterAsset ? log.filter(e => e.asset_id === filterAsset) : log

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>Activity history</h2>
        <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)} style={{ width: 220 }}>
          <option value="">All assets</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         filtered.length === 0 ? <EmptyState message="No activity recorded yet." /> : (
          <div>
            {filtered.map((e, i) => {
              const ts = TYPE_STYLES[e.type] || TYPE_STYLES.note
              return (
                <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, color: ts.color, background: ts.color + '18', padding: '2px 6px', borderRadius: 3, marginTop: 1, flexShrink: 0 }}>{ts.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{e.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {e.asset_name && <span style={{ color: 'var(--text2)', marginRight: 8 }}>{e.asset_name}</span>}
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
