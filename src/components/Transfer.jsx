import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, EmptyState, Spinner, ViewOnlyBanner } from './UI'

export default function Transfer({ onViewAsset }) {
  const { isAdmin, profile } = useAuth()
  const [assets, setAssets] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAsset, setSelectedAsset] = useState('')
  const [fromPerson, setFromPerson] = useState('')
  const [toPerson, setToPerson] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase.from('assets').select('*').eq('status', 'Checked Out').order('name'),
      supabase.from('asset_transfers').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setAssets(a || [])
    setTransfers(t || [])
    setLoading(false)
  }

  async function doTransfer() {
    if (!selectedAsset || !toPerson.trim()) { setMsg('Please select an asset and enter the recipient.'); return }
    setSaving(true)
    const asset = assets.find(a => a.id === selectedAsset)
    const from = fromPerson.trim() || asset?.assigned_to || 'Unknown'

    // Update asset assignment
    await supabase.from('assets').update({ assigned_to: toPerson.trim() }).eq('id', selectedAsset)

    // Log transfer record
    await supabase.from('asset_transfers').insert({
      asset_id: selectedAsset,
      asset_tag: asset.asset_tag,
      asset_name: asset.name,
      from_person: from,
      to_person: toPerson.trim(),
      reason: reason.trim() || null,
      transferred_by: profile?.email,
    })

    // Activity log
    await supabase.from('activity_log').insert({
      asset_id: selectedAsset,
      asset_tag: asset.asset_tag,
      asset_name: asset.name,
      type: 'checkout',
      message: `Transferred from ${from} to ${toPerson.trim()}${reason ? ' — ' + reason : ''}`,
      performed_by: profile?.email,
    })

    setSaving(false)
    setMsg(`✓ ${asset.name} transferred from ${from} to ${toPerson}`)
    setSelectedAsset(''); setFromPerson(''); setToPerson(''); setReason('')
    fetchAll()
    setTimeout(() => setMsg(''), 4000)
  }

  // Auto-fill from person when asset selected
  function handleAssetSelect(id) {
    setSelectedAsset(id)
    const asset = assets.find(a => a.id === id)
    if (asset?.assigned_to) setFromPerson(asset.assigned_to)
    else setFromPerson('')
  }

  const filteredTransfers = transfers.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${t.asset_name} ${t.asset_tag} ${t.from_person} ${t.to_person}`.toLowerCase().includes(q)
  })

  const sel = { width: '100%', fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text)', fontFamily: 'var(--font)' }

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      {isAdmin && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: '1rem' }}>Transfer asset between employees</h3>

          {msg && (
            <div style={{ background: msg.startsWith('✓') ? 'var(--green-bg)' : 'var(--red-bg)', border: `1px solid ${msg.startsWith('✓') ? 'var(--green)' : 'var(--red)'}`, borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)', marginBottom: '1rem' }}>
              {msg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Asset to transfer *</label>
              <select style={sel} value={selectedAsset} onChange={e => handleAssetSelect(e.target.value)}>
                <option value="">Select checked-out asset…</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name} ({a.assigned_to || 'unassigned'})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Transfer from</label>
              <input value={fromPerson} onChange={e => setFromPerson(e.target.value)} placeholder="Auto-filled from asset" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Transfer to *</label>
              <input value={toPerson} onChange={e => setToPerson(e.target.value)} placeholder="New employee name" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Reason</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Employee change, department move" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn variant="primary" onClick={doTransfer} disabled={saving || !selectedAsset || !toPerson.trim()}>
              {saving ? 'Transferring…' : '⇄ Transfer asset'}
            </Btn>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>Transfer history</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transfers…" style={{ width: 200 }} />
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         filteredTransfers.length === 0 ? <EmptyState message="No transfers recorded yet." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Asset', 'From', 'To', 'Reason', 'By', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{t.asset_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{t.asset_tag}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{t.from_person}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>{t.to_person}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{t.reason || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{t.transferred_by}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
