import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from './UI'

export default function ValueDashboard() {
  const [fetchError, setFetchError] = useState('')
  const [assets, setAssets] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: m }, { data: s }] = await Promise.all([
      supabase.from('assets').select('*'),
      supabase.from('maintenance_records').select('cost, asset_id'),
      supabase.from('sites').select('id, name'),
    ])
    setAssets(a || [])
    setMaintenance(m || [])
    setSites(s || [])
    setLoading(false)
  }

  if (loading) return <div style={{ padding: '3rem' }}><Spinner /></div>

  const today = new Date()

  function depreciate(asset) {
    if (!asset.purchase_cost || !asset.purchase_date) return null
    const years = asset.category === 'LAPTOP' || asset.category === 'DESKTOP' || asset.category?.includes('IT') ? 3 : 5
    const cost = parseFloat(asset.purchase_cost)
    const age = (today - new Date(asset.purchase_date)) / (1000 * 60 * 60 * 24 * 365)
    return Math.max(0, cost - (cost / years) * age)
  }

  const totalCost = assets.reduce((s, a) => s + (parseFloat(a.purchase_cost) || 0), 0)
  const totalDepreciated = assets.reduce((s, a) => { const v = depreciate(a); return s + (v ?? (parseFloat(a.purchase_cost) || 0)) }, 0)
  const totalMaintenance = maintenance.reduce((s, m) => s + (parseFloat(m.cost) || 0), 0)
  const assetsWithCost = assets.filter(a => a.purchase_cost).length

  // By category
  const byCategory = {}
  assets.forEach(a => {
    if (!a.purchase_cost) return
    const cat = a.category || 'Unknown'
    if (!byCategory[cat]) byCategory[cat] = { count: 0, cost: 0, current: 0 }
    byCategory[cat].count++
    byCategory[cat].cost += parseFloat(a.purchase_cost) || 0
    byCategory[cat].current += depreciate(a) ?? (parseFloat(a.purchase_cost) || 0)
  })
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1].cost - a[1].cost).slice(0, 8)

  // By site
  const bySite = {}
  sites.forEach(s => { bySite[s.name] = { count: 0, cost: 0, maintenance: 0 } })
  bySite['No site'] = { count: 0, cost: 0, maintenance: 0 }
  assets.forEach(a => {
    const site = a.location && sites.find(s => a.location?.toLowerCase().includes(s.name.toLowerCase()))
    const key = site ? site.name : 'No site'
    if (!bySite[key]) bySite[key] = { count: 0, cost: 0, maintenance: 0 }
    bySite[key].count++
    bySite[key].cost += parseFloat(a.purchase_cost) || 0
  })
  maintenance.forEach(m => {
    const asset = assets.find(a => a.id === m.asset_id)
    if (!asset) return
    const site = asset.location && sites.find(s => asset.location?.toLowerCase().includes(s.name.toLowerCase()))
    const key = site ? site.name : 'No site'
    if (bySite[key]) bySite[key].maintenance += parseFloat(m.cost) || 0
  })
  const siteEntries = Object.entries(bySite).filter(([, v]) => v.count > 0).sort((a, b) => b[1].cost - a[1].cost)

  const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const card = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }
  const thStyle = { padding: '8px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const tdStyle = { padding: '10px 14px', fontSize: 13 }

  return (
    <div className="fade-in">
      {/* Top summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          ['Total purchase value', fmt(totalCost), 'var(--accent)', `${assetsWithCost} of ${assets.length} assets have cost data`],
          ['Current value (depreciated)', fmt(totalDepreciated), 'var(--green)', `${fmt(totalCost - totalDepreciated)} depreciated`],
          ['Total maintenance spend', fmt(totalMaintenance), 'var(--amber)', `${maintenance.length} maintenance records`],
          ['Avg cost per asset', assetsWithCost > 0 ? fmt(totalCost / assetsWithCost) : '—', 'var(--blue)', 'Across assets with cost data'],
        ].map(([label, value, color, sub]) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color, fontFamily: 'var(--mono)', marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* By category */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: '1rem' }}>Value by category</div>
          {topCategories.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>No cost data yet.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Category', 'Assets', 'Purchase value', 'Current value'].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {topCategories.map(([cat, d]) => (
                  <tr key={cat} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}><span style={{ fontSize: 11, fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg3)', color: 'var(--text2)' }}>{cat}</span></td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{d.count}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)' }}>{fmt(d.cost)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)', color: 'var(--green)' }}>{fmt(d.current)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* By site */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: '1rem' }}>Value by site</div>
          {siteEntries.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>No site data yet.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Site', 'Assets', 'Asset value', 'Maintenance'].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {siteEntries.map(([site, d]) => (
                  <tr key={site} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{site}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{d.count}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)' }}>{d.cost > 0 ? fmt(d.cost) : '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)', color: d.maintenance > 0 ? 'var(--amber)' : 'var(--text3)' }}>{d.maintenance > 0 ? fmt(d.maintenance) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Top 10 most valuable assets */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: '1rem' }}>Top 10 most valuable assets</div>
        {assets.filter(a => a.purchase_cost).length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>No cost data yet. Add purchase costs to assets to see this report.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Asset', 'Category', 'Status', 'Purchase cost', 'Current value', 'Depreciation'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {assets.filter(a => a.purchase_cost).sort((a, b) => parseFloat(b.purchase_cost) - parseFloat(a.purchase_cost)).slice(0, 10).map(a => {
                const current = depreciate(a)
                const dep = current !== null ? parseFloat(a.purchase_cost) - current : 0
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{a.model || a.asset_tag}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{a.asset_tag}</div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text2)' }}>{a.category}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text2)' }}>{a.status}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)', fontWeight: 500 }}>{fmt(parseFloat(a.purchase_cost))}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)', color: 'var(--green)' }}>{current !== null ? fmt(current) : '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--mono)', color: 'var(--red)', fontSize: 12 }}>{current !== null ? `-${fmt(dep)}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
