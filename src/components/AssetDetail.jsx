import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, Spinner } from './UI'
import AssetPhotos from './AssetPhotos'
import AssetComments from './AssetComments'
import CustomFields from './CustomFields'
import AssetLicenses from './AssetLicenses'
import AssetTags from './AssetTags'

const TABS = ['Overview','Labels','Licenses','Photos','Custom Fields','Comments','Maintenance','Activity']

export default function AssetDetail({ assetId, onBack, onEdit }) {
  const { isAdmin } = useAuth()
  const [asset, setAsset] = useState(null)
  const [log, setLog] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [quickNote, setQuickNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const qrRef = useRef(null)

  useEffect(() => { fetchAll() }, [assetId])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: l }, { data: m }] = await Promise.all([
      supabase.from('assets').select('*').eq('id', assetId).single(),
      supabase.from('activity_log').select('*').eq('asset_id', assetId).order('created_at', { ascending: false }),
      supabase.from('maintenance_records').select('*').eq('asset_id', assetId).order('performed_date', { ascending: false }),
    ])
    setAsset(a); setLog(l || []); setMaintenance(m || [])
    setQuickNote(a?.quick_note || '')
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
    await supabase.from('assets').update({ quick_note: quickNote }).eq('id', assetId)
    setNoteSaving(false); setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  function printQR() {
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>Asset Label - ${asset.asset_tag}</title>
    <style>body{font-family:monospace;text-align:center;padding:20px}@media print{button{display:none}}</style>
    </head><body>
    <button onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;cursor:pointer">Print</button>
    <h2>${asset.model || asset.asset_tag}</h2><p>${asset.asset_tag}</p>
    ${qrRef.current?.innerHTML || ''}
    <p style="margin-top:8px;font-size:10px">${asset.location||''}</p>
    </body></html>`)
    win.document.close()
  }

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
        {isAdmin && <Btn size="sm" variant="primary" onClick={() => onEdit(asset)}>Edit asset</Btn>}
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
                ['Assigned to', asset.assigned_to],
                ['Location / Site', asset.location],
                ['Model', asset.model],
                ['Serial number', asset.serial_number],
                ['Purchase date', asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : null],
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
          <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)}
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
          {log.length===0 ? <div style={{ fontSize:13, color:'var(--text3)' }}>No activity yet.</div> :
           log.map((e,i) => {
             const ts = TYPE_STYLES[e.type]||TYPE_STYLES.note
             return (
               <div key={e.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:i<log.length-1?'1px solid var(--border)':'none' }}>
                 <span style={{ fontFamily:'var(--mono)', fontSize:10, fontWeight:500, color:ts.color, background:ts.color+'18', padding:'2px 5px', borderRadius:3, flexShrink:0, marginTop:1 }}>{ts.label}</span>
                 <div>
                   <div style={{ fontSize:13 }}>{e.message}</div>
                   <div style={{ fontSize:11, color:'var(--text3)' }}>{e.performed_by?`by ${e.performed_by} · `:''}{new Date(e.created_at).toLocaleString()}</div>
                 </div>
               </div>
             )
           })}
        </div>
      )}
    </div>
  )
}
