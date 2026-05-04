import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Modal } from './UI'

const TEMPLATE = `name,email,title,department,phone,location,hire_date,site_id,notes,asset_tag_1,asset_tag_2,asset_tag_3
John Smith,john@company.com,Engineer,IT,555-1234,Head Office,2024-01-15,,Primary laptop user,IT-001,IT-045,
Jane Doe,jane@company.com,Manager,Operations,555-5678,Site B,2023-06-01,,Dept manager,IT-002,,`

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { rows: [], errors: ['Need a header row and at least one data row.'] }
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const errs = []
  const rows = lines.slice(1).map((line, i) => {
    // Handle quoted fields
    const vals = []
    let cur = '', inQ = false
    for (const ch of line + ',') {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
      else cur += ch
    }
    const row = {}
    headers.forEach((h, j) => { row[h] = vals[j] || '' })
    if (!row.name) errs.push(`Row ${i + 2}: missing name`)
    return row
  })
  return { rows, errors: errs }
}

export default function ImportEmployeesCSV({ open, onClose, onDone, sites }) {
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [siteId, setSiteId] = useState('')
  const [progress, setProgress] = useState('')

  function handlePaste(text) {
    setCsv(text); setResult(null)
    if (!text.trim()) { setPreview([]); setErrors([]); return }
    const { rows, errors } = parseCSV(text)
    setPreview(rows.slice(0, 5)); setErrors(errors)
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'employee-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport() {
    const { rows, errors: errs } = parseCSV(csv)
    if (errs.length) { setErrors(errs); return }
    setImporting(true)
    let empCount = 0, assetCount = 0, skipCount = 0

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      setProgress(`Importing ${i + 1} of ${rows.length}: ${r.name}`)

      // Insert employee
      const empPayload = {
        name: r.name,
        email: r.email || null,
        title: r.title || null,
        department: r.department || null,
        phone: r.phone || null,
        location: r.location || null,
        notes: r.notes || null,
        hire_date: r.hire_date || null,
        site_id: r.site_id || siteId || null,
      }

      const { data: emp, error: empErr } = await supabase
        .from('employees').insert(empPayload).select().single()

      if (empErr) { skipCount++; continue }
      empCount++

      // Assign any asset tags listed
      const assetCols = Object.keys(r).filter(k => k.startsWith('asset_tag'))
      for (const col of assetCols) {
        const tag = r[col]?.trim()
        if (!tag) continue

        const { data: asset } = await supabase
          .from('assets').select('id, asset_tag').eq('asset_tag', tag).maybeSingle()

        if (asset) {
          await supabase.from('assets').update({
            assigned_to: r.name,
            status: 'Checked Out'
          }).eq('id', asset.id)

          await supabase.from('activity_log').insert({
            asset_id: asset.id,
            asset_tag: asset.asset_tag,
            asset_name: asset.asset_tag,
            type: 'checkout',
            message: `Assigned to ${r.name} via employee import`,
          })
          assetCount++
        }
      }
    }

    setImporting(false); setProgress('')
    setResult({ empCount, assetCount, skipCount })
    setCsv(''); setPreview([]); setErrors([])
    setTimeout(() => { onDone?.(); onClose() }, 2000)
  }

  const rowCount = csv.trim() && !errors.length ? parseCSV(csv).rows.length : 0

  return (
    <Modal open={open} onClose={onClose} title="Import employees + assets" width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Instructions */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>
          <div style={{ fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>How it works</div>
          <div>• Each row = one employee. Fill in their details plus up to 3 asset tags.</div>
          <div>• If the asset tag exists, it gets assigned to that employee (status → Checked Out).</div>
          <div>• Leave asset columns blank if the employee has no assets yet.</div>
          <div style={{ marginTop: 6, color: 'var(--accent)' }}>• Download the template to see the exact format.</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn size="sm" onClick={downloadTemplate}>⬇ Download template</Btn>
          {sites?.length > 0 && (
            <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Default site (optional)</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        <textarea
          value={csv}
          onChange={e => handlePaste(e.target.value)}
          placeholder="Paste CSV data here…"
          style={{ minHeight: 140, fontFamily: 'var(--mono)', fontSize: 12 }}
        />

        {errors.length > 0 && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--red)' }}>{e}</div>)}
          </div>
        )}

        {progress && (
          <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>⏳ {progress}</div>
        )}

        {result && (
          <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>✓ Import complete</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              {result.empCount} employee{result.empCount !== 1 ? 's' : ''} imported
              · {result.assetCount} asset{result.assetCount !== 1 ? 's' : ''} assigned
              {result.skipCount > 0 ? ` · ${result.skipCount} rows skipped` : ''}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && !result && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview (first {preview.length} rows)</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                  {['Name', 'Email', 'Title', 'Department', 'Hire date', 'Asset tags'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text2)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{preview.map((r, i) => {
                  const assetTags = Object.keys(r).filter(k => k.startsWith('asset_tag')).map(k => r[k]).filter(Boolean)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 500 }}>{r.name}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.email || '—'}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.title || '—'}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.department || '—'}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.hire_date || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>
                        {assetTags.length > 0
                          ? assetTags.map(t => <span key={t} style={{ fontSize: 11, fontFamily: 'var(--mono)', padding: '1px 6px', background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: 4, marginRight: 4 }}>{t}</span>)
                          : <span style={{ color: 'var(--text3)' }}>None</span>}
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={doImport} disabled={!csv.trim() || importing || errors.length > 0}>
            {importing ? 'Importing…' : `Import ${rowCount > 0 ? rowCount + ' employees' : ''}`}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
