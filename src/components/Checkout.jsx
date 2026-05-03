import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, EmptyState, Spinner, ViewOnlyBanner } from './UI'

export default function Checkout() {
  const { isAdmin, profile } = useAuth()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [coAsset, setCoAsset] = useState('')
  const [coPerson, setCoPerson] = useState('')
  const [coDate, setCoDate] = useState('')
  const [coNotes, setCoNotes] = useState('')
  const [ciAsset, setCiAsset] = useState('')
  const [ciCondition, setCiCondition] = useState('Good')
  const [ciNotes, setCiNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    setLoading(true)
    const { data } = await supabase.from('assets').select('*').order('name')
    setAssets(data || [])
    setLoading(false)
  }

  const available = assets.filter(a => a.status === 'Available')
  const checkedOut = assets.filter(a => a.status === 'Checked Out')

  async function doCheckout() {
    if (!coAsset || !coPerson.trim()) { setMsg('Select an asset and enter a name.'); return }
    setSaving(true)
    const asset = assets.find(a => a.id === coAsset)
    await supabase.from('assets').update({ status: 'Checked Out', assigned_to: coPerson, expected_return: coDate || null }).eq('id', coAsset)
    await supabase.from('activity_log').insert({ asset_id: coAsset, asset_tag: asset.asset_tag, asset_name: asset.name, type: 'checkout', message: `Checked out to ${coPerson}${coNotes ? ' — ' + coNotes : ''}`, performed_by: profile?.email })
    setCoPerson(''); setCoDate(''); setCoNotes(''); setCoAsset('')
    setSaving(false)
    setMsg(`✓ ${asset.name} checked out to ${coPerson}`)
    fetchAssets()
    setTimeout(() => setMsg(''), 4000)
  }

  async function doCheckin() {
    if (!ciAsset) { setMsg('Select an asset to check in.'); return }
    setSaving(true)
    const asset = assets.find(a => a.id === ciAsset)
    const newStatus = ciCondition === 'Needs maintenance' ? 'Maintenance' : 'Available'
    await supabase.from('assets').update({ status: newStatus, assigned_to: null, expected_return: null }).eq('id', ciAsset)
    await supabase.from('activity_log').insert({ asset_id: ciAsset, asset_tag: asset.asset_tag, asset_name: asset.name, type: 'checkin', message: `Checked in from ${asset.assigned_to || 'unknown'} — condition: ${ciCondition}${ciNotes ? ' — ' + ciNotes : ''}`, performed_by: profile?.email })
    setCiNotes(''); setCiAsset(''); setCiCondition('Good')
    setSaving(false)
    setMsg(`✓ ${asset.name} checked in (${newStatus})`)
    fetchAssets()
    setTimeout(() => setMsg(''), 4000)
  }

  const sel = { width: '100%', fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text)' }

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}
      {msg && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 12, color: 'var(--green)', marginBottom: '1rem' }}>{msg}</div>}

      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Check Out */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: '1rem' }}>Check out asset</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Asset</label>
                <select style={sel} value={coAsset} onChange={e => setCoAsset(e.target.value)}>
                  <option value="">{available.length ? 'Select asset…' : 'No available assets'}</option>
                  {available.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Assigned to</label>
                <input value={coPerson} onChange={e => setCoPerson(e.target.value)} placeholder="Employee name" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Expected return</label>
                <input type="date" value={coDate} onChange={e => setCoDate(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={coNotes} onChange={e => setCoNotes(e.target.value)} rows={2} placeholder="Optional…" />
              </div>
              <Btn variant="primary" onClick={doCheckout} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>Check out</Btn>
            </div>
          </div>

          {/* Check In */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: '1rem' }}>Check in asset</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Asset</label>
                <select style={sel} value={ciAsset} onChange={e => setCiAsset(e.target.value)}>
                  <option value="">{checkedOut.length ? 'Select asset…' : 'No assets checked out'}</option>
                  {checkedOut.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name} ({a.assigned_to})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Condition on return</label>
                <select style={sel} value={ciCondition} onChange={e => setCiCondition(e.target.value)}>
                  <option>Good</option>
                  <option>Needs maintenance</option>
                  <option>Damaged</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={ciNotes} onChange={e => setCiNotes(e.target.value)} rows={2} placeholder="Optional…" />
              </div>
              <Btn variant="primary" onClick={doCheckin} disabled={saving} style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>Check in</Btn>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: '0.75rem' }}>Currently checked out</h2>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         checkedOut.length === 0 ? <EmptyState message="No assets currently checked out." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Asset', 'Assigned To', 'Expected Return', isAdmin ? 'Quick Return' : ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checkedOut.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{a.asset_tag}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{a.assigned_to || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: a.expected_return && new Date(a.expected_return) < new Date() ? 'var(--red)' : 'var(--text)' }}>
                    {a.expected_return ? new Date(a.expected_return).toLocaleDateString() : '—'}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '10px 14px' }}>
                      <Btn size="sm" onClick={async () => {
                        await supabase.from('assets').update({ status: 'Available', assigned_to: null, expected_return: null }).eq('id', a.id)
                        await supabase.from('activity_log').insert({ asset_id: a.id, asset_tag: a.asset_tag, asset_name: a.name, type: 'checkin', message: `Quick check-in from ${a.assigned_to || 'unknown'}`, performed_by: profile?.email })
                        fetchAssets()
                      }}>Return</Btn>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
