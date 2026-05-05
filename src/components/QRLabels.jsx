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

    // Avery 5160: 3 columns × 10 rows = 30 per page
    // Label size: 2.625" × 1"
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Asset QR Labels</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <style>
        * { margin:0; padding:0; box-sizing:border-box }
        body { font-family: Arial, sans-serif; background: white }
        .page { width:8.5in; padding:0.5in 0.1875in }
        .grid { display:grid; grid-template-columns:repeat(3,2.625in); gap:0 0.125in }
        .label { width:2.625in; height:1in; border:0.5px solid #ccc; padding:4px 6px; display:flex; align-items:center; gap:6px; page-break-inside:avoid; overflow:hidden }
        .qr { flex-shrink:0 }
        .info { flex:1; min-width:0 }
        .tag { font-size:9pt; font-weight:bold; font-family:monospace; color:#000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
        .model { font-size:7pt; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px }
        .assigned { font-size:6.5pt; color:#666; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px }
        .cat { font-size:6pt; color:#999; text-transform:uppercase; letter-spacing:0.03em; margin-top:2px }
        @media print { body{margin:0} button{display:none} .page{padding:0.5in 0.1875in} }
      </style></head>
      <body>
      <button onclick="window.print()" style="margin:12px;padding:8px 20px;font-size:14px;cursor:pointer;background:#d4ff4e;border:none;border-radius:4px;font-weight:600">🖨 Print Labels</button>
      <div class="page"><div class="grid" id="grid"></div></div>
      <script>
        const assets = ${JSON.stringify(selectedAssets)};
        const appUrl = "${appUrl}";
        const grid = document.getElementById('grid');
        assets.forEach(a => {
          const label = document.createElement('div');
          label.className = 'label';
          const qrDiv = document.createElement('div');
          qrDiv.className = 'qr';
          label.appendChild(qrDiv);
          const info = document.createElement('div');
          info.className = 'info';
          info.innerHTML = \`
            <div class="tag">\${a.asset_tag}</div>
            <div class="model">\${a.model||a.category||''}</div>
            \${a.assigned_to ? \`<div class="assigned">\${a.assigned_to}</div>\` : ''}
            <div class="cat">\${a.category||''}</div>
          \`;
          label.appendChild(info);
          grid.appendChild(label);
          new QRCode(qrDiv, {
            text: appUrl + '/#asset=' + a.asset_tag,
            width: 68, height: 68,
            correctLevel: QRCode.CorrectLevel.M
          });
        });
      </script>
      </body></html>
    `)
    win.document.close()
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
