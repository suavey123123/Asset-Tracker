import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Spinner, Badge } from './UI'

export default function Offboarding() {
  const { profile } = useAuth()
  const [saveError, setSaveError] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [employees, setEmployees] = useState([])
  const [selected, setSelected] = useState(null)
  const [assets, setAssets] = useState([])
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchEmployees() }, [])

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('*').order('name')
    setEmployees(data || [])
  }

  async function selectEmployee(emp) {
    setSelected(emp); setDone(false); setLoading(true)
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from('assets').select('*').limit(500).eq('assigned_to', emp.name).eq('status', 'Checked Out'),
      supabase.from('asset_license_assignments').select('*, license:license_id(id, name, seats_used), asset:asset_id(name, asset_tag)').eq('assigned_to', emp.name),
    ])
    setAssets(a || [])
    setLicenses(l || [])
    setLoading(false)
  }

  async function offboard() {
    if (!selected) return
    if (!confirm(`Offboard ${selected.name}? This will check in all their assets and free their licenses.`)) return
    setProcessing(true)

    // Check in all assets
    for (const asset of assets) {
      await supabase.from('assets').update({ status: 'Available', assigned_to: null, assigned_to_team: 'Storage', expected_return: null, location: asset.location, site_id: asset.site_id }).eq('id', asset.id)
      await supabase.from('activity_log').insert({
        asset_id: asset.id, asset_tag: asset.asset_tag, asset_name: asset.name,
        type: 'checkin', message: `Checked in during offboarding of ${selected.name}`,
        performed_by: profile?.email,
      })
    }

    // Free licenses
    for (const l of licenses) {
      await supabase.from('asset_license_assignments').delete().eq('id', l.id)
      if (l.license) {
        await supabase.rpc('decrement_license_seats', { license_id: l.license.id })
      }
    }

    // Log to activity
    await supabase.from('activity_log').insert({
      asset_id: null, asset_tag: null, asset_name: null,
      type: 'note', message: `Employee offboarded: ${selected.name} — ${assets.length} asset(s) returned, ${licenses.length} license(s) freed`,
      performed_by: profile?.email,
    })
    await supabase.from('employees').delete().eq('id', selected.id)

    setProcessing(false); setDone(true)
    setAssets([]); setLicenses([])
    fetchEmployees()
  }

  const filteredEmps = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
        {/* Employee list */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Select employee</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…" style={{ marginBottom: 10 }} />
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxHeight: 500, overflowY: 'auto' }}>
            {filteredEmps.map(emp => (
              <div key={emp.id} onClick={() => selectEmployee(emp)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selected?.id === emp.id ? 'var(--accent-bg)' : 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (selected?.id !== emp.id) e.currentTarget.style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (selected?.id !== emp.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: selected?.id === emp.id ? 'var(--accent)' : 'var(--text)' }}>{emp.name}</div>
                {emp.title && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{emp.title}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Offboarding panel */}
        <div>
          {!selected && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '3rem', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 14 }}>Select an employee to begin offboarding</div>
            </div>
          )}

          {selected && loading && <div style={{ padding: '3rem' }}><Spinner /></div>}

          {selected && !loading && !done && (
            <div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{[selected.title, selected.department].filter(Boolean).join(' · ')}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Assets to check in ({assets.length})</div>
                  {assets.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>No checked-out assets</div> :
                    assets.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{a.model || a.asset_tag}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{a.asset_tag}</div>
                        </div>
                        <Badge status={a.status} />
                      </div>
                    ))
                  }
                </div>

                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Licenses to free ({licenses.length})</div>
                  {licenses.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>No licenses assigned</div> :
                    licenses.map(l => (
                      <div key={l.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{l.license?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{l.asset?.asset_tag}</div>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '1rem', fontSize: 13, color: 'var(--red)' }}>
                ⚠ This will check in {assets.length} asset{assets.length !== 1 ? 's' : ''} and free {licenses.length} license seat{licenses.length !== 1 ? 's' : ''}. This cannot be undone.
              </div>

              <Btn variant="danger" onClick={offboard} disabled={processing} style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px' }}>
                {processing ? 'Processing…' : `🚪 Offboard ${selected.name}`}
              </Btn>
            </div>
          )}

          {done && (
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--green)', marginBottom: 6 }}>Offboarding complete</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.5rem' }}>All assets checked in and licenses freed for {selected.name}.</div>
              <Btn onClick={() => { setSelected(null); setDone(false) }}>Offboard another employee</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


