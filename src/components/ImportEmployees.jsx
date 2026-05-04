import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Modal } from './UI'

const TEMPLATE = `name,email,title,department,phone,location,hire_date,notes
John Smith,john@company.com,IT Engineer,IT,555-1234,Office Floor 2,2024-01-15,
Jane Doe,jane@company.com,Manager,Operations,555-5678,HQ Desk 10,2023-06-01,`

export default function ImportEmployees({ open, onClose, onDone, sites }) {
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [siteId, setSiteId] = useState('')

  function parseCSV(text) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) return { rows: [], errors: ['CSV must have a header row and at least one data row.'] }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    const errs = []
    const rows = []
    lines.slice(1).forEach((line, i) => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row = {}
      headers.forEach((h, j) => { row[h] = vals[j] || '' })
      if (!row.name) errs.push(`Row ${i + 2}: missing name`)
      rows.push(row)
    })
    return { rows, errors: errs }
  }

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
    const payload = rows.map(r => ({
      name: r.name, email: r.email || null, title: r.title || null,
      department: r.department || null, phone: r.phone || null,
      location: r.location || null, notes: r.notes || null,
      hire_date: r.hire_date || null,
      site_id: siteId || null,
    }))
    const { data, error } = await supabase.from('employees').insert(payload).select()
    setImporting(false)
    if (error) { setErrors([error.message]); return }
    setResult({ count: data.length })
    setCsv(''); setPreview([]); setErrors([])
    setTimeout(() => { onDone?.(); onClose() }, 1500)
  }

  return (
    <Modal open={open} onClose={onClose} title="Import employees from CSV" width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>Paste CSV data or download the template.</p>
          <Btn size="sm" onClick={downloadTemplate}>⬇ Download template</Btn>
        </div>

        {sites?.length > 0 && (
          <div>
            <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Assign all to site (optional)</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ width: '100%' }}>
              <option value="">No site</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <textarea value={csv} onChange={e => handlePaste(e.target.value)} placeholder="Paste CSV data here…" style={{ minHeight: 140, fontFamily: 'var(--mono)', fontSize: 12 }} />

        {errors.length > 0 && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--red)' }}>{e}</div>)}
          </div>
        )}

        {result && (
          <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--green)' }}>
            ✓ Successfully imported {result.count} employee{result.count !== 1 ? 's' : ''}
          </div>
        )}

        {preview.length > 0 && !result && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview (first {preview.length} rows)</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Email', 'Title', 'Department', 'Hire Date'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text2)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{preview.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.email || '—'}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.title || '—'}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.department || '—'}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.hire_date || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={doImport} disabled={!csv.trim() || importing || errors.length > 0}>
            {importing ? 'Importing…' : `Import ${csv.trim() ? parseCSV(csv).rows.length : ''} employees`}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
