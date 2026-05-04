import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Spinner, Badge } from './UI'

export default function Reports() {
  const [assets, setAssets] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState('summary')
  const [licenses, setLicenses] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: m }, { data: l }, { data: lic }] = await Promise.all([
      supabase.from('assets').select('*').order('name'),
      supabase.from('maintenance_records').select('*'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }),
      supabase.from('licenses').select('*').order('name'),
    ])
    setAssets(a || [])
    setMaintenance(m || [])
    setLog(l || [])
    setLicenses(lic || [])
    setLoading(false)
  }

  function exportCSV() {
    const headers = ['asset_tag','name','category','status','model','serial_number','location','assigned_to','purchase_date','purchase_cost','warranty_expiry','notes']
    const rows = assets.map(a => headers.map(h => { const v = a[h] ?? ''; return String(v).includes(',') ? `"${v}"` : v }).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = `assets-export-${new Date().toISOString().slice(0,10)}.csv`; el.click()
    URL.revokeObjectURL(url)
  }

  function exportAuditPDF() {
    const today = new Date().toLocaleDateString()
    const win = window.open('', '_blank')
    win.document.write(`<html><head><title>Asset Audit Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h1{font-size:18px;margin-bottom:4px}p{color:#666;margin-bottom:16px;font-size:11px}table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:8px;text-align:left;font-size:11px;border:1px solid #ddd}td{padding:8px;border:1px solid #ddd;font-size:11px}.check{width:16px;height:16px;border:1px solid #999;display:inline-block}@media print{button{display:none}}</style>
    </head><body>
    <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;cursor:pointer">Print / Save PDF</button>
    <h1>Asset Audit Report</h1><p>Generated: ${today} &nbsp;|&nbsp; Total assets: ${assets.length}</p>
    <table><thead><tr><th>✓</th><th>Tag</th><th>Name</th><th>Category</th><th>Status</th><th>Location</th><th>Assigned To</th><th>Serial #</th></tr></thead>
    <tbody>${assets.map(a => `<tr><td><span class="check"></span></td><td style="font-family:monospace">${a.asset_tag}</td><td>${a.name}</td><td>${a.category}</td><td>${a.status}</td><td>${a.location||'—'}</td><td>${a.assigned_to||'—'}</td><td style="font-family:monospace">${a.serial_number||'—'}</td></tr>`).join('')}</tbody>
    </table></body></html>`)
    win.document.close()
  }

  if (loading) return <div style={{ padding: '3rem' }}><Spinner /></div>

  const today = new Date()
  const totalValue = assets.reduce((s, a) => s + (parseFloat(a.purchase_cost) || 0), 0)
  const maintenanceCost = maintenance.reduce((s, m) => s + (parseFloat(m.cost) || 0), 0)

  const withDepreciation = assets.filter(a => a.purchase_cost && a.purchase_date).map(a => {
    const years = a.category === 'IT Equipment' ? 3 : 5
    const cost = parseFloat(a.purchase_cost)
    const age = (today - new Date(a.purchase_date)) / (1000*60*60*24*365)
    const currentValue = Math.max(0, cost - (cost/years)*age)
    return { ...a, cost, currentValue, depreciation: cost-currentValue, age: age.toFixed(1) }
  }).sort((a,b) => b.depreciation - a.depreciation)

  const checkoutCounts = {}
  log.filter(e => e.type === 'checkout').forEach(e => { checkoutCounts[e.asset_id] = (checkoutCounts[e.asset_id]||0)+1 })
  const utilization = assets.map(a => ({ ...a, checkouts: checkoutCounts[a.id]||0 })).sort((a,b) => b.checkouts-a.checkouts)

  const overdue = assets.filter(a => a.status==='Checked Out' && a.expected_return && new Date(a.expected_return)<today)
  const in30 = new Date(); in30.setDate(today.getDate()+30)
  const expiringWarranties = assets.filter(a => a.warranty_expiry && new Date(a.warranty_expiry)<=in30).sort((a,b) => new Date(a.warranty_expiry)-new Date(b.warranty_expiry))

  const REPORTS = [
    {id:'summary',label:'Summary'},{id:'depreciation',label:'Depreciation'},
    {id:'utilization',label:'Utilization'},{id:'overdue',label:`Overdue${overdue.length?' ('+overdue.length+')':''}`},
    {id:'warranties',label:'Warranties'},
  ]

  const thStyle = { padding:'10px 14px', textAlign:'left', fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }
  const tdStyle = { padding:'10px 14px' }

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:8, marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <Btn onClick={exportCSV} variant="primary">⬇ Export assets CSV</Btn>
        <Btn onClick={() => {
          const headers = ['name','vendor','license_type','seats_total','seats_used','purchase_cost','expiry_date','support_expiry']
          const rows = licenses.map(l => headers.map(h => { const v = l[h]??''; return String(v).includes(',')?`"${v}"`:v }).join(','))
          const csv = [headers.join(','), ...rows].join('\n')
          const blob = new Blob([csv], { type:'text/csv' })
          const url = URL.createObjectURL(blob)
          const el = document.createElement('a'); el.href=url; el.download=`licenses-export-${new Date().toISOString().slice(0,10)}.csv`; el.click()
          URL.revokeObjectURL(url)
        }}>⬇ Export licenses CSV</Btn>
        <Btn onClick={exportAuditPDF}>🖨 Print audit sheet</Btn>
        <Btn onClick={() => {
          const win = window.open('', '_blank')
          win.document.write(`<html><head><title>Asset QR Labels</title>
          <style>body{font-family:monospace;padding:20px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.label{border:1px solid #ddd;padding:12px;text-align:center;border-radius:6px}h3{font-size:12px;margin-bottom:4px}p{font-size:10px;color:#666}@media print{button{display:none}}</style>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
          </head><body>
          <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;cursor:pointer">🖨 Print all labels</button>
          <div class="grid">
          ${assets.map(a => `<div class="label" id="qr-${a.id}"><h3>${a.model||a.asset_tag}</h3><p>${a.asset_tag}</p><div id="qrbox-${a.id}"></div><p>${a.location||''}</p></div>`).join('')}
          </div>
          <script>
          window.onload = () => {
            ${assets.map(a => `new QRCode(document.getElementById('qrbox-${a.id}'), {text:'${window.location.origin}/asset/${a.id}',width:80,height:80})`).join(';')}
          }
          <\/script>
          </body></html>`)
          win.document.close()
        }}>🏷 Print all QR labels</Btn>
      </div>

      <div style={{ display:'flex', gap:4, background:'var(--bg2)', padding:4, borderRadius:'var(--radius)', border:'1px solid var(--border)', marginBottom:'1.25rem', width:'fit-content', flexWrap:'wrap' }}>
        {REPORTS.map(r => (
          <button key={r.id} onClick={() => setActiveReport(r.id)} style={{
            padding:'6px 14px', fontSize:13, borderRadius:'var(--radius)',
            background: activeReport===r.id ? 'var(--bg4)' : 'transparent',
            color: activeReport===r.id ? 'var(--text)' : 'var(--text2)',
            border: activeReport===r.id ? '1px solid var(--border2)' : '1px solid transparent',
            cursor:'pointer', fontFamily:'var(--font)',
          }}>{r.label}</button>
        ))}
      </div>

      {activeReport==='summary' && (
        <div className="fade-in">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:'1.25rem' }}>
            {[['Total assets',assets.length,'var(--text)'],['Total purchase value','$'+totalValue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),'var(--accent)'],['Total maintenance cost','$'+maintenanceCost.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),'var(--amber)'],['IT Equipment',assets.filter(a=>a.category==='IT Equipment').length,'var(--blue)'],['Tools & Equipment',assets.filter(a=>a.category==='Tools & Equipment').length,'var(--amber)'],['Retired',assets.filter(a=>a.status==='Retired').length,'var(--text2)']].map(([l,v,c]) => (
              <div key={l} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:22, fontWeight:500, color:c, fontFamily:'var(--mono)' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>{['Status','Count','% of total'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {['Available','Checked Out','Maintenance','Ordered','Received','Retired'].map(s => {
                  const count = assets.filter(a=>a.status===s).length
                  return count>0 ? (<tr key={s} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={tdStyle}><Badge status={s} /></td>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)', fontWeight:500 }}>{count}</td>
                    <td style={{ ...tdStyle, color:'var(--text2)' }}>{assets.length?Math.round(count/assets.length*100):0}%</td>
                  </tr>) : null
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport==='depreciation' && (
        <div className="fade-in">
          <p style={{ fontSize:13, color:'var(--text2)', marginBottom:'1rem' }}>Straight-line depreciation: IT Equipment over 3 years, Tools over 5 years.</p>
          {withDepreciation.length===0 ? <div style={{ color:'var(--text3)', fontSize:13 }}>No assets with purchase cost and date recorded.</div> : (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>{['Asset','Age (yrs)','Purchase cost','Depreciation','Current value'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{withDepreciation.map(a=>(
                  <tr key={a.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={tdStyle}><div style={{ fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>{a.asset_tag}</div></td>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)' }}>{a.age}</td>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)' }}>${a.cost.toFixed(2)}</td>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)', color:'var(--red)' }}>-${a.depreciation.toFixed(2)}</td>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)', color:'var(--green)', fontWeight:500 }}>${a.currentValue.toFixed(2)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeReport==='utilization' && (
        <div className="fade-in">
          <p style={{ fontSize:13, color:'var(--text2)', marginBottom:'1rem' }}>Assets ranked by number of times checked out.</p>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>{['Asset','Category','Status','Check-outs','Utilization'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>{utilization.map(a => {
                const maxC = Math.max(...utilization.map(x=>x.checkouts),1)
                const pct = Math.round(a.checkouts/maxC*100)
                return (
                  <tr key={a.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={tdStyle}><div style={{ fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>{a.asset_tag}</div></td>
                    <td style={tdStyle}><Badge status={a.category} /></td>
                    <td style={tdStyle}><Badge status={a.status} /></td>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)', fontWeight:500 }}>{a.checkouts}</td>
                    <td style={{ ...tdStyle, minWidth:140 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:6, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:`${pct}%`, height:'100%', background:pct>66?'var(--green)':pct>33?'var(--amber)':'var(--text3)', borderRadius:3 }} />
                        </div>
                        <span style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)', minWidth:30 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport==='overdue' && (
        <div className="fade-in">
          {overdue.length===0 ? <div style={{ color:'var(--green)', fontSize:14, padding:'2rem', textAlign:'center' }}>✓ No overdue check-outs!</div> : (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--red)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>{['Asset','Assigned To','Expected Return','Days Overdue'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{overdue.map(a => {
                  const days = Math.floor((today-new Date(a.expected_return))/86400000)
                  return (
                    <tr key={a.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={tdStyle}><div style={{ fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text2)' }}>{a.asset_tag}</div></td>
                      <td style={tdStyle}>{a.assigned_to||'—'}</td>
                      <td style={{ ...tdStyle, color:'var(--red)' }}>{new Date(a.expected_return).toLocaleDateString()}</td>
                      <td style={{ ...tdStyle, fontFamily:'var(--mono)', color:'var(--red)', fontWeight:500 }}>{days}d</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeReport==='warranties' && (
        <div className="fade-in">
          {expiringWarranties.length===0 ? <div style={{ color:'var(--text3)', fontSize:14, padding:'2rem', textAlign:'center' }}>No warranties expiring within 30 days.</div> : (
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>{['Asset','Category','Warranty Expiry','Status'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{expiringWarranties.map(a => {
                  const expired = new Date(a.warranty_expiry)<today
                  return (
                    <tr key={a.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={tdStyle}><div style={{ fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text2)' }}>{a.asset_tag}</div></td>
                      <td style={tdStyle}><Badge status={a.category} /></td>
                      <td style={{ ...tdStyle, color:expired?'var(--red)':'var(--amber)' }}>{new Date(a.warranty_expiry).toLocaleDateString()}</td>
                      <td style={tdStyle}><span style={{ fontSize:11, color:expired?'var(--red)':'var(--amber)', fontFamily:'var(--mono)', fontWeight:500 }}>{expired?'EXPIRED':'EXPIRING SOON'}</span></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
