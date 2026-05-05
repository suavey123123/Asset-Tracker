import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Spinner } from './UI'

export default function QRLabels() {
  const [assets, setAssets] = useState([])
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    setLoading(true)
    const { data } = await supabase.from('assets').select('id, asset_tag, model, category, assigned_to, location').order('asset_tag')
    setAssets(data || [])
    setLoading(false)
  }

  const filtered = assets.filter(a => {
    if (filterCat && a.category !== filterCat) return false
    if (search && !`${a.asset_tag} ${a.model||''} ${a.assigned_to||''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const cats = [...new Set(assets.map(a => a.category).filter(Boolean))].sort()

  function toggleAll() {
    if (selected.length === filtered.length) setSelected([])
    else setSelected(filtered.map(a => a.id))
  }

  function printLabels() {
    const selectedAssets = assets.filter(a => selected.includes(a.id))
    const appUrl = window.location.origin

    // Build label HTML for each asset
    const labels = selectedAssets.map(a => {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(appUrl + '/#asset=' + a.asset_tag)}`
      return `
        <div class="label">
          <img src="${qrUrl}" width="70" height="70" />
          <div class="tag">${a.asset_tag}</div>
          <div class="model">${(a.model || a.category || '').substring(0, 28)}</div>
          ${a.assigned_to ? `<div class="person">${a.assigned_to.substring(0, 24)}</div>` : ''}
        </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>QR Labels</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: Arial, sans-serif; background: white }
  .page { width: 8.5in; padding: 0.5in 0.1875in }
  .grid { display: grid; grid-template-columns: repeat(3, 2.625in); gap: 0 0.125in }
  .label { width: 2.625in; height: 1in; padding: 4px 6px; display: flex; align-items: center; gap: 6px; page-break-inside: avoid; overflow: hidden; border: 0.5px solid #ddd }
  img { flex-shrink: 0 }
  .tag { font-family: monospace; font-size: 8.5pt; font-weight: 700; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  .model { font-size: 7pt; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px }
  .person { font-size: 6.5pt; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px }
  .info { flex: 1; min-width: 0 }
  .print-btn { margin: 12px; padding: 8px 20px; font-size: 14px; cursor: pointer; background: #d4ff4e; border: none; border-radius: 4px; font-weight: 600 }
  @media print { .print-btn { display: none } .page { padding: 0.5in 0.1875in } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print ${selectedAssets.length} labels</button>
<div class="page">
  <div class="grid">
    ${labels.map(l => l.replace(/<div class="tag">/, '<div class="info"><div class="tag">').replace(/<\/div>\s*$/, '</div></div>')).join('')}
  </div>
</div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) alert('Please allow popups to print labels.')
    setTimeout(() => URL.revokeObjectURL(url), 15000)
  }

  return (
    <div className="fade-in">
      <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets…" style={{ flex:1, minWidth:200 }} />
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ width:160 }}>
          <option value="">All categories</option>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
        <Btn onClick={toggleAll}>{selected.length===filtered.length&&filtered.length>0?'Deselect all':'Select all'}</Btn>
        <Btn variant="primary" onClick={printLabels} disabled={selected.length===0}>
          🖨 Print {selected.length > 0 ? `${selected.length} label${selected.length!==1?'s':''}` : 'labels'}
        </Btn>
      </div>

      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:'1rem' }}>
        Avery 5160 format · 30 labels per page · Select assets to print
      </div>

      {loading ? <Spinner /> : (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
              <th style={{ width:40, padding:'10px 14px' }}>
                <input type="checkbox" checked={selected.length===filtered.length&&filtered.length>0} onChange={toggleAll} style={{ width:'auto' }} />
              </th>
              {['Tag','Model','Category','Assigned To','Site'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(a => {
                const isSelected = selected.includes(a.id)
                return (
                  <tr key={a.id} onClick={()=>setSelected(s=>isSelected?s.filter(x=>x!==a.id):[...s,a.id])}
                    style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', background:isSelected?'var(--accent-bg)':undefined }}>
                    <td style={{ padding:'10px 14px' }}>
                      <input type="checkbox" checked={isSelected} onChange={()=>{}} style={{ width:'auto' }} />
                    </td>
                    <td style={{ padding:'10px 14px', fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)', fontWeight:500 }}>{a.asset_tag}</td>
                    <td style={{ padding:'10px 14px', fontSize:13 }}>{a.model||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'var(--text2)' }}>{a.category}</td>
                    <td style={{ padding:'10px 14px', fontSize:13 }}>{a.assigned_to||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{a.location||'—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
