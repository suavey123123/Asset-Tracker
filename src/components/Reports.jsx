import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Spinner } from './UI'

export default function Reports() {
  const [saveError, setSaveError] = useState('')
  const [assets, setAssets] = useState([])
  const [licenses, setLicenses] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [requests, setRequests] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState('utilization')
  const [budgetYear, setBudgetYear] = useState(String(new Date().getFullYear()))
  const [budgets, setBudgets] = useState({ hardware: 0, software: 0, maintenance: 0, total: 0 })
  const [budgetInputs, setBudgetInputs] = useState({ hardware: '', software: '', maintenance: '', total: '' })
  const [drilldown, setDrilldown] = useState('hardware')
  const [budgetSite, setBudgetSite] = useState('')
  const [budgetView, setBudgetView] = useState('annual') // 'annual' | 'monthly'

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    async function loadBudget() {
      const { data } = await supabase.from('app_settings').select('value').eq('key', `budget_${budgetYear}`).maybeSingle()
      if (data?.value) {
        setBudgets(data.value)
        setBudgetInputs(data.value)
      } else {
        setBudgets({ hardware: 0, software: 0, maintenance: 0, total: 0 })
        setBudgetInputs({ hardware: '', software: '', maintenance: '', total: '' })
      }
    }
    loadBudget()
  }, [budgetYear])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: l }, { data: m }, { data: r }, { data: lg }] = await Promise.all([
      supabase.from('assets').select('*').limit(500).order('created_at', { ascending: false }).limit(500),
      supabase.from('licenses').select('*').order('name'),
      supabase.from('maintenance_records').select('*').order('performed_date', { ascending: false }),
      supabase.from('asset_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }),
    ])
    setAssets(a || []); setLicenses(l || []); setMaintenance(m || [])
    setRequests(r || []); setLog(lg || [])
    setLoading(false)
  }

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate() + 30)
  const in60 = new Date(); in60.setDate(today.getDate() + 60)
  const days60ago = new Date(); days60ago.setDate(today.getDate() - 60)

  // Utilization
  const stale = assets.filter(a => a.status === 'Available' && a.updated_at && new Date(a.updated_at) < days60ago)
  const overdue = assets.filter(a => a.status === 'Checked Out' && a.expected_return && new Date(a.expected_return) < today)
  const retired = assets.filter(a => a.status === 'Retired')

  // Budget
  const yearAssets = assets.filter(a => a.purchase_date && new Date(a.purchase_date).getFullYear() === parseInt(budgetYear))
  const yearMaint = maintenance.filter(m => m.performed_date && new Date(m.performed_date).getFullYear() === parseInt(budgetYear))
  const assetSpend = yearAssets.reduce((s, a) => s + (parseFloat(a.purchase_cost) || 0), 0)
  const maintSpend = yearMaint.reduce((s, m) => s + (parseFloat(m.cost) || 0), 0)
  const totalSpend = assetSpend + maintSpend
  const budgetRemaining = budgets.total - totalSpend
  const budgetPct = budgets.total > 0 ? Math.min(100, Math.round(totalSpend / budgets.total * 100)) : 0

  // Category buckets
  const SW_CATS = ['SOFTWARE','LICENSE','SAAS','SUBSCRIPTION']
  const HW_CATS = ['LAPTOP','DESKTOP','MONITOR','PHONE','TABLET','SERVER','PRINTER','PROJECTOR','TV','ROUTER','SWITCH','ACCESS POINT','UPS','CAMERA','SCANNER']

  const filteredAssets = budgetSite ? yearAssets.filter(a => { const s = sites?.find(s=>s.id===a.site_id); return s?.name === budgetSite || a.location === budgetSite }) : yearAssets
  const filteredMaint  = budgetSite ? yearMaint.filter(m => assets.find(a=>a.id===m.asset_id)?.location === budgetSite) : yearMaint

  const hwAssets  = filteredAssets.filter(a => HW_CATS.includes(a.category?.toUpperCase()) || !SW_CATS.includes(a.category?.toUpperCase()))
  const swAssets  = filteredAssets.filter(a => SW_CATS.includes(a.category?.toUpperCase()))
  const hwSpend   = hwAssets.reduce((s,a)=>s+(parseFloat(a.purchase_cost)||0),0)
  const swSpend   = swAssets.reduce((s,a)=>s+(parseFloat(a.purchase_cost)||0),0)
  const maintSpendFiltered = filteredMaint.reduce((s,m)=>s+(parseFloat(m.cost)||0),0)

  // Monthly breakdown
  const months = Array.from({length:12},(_,i)=>i)
  const monthlyHW   = months.map(m=>hwAssets.filter(a=>new Date(a.purchase_date).getMonth()===m).reduce((s,a)=>s+(parseFloat(a.purchase_cost)||0),0))
  const monthlySW   = months.map(m=>swAssets.filter(a=>new Date(a.purchase_date).getMonth()===m).reduce((s,a)=>s+(parseFloat(a.purchase_cost)||0),0))
  const monthlyMaint= months.map(m=>filteredMaint.filter(a=>new Date(a.performed_date).getMonth()===m).reduce((s,a)=>s+(parseFloat(a.cost)||0),0))
  const monthNames  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const maxMonthly  = Math.max(...months.map(m=>monthlyHW[m]+monthlySW[m]+monthlyMaint[m]),1)

  const uniqueSites = [...new Set(assets.map(a=>a.location).filter(Boolean))]

  // Monthly summary
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
  const lastMonth = new Date(thisMonth); lastMonth.setMonth(lastMonth.getMonth() - 1)
  const monthAssets = assets.filter(a => a.created_at && new Date(a.created_at) >= thisMonth)
  const monthRetired = assets.filter(a => a.status === 'Retired' && a.updated_at && new Date(a.updated_at) >= thisMonth)
  const monthMaint = maintenance.filter(m => m.performed_date && new Date(m.performed_date) >= thisMonth)
  const monthRequests = requests.filter(r => r.created_at && new Date(r.created_at) >= thisMonth)
  const monthRequestsApproved = monthRequests.filter(r => r.status === 'approved')
  const expiringLicenses = licenses.filter(l => l.expiry_date && new Date(l.expiry_date) <= in30 && new Date(l.expiry_date) >= today)

  async function saveBudgets() {
    const vals = { hardware: parseFloat(budgetInputs.hardware)||0, software: parseFloat(budgetInputs.software)||0, maintenance: parseFloat(budgetInputs.maintenance)||0, total: parseFloat(budgetInputs.total)||0 }
    setBudgets(vals)
    await supabase.from('app_settings').upsert({ key: `budget_${budgetYear}`, value: vals, updated_at: new Date().toISOString() })
  }

  function exportCSV(data, filename, headers) {
    const rows = data.map(r => headers.map(h => { const v = r[h]??''; return String(v).includes(',')?`"${v}"`:v }).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a'); el.href=url; el.download=`${filename}-${today.toISOString().slice(0,10)}.csv`; el.click()
    URL.revokeObjectURL(url)
  }

  function printMonthlySummary() {
    const win = window.open('', '_blank', 'noopener,noreferrer')
    win.document.write(`
      <html><head><title>Monthly IT Summary Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#111;max-width:800px;margin:0 auto}
        h1{font-size:20px;margin-bottom:4px;color:#0f0f0f}
        h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #d4ff4e;padding-bottom:4px;color:#333}
        .meta{color:#666;font-size:11px;margin-bottom:20px}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        .stat{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:12px;text-align:center}
        .stat-val{font-size:28px;font-weight:bold;display:block;color:#0f0f0f}
        .stat-label{font-size:10px;color:#666;margin-top:2px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
        th{background:#f0f0f0;padding:6px 10px;text-align:left;border:1px solid #ddd;font-size:10px;text-transform:uppercase}
        td{padding:6px 10px;border:1px solid #e0e0e0}
        .badge{padding:2px 8px;border-radius:100px;font-size:10px;font-weight:600}
        .green{background:#dcfce7;color:#166534} .amber{background:#fef3c7;color:#92400e} .red{background:#fee2e2;color:#991b1b}
        .sig{border:1px solid #999;height:40px;margin-top:6px}
        @media print{button{display:none}}
      </style></head><body>
      <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;cursor:pointer;font-size:13px">🖨 Print / Save PDF</button>
      <h1>Monthly IT Asset Management Report</h1>
      <div class="meta">
        Period: ${today.toLocaleString('default',{month:'long'})} ${today.getFullYear()} &nbsp;·&nbsp;
        Generated: ${today.toLocaleString()} &nbsp;·&nbsp;
        Prepared by: _______________________
      </div>

      <div class="stats">
        <div class="stat"><span class="stat-val">${monthAssets.length}</span><span class="stat-label">Assets added</span></div>
        <div class="stat"><span class="stat-val">${monthRetired.length}</span><span class="stat-label">Assets retired</span></div>
        <div class="stat"><span class="stat-val">${monthMaint.length}</span><span class="stat-label">Maintenance completed</span></div>
        <div class="stat"><span class="stat-val">${monthRequests.length}</span><span class="stat-label">Requests handled</span></div>
      </div>

      <h2>Assets Added This Month</h2>
      ${monthAssets.length === 0 ? '<p style="color:#999">None this month.</p>' : `
      <table><thead><tr><th>Tag</th><th>Model</th><th>Category</th><th>Assigned To</th><th>Purchase Cost</th></tr></thead><tbody>
      ${monthAssets.map(a=>`<tr><td style="font-family:monospace">${a.asset_tag}</td><td>${a.model||'—'}</td><td>${a.category}</td><td>${a.assigned_to||'—'}</td><td>${a.purchase_cost?'$'+parseFloat(a.purchase_cost).toFixed(2):'—'}</td></tr>`).join('')}
      </tbody></table>`}

      <h2>Maintenance Completed</h2>
      ${monthMaint.length === 0 ? '<p style="color:#999">None this month.</p>' : `
      <table><thead><tr><th>Asset</th><th>Type</th><th>Date</th><th>Performed By</th><th>Cost</th></tr></thead><tbody>
      ${monthMaint.map(m=>`<tr><td>${m.asset_tag||'—'}</td><td>${m.maintenance_type||'—'}</td><td>${m.performed_date?new Date(m.performed_date).toLocaleDateString():'—'}</td><td>${m.performed_by||'—'}</td><td>${m.cost?'$'+parseFloat(m.cost).toFixed(2):'—'}</td></tr>`).join('')}
      </tbody></table>`}

      <h2>Asset Requests</h2>
      ${monthRequests.length === 0 ? '<p style="color:#999">None this month.</p>' : `
      <table><thead><tr><th>Requested For</th><th>Category</th><th>Status</th><th>Assigned Asset</th></tr></thead><tbody>
      ${monthRequests.map(r=>`<tr><td>${r.requester_name}</td><td>${r.category||'—'}</td><td><span class="badge ${r.status==='approved'?'green':r.status==='denied'?'red':'amber'}">${r.status.toUpperCase()}</span></td><td style="font-family:monospace">${r.assigned_asset_tag||'—'}</td></tr>`).join('')}
      </tbody></table>`}

      ${expiringLicenses.length > 0 ? `
      <h2>Licenses Expiring Soon</h2>
      <table><thead><tr><th>License</th><th>Vendor</th><th>Expiry</th></tr></thead><tbody>
      ${expiringLicenses.map(l=>`<tr><td>${l.name}</td><td>${l.vendor||'—'}</td><td style="color:red;font-weight:bold">${new Date(l.expiry_date).toLocaleDateString()}</td></tr>`).join('')}
      </tbody></table>` : ''}

      <h2>Sign-off</h2>
      <table style="width:60%">
        <tr><td><strong>Prepared by:</strong><div class="sig"></div></td><td><strong>Reviewed by:</strong><div class="sig"></div></td></tr>
      </table>
      </body></html>
    `)
    win.document.close()
  }

  const TABS = [
    { id:'utilization', label:'Utilization' },
    { id:'budget',      label:'Budget' },
    { id:'monthly',     label:'Monthly Report' },
    { id:'warranties',  label:'Warranties' },
    { id:'depreciation',label:'Depreciation' },
  ]

  const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem', marginBottom:'1rem' }
  const thStyle = { padding:'10px 14px', textAlign:'left', fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }
  const tdStyle = { padding:'10px 14px', fontSize:13, borderBottom:'1px solid var(--border)' }

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:4, background:'var(--bg2)', padding:4, borderRadius:'var(--radius)', border:'1px solid var(--border)', marginBottom:'1.5rem', flexWrap:'wrap', width:'fit-content' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveReport(t.id)} style={{ padding:'6px 14px', fontSize:13, borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'var(--font)', background:activeReport===t.id?'var(--bg4)':'transparent', color:activeReport===t.id?'var(--text)':'var(--text2)', border:activeReport===t.id?'1px solid var(--border2)':'1px solid transparent' }}>{t.label}</button>
        ))}
      </div>

      {loading ? <Spinner /> : <>

      {/* UTILIZATION */}
      {activeReport==='utilization' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:'1.5rem' }}>
            {[['Stale (60+ days available)', stale.length, 'var(--amber)'],['Overdue check-outs', overdue.length, 'var(--red)'],['Retired assets', retired.length, 'var(--text2)']].map(([l,v,c])=>(
              <div key={l} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:6 }}>{l}</div>
                <div style={{ fontSize:28, fontWeight:500, color:c, fontFamily:'var(--mono)' }}>{v}</div>
              </div>
            ))}
          </div>

          {stale.length > 0 && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem', color:'var(--amber)' }}>⏱ Stale assets — Available for 60+ days</div>
              <p style={{ fontSize:12, color:'var(--text2)', marginBottom:'1rem' }}>These assets haven't been checked out in over 60 days. Consider reallocating or retiring them.</p>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Tag','Model','Category','Last updated','Days idle','Action'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{stale.map(a=>{
                  const days = Math.floor((today-new Date(a.updated_at))/86400000)
                  return <tr key={a.id}>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)', color:'var(--accent)' }}>{a.asset_tag}</td>
                    <td style={tdStyle}>{a.model||'—'}</td>
                    <td style={{ ...tdStyle, fontSize:11 }}>{a.category}</td>
                    <td style={{ ...tdStyle, color:'var(--text2)' }}>{new Date(a.updated_at).toLocaleDateString()}</td>
                    <td style={{ ...tdStyle, color:'var(--amber)', fontFamily:'var(--mono)', fontWeight:500 }}>{days}d</td>
                    <td style={tdStyle}><Btn size="sm" onClick={()=>{}}>Review</Btn></td>
                  </tr>
                })}</tbody>
              </table>
            </div>
          )}

          {overdue.length > 0 && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem', color:'var(--red)' }}>⚠ Overdue check-outs</div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Tag','Model','Assigned To','Due Date','Days Overdue'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{overdue.map(a=>{
                  const days = Math.floor((today-new Date(a.expected_return))/86400000)
                  return <tr key={a.id}>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)', color:'var(--accent)' }}>{a.asset_tag}</td>
                    <td style={tdStyle}>{a.model||'—'}</td>
                    <td style={tdStyle}>{a.assigned_to}</td>
                    <td style={{ ...tdStyle, color:'var(--red)' }}>{new Date(a.expected_return).toLocaleDateString()}</td>
                    <td style={{ ...tdStyle, color:'var(--red)', fontWeight:500, fontFamily:'var(--mono)' }}>{days}d</td>
                  </tr>
                })}</tbody>
              </table>
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <Btn onClick={()=>exportCSV(assets,'assets-export',['asset_tag','name','model','category','status','assigned_to','location','purchase_cost','warranty_expiry'])}>⬇ Export assets CSV</Btn>
            <Btn onClick={()=>exportCSV(licenses,'licenses-export',['name','vendor','license_type','seats_total','seats_used','purchase_cost','expiry_date'])}>⬇ Export licenses CSV</Btn>
          </div>
        </div>
      )}

      {/* BUDGET */}
      {activeReport==='budget' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Controls */}
          <div style={{ ...card, padding:'1rem', display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>Year</div>
              <select value={budgetYear} onChange={e=>setBudgetYear(e.target.value)} style={{ width:90 }}>
                {[2023,2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>Site / Location</div>
              <select value={budgetSite} onChange={e=>setBudgetSite(e.target.value)} style={{ width:160 }}>
                <option value="">All sites</option>
                {uniqueSites.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:4, background:'var(--bg3)', padding:3, borderRadius:'var(--radius)', border:'1px solid var(--border2)' }}>
              {['annual','monthly'].map(v=>(
                <button key={v} onClick={()=>setBudgetView(v)} style={{ padding:'4px 12px', borderRadius:'var(--radius)', fontSize:12, border:'none', cursor:'pointer', fontFamily:'var(--font)', background:budgetView===v?'var(--bg2)':'transparent', color:budgetView===v?'var(--text)':'var(--text3)', fontWeight:budgetView===v?500:400 }}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>
              ))}
            </div>
          </div>

          {/* Budget inputs */}
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem' }}>Set budgets for {budgetYear}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12 }}>
              {[['total','Total IT Budget','var(--text)'],['hardware','Hardware','var(--blue)'],['software','Software / Licenses','var(--purple,#a78bfa)'],['maintenance','Maintenance','var(--amber)']].map(([k,label,color])=>(
                <div key={k} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px' }}>
                  <div style={{ fontSize:11, color:color, fontWeight:500, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'var(--text3)' }}>$</span>
                    <input type="number" value={budgetInputs[k]||''} onChange={e=>setBudgetInputs(p=>({...p,[k]:e.target.value}))} placeholder="0" style={{ width:'100%', fontSize:14, fontFamily:'var(--mono)' }} />
                  </div>
                </div>
              ))}
            </div>
            <Btn variant="primary" onClick={saveBudgets}>Save budgets</Btn>
          </div>

          {/* Spend overview */}
          {budgets.total > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[
                ['Total budget', '$'+budgets.total.toLocaleString(), budgets.total, budgets.total, 'var(--text)'],
                ['Hardware spend', '$'+hwSpend.toLocaleString(), hwSpend, budgets.hardware||budgets.total, 'var(--blue)'],
                ['Software spend', '$'+swSpend.toLocaleString(), swSpend, budgets.software||budgets.total, 'var(--accent)'],
                ['Maintenance spend', '$'+maintSpendFiltered.toLocaleString(), maintSpendFiltered, budgets.maintenance||budgets.total, 'var(--amber)'],
              ].map(([label,val,spend,budget,color])=>{
                const pct = budget>0?Math.min(100,Math.round(spend/budget*100)):0
                return (
                  <div key={label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
                    <div style={{ fontSize:11, color:'var(--text2)', marginBottom:6 }}>{label}</div>
                    <div style={{ fontSize:22, fontWeight:500, color, fontFamily:'var(--mono)', marginBottom:8 }}>{val}</div>
                    <div style={{ height:6, background:'var(--bg4)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                      <div style={{ width:pct+'%', height:'100%', background:pct>90?'var(--red)':pct>70?'var(--amber)':color, borderRadius:3, transition:'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{pct}% of budget</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Remaining banner */}
          {budgets.total > 0 && (
            <div style={{ background: budgetRemaining>=0?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${budgetRemaining>=0?'var(--green)':'var(--red)'}`, borderRadius:'var(--radius)', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, color:budgetRemaining>=0?'var(--green)':'var(--red)', fontWeight:500 }}>{budgetRemaining>=0?'Remaining budget':'Over budget'}</span>
              <span style={{ fontFamily:'var(--mono)', fontSize:16, fontWeight:600, color:budgetRemaining>=0?'var(--green)':'var(--red)' }}>{budgetRemaining>=0?'$'+budgetRemaining.toLocaleString():'-$'+Math.abs(budgetRemaining).toLocaleString()}</span>
            </div>
          )}

          {/* Monthly breakdown */}
          {budgetView==='monthly' && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem' }}>Monthly spend — {budgetYear}</div>
              <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:140, marginBottom:8 }}>
                {months.map(m=>{
                  const hw=monthlyHW[m], sw=monthlySW[m], mn=monthlyMaint[m], total=hw+sw+mn
                  const h=Math.round((total/maxMonthly)*120)
                  const hwH=Math.round((hw/maxMonthly)*120), swH=Math.round((sw/maxMonthly)*120), mnH=Math.round((mn/maxMonthly)*120)
                  return (
                    <div key={m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      {total>0&&<div style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)' }}>${Math.round(total/1000)}k</div>}
                      <div style={{ width:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', height:120, gap:1 }}>
                        {mnH>0&&<div style={{ height:mnH, background:'var(--amber)', borderRadius:2, opacity:0.8 }} title={`Maintenance: $${mn.toFixed(0)}`} />}
                        {swH>0&&<div style={{ height:swH, background:'var(--accent)', borderRadius:2, opacity:0.8 }} title={`Software: $${sw.toFixed(0)}`} />}
                        {hwH>0&&<div style={{ height:hwH, background:'var(--blue)', borderRadius:2, opacity:0.8 }} title={`Hardware: $${hw.toFixed(0)}`} />}
                      </div>
                      <div style={{ fontSize:9, color:'var(--text3)' }}>{monthNames[m]}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--text2)', justifyContent:'center' }}>
                {[['var(--blue)','Hardware'],['var(--accent)','Software'],['var(--amber)','Maintenance']].map(([c,l])=>(
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:10,height:10,background:c,borderRadius:2 }}/>{l}</div>
                ))}
              </div>
            </div>
          )}

          {/* Drilldown */}
          <div style={card}>
            <div style={{ display:'flex', gap:8, marginBottom:'1rem' }}>
              {[['hardware','Hardware'],['software','Software'],['maintenance','Maintenance']].map(([k,l])=>(
                <button key={k} onClick={()=>setDrilldown(drilldown===k?null:k)} style={{ padding:'6px 14px', fontSize:12, borderRadius:'var(--radius)', border:'1px solid', borderColor:drilldown===k?'var(--accent)':'var(--border2)', background:drilldown===k?'var(--accent-bg)':'var(--bg3)', color:drilldown===k?'var(--accent)':'var(--text2)', cursor:'pointer', fontFamily:'var(--font)', fontWeight:drilldown===k?500:400 }}>{l}</button>
              ))}
              {drilldown && <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text2)' }}>Showing {drilldown} purchases</span>}
            </div>



            {drilldown==='hardware' && (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Tag','Model','Category','Site','Date','Cost'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{hwAssets.filter(a=>a.purchase_cost).sort((a,b)=>parseFloat(b.purchase_cost)-parseFloat(a.purchase_cost)).map(a=>(
                  <tr key={a.id}><td style={{...tdStyle,fontFamily:'var(--mono)',color:'var(--accent)',fontSize:12}}>{a.asset_tag}</td><td style={tdStyle}>{a.model||'—'}</td><td style={{...tdStyle,fontSize:11}}>{a.category}</td><td style={{...tdStyle,color:'var(--text2)'}}>{a.location||'—'}</td><td style={{...tdStyle,color:'var(--text2)'}}>{a.purchase_date?new Date(a.purchase_date).toLocaleDateString():'—'}</td><td style={{...tdStyle,fontFamily:'var(--mono)',fontWeight:500,color:'var(--blue)'}}>${parseFloat(a.purchase_cost).toFixed(2)}</td></tr>
                ))}</tbody>
              </table>
            )}

            {drilldown==='software' && (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Tag','Model','Category','Date','Cost'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{swAssets.filter(a=>a.purchase_cost).sort((a,b)=>parseFloat(b.purchase_cost)-parseFloat(a.purchase_cost)).map(a=>(
                  <tr key={a.id}><td style={{...tdStyle,fontFamily:'var(--mono)',color:'var(--accent)',fontSize:12}}>{a.asset_tag}</td><td style={tdStyle}>{a.model||'—'}</td><td style={{...tdStyle,fontSize:11}}>{a.category}</td><td style={{...tdStyle,color:'var(--text2)'}}>{a.purchase_date?new Date(a.purchase_date).toLocaleDateString():'—'}</td><td style={{...tdStyle,fontFamily:'var(--mono)',fontWeight:500,color:'var(--accent)'}}>${parseFloat(a.purchase_cost).toFixed(2)}</td></tr>
                ))}</tbody>
              </table>
            )}

            {drilldown==='maintenance' && (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Asset','Type','Date','Performed By','Cost'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{filteredMaint.filter(m=>m.cost).sort((a,b)=>parseFloat(b.cost)-parseFloat(a.cost)).map(m=>(
                  <tr key={m.id}><td style={{...tdStyle,fontFamily:'var(--mono)',color:'var(--accent)',fontSize:12}}>{m.asset_tag||'—'}</td><td style={tdStyle}>{m.maintenance_type||'—'}</td><td style={{...tdStyle,color:'var(--text2)'}}>{m.performed_date?new Date(m.performed_date).toLocaleDateString():'—'}</td><td style={{...tdStyle,color:'var(--text2)'}}>{m.performed_by||'—'}</td><td style={{...tdStyle,fontFamily:'var(--mono)',fontWeight:500,color:'var(--amber)'}}>${parseFloat(m.cost).toFixed(2)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MONTHLY REPORT */}
      {activeReport==='monthly' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem', gap:8 }}>
            <Btn variant="primary" onClick={printMonthlySummary}>🖨 Print / Export PDF</Btn>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:'1.5rem' }}>
            {[['Assets added',monthAssets.length,'var(--accent)'],['Assets retired',monthRetired.length,'var(--text2)'],['Maintenance done',monthMaint.length,'var(--blue)'],['Requests',monthRequests.length,'var(--green)']].map(([l,v,c])=>(
              <div key={l} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:6 }}>{l}</div>
                <div style={{ fontSize:28, fontWeight:500, color:c, fontFamily:'var(--mono)' }}>{v}</div>
              </div>
            ))}
          </div>
          {expiringLicenses.length > 0 && (
            <div style={{ background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:13, color:'var(--red)', marginBottom:'1rem' }}>
              ⚠ {expiringLicenses.length} license{expiringLicenses.length!==1?'s':''} expiring within 30 days: {expiringLicenses.map(l=>l.name).join(', ')}
            </div>
          )}
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem' }}>Requests this month</div>
            {monthRequests.length===0?<div style={{ color:'var(--text3)', fontSize:13 }}>No requests this month.</div>:(
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Requested For','Category','Status','Assigned Asset'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{monthRequests.map(r=>(
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.requester_name}</td>
                    <td style={{ ...tdStyle, color:'var(--text2)' }}>{r.category||'—'}</td>
                    <td style={tdStyle}><span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:500, color:r.status==='approved'?'var(--green)':r.status==='denied'?'var(--red)':'var(--amber)' }}>{r.status.toUpperCase()}</span></td>
                    <td style={{ ...tdStyle, fontFamily:'var(--mono)', fontSize:12 }}>{r.assigned_asset_tag||'—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* WARRANTIES */}
      {activeReport==='warranties' && (
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:500, marginBottom:'1rem' }}>Warranty status</div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>{['Tag','Model','Category','Warranty Expiry','Status'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>{assets.filter(a=>a.warranty_expiry).sort((a,b)=>new Date(a.warranty_expiry)-new Date(b.warranty_expiry)).map(a=>{
              const exp = new Date(a.warranty_expiry)
              const expired = exp<today
              const soon = !expired && exp<=in30
              return <tr key={a.id}>
                <td style={{ ...tdStyle, fontFamily:'var(--mono)', color:'var(--accent)', fontSize:12 }}>{a.asset_tag}</td>
                <td style={tdStyle}>{a.model||'—'}</td>
                <td style={{ ...tdStyle, fontSize:11 }}>{a.category}</td>
                <td style={{ ...tdStyle, color:expired?'var(--red)':soon?'var(--amber)':'var(--text2)' }}>{exp.toLocaleDateString()}</td>
                <td style={tdStyle}><span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:500, color:expired?'var(--red)':soon?'var(--amber)':'var(--green)' }}>{expired?'EXPIRED':soon?'EXPIRING SOON':'ACTIVE'}</span></td>
              </tr>
            })}</tbody>
          </table>
        </div>
      )}

      {/* DEPRECIATION */}
      {activeReport==='depreciation' && (
        <div style={card}>
          <div style={{ fontSize:14, fontWeight:500, marginBottom:'0.5rem' }}>Asset depreciation</div>
          <p style={{ fontSize:12, color:'var(--text2)', marginBottom:'1rem' }}>Straight-line depreciation: IT equipment over 3 years, other assets over 5 years.</p>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>{['Tag','Model','Category','Purchase Cost','Current Value','Depreciation %','Age'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>{assets.filter(a=>a.purchase_cost&&a.purchase_date).sort((a,b)=>parseFloat(b.purchase_cost)-parseFloat(a.purchase_cost)).map(a=>{
              const itCats = ['LAPTOP','DESKTOP','SERVER','MONITOR','TABLET','PHONE']
              const years = itCats.includes(a.category) ? 3 : 5
              const cost = parseFloat(a.purchase_cost)
              const age = (today-new Date(a.purchase_date))/(1000*60*60*24*365)
              const current = Math.max(0, cost-(cost/years)*age)
              const depPct = Math.min(100, Math.round((cost-current)/cost*100))
              return <tr key={a.id}>
                <td style={{ ...tdStyle, fontFamily:'var(--mono)', color:'var(--accent)', fontSize:12 }}>{a.asset_tag}</td>
                <td style={tdStyle}>{a.model||'—'}</td>
                <td style={{ ...tdStyle, fontSize:11 }}>{a.category}</td>
                <td style={{ ...tdStyle, fontFamily:'var(--mono)' }}>${cost.toFixed(0)}</td>
                <td style={{ ...tdStyle, fontFamily:'var(--mono)', color:'var(--green)' }}>${current.toFixed(0)}</td>
                <td style={tdStyle}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ height:6, width:60, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ width:`${depPct}%`, height:'100%', background:depPct>75?'var(--red)':depPct>50?'var(--amber)':'var(--green)', borderRadius:3 }} />
                    </div>
                    <span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{depPct}%</span>
                  </div>
                </td>
                <td style={{ ...tdStyle, color:'var(--text2)', fontSize:12 }}>{age.toFixed(1)}y</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      )}
      </>}
    </div>
  )
}
