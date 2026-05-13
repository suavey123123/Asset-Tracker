import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, Spinner } from './UI'
import AssetPhotos from './AssetPhotos'
import AssetComments from './AssetComments'
import HelpdeskIntegration from './HelpdeskIntegration'
import CustomFields from './CustomFields'
import AssetLicenses from './AssetLicenses'
import AssetTags from './AssetTags'

const TABS = ['Overview','Labels','Licenses','Photos','Custom Fields','Comments','Maintenance','Activity']

function calcDepreciation(cost, purchase_date, useful_life_years = 3) {
  if (!cost || !purchase_date) return null
  const c = parseFloat(cost)
  if (isNaN(c) || c <= 0) return null
  const ageYears = (Date.now() - new Date(purchase_date)) / (1000*60*60*24*365)
  const depreciatedPct = Math.min(ageYears / useful_life_years, 1)
  const currentValue = Math.max(c * (1 - depreciatedPct), 0)
  const annualDep = c / useful_life_years
  return { original: c, current: currentValue, annual: annualDep, ageYears, pct: depreciatedPct * 100 }
}

export default function AssetDetail({ assetId, onBack, onEdit }) {
  const { isAdmin, isAdminOrManager, canReadFinancials } = useAuth()
  const [asset, setAsset] = useState(null)
  const [log, setLog] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [quickNote, setQuickNote] = useState('')
  const quickNoteRef = useRef('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const qrRef = useRef(null)

  useEffect(() => { fetchAll() }, [assetId])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: l }, { data: m }] = await Promise.all([
      supabase.from('assets').select('*').limit(500).eq('id', assetId).single(),
      supabase.from('activity_log').select('*').eq('asset_id', assetId).order('created_at', { ascending: false }),
      supabase.from('maintenance_records').select('*').eq('asset_id', assetId).order('performed_date', { ascending: false }),
    ])
    setAsset(a); setLog(l || []); setMaintenance(m || [])
    setQuickNote(a?.quick_note || '')
    quickNoteRef.current = a?.quick_note || ''
    setLoading(false)
  }

  useEffect(() => {
    if (!asset || !qrRef.current || activeTab !== 'Overview') return
    qrRef.current.innerHTML = ''
    const url = window.location.href
    const loadQR = () => {
      if (window.QRCode && qrRef.current) {
        try { new window.QRCode(qrRef.current, { text: url, width: 110, height: 110, colorDark: '#e8e8e8', colorLight: '#161616' }) } catch(e) {}
      }
    }
    if (window.QRCode) { loadQR(); return }
    const existing = document.getElementById('qrcode-script')
    if (existing) { existing.onload = loadQR; return }
    const script = document.createElement('script')
    script.id = 'qrcode-script'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    script.onload = loadQR
    document.head.appendChild(script)
  }, [asset, activeTab])

  async function saveNote() {
    setNoteSaving(true)
    await supabase.from('assets').update({ quick_note: quickNoteRef.current }).eq('id', assetId)
    setNoteSaving(false); setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  function printQR() {
    const tag = asset.asset_tag || ''
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/#asset=' + tag)}`
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Asset Label - ${tag}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 30px; background: #fff; color: #000 }
  .label { border: 2px solid #000; border-radius: 8px; padding: 20px 24px; text-align: center; width: 280px }
  img { display: block; margin: 0 auto 12px }
  .tag { font-family: monospace; font-size: 16px; font-weight: 700; margin-bottom: 4px }
  .model { font-size: 13px; color: #333; margin-bottom: 4px }
  .site { font-size: 11px; color: #666 }
  .print-btn { margin-bottom: 20px; padding: 8px 20px; font-size: 13px; cursor: pointer; background: #d4ff4e; border: none; border-radius: 4px; font-weight: 600 }
  @media print { .print-btn { display: none } }
</style></head>
<body>
<button class="print-btn" onclick="window.print()">Print label</button>
<div class="label">
  <img src="${qrUrl}" width="180" height="180" />
  <div class="tag">${tag}</div>
  <div class="model">${asset.model || asset.category || ''}</div>
  ${asset.location ? `<div class="site">${asset.location}</div>` : ''}
</div>
</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) alert('Please allow popups to print.')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const isPhone = asset?.category?.toUpperCase() === 'PHONE'

  if (loading) return <div style={{ padding:'3rem' }}><Spinner /></div>
  if (!asset) return <div style={{ color:'var(--text2)' }}>Asset not found.</div>

  const today = new Date()
  const warrantyExpired = asset.warranty_expiry && new Date(asset.warranty_expiry) < today
  const warrantyExpiringSoon = asset.warranty_expiry && new Date(asset.warranty_expiry) > today && new Date(asset.warranty_expiry) < new Date(today.getTime() + 30*86400000)
  const isOverdue = asset.status === 'Checked Out' && asset.expected_return && new Date(asset.expected_return) < today

  const TYPE_STYLES = {
    checkout:{ color:'var(--blue)', label:'OUT' }, checkin:{ color:'var(--green)', label:'IN' },
    maintenance:{ color:'var(--amber)', label:'MNT' }, created:{ color:'var(--accent)', label:'NEW' },
    updated:{ color:'var(--text2)', label:'UPD' }, note:{ color:'var(--text3)', label:'NOTE' },
  }

  const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem' }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1rem' }}>
        <Btn onClick={onBack} size="sm">← Back</Btn>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:500 }}>{asset.model || asset.asset_tag}</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
            <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)' }}>{asset.asset_tag}</span>
            <Badge status={asset.category} /><Badge status={asset.status} />
          </div>
        </div>
        {isAdminOrManager && <Btn size="sm" variant="primary" onClick={() => onEdit(asset)}>Edit asset</Btn>}
      </div>

      {/* Alerts */}
      {isOverdue && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--red)', marginBottom:10 }}>⚠ Overdue — expected return was {new Date(asset.expected_return).toLocaleDateString()}</div>}
      {warrantyExpired && <div style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--text2)', marginBottom:10 }}>Warranty expired {new Date(asset.warranty_expiry).toLocaleDateString()}</div>}
      {warrantyExpiringSoon && <div style={{ background:'var(--amber-bg)', border:'1px solid var(--amber)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--amber)', marginBottom:10 }}>⏱ Warranty expires {new Date(asset.warranty_expiry).toLocaleDateString()}</div>}

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, background:'var(--bg2)', padding:4, borderRadius:'var(--radius)', border:'1px solid var(--border)', marginBottom:'1rem', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding:'5px 12px', fontSize:12, borderRadius:'var(--radius)',
            background: activeTab===t ? 'var(--bg4)' : 'transparent',
            color: activeTab===t ? 'var(--text)' : 'var(--text2)',
            border: activeTab===t ? '1px solid var(--border2)' : '1px solid transparent',
            cursor:'pointer', fontFamily:'var(--font)',
          }}>{t}{t==='Maintenance'?` (${maintenance.length})`:t==='Activity'?` (${log.length})`:''}</button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab==='Overview' && (
        <div className="fade-in" style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:'1rem' }}>
          <div style={card}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
              {[
                ['Assigned to', asset.assigned_to || (asset.assigned_to_team ? asset.assigned_to_team + ' (team)' : null)],
                ['Location / Site', asset.location],
                ['Serial number', asset.serial_number],
                ['Purchase date', asset.purchase_date ? (() => { try { return new Date(asset.purchase_date).toLocaleDateString() } catch { return asset.purchase_date } })() : null],
                ['Provision date', asset.provision_date ? (() => { try { return new Date(asset.provision_date).toLocaleDateString() } catch { return asset.provision_date } })() : null],
                ['Purchase cost', asset.purchase_cost ? '$'+parseFloat(asset.purchase_cost).toFixed(2) : null],
                ['Warranty expiry', asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : null],
                ['Expected return', asset.expected_return ? new Date(asset.expected_return).toLocaleDateString() : null],
              ].map(([label, value]) => value ? (
                <div key={label}>
                  <div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13 }}>{value}</div>
                </div>
              ) : null)}
            </div>
            {asset.specs && Object.keys(asset.specs).filter(k=>asset.specs[k]).length > 0 && (
              <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:8, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>Tech specs</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 24px' }}>
                  {Object.entries(asset.specs).filter(([k,v])=>v).map(([k,v])=>(
                    <div key={k}>
                      <div style={{ fontSize:11, color:'var(--text2)', marginBottom:2, fontFamily:'var(--mono)' }}>{k}</div>
                      <div style={{ fontSize:13 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(asset.locked_status || asset.carrier || asset.imei) && (
              <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:8, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>Phone details</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 24px' }}>
                  {asset.locked_status && <div>
                    <div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>Lock status</div>
                    <div style={{ fontSize:13 }}>{asset.locked_status}</div>
                  </div>}
                  {asset.carrier && <div>
                    <div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>Carrier / Provider</div>
                    <div style={{ fontSize:13 }}>{asset.carrier}</div>
                  </div>}
                  {asset.imei && <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>IMEI</div>
                    <div style={{ fontSize:13, fontFamily:'var(--mono)' }}>{asset.imei}</div>
                  </div>}
                </div>
              </div>
            )}
            {asset.notes && <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>Notes</div>
              <div style={{ fontSize:13, color:'var(--text2)' }}>{asset.notes}</div>
            </div>}
          </div>
          <div style={{ ...card, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>QR Code</div>
            <div ref={qrRef} style={{ borderRadius:6, overflow:'hidden' }} />
            <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', fontFamily:'var(--mono)' }}>{asset.asset_tag}</div>
            <Btn size="sm" onClick={printQR} style={{ width:'100%', justifyContent:'center' }}>🖨 Print label</Btn>
          </div>
        </div>
      )}

      {activeTab==='Overview' && (
        <div style={{ ...card, marginTop:'1rem', background:'rgba(212,255,78,0.04)', border:'1px solid rgba(212,255,78,0.2)' }} className="fade-in">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:500, color:'var(--accent)' }}>📝 Quick note</span>
            {noteSaved && <span style={{ fontSize:11, color:'var(--green)' }}>✓ Saved</span>}
          </div>
          <textarea value={quickNote} onChange={e => { setQuickNote(e.target.value); quickNoteRef.current = e.target.value }}
            onBlur={saveNote}
            placeholder="Add a quick note about this asset — visible immediately, no save button needed…"
            style={{ width:'100%', minHeight:70, resize:'vertical', fontSize:13, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontFamily:'var(--font)', lineHeight:1.5 }}
          />
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>Auto-saves when you click away</div>
        </div>
      )}
      {activeTab==='Labels' && <div style={card} className="fade-in"><AssetTags assetId={assetId} /></div>}
      {activeTab==='Licenses' && <div style={card} className="fade-in"><AssetLicenses assetId={assetId} /></div>}
      {activeTab==='Photos' && <div style={card} className="fade-in"><AssetPhotos assetId={assetId} assetTag={asset.asset_tag} /></div>}
      {activeTab==='Custom Fields' && <div style={card} className="fade-in"><CustomFields assetId={assetId} category={asset.category} /></div>}
      {activeTab==='Comments' && <div style={card} className="fade-in"><AssetComments assetId={assetId} /></div>}

      {activeTab==='Maintenance' && (
        <div style={card} className="fade-in">
          {maintenance.length===0 ? <div style={{ fontSize:13, color:'var(--text3)' }}>No maintenance records.</div> : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr>{['Type','Date','Performed by','Cost','Notes'].map(h=><th key={h} style={{ textAlign:'left', padding:'6px 0', fontSize:11, color:'var(--text2)', fontWeight:500, borderBottom:'1px solid var(--border)' }}>{h}</th>)}</tr></thead>
              <tbody>{maintenance.map(m=>(
                <tr key={m.id}>
                  <td style={{ padding:'8px 0', borderBottom:'1px solid var(--border)' }}>{m.maintenance_type}</td>
                  <td style={{ padding:'8px 0', borderBottom:'1px solid var(--border)', color:'var(--text2)' }}>{m.performed_date?new Date(m.performed_date).toLocaleDateString():'—'}</td>
                  <td style={{ padding:'8px 0', borderBottom:'1px solid var(--border)', color:'var(--text2)' }}>{m.performed_by||'—'}</td>
                  <td style={{ padding:'8px 0', borderBottom:'1px solid var(--border)' }}>{m.cost?'$'+parseFloat(m.cost).toFixed(2):'—'}</td>
                  <td style={{ padding:'8px 0', borderBottom:'1px solid var(--border)', color:'var(--text2)', maxWidth:200 }}>{m.notes||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {activeTab==='Activity' && (
        <div style={card} className="fade-in">
          <div style={{ fontSize:13, fontWeight:500, marginBottom:'1rem', color:'var(--text2)' }}>Asset history timeline</div>
          {log.length===0 ? <div style={{ fontSize:13, color:'var(--text3)' }}>No activity yet.</div> : (
            <div style={{ position:'relative', paddingLeft:28 }}>
              {/* Vertical line */}
              <div style={{ position:'absolute', left:10, top:8, bottom:8, width:2, background:'var(--border)' }} />
              {[...log].reverse().map((e,i) => {
                const ts = TYPE_STYLES[e.type]||TYPE_STYLES.note
                const icons = { checkout:'📤', checkin:'📥', maintenance:'🔧', created:'✨', updated:'✏️', note:'📝', transfer:'⇄' }
                return (
                  <div key={e.id} style={{ position:'relative', marginBottom: i < log.length-1 ? 20 : 0 }}>
                    {/* Dot */}
                    <div style={{ position:'absolute', left:-23, top:2, width:16, height:16, borderRadius:'50%', background:ts.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, border:'2px solid var(--bg2)' }}>
                      <span style={{ fontSize:8 }}>{icons[e.type]||'•'}</span>
                    </div>
                    {/* Content */}
                    <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:10, fontWeight:600, color:ts.color, background:ts.color+'18', padding:'1px 6px', borderRadius:3, textTransform:'uppercase', letterSpacing:'0.05em' }}>{ts.label}</span>
                        <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto' }}>{new Date(e.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize:13, color:'var(--text)' }}>{e.message}</div>
                      {e.performed_by && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>by {e.performed_by}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
