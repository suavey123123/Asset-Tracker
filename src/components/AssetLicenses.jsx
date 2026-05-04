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
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)
  const [assetOwner, setAssetOwner] = useState('')

  useEffect(() => { fetchAll() }, [assetId])

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

  async function assignSelected() {
    if (!selected.length) return
    setSaving(true)
    for (const licId of selected) {
      const lic = allLicenses.find(l => l.id === licId)
      if (!lic) continue
      if (lic.seats_total && lic.seats_used >= lic.seats_total) continue
      await supabase.from('asset_license_assignments').insert({ asset_id: assetId, license_id: licId, assigned_to: assetOwner || null })
      await supabase.from('licenses').update({ seats_used: (lic.seats_used || 0) + 1 }).eq('id', licId)
    }
    setSelected([])
    setAdding(false)
    setSaving(false)
    fetchAll()
  }

  async function unassign(assignment) {
    if (!confirm(`Remove ${assignment.license?.name} from this asset?`)) return
    await supabase.from('asset_license_assignments').delete().eq('id', assignment.id)
    const lic = allLicenses.find(l => l.id === assignment.license_id)
    if (lic) await supabase.from('licenses').update({ seats_used: Math.max(0, (lic.seats_used || 1) - 1) }).eq('id', lic.id)
    fetchAll()
  }

  async function unassignAll() {
    if (!confirm(`Remove all ${assigned.length} licenses from this asset?`)) return
    for (const a of assigned) {
      await supabase.from('asset_license_assignments').delete().eq('id', a.id)
      const lic = allLicenses.find(l => l.id === a.license_id)
      if (lic) await supabase.from('licenses').update({ seats_used: Math.max(0, (lic.seats_used || 1) - 1) }).eq('id', lic.id)
    }
    fetchAll()
  }

  const assignedIds = assigned.map(a => a.license_id)
  const available = allLicenses.filter(l => !assignedIds.includes(l.id))
  const allAvailableSelected = available.filter(l => !(l.seats_total && l.seats_used >= l.seats_total))

  function toggleAll() {
    if (selected.length === allAvailableSelected.length) {
      setSelected([])
    } else {
      setSelected(allAvailableSelected.map(l => l.id))
    }
  }

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
        <div style={{ display: 'flex', gap: 6 }}>
          {isAdmin && assigned.length > 0 && !adding && (
            <Btn size="sm" variant="danger" onClick={unassignAll}>Remove all</Btn>
          )}
          {isAdmin && available.length > 0 && !adding && (
            <Btn size="sm" onClick={() => { setAdding(true); setSelected([]) }}>+ Assign licenses</Btn>
          )}
        </div>
      </div>

      {loading ? <Spinner size={16} /> : (
        <>
          {assigned.length === 0 && !adding && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>No licenses assigned to this asset.</div>
          )}

          {/* Assigned licenses list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: adding ? '1rem' : 0 }}>
            {assigned.map(a => {
              const lic = a.license
              if (!lic) return null
              const seatsLeft = lic.seats_total ? lic.seats_total - lic.seats_used : null
              const expired = lic.expiry_date && new Date(lic.expiry_date) < new Date()
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{lic.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                      {lic.vendor && <span>{lic.vendor}</span>}
                      {a.assigned_to && <span style={{ color: 'var(--blue)' }}>👤 {a.assigned_to}</span>}
                      {lic.seats_total && <span style={{ color: seatColor(lic) }}>{lic.seats_used}/{lic.seats_total} seats · {seatsLeft} left</span>}
                      {expired && <span style={{ color: 'var(--red)', fontWeight: 500 }}>EXPIRED</span>}
                      {lic.expiry_date && !expired && <span>Expires {new Date(lic.expiry_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {isAdmin && <Btn size="sm" variant="danger" onClick={() => unassign(a)}>Remove</Btn>}
                </div>
              )
            })}
          </div>

          {/* Multi-select picker */}
          {adding && isAdmin && (
            <div style={{ padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>Select licenses to assign:</div>
                <button onClick={toggleAll} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  {selected.length === allAvailableSelected.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {available.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>All licenses already assigned.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
                  {available.map(l => {
                    const seatsLeft = l.seats_total ? l.seats_total - (l.seats_used || 0) : null
                    const full = seatsLeft !== null && seatsLeft <= 0
                    const checked = selected.includes(l.id)
                    return (
                      <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: full ? 'not-allowed' : 'pointer', opacity: full ? 0.5 : 1, padding: '7px 10px', borderRadius: 'var(--radius)', background: checked ? 'var(--accent-bg)' : 'var(--bg2)', border: `1px solid ${checked ? 'var(--accent-border)' : 'var(--border)'}` }}>
                        <input type="checkbox" checked={checked} disabled={full}
                          onChange={e => setSelected(s => e.target.checked ? [...s, l.id] : s.filter(x => x !== l.id))}
                          style={{ width: 'auto', accentColor: 'var(--accent)', cursor: full ? 'not-allowed' : 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500 }}>{l.name}</span>
                          {l.vendor && <span style={{ color: 'var(--text2)', marginLeft: 8, fontSize: 12 }}>{l.vendor}</span>}
                        </div>
                        {seatsLeft !== null && (
                          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: full ? 'var(--red)' : seatsLeft <= 3 ? 'var(--amber)' : 'var(--green)', flexShrink: 0 }}>
                            {full ? 'No seats' : `${seatsLeft} left`}
                          </span>
                        )}
                        {l.expiry_date && new Date(l.expiry_date) < new Date() && (
                          <span style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'var(--mono)', flexShrink: 0 }}>EXPIRED</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Btn variant="primary" size="sm" onClick={assignSelected} disabled={saving || !selected.length}>
                  {saving ? 'Assigning…' : `Assign ${selected.length > 0 ? selected.length + ' ' : ''}license${selected.length !== 1 ? 's' : ''}`}
                </Btn>
                <Btn size="sm" onClick={() => { setAdding(false); setSelected([]) }}>Cancel</Btn>
                {selected.length > 0 && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{selected.length} selected</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
