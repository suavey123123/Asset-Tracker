import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Spinner } from './UI'

const EMP_CACHE_KEY = 'home_emp_lookup'

function getEmpLookup() {
  try {
    const saved = localStorage.getItem(EMP_CACHE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return {}
}

export default function Home({ onNav, onViewAsset }) {
  { id:'stats',       label:'Summary stats',        default:true },
  { id:'alerts',      label:'Alerts & warnings',    default:true },
  { id:'recent',      label:'Recent assets',         default:true },
  { id:'activity',    label:'Recent activity',       default:true },
  { id:'overdue',     label:'Overdue check-outs',    default:true },
  { id:'warranties',  label:'Expiring warranties',   default:true },
  { id:'licenses',    label:'License status',        default:true },
  { id:'byCategory',  label:'Assets by category',    default:false },
  { id:'bySite',      label:'Assets & employees by site', default:false },
  { id:'byStatus',      label:'Assets by status',          default:false },
  { id:'consumables',   label:'Low stock consumables',     default:true },
  { id:'maintenance',   label:'Upcoming maintenance',      default:true },
  { id:'requests',      label:'Pending asset requests',    default:true },
  { id:'aging',         label:'Assets due for replacement',  default:true },
  { id:'licenseexpiry', label:'License expiry alerts',       default:true },
]

const STORAGE_KEY = 'dashboard_widgets_v1'

export default function Home({ onNav, onViewAsset }) {
  const [assets, setAssets] = useState([])
  const [log, setLog] = useState([])
  const [licenses, setLicenses] = useState([])
  const [sites, setSites] = useState([])
  const [employees, setEmployees] = useState([])
  const [consumables, setConsumables] = useState([])
  const [empLookup] = useState(getEmpLookup)
  const [schedules, setSchedules] = useState([])
  const [requests, setRequests] = useState([])
  const [agingAssets, setAgingAssets] = useState([])
  const [expiringLicensesList, setExpiringLicensesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : ALL_WIDGETS.filter(w=>w.default).map(w=>w.id)
    } catch { return ALL_WIDGETS.filter(w=>w.default).map(w=>w.id) }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets)) } catch {}
  }, [widgets])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: l }, { data: lg }, { data: s }, { data: e }, { data: c }, { data: ms }, { data: rq }, { data: ag }, { data: lic }] = await Promise.all([
      supabase.from('licenses').select('*'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
      supabase.from('sites').select('id, name'),
      supabase.from('employees').select('id, name, site_id'),
      supabase.from('consumables').select('*').order('name'),
      supabase.from('maintenance_schedules').select('*'),
      supabase.from('asset_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('assets').select('asset_tag,model,category,purchase_date,status').not('purchase_date','is',null).eq('status','Checked Out').limit(500),
      supabase.from('licenses').select('*').not('expiry_date','is',null).order('expiry_date'),
    ])

    // Fetch ALL assets in batches (Supabase SDK defaults to Range: rows=0-999)
    // Use .range() to set the range, then loop to get all data
    let allAssetData = []
    let offset = 0
    let batch
    do {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .range(offset, offset + 9999)
        .order('created_at', { ascending: false })
      if (error) { console.error('[Home] Fetch error:', error); break }
      batch = data || []
      allAssetData = [...allAssetData, ...batch]
      offset += 10000
    } while (batch.length >= 10000 && allAssetData.length < 500000)
    setAssets(allAssetData || [])
    setLicenses(l || [])
    setLog(lg || [])
    setSites(s || [])
    setEmployees(e || [])
    // Cache employee lookup for resolving assigned_to UUIDs
    if (e) {
      try {
        const map = {}
        e.forEach(emp => { map[emp.id] = emp.name })
        localStorage.setItem(EMP_CACHE_KEY, JSON.stringify(map))
      } catch {}
    }
    setConsumables(c || [])
    setSchedules(ms || [])
    setRequests(rq || [])
    setAgingAssets((ag||[]).filter(a => {
      const yrs = (Date.now()-new Date(a.purchase_date))/(1000*60*60*24*365)
      return yrs >= 3
    }).sort((a,b)=>new Date(a.purchase_date)-new Date(b.purchase_date)))
    setExpiringLicensesList((lic||[]).filter(l => {
      const days = (new Date(l.expiry_date)-Date.now())/(1000*60*60*24)
      return days <= 90
    }))
    setLoading(false)
  }

  function toggleWidget(id) {
    setWidgets(w => w.includes(id) ? w.filter(x=>x!==id) : [...w, id])
  }

  if (loading) return <div style={{ padding:'3rem' }}><Spinner /></div>

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate()+30)

  const stats = {
    total: assets.length,
    available: assets.filter(a=>a.status==='Available').length,
    checkedOut: assets.filter(a=>a.status==='Checked Out').length,
    maintenance: assets.filter(a=>a.status==='Maintenance').length,
  }

  const overdueCheckouts = assets.filter(a => a.status==='Checked Out' && a.expected_return && new Date(a.expected_return)<today)
  const expiringWarranties = assets.filter(a => a.warranty_expiry && new Date(a.warranty_expiry)<=in30 && new Date(a.warranty_expiry)>=today)
  const expiredWarranties = assets.filter(a => a.warranty_expiry && new Date(a.warranty_expiry)<today && a.status!=='Retired')
  const expiringLicenses = licenses.filter(l => l.expiry_date && new Date(l.expiry_date)<=in30)
  const totalAlerts = overdueCheckouts.length + expiringWarranties.length + expiringLicenses.length

  const byCategory = {}
  assets.forEach(a => { byCategory[a.category] = (byCategory[a.category]||0)+1 })
  const topCategories = Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).slice(0,8)

  const byStatus = {}
  assets.forEach(a => { byStatus[a.status] = (byStatus[a.status]||0)+1 })

  const bySite = {}
  sites.forEach(s => { bySite[s.name] = assets.filter(a=>a.location?.toLowerCase().includes(s.name.toLowerCase())).length })

  const TYPE_STYLES = {
    checkout:{ color:'var(--blue)', label:'OUT' }, checkin:{ color:'var(--green)', label:'IN' },
    maintenance:{ color:'var(--amber)', label:'MNT' }, created:{ color:'var(--accent)', label:'NEW' },
    updated:{ color:'var(--text2)', label:'UPD' }, note:{ color:'var(--text3)', label:'NOTE' },
  }

  const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem' }
  const cardTitle = { fontSize:13, fontWeight:500, marginBottom:'0.75rem', color:'var(--text)' }
  const row = { display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }
  const linkBtn = { fontSize:12, color:'var(--text2)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }

  const has = (id) => widgets.includes(id)

  return (
    <div className="fade-in">
      {/* Customize button */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        <button onClick={()=>setEditing(e=>!e)} style={{ fontSize:12, color:'var(--text2)', background:'none', border:'1px solid var(--border2)', borderRadius:'var(--radius)', padding:'5px 12px', cursor:'pointer', fontFamily:'var(--font)' }}>
          {editing ? '✓ Done' : '⊞ Customize dashboard'}
        </button>
      </div>

      {/* Widget picker */}
      {editing && (
        <div style={{ ...card, marginBottom:'1.25rem', background:'var(--bg3)' }}>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:'0.75rem' }}>Choose widgets to show</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8 }}>
            {ALL_WIDGETS.map(w => (
              <label key={w.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', padding:'6px 10px', borderRadius:'var(--radius)', background: widgets.includes(w.id)?'var(--accent-bg)':'var(--bg2)', border:`1px solid ${widgets.includes(w.id)?'var(--accent-border)':'var(--border)'}` }}>
                <input type="checkbox" checked={widgets.includes(w.id)} onChange={()=>toggleWidget(w.id)} style={{ width:'auto', accentColor:'var(--accent)' }} />
                <span style={{ color: widgets.includes(w.id)?'var(--accent)':'var(--text2)' }}>{w.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {has('alerts') && (
        <>
          {overdueCheckouts.length>0 && <div onClick={()=>onNav('inventory')} style={{ background:'var(--red-bg)', border:'1px solid var(--red)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--red)', marginBottom:8, display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <span style={{ fontWeight:500 }}>⚠ {overdueCheckouts.length} overdue check-out{overdueCheckouts.length>1?'s':''}</span>
            <span style={{ fontSize:12 }}>{overdueCheckouts.map(a=>a.name).join(', ')}</span>
            <span style={{ marginLeft:'auto', fontSize:12 }}>View →</span>
          </div>}
          {expiringWarranties.length>0 && <div onClick={()=>onNav('reports')} style={{ background:'var(--amber-bg)', border:'1px solid var(--amber)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--amber)', marginBottom:8, display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <span style={{ fontWeight:500 }}>⏱ {expiringWarranties.length} warranty expiring within 30 days</span>
            <span style={{ marginLeft:'auto', fontSize:12 }}>View →</span>
          </div>}
          {expiringLicenses.length>0 && <div onClick={()=>onNav('licenses')} style={{ background:'var(--purple-bg)', border:'1px solid var(--purple)', borderRadius:'var(--radius)', padding:'8px 14px', fontSize:13, color:'var(--purple)', marginBottom:8, display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <span style={{ fontWeight:500 }}>📋 {expiringLicenses.length} software license{expiringLicenses.length>1?'s':''} expiring soon</span>
            <span style={{ marginLeft:'auto', fontSize:12 }}>View →</span>
          </div>}
        </>
      )}

      {/* Stats */}
      {has('stats') && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:'1.25rem' }}>
          {[['Total assets',stats.total,'var(--text)','inventory'],['Available',stats.available,'var(--green)','inventory'],['Checked out',stats.checkedOut,'var(--blue)','inventory'],['Maintenance',stats.maintenance,'var(--amber)','maintenance']].map(([l,v,c,nav]) => (
            <div key={l} onClick={()=>onNav(nav)} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
            >
              <div style={{ fontSize:11, color:'var(--text2)', marginBottom:6 }}>{l}</div>
              <div style={{ fontSize:28, fontWeight:500, color:c, fontFamily:'var(--mono)' }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
        {/* Recent assets */}
        {has('recent') && (
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
              <span style={cardTitle}>Recent assets</span>
              <button onClick={()=>onNav('inventory')} style={linkBtn}>View all →</button>
            </div>
            {assets.slice(0,5).length===0 ? <div style={{ color:'var(--text3)', fontSize:13 }}>No assets yet.</div> :
             assets.slice(0,5).map(a => (
              <div key={a.id} onClick={()=>onViewAsset(a)} style={row}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                  <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>{a.asset_tag}</div>
                </div>
                <Badge status={a.status} />
              </div>
            ))}
          </div>
        )}

        {/* Activity */}
        {has('activity') && (
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
              <span style={cardTitle}>Recent activity</span>
              <button onClick={()=>onNav('history')} style={linkBtn}>View all →</button>
            </div>
            {log.length===0 ? <div style={{ color:'var(--text3)', fontSize:13 }}>No activity yet.</div> :
             log.map((e,i) => {
               const ts = TYPE_STYLES[e.type]||TYPE_STYLES.note
               return (
                 <div key={e.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', alignItems:'flex-start' }}>
                   <span style={{ fontFamily:'var(--mono)', fontSize:10, fontWeight:500, color:ts.color, background:ts.color+'18', padding:'2px 5px', borderRadius:3, flexShrink:0, marginTop:1 }}>{ts.label}</span>
                   <div style={{ flex:1, minWidth:0 }}>
                     <div style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.message}</div>
                     <div style={{ fontSize:11, color:'var(--text3)' }}>{e.asset_name} · {new Date(e.created_at).toLocaleDateString()}</div>
                   </div>
                 </div>
               )
             })}
          </div>
        )}

        {/* Overdue */}
        {has('overdue') && overdueCheckouts.length>0 && (
          <div style={{ ...card, borderColor:'rgba(255,90,90,0.3)' }}>
            <div style={{ ...cardTitle, color:'var(--red)' }}>⚠ Overdue check-outs</div>
            {overdueCheckouts.map(a => (
              <div key={a.id} onClick={()=>onViewAsset(a)} style={row}>
                <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, color:'var(--text2)' }}>Assigned to {a.assigned_to}</div></div>
                <div style={{ fontSize:12, color:'var(--red)' }}>Due {new Date(a.expected_return).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* Expiring warranties */}
        {has('warranties') && expiringWarranties.length>0 && (
          <div style={{ ...card, borderColor:'rgba(255,184,74,0.3)' }}>
            <div style={{ ...cardTitle, color:'var(--amber)' }}>⏱ Expiring warranties</div>
            {expiringWarranties.map(a => (
              <div key={a.id} onClick={()=>onViewAsset(a)} style={row}>
                <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>{a.asset_tag}</div></div>
                <div style={{ fontSize:12, color:'var(--amber)' }}>{new Date(a.warranty_expiry).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* License status */}
        {has('licenses') && licenses.length>0 && (
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
              <span style={cardTitle}>Software licenses</span>
              <button onClick={()=>onNav('licenses')} style={linkBtn}>View all →</button>
            </div>
            {licenses.slice(0,5).map(l => {
              const exp = l.expiry_date && new Date(l.expiry_date)<today
              const expSoon = l.expiry_date && !exp && new Date(l.expiry_date)<in30
              return (
                <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{l.name}</div><div style={{ fontSize:11, color:'var(--text2)' }}>{l.vendor} · {l.license_type}</div></div>
                  <span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:500, color: exp?'var(--red)':expSoon?'var(--amber)':'var(--green)' }}>
                    {exp?'EXPIRED':expSoon?'EXPIRING':'ACTIVE'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* By category */}
        {has('byCategory') && topCategories.length>0 && (
          <div style={card}>
            <div style={cardTitle}>Assets by category</div>
            {topCategories.map(([cat, count]) => {
              const pct = Math.round(count/assets.length*100)
              return (
                <div key={cat} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                    <span>{cat}</span>
                    <span style={{ color:'var(--text2)', fontFamily:'var(--mono)' }}>{count}</span>
                  </div>
                  <div style={{ height:4, background:'var(--bg4)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:'var(--accent)', borderRadius:2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* By site */}
        {has('bySite') && sites.length>0 && (
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
              <span style={cardTitle}>By site</span>
              <button onClick={()=>onNav('sites')} style={linkBtn}>View all →</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'0 16px', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Site</span>
              <span style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', textAlign:'right' }}>Employees</span>
              <span style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', textAlign:'right' }}>Assets</span>
            </div>
            {sites.map(site => {
              const siteAssets = assets.filter(a => a.location?.toLowerCase().includes(site.name.toLowerCase()) || a.site_id === site.id).length
              const siteEmps = employees.filter(e => e.site_id === site.id).length
              return (
                <div key={site.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'0 16px', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{site.name}</span>
                  <span style={{ fontFamily:'var(--mono)', fontWeight:500, color:'var(--blue)', textAlign:'right' }}>{siteEmps}</span>
                  <span style={{ fontFamily:'var(--mono)', fontWeight:500, color:'var(--accent)', textAlign:'right' }}>{siteAssets}</span>
                </div>
              )
            })}
            <div style={{ display:'flex', gap:16, marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--blue)' }}>● Employees</span>
              <span style={{ fontSize:11, color:'var(--accent)' }}>● Assets</span>
            </div>
          </div>
        )}

        {/* By status */}
        {has('consumables') && (
        <div style={card}>
          <div style={cardTitle}>⚠ Low stock consumables</div>
          {consumables.filter(c => c.quantity <= (c.low_stock_threshold || 5)).length === 0
            ? <div style={{ fontSize:13, color:'var(--text3)' }}>All consumables well stocked.</div>
            : consumables.filter(c => c.quantity <= (c.low_stock_threshold || 5)).map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{c.name}</div>
                    <div style={{ fontSize:11, color:'var(--text2)' }}>{c.category||'—'}</div>
                  </div>
                  <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:600, color: c.quantity === 0 ? 'var(--red)' : 'var(--amber)' }}>{c.quantity} left</span>
                </div>
              ))
          }
        </div>
      )}

      {has('maintenance') && (
        <div style={card}>
          <div style={cardTitle}>🔧 Upcoming maintenance</div>
          {schedules.filter(s => s.next_due && new Date(s.next_due) <= new Date(Date.now() + 14*86400000)).length === 0
            ? <div style={{ fontSize:13, color:'var(--text3)' }}>No maintenance due in the next 14 days.</div>
            : schedules.filter(s => s.next_due && new Date(s.next_due) <= new Date(Date.now() + 14*86400000)).slice(0,5).map(s => {
                const due = new Date(s.next_due)
                const overdue = due < new Date()
                return (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{s.asset_tag||'—'}</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{s.maintenance_type||'—'}</div>
                    </div>
                    <span style={{ fontSize:11, fontFamily:'var(--mono)', color: overdue ? 'var(--red)' : 'var(--amber)', fontWeight:500 }}>{overdue ? 'OVERDUE' : due.toLocaleDateString()}</span>
                  </div>
                )
              })
          }
        </div>
      )}

      {has('aging') && (
        <div style={card}>
          <div style={cardTitle}>🔴 Assets due for replacement</div>
          {agingAssets.length === 0
            ? <div style={{ fontSize:13, color:'var(--text3)' }}>No assets older than 3 years.</div>
            : agingAssets.slice(0,6).map(a => {
                const yrs = ((Date.now()-new Date(a.purchase_date))/(1000*60*60*24*365)).toFixed(1)
                return (
                  <div key={a.asset_tag} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500, fontFamily:'var(--mono)', color:'var(--accent)' }}>{a.asset_tag}</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{a.model||a.category}</div>
                    </div>
                    <span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:600, color: yrs>=4?'var(--red)':'var(--amber)', background: yrs>=4?'var(--red)':'var(--amber)', WebkitBackgroundClip:'unset', backgroundClip:'unset', padding:'2px 6px', borderRadius:3, backgroundColor: yrs>=4?'rgba(255,80,80,0.15)':'rgba(255,170,0,0.15)' }}>{yrs}yr</span>
                  </div>
                )
              })
          }
          {agingAssets.length > 6 && <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>+{agingAssets.length-6} more assets</div>}
        </div>
      )}

      {has('licenseexpiry') && (
        <div style={card}>
          <div style={cardTitle}>📋 License expiry (90 days)</div>
          {expiringLicensesList.length === 0
            ? <div style={{ fontSize:13, color:'var(--text3)' }}>No licenses expiring soon.</div>
            : expiringLicensesList.map(l => {
                const days = Math.ceil((new Date(l.expiry_date)-Date.now())/(1000*60*60*24))
                const expired = days < 0
                return (
                  <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{l.name}</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{l.vendor||'—'}</div>
                    </div>
                    <span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:600, color:expired?'var(--red)':days<=30?'var(--amber)':'var(--text2)', backgroundColor:expired?'rgba(255,80,80,0.15)':days<=30?'rgba(255,170,0,0.15)':'var(--bg3)', padding:'2px 6px', borderRadius:3 }}>
                      {expired ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                  </div>
                )
              })
          }
        </div>
      )}

      {has('requests') && (
        <div style={card}>
          <div style={cardTitle}>📋 Pending requests</div>
          {requests.length === 0
            ? <div style={{ fontSize:13, color:'var(--text3)' }}>No pending requests.</div>
            : requests.slice(0,5).map(r => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{r.requester_name}</div>
                    <div style={{ fontSize:11, color:'var(--text2)' }}>{r.category||'General'} · {r.urgency}</div>
                  </div>
                  <span style={{ fontSize:11, color:'var(--amber)', fontFamily:'var(--mono)', fontWeight:600 }}>PENDING</span>
                </div>
              ))
          }
        </div>
      )}

      {has('byStatus') && (
          <div style={card}>
            <div style={cardTitle}>Assets by status</div>
            {Object.entries(byStatus).map(([status, count]) => (
              <div key={status} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <Badge status={status} />
                <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:500 }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
