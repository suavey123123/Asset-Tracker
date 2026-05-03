import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, Spinner } from './UI'
import AssetPhotos from './AssetPhotos'
import AssetComments from './AssetComments'
import CustomFields from './CustomFields'

export default function AssetDetail({ assetId, onBack, onEdit }) {
  const { isAdmin } = useAuth()
  const [asset, setAsset] = useState(null)
  const [log, setLog] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading, setLoading] = useState(true)
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
    setLoading(false)
  }

  useEffect(() => {
    if (!asset || !qrRef.current) return
    qrRef.current.innerHTML = ''
    const url = window.location.href
    const existing = document.getElementById('qrcode-script')
    const loadQR = () => {
      if (window.QRCode && qrRef.current) {
        try { new window.QRCode(qrRef.current, { text: url, width: 110, height: 110, colorDark: '#e8e8e8', colorLight: '#161616' }) } catch(e) {}
      }
    }
    if (window.QRCode) { loadQR(); return }
    if (existing) { existing.onload = loadQR; return }
    const script = document.createElement('script')
    script.id = 'qrcode-script'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    script.onload = loadQR
    document.head.appendChild(script)
  }, [asset])

  function printQR() {
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>Asset Label - ${asset.asset_tag}</title>
    <style>body{font-family:monospace;text-align:center;padding:20px}h2{font-size:14px}p{font-size:12px;color:#666}@media print{button{display:none}}</style>
    </head><body>
    <button onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;cursor:pointer">Print</button>
    <h2>${asset.name}</h2><p>${asset.asset_tag}</p>
    ${qrRef.current?.innerHTML || ''}
    <p style="margin-top:8px;font-size:10px">${asset.location||''}</p>
    </body></html>`)
    win.document.close()
  }

  if (loading) return <div style={{ padding: '3rem' }}><Spinner /></div>
  if (!asset) return <div style={{ color: 'var(--text2)' }}>Asset not found.</div>

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
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.25rem' }}>
        <Btn onClick={onBack} size="sm">← Back</Btn>
        <div style={{ flex:1 }} />
        {isAdmin && <Btn size="sm" variant="primary" onClick={() => onEdit(asset)}>Edit asset</Btn>}
      </div>

      {isOverdue && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--red)', marginBottom:10 }}>⚠ Overdue — expected return was {new Date(asset.expected_return).toLocaleDateString()}</div>}
      {warrantyExpired && <div style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--text2)', marginBottom:10 }}>Warranty expired {new Date(asset.warranty_expiry).toLocaleDateString()}</div>}
      {warrantyExpiringSoon && <div style={{ background:'var(--amber-bg)', border:'1px solid var(--amber)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--amber)', marginBottom:10 }}>⏱ Warranty expires {new Date(asset.warranty_expiry).toLocaleDateString()}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 180px', gap:'1rem', marginBottom:'1rem' }}>
        <div style={card}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1rem' }}>
            <div>
              <h2 style={{ fontSize:20, fontWeight:500, marginBottom:4 }}>{asset.name}</h2>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)' }}>{asset.asset_tag}</span>
                <Badge status={asset.category} /><Badge status={asset.status} />
              </div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
            {[['Model',asset.model],['Serial number',asset.serial_number],['Location',asset.location],['Assigned to',asset.assigned_to],['Purchase date',asset.purchase_date?new Date(asset.purchase_date).toLocaleDateString():null],['Purchase cost',asset.purchase_cost?'$'+parseFloat(asset.purchase_cost).toFixed(2):null],['Warranty expiry',asset.warranty_expiry?new Date(asset.warranty_expiry).toLocaleDateString():null],['Expected return',asset.expected_return?new Date(asset.expected_return).toLocaleDateString():null]].map(([label,value]) => value?(
              <div key={label}>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:13 }}>{value}</div>
              </div>
            ):null)}
          </div>
          {asset.notes && <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--border)' }}>
            <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>Notes</div>
            <div style={{ fontSize:13, color:'var(--text2)' }}>{asset.notes}</div>
          </div>}
        </div>

        <div style={{ ...card, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>Asset QR</div>
          <div ref={qrRef} style={{ borderRadius:6, overflow:'hidden' }} />
          <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', fontFamily:'var(--mono)' }}>{asset.asset_tag}</div>
          <Btn size="sm" onClick={printQR} style={{ width:'100%', justifyContent:'center' }}>🖨 Print label</Btn>
        </div>
      </div>

      {/* Photos */}
      <div style={{ ...card, marginBottom:'1rem' }}>
        <AssetPhotos assetId={assetId} assetTag={asset.asset_tag} />
      </div>

      {/* Custom fields */}
      <div style={{ ...card, marginBottom:'1rem' }}>
        <CustomFields assetId={assetId} category={asset.category} />
      </div>

      {/* Comments */}
      <div style={{ ...card, marginBottom:'1rem' }}>
        <AssetComments assetId={assetId} />
      </div>

      {/* Maintenance */}
      <div style={{ ...card, marginBottom:'1rem' }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:'0.75rem' }}>Maintenance history ({maintenance.length})</div>
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

      {/* Activity */}
      <div style={card}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:'0.75rem' }}>Activity log ({log.length})</div>
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
    </div>
  )
}
