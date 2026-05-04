import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Spinner } from './UI'

export default function AssetLicenses({ assetId }) {
  const { isAdmin } = useAuth()
  const [assigned, setAssigned] = useState([])
  const [allLicenses, setAllLicenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedLic, setSelectedLic] = useState('')

  useEffect(() => { fetchAll() }, [assetId])

  const [assetOwner, setAssetOwner] = useState('')

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: l }, { data: asset }] = await Promise.all([
      supabase.from('asset_license_assignments').select('*, license:license_id(*)').eq('asset_id', assetId),
      supabase.from('licenses').select('*').order('name'),
      supabase.from('assets').select('assigned_to').eq('id', assetId).single(),
    ])
    setAssigned(a || [])
    setAllLicenses(l || [])
    setAssetOwner(asset?.assigned_to || '')
    setLoading(false)
  }

  async function assign() {
    if (!selectedLic) return
    const lic = allLicenses.find(l => l.id === selectedLic)
    // Check seats available
    if (lic.seats_total && lic.seats_used >= lic.seats_total) {
      alert(`No seats available for ${lic.name} (${lic.seats_used}/${lic.seats_total} used)`)
      return
    }
    // Add assignment with owner
    await supabase.from('asset_license_assignments').insert({ asset_id: assetId, license_id: selectedLic, assigned_to: assetOwner || null })
    // Increment seats_used
    await supabase.from('licenses').update({ seats_used: (lic.seats_used || 0) + 1 }).eq('id', selectedLic)
    setSelectedLic('')
    setAdding(false)
    fetchAll()
  }

  async function unassign(assignment) {
    if (!confirm(`Remove ${assignment.license?.name} from this asset?`)) return
    await supabase.from('asset_license_assignments').delete().eq('id', assignment.id)
    // Decrement seats_used
    const lic = allLicenses.find(l => l.id === assignment.license_id)
    if (lic) {
      await supabase.from('licenses').update({ seats_used: Math.max(0, (lic.seats_used || 1) - 1) }).eq('id', assignment.license_id)
    }
    fetchAll()
  }

  const assignedIds = assigned.map(a => a.license_id)
  const available = allLicenses.filter(l => !assignedIds.includes(l.id))

  function seatColor(lic) {
    if (!lic.seats_total) return 'var(--text2)'
    const pct = lic.seats_used / lic.seats_total
    if (pct >= 1) return 'var(--red)'
    if (pct >= 0.8) return 'var(--amber)'
    return 'var(--green)'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Software licenses ({assigned.length})</div>
        {isAdmin && !adding && available.length > 0 && (
          <Btn size="sm" onClick={() => setAdding(true)}>+ Assign license</Btn>
        )}
      </div>

      {loading ? <Spinner size={16} /> : (
        <>
          {assigned.length === 0 && !adding && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>No licenses assigned to this asset.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {assigned.map(a => {
              const lic = a.license
              if (!lic) return null
              const seatsLeft = lic.seats_total ? lic.seats_total - lic.seats_used : null
              const today = new Date()
              const expired = lic.expiry_date && new Date(lic.expiry_date) < today
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{lic.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 10, marginTop: 2 }}>
                      {lic.vendor && <span>{lic.vendor}</span>}
                      {lic.seats_total && (
                        <span style={{ color: seatColor(lic) }}>
                          {lic.seats_used}/{lic.seats_total} seats · {seatsLeft} left
                        </span>
                      )}
                      {expired && <span style={{ color: 'var(--red)', fontWeight: 500 }}>EXPIRED</span>}
                      {lic.expiry_date && !expired && <span>Expires {new Date(lic.expiry_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <Btn size="sm" variant="danger" onClick={() => unassign(a)}>Remove</Btn>
                  )}
                </div>
              )
            })}
          </div>

          {adding && isAdmin && (
            <div style={{ marginTop: 8, padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Select a license to assign:</div>
              <select value={selectedLic} onChange={e => setSelectedLic(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
                <option value="">Choose license…</option>
                {available.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.seats_total ? ` (${l.seats_total - l.seats_used} seats left)` : ''}{l.expiry_date && new Date(l.expiry_date) < new Date() ? ' — EXPIRED' : ''}
                  </option>
                ))}
              </select>
              {available.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>All licenses already assigned to this asset.</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn size="sm" variant="primary" onClick={assign} disabled={!selectedLic}>Assign</Btn>
                <Btn size="sm" onClick={() => { setAdding(false); setSelectedLic('') }}>Cancel</Btn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
