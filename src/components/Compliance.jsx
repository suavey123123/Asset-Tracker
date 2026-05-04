import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Spinner, Badge } from './UI'

export default function Compliance() {
  const [assets, setAssets] = useState([])
  const [licenses, setLicenses] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [auditNotes, setAuditNotes] = useState({})
  const [auditChecked, setAuditChecked] = useState({})

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: l }, { data: m }, { data: e }] = await Promise.all([
      supabase.from('assets').select('*').order('name'),
      supabase.from('licenses').select('*').order('name'),
      supabase.from('maintenance_records').select('*'),
      supabase.from('employees').select('*').order('name'),
    ])
    setAssets(a || [])
    setLicenses(l || [])
    setMaintenance(m || [])
    setEmployees(e || [])
    setLoading(false)
  }

  function printReport() {
    const today = new Date()
    const win = window.open('', '_blank')
    const rows = assets.map(a => `
      <tr>
        <td><input type="checkbox" ${auditChecked[a.id] ? 'checked' : ''}> </td>
        <td style="font-family:monospace">${a.asset_tag}</td>
        <td>${a.name}</td>
        <td>${a.category}</td>
        <td>${a.status}</td>
        <td>${a.assigned_to || '—'}</td>
        <td>${a.location || '—'}</td>
        <td>${a.serial_number || '—'}</td>
        <td>${a.warranty_expiry ? new Date(a.warranty_expiry).toLocaleDateString() : '—'}</td>
        <td>${auditNotes[a.id] || ''}</td>
      </tr>
    `).join('')

    const licRows = licenses.map(l => `
      <tr>
        <td>${l.name}</td>
        <td>${l.vendor || '—'}</td>
        <td>${l.license_type}</td>
        <td>${l.seats_used || '—'}/${l.seats_total || '—'}</td>
        <td>${l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : '—'}</td>
        <td style="color:${l.expiry_date && new Date(l.expiry_date) < today ? 'red' : 'green'}">${l.expiry_date && new Date(l.expiry_date) < today ? 'EXPIRED' : 'ACTIVE'}</td>
      </tr>
    `).join('')

    win.document.write(`
      <html><head><title>Compliance Audit Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;padding:20px;color:#111}
        h1{font-size:18px;margin-bottom:4px}
        h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #333;padding-bottom:4px}
        .meta{color:#666;font-size:11px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:10px;border:1px solid #ccc;text-transform:uppercase}
        td{padding:6px 8px;border:1px solid #ddd;font-size:10px;vertical-align:top}
        .stat{display:inline-block;margin-right:24px;text-align:center}
        .stat-val{font-size:24px;font-weight:bold;display:block}
        .stat-label{font-size:10px;color:#666}
        .summary{background:#f9f9f9;border:1px solid #ddd;padding:12px;margin-bottom:16px;border-radius:4px}
        @media print{button{display:none}.no-print{display:none}}
        .sig-box{border:1px solid #999;height:40px;margin-top:4px}
      </style></head><body>
      <button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;cursor:pointer;font-size:13px">🖨 Print / Save PDF</button>
      <h1>IT Asset Compliance Audit Report</h1>
      <div class="meta">Generated: ${today.toLocaleString()} &nbsp;|&nbsp; Prepared by: _________________________ &nbsp;|&nbsp; Period: _________________________</div>

      <div class="summary">
        <div class="stat"><span class="stat-val">${assets.length}</span><span class="stat-label">Total assets</span></div>
        <div class="stat"><span class="stat-val">${assets.filter(a=>a.status==='Available').length}</span><span class="stat-label">Available</span></div>
        <div class="stat"><span class="stat-val">${assets.filter(a=>a.status==='Checked Out').length}</span><span class="stat-label">Checked Out</span></div>
        <div class="stat"><span class="stat-val">${assets.filter(a=>a.status==='Maintenance').length}</span><span class="stat-label">Maintenance</span></div>
        <div class="stat"><span class="stat-val">${licenses.length}</span><span class="stat-label">Licenses</span></div>
        <div class="stat"><span class="stat-val">${employees.length}</span><span class="stat-label">Employees</span></div>
      </div>

      <h2>Hardware Asset Inventory</h2>
      <table>
        <thead><tr><th>✓</th><th>Tag</th><th>Name</th><th>Category</th><th>Status</th><th>Assigned To</th><th>Location</th><th>Serial #</th><th>Warranty</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h2>Software License Inventory</h2>
      <table>
        <thead><tr><th>Software</th><th>Vendor</th><th>Type</th><th>Seats (used/total)</th><th>Expiry</th><th>Status</th></tr></thead>
        <tbody>${licRows || '<tr><td colspan="6" style="text-align:center;color:#999">No licenses recorded</td></tr>'}</tbody>
      </table>

      <h2>Sign-off</h2>
      <table style="width:60%">
        <tr><td><strong>Auditor name:</strong><div class="sig-box"></div></td><td><strong>Signature:</strong><div class="sig-box"></div></td><td><strong>Date:</strong><div class="sig-box"></div></td></tr>
        <tr><td><strong>Reviewer name:</strong><div class="sig-box"></div></td><td><strong>Signature:</strong><div class="sig-box"></div></td><td><strong>Date:</strong><div class="sig-box"></div></td></tr>
      </table>
      </body></html>
    `)
    win.document.close()
  }

  if (loading) return <div style={{ padding:'3rem' }}><Spinner /></div>

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate()+30)

  const issues = [
    ...assets.filter(a => a.status==='Checked Out' && a.expected_return && new Date(a.expected_return)<today).map(a => ({ type:'overdue', label:`${a.name} (${a.asset_tag}) is overdue — assigned to ${a.assigned_to}`, color:'var(--red)' })),
    ...assets.filter(a => a.warranty_expiry && new Date(a.warranty_expiry)<today && a.status!=='Retired').map(a => ({ type:'warranty', label:`${a.name} warranty expired ${new Date(a.warranty_expiry).toLocaleDateString()}`, color:'var(--amber)' })),
    ...licenses.filter(l => l.expiry_date && new Date(l.expiry_date)<today).map(l => ({ type:'license', label:`${l.name} license EXPIRED ${new Date(l.expiry_date).toLocaleDateString()}`, color:'var(--red)' })),
    ...licenses.filter(l => l.expiry_date && new Date(l.expiry_date)>today && new Date(l.expiry_date)<in30).map(l => ({ type:'license', label:`${l.name} license expiring ${new Date(l.expiry_date).toLocaleDateString()}`, color:'var(--amber)' })),
    ...licenses.filter(l => l.seats_total && l.seats_used >= l.seats_total).map(l => ({ type:'seats', label:`${l.name} is at full seat capacity (${l.seats_used}/${l.seats_total})`, color:'var(--amber)' })),
  ]

  const allChecked = assets.length > 0 && assets.every(a => auditChecked[a.id])

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:8, marginBottom:'1.25rem', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:500 }}>Compliance Audit</div>
          <div style={{ fontSize:12, color:'var(--text2)' }}>Check off assets as you physically verify them, then print the report.</div>
        </div>
        <Btn onClick={printReport} variant="primary">🖨 Print audit report</Btn>
      </div>

      {/* Issues panel */}
      {issues.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:'0.75rem', color:'var(--red)' }}>⚠ {issues.length} compliance issue{issues.length!==1?'s':''} found</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {issues.map((issue, i) => (
              <div key={i} style={{ display:'flex', gap:8, fontSize:12, color:issue.color, alignItems:'center' }}>
                <span>•</span><span>{issue.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {issues.length === 0 && (
        <div style={{ background:'var(--green-bg)', border:'1px solid var(--green)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:13, color:'var(--green)', marginBottom:'1.25rem' }}>
          ✓ No compliance issues found
        </div>
      )}

      {/* Asset checklist */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
        <div style={{ fontSize:13, fontWeight:500 }}>Asset verification checklist ({Object.values(auditChecked).filter(Boolean).length}/{assets.length} verified)</div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn size="sm" onClick={() => { const all={}; assets.forEach(a=>{all[a.id]=true}); setAuditChecked(all) }}>Check all</Btn>
          <Btn size="sm" onClick={() => setAuditChecked({})}>Uncheck all</Btn>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:6, background:'var(--bg4)', borderRadius:3, marginBottom:'1rem', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${assets.length ? Math.round(Object.values(auditChecked).filter(Boolean).length/assets.length*100) : 0}%`, background:'var(--green)', borderRadius:3, transition:'width 0.3s' }} />
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
            <th style={{ padding:'10px 14px', width:36 }}>
              <input type="checkbox" checked={allChecked} onChange={e => { const all={}; if(e.target.checked) assets.forEach(a=>{all[a.id]=true}); setAuditChecked(all) }} style={{ width:'auto', cursor:'pointer' }} />
            </th>
            {['Tag','Name','Category','Status','Assigned To','Location','Notes'].map(h=>(
              <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {assets.map(a => {
              const checked = auditChecked[a.id]
              return (
                <tr key={a.id} style={{ borderBottom:'1px solid var(--border)', background: checked?'var(--green-bg)':undefined, opacity: checked?0.7:1 }}>
                  <td style={{ padding:'10px 14px' }}>
                    <input type="checkbox" checked={!!checked} onChange={e=>setAuditChecked(s=>({...s,[a.id]:e.target.checked}))} style={{ width:'auto', cursor:'pointer', accentColor:'var(--green)' }} />
                  </td>
                  <td style={{ padding:'10px 14px', fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)' }}>{a.asset_tag}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, fontWeight:500 }}>{a.name}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{a.category}</td>
                  <td style={{ padding:'10px 14px' }}><Badge status={a.status} /></td>
                  <td style={{ padding:'10px 14px', fontSize:12 }}>{a.assigned_to||'—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{a.location||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <input
                      value={auditNotes[a.id]||''}
                      onChange={e=>setAuditNotes(s=>({...s,[a.id]:e.target.value}))}
                      placeholder="Audit note…"
                      style={{ fontSize:12, padding:'4px 8px', width:140 }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
