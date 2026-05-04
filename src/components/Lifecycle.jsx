import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, Spinner, EmptyState } from './UI'

const STAGES = [
  { id: 'Ordered',     icon: '📦', color: 'var(--purple)', desc: 'Purchase order placed' },
  { id: 'Received',    icon: '✅', color: 'var(--accent)',  desc: 'Physically received and logged' },
  { id: 'Available',   icon: '🟢', color: 'var(--green)',   desc: 'Ready for use' },
  { id: 'Checked Out', icon: '🔵', color: 'var(--blue)',    desc: 'Assigned to an employee' },
  { id: 'Maintenance', icon: '🔧', color: 'var(--amber)',   desc: 'Under repair or service' },
  { id: 'Retired',     icon: '⚫', color: 'var(--text3)',   desc: 'End of life, decommissioned' },
]

const STAGE_ORDER = ['Ordered','Received','Available','Checked Out','Maintenance','Retired']

export default function Lifecycle({ onViewAsset }) {
  const { isAdmin, profile } = useAuth()
  const [assets, setAssets] = useState([])
  const [lifecycles, setLifecycles] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterStage, setFilterStage] = useState('')
  const [search, setSearch] = useState('')
  const [advancing, setAdvancing] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from('assets').select('*').order('created_at', { ascending: false }),
      supabase.from('asset_lifecycle').select('*').order('changed_at', { ascending: true }),
    ])
    setAssets(a || [])
    // Group lifecycle events by asset
    const grouped = {}
    ;(l || []).forEach(e => {
      if (!grouped[e.asset_id]) grouped[e.asset_id] = []
      grouped[e.asset_id].push(e)
    })
    setLifecycles(grouped)
    setLoading(false)
  }

  async function advanceStage(asset, newStage) {
    setAdvancing(asset.id)
    // Update asset status
    await supabase.from('assets').update({ status: newStage }).eq('id', asset.id)
    // Log lifecycle event
    await supabase.from('asset_lifecycle').insert({
      asset_id: asset.id,
      asset_tag: asset.asset_tag,
      asset_name: asset.name,
      stage: newStage,
      changed_by: profile?.email,
      notes: null,
    })
    // Activity log
    await supabase.from('activity_log').insert({
      asset_id: asset.id,
      asset_tag: asset.asset_tag,
      asset_name: asset.name,
      type: 'updated',
      message: `Lifecycle stage changed to ${newStage}`,
      performed_by: profile?.email,
    })
    setAdvancing(null)
    fetchAll()
  }

  function getNextStage(currentStage) {
    const idx = STAGE_ORDER.indexOf(currentStage)
    if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null
    return STAGE_ORDER[idx + 1]
  }

  function getStageInfo(stageId) {
    return STAGES.find(s => s.id === stageId) || STAGES[0]
  }

  function getFirstDate(assetId, stage) {
    const events = lifecycles[assetId] || []
    const e = events.find(e => e.stage === stage)
    return e ? new Date(e.changed_at).toLocaleDateString() : null
  }

  function getDaysInStage(asset) {
    const events = lifecycles[asset.id] || []
    const stageEvents = events.filter(e => e.stage === asset.status)
    if (!stageEvents.length) return null
    const last = stageEvents[stageEvents.length - 1]
    const days = Math.floor((new Date() - new Date(last.changed_at)) / 86400000)
    return days
  }

  const filtered = assets.filter(a => {
    if (filterStage && a.status !== filterStage) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${a.name} ${a.asset_tag} ${a.location}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Group by stage for kanban view
  const byStage = {}
  STAGE_ORDER.forEach(s => { byStage[s] = filtered.filter(a => a.status === s) })

  return (
    <div className="fade-in">
      {/* Stage overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: '1.5rem' }}>
        {STAGES.map(s => {
          const count = assets.filter(a => a.status === s.id).length
          return (
            <div
              key={s.id}
              onClick={() => setFilterStage(filterStage === s.id ? '' : s.id)}
              style={{
                background: filterStage === s.id ? s.color + '20' : 'var(--bg2)',
                border: `1px solid ${filterStage === s.id ? s.color : 'var(--border)'}`,
                borderRadius: 'var(--radius)', padding: '10px 12px',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{s.id}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: s.color, fontFamily: 'var(--mono)' }}>{count}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" style={{ width: 200 }} />
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ width: 160 }}>
          <option value="">All stages</option>
          {STAGE_ORDER.map(s => <option key={s}>{s}</option>)}
        </select>
        {filterStage && <Btn size="sm" onClick={() => setFilterStage('')}>Clear filter</Btn>}
      </div>

      {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
       filtered.length === 0 ? <EmptyState message="No assets found." /> : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Asset', 'Current Stage', 'Days in Stage', 'Ordered', 'Received', 'Available', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const stageInfo = getStageInfo(a.status)
                const nextStage = getNextStage(a.status)
                const days = getDaysInStage(a)
                const orderedDate = getFirstDate(a.id, 'Ordered')
                const receivedDate = getFirstDate(a.id, 'Received')
                const availableDate = getFirstDate(a.id, 'Available')

                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${stageInfo.color}` }}>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => onViewAsset && onViewAsset(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'var(--font)' }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{a.asset_tag}</div>
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{stageInfo.icon}</span>
                        <Badge status={a.status} />
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 13, color: days !== null ? (days > 90 ? 'var(--red)' : days > 30 ? 'var(--amber)' : 'var(--text)') : 'var(--text3)' }}>
                      {days !== null ? `${days}d` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{orderedDate || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{receivedDate || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{availableDate || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {isAdmin && nextStage && (
                        <Btn
                          size="sm"
                          variant="primary"
                          disabled={advancing === a.id}
                          onClick={() => advanceStage(a, nextStage)}
                        >
                          {advancing === a.id ? '…' : `→ ${nextStage}`}
                        </Btn>
                      )}
                      {a.status === 'Retired' && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>End of life</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
