import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Modal } from './UI'


function normalizeDate(val) {
  if (!val || !String(val).trim()) return null
  const v = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
    const [m,d,y]=v.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(v)) {
    const [m,d,y]=v.split('/'); return `20${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(v)) return v.replace(/\//g,'-')
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(v)) {
    const [a,b,y]=v.split('-'); return `${y}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`
  }
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(v)) {
    const [d,m,y]=v.split('.'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  try { const d=new Date(v); if(!isNaN(d)) return d.toISOString().slice(0,10) } catch {}
  return null
}

function cleanCost(val) {
  if (!val) return null
  const n = parseFloat(String(val).replace(/[$,\s]/g,''))
  return isNaN(n) ? null : n
}


const TEMPLATE = `name,email,title,department,phone,hire_date,asset_tag,asset_category,asset_model,asset_serial,purchase_date,provision_date,purchase_cost,cpu,gpu,ram,ssd,hdd,mac_wifi,mac_lan,os_version
John Smith,john@company.com,IT Engineer,IT,555-1234,2024-01-15,IT-001,LAPTOP,Dell XPS 15,SN-12345,5/29/2025,6/1/2025,$1899.00,Intel i7-13700H,NVIDIA RTX 4060,16GB DDR5,512GB NVMe,,00:1A:2B:3C:4D:5E,00:1A:2B:3C:4D:5F,Windows 11 Pro
John Smith,john@company.com,IT Engineer,IT,555-1234,2024-01-15,IT-045,PHONE,iPhone 15,SN-67890,5/29/2025,6/1/2025,$999.00,,,,,,,iOS 17
Jane Doe,jane@company.com,IT Manager,IT,555-5678,2023-06-01,IT-002,LAPTOP,MacBook Pro 14,SN-11111,5/25/2023,6/1/2023,$2499.00,Apple M3 Pro,Apple M3 GPU,18GB,512GB NVMe,,00:AA:BB:CC:DD:EE,00:AA:BB:CC:DD:EF,macOS Sonoma 14`

const NOTES = [
  'One row per asset. If an employee has 2 assets, add 2 rows with the same employee details.',
  'asset_tag is required per row. All other asset fields are optional.',
  'If the asset tag already exists it will be assigned. If not, a new asset will be created.',
  'Employee details only get created once — duplicate names are automatically skipped.',
  'Dates accept any format: 5/29/2025, 2025-05-29, 29/05/2025 etc.',
  'Costs accept $ signs and commas: $1,899.00 or 1899.00 both work.',
]

function parseCSVLine(line) {
  const vals = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      vals.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  vals.push(cur.trim())
  return vals
}

function parseCSV(text) {
  // Handle Windows (CRLF) and Mac (CR) line endings
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.replace(/,/g,'').trim())
  if (lines.length < 2) return { rows: [], errors: ['Need a header row and at least one data row.'] }
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
  const errs = []
  const rows = lines.slice(1).map((line, i) => {
    const vals = parseCSVLine(line)
    const row = {}
    headers.forEach((h, j) => { row[h] = (vals[j] || '').trim() })
    return row
  }).filter(row => row.name && row.name.trim())
  // Only error if a row has some data but no name
  return { rows, errors: errs }
}


export default function ImportEmployeesCSV({ open, onClose, onDone, sites }) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ step: '', current: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [siteId, setSiteId] = useState('')

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      setErrors([])
      const { rows, errors } = parseCSV(text)
      setPreview(rows)
      setErrors(errors)
      if (!errors.length) {
        // Store parsed rows directly, don't show raw CSV in textarea
        setCsv(text)
        setFileName(file.name)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleCSV(text) {
    setCsv(text); setErrors([])
    if (!text.trim()) { setPreview([]); return }
    const { rows, errors } = parseCSV(text)
    setPreview(rows)
    setErrors(errors)
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'employee-asset-import.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport() {
    const { rows, errors: errs } = parseCSV(csv)
    if (errs.length) { setErrors(errs); return }
    setImporting(true)

    // Group rows by employee name to avoid duplicate inserts
    const empMap = {}
    rows.forEach(r => {
      if (!empMap[r.name]) empMap[r.name] = { details: r, assets: [] }
      if (r.asset_tag) empMap[r.name].assets.push(r)
    })

    const employees = Object.values(empMap)
    let empCreated = 0, empSkipped = 0, assetCreated = 0, assetAssigned = 0, errors = []

    // Step 1: Create employees
    setProgress({ step: 'Creating employees', current: 0, total: employees.length })
    for (let i = 0; i < employees.length; i++) {
      const { details: r } = employees[i]
      setProgress({ step: 'Creating employees', current: i + 1, total: employees.length })

      // Check if employee already exists — update if so, create if not
      const { data: existing } = await supabase.from('employees').select('id').ilike('name', r.name).maybeSingle()

      const empPayload = {
        name: r.name,
        email: r.email || null,
        title: r.title || null,
        department: r.department || null,
        phone: r.phone || null,
        hire_date: normalizeDate(r.hire_date),
        site_id: siteId || null,
      }

      if (existing) {
        // Update existing employee with new data
        const { error } = await supabase.from('employees').update(empPayload).eq('id', existing.id)
        if (error) errors.push(`Employee ${r.name}: ${error.message}`)
        else empSkipped++ // count as skipped-but-updated
      } else {
        const { error } = await supabase.from('employees').insert(empPayload)
        if (error) { errors.push(`Employee ${r.name}: ${error.message}`); empSkipped++ }
        else empCreated++
      }
    }

    // Step 2: Create/assign assets
    const assetRows = rows.filter(r => r.asset_tag)
    setProgress({ step: 'Assigning assets', current: 0, total: assetRows.length })

    for (let i = 0; i < assetRows.length; i++) {
      const r = assetRows[i]
      setProgress({ step: 'Assigning assets', current: i + 1, total: assetRows.length })

      // Check if asset already exists
      const { data: existing } = await supabase.from('assets').select('id, asset_tag').eq('asset_tag', r.asset_tag).maybeSingle()

      if (existing) {
        // Update existing asset with all fields + assign to employee
        await supabase.from('assets').update({
          assigned_to: r.name,
          status: 'Checked Out',
          model: r.asset_model || existing.model || null,
          serial_number: r.asset_serial || existing.serial_number || null,
          purchase_date: normalizeDate(r.purchase_date) || existing.purchase_date || null,
          provision_date: normalizeDate(r.provision_date) || existing.provision_date || null,
          purchase_cost: cleanCost(r.purchase_cost) || existing.purchase_cost || null,
          specs: {
            CPU: r.cpu || '',
            GPU: r.gpu || '',
            RAM: r.ram || '',
            SSD: r.ssd || '',
            HDD: r.hdd || '',
            'MAC ADDRESS (WIFI)': r.mac_wifi || '',
            'MAC ADDRESS (LAN)': r.mac_lan || '',
            'OS VERSION': r.os_version || '',
          }
        }).eq('id', existing.id)
        await supabase.from('activity_log').insert({ asset_id: existing.id, asset_tag: existing.asset_tag, asset_name: existing.asset_tag, type: 'checkout', message: `Assigned to ${r.name} via bulk import` })
        assetAssigned++
      } else {
        // Create new asset and assign
        const { data: newAsset, error } = await supabase.from('assets').insert({
          asset_tag: r.asset_tag,
          name: r.asset_model || r.asset_tag,
          model: r.asset_model || null,
          category: (r.asset_category || 'LAPTOP').toUpperCase().trim().replace(/[^A-Z0-9 &()-]/g, '').substring(0, 50) || 'OTHER',
          serial_number: r.asset_serial || null,
          purchase_date: normalizeDate(r.purchase_date),
          provision_date: normalizeDate(r.provision_date),
          purchase_cost: cleanCost(r.purchase_cost),
          status: 'Checked Out',
          assigned_to: r.name,
          assigned_to_team: null,
          location: sites?.find(s => s.id === siteId)?.name || null,
          specs: {
            CPU: r.cpu || '',
            GPU: r.gpu || '',
            RAM: r.ram || '',
            SSD: r.ssd || '',
            HDD: r.hdd || '',
            'MAC ADDRESS (WIFI)': r.mac_wifi || '',
            'MAC ADDRESS (LAN)': r.mac_lan || '',
            'OS VERSION': r.os_version || '',
          }
        }).select().single()

        if (error) { errors.push(`Asset ${r.asset_tag}: ${error.message}`) }
        else {
          await supabase.from('activity_log').insert({ asset_id: newAsset.id, asset_tag: newAsset.asset_tag, asset_name: newAsset.asset_tag, type: 'created', message: `Created and assigned to ${r.name} via bulk import` })
          assetCreated++
        }
      }
    }

    setImporting(false)
    setProgress({ step: '', current: 0, total: 0 })
    setResult({ empCreated, empSkipped, assetCreated, assetAssigned, errors })
    if (!errors.length) {
      setTimeout(() => { onDone?.(); onClose(); reset() }, 3000)
    }
  }

  function reset() {
    setCsv(''); setFileName(''); setPreview([]); setErrors([]); setResult(null); setSiteId('')
    setProgress({ step: '', current: 0, total: 0 })
  }

  const rowCount = csv.trim() && !errors.length ? parseCSV(csv).rows.length : 0
  const pct = progress.total > 0 ? Math.round(progress.current / progress.total * 100) : 0

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Import employees + assets" width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--green)', marginBottom: 8 }}>✓ Import complete</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 13 }}>
                <div>👤 {result.empCreated} employee{result.empCreated !== 1 ? 's' : ''} created</div>
                <div style={{ color: 'var(--text2)' }}>⊘ {result.empSkipped} skipped (already exist)</div>
                <div>🆕 {result.assetCreated} asset{result.assetCreated !== 1 ? 's' : ''} created & assigned</div>
                <div>🔗 {result.assetAssigned} existing asset{result.assetAssigned !== 1 ? 's' : ''} assigned</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--red)', marginBottom: 6 }}>Errors:</div>
                {result.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--red)' }}>{e}</div>)}
              </div>
            )}
            <Btn onClick={() => { onDone?.(); onClose(); reset() }}>Close</Btn>
          </div>
        ) : importing ? (
          <div style={{ padding: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{progress.step}… ({progress.current}/{progress.total})</div>
            <div style={{ width: '100%', height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{pct}%</div>
          </div>
        ) : (
          <>
            {/* How it works */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>How it works</div>
              {NOTES.map((n, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 3 }}>• {n}</div>)}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn size="sm" onClick={downloadTemplate}>⬇ Download template</Btn>
              {sites?.length > 0 && (
                <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">No site</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>



            {/* File upload */}
            <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg3)', border:'2px dashed var(--border2)', borderRadius:'var(--radius)', cursor:'pointer', fontSize:13, color:'var(--text2)' }}>
              <span style={{ fontSize:20 }}>📂</span>
              <div>
                <div style={{ fontWeight:500, color:'var(--text)' }}>Click to upload CSV file</div>
                <div style={{ fontSize:11, marginTop:2 }}>or paste data below</div>
              </div>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display:'none' }} />
            </label>

            {fileName ? (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--green-bg)', border:'1px solid var(--green)', borderRadius:'var(--radius)', fontSize:13 }}>
                <span>✓</span>
                <span style={{ flex:1, color:'var(--green)', fontWeight:500 }}>{fileName}</span>
                <button onClick={()=>{ setCsv(''); setFileName(''); setPreview([]); setErrors([]) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, fontFamily:'var(--font)' }}>×</button>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:'var(--border)' }} />
                  <span style={{ fontSize:11, color:'var(--text3)' }}>or paste manually</span>
                  <div style={{ flex:1, height:1, background:'var(--border)' }} />
                </div>
                <textarea value={csv} onChange={e => { setFileName(''); if (e.target.value.trim()) handleCSV(e.target.value); else { setCsv(''); setPreview([]); setErrors([]) } }}
                  placeholder="Paste CSV data here…"
                  style={{ minHeight: 100, fontFamily: 'var(--mono)', fontSize: 12 }} />
              </>
            )}

            {errors.length > 0 && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>
                {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--red)' }}>{e}</div>)}
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && !errors.length && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
                <div style={{ padding: '6px 12px', background: 'var(--bg3)', fontSize: 11, color: 'var(--text2)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                  <span>PREVIEW ({preview.length} rows)</span>
                  <span>{Object.keys(Object.fromEntries(preview.map(r=>[r.name,1]))).length} unique employees</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                    {['Name','Email','Asset tag','Category','Model'].map(h => <th key={h} style={{ padding:'6px 10px', textAlign:'left', color:'var(--text2)', fontWeight:500, fontSize:11 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>{preview.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding:'6px 10px', fontWeight:500 }}>{r.name}</td>
                      <td style={{ padding:'6px 10px', color:'var(--text2)', fontSize:11 }}>{r.email||'—'}</td>
                      <td style={{ padding:'6px 10px', fontFamily:'var(--mono)', color: r.asset_tag ? 'var(--accent)' : 'var(--text3)' }}>{r.asset_tag||'no asset'}</td>
                      <td style={{ padding:'6px 10px', color:'var(--text2)', fontSize:11 }}>{r.asset_category||'—'}</td>
                      <td style={{ padding:'6px 10px', color:'var(--text2)' }}>{r.asset_model||'—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <Btn onClick={() => { onClose(); reset() }}>Cancel</Btn>
              <Btn variant="primary" onClick={doImport} disabled={!csv.trim() || importing || !!errors.length}>
                Import {rowCount > 0 ? rowCount + ' rows' : ''}
              </Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
