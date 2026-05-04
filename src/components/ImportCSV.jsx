import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal } from './UI'

function normalizeDate(val) {
  if (!val || !val.trim()) return null
  const v = val.trim()
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  // MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
    const [m, d, y] = v.split('/')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(v)) {
    const [d, m, y] = v.split('/')
    return `20${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // MM-DD-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(v)) {
    const [m, d, y] = v.split('-')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(v)) {
    const [d, m, y] = v.split('.')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // Try native parse as fallback
  try {
    const d = new Date(v)
    if (!isNaN(d)) return d.toISOString().slice(0, 10)
  } catch {}
  return null
}


const TEMPLATE = `asset_tag,asset_category,asset_model,asset_serial,status,location,assigned_to,assigned_to_team,purchase_date,provision_date,purchase_cost,warranty_expiry,cpu,gpu,ram,ssd,hdd,mac_wifi,mac_lan,os_version,notes
IT-001,LAPTOP,Apple MacBook Pro 14,C02XL1234,Available,Head Office,,,2024-01-15,2499.00,2027-01-15,Apple M3 Pro,Apple M3 GPU,18GB,512GB NVMe,,,00:1A:2B:3C:4D:5E,macOS Sonoma 14.0,
IT-002,LAPTOP,Dell XPS 15,DL-98765,Checked Out,Head Office,John Smith,,2023-06-01,1899.00,2026-06-01,Intel i7-13700H,NVIDIA RTX 4060,16GB DDR5,512GB NVMe,,,00:AA:BB:CC:DD:EE,Windows 11 Pro,
IT-003,PHONE,iPhone 15 Pro,IP-11111,Available,Head Office,,,,,,,,,,,00:BB:CC:DD:EE:FF,iOS 17,
IT-004,PRINTER,HP LaserJet Pro,HP-22222,Checked Out,Floor 2,,Finance Team,2022-03-01,599.00,2025-03-01,,,,,,,,,Shared printer`

export default function ImportCSV({ open, onClose, onDone }) {
  const { profile } = useAuth()
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

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
      if (!row.asset_tag) errs.push(`Row ${i + 2}: missing asset_tag`)
      if (row.category && !['IT Equipment', 'Tools & Equipment'].includes(row.category)) {
        errs.push(`Row ${i + 2}: category must be "IT Equipment" or "Tools & Equipment"`)
      }
      rows.push(row)
    })
    return { rows, errors: errs }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => handlePaste(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  function handlePaste(text) {
    setCsv(text)
    setResult(null)
    if (!text.trim()) { setPreview([]); setErrors([]); return }
    const { rows, errors } = parseCSV(text)
    setPreview(rows.slice(0, 5))
    setErrors(errors)
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'asset-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport() {
    const { rows, errors: errs } = parseCSV(csv)
    if (errs.length) { setErrors(errs); return }
    setImporting(true)
    const payload = rows.map(r => ({
      asset_tag: r.asset_tag,
      name: r.asset_model || r.asset_tag,
      category: (r.asset_category || 'LAPTOP').toUpperCase(),
      status: r.status || 'Available',
      model: r.asset_model || null,
      serial_number: r.asset_serial || null,
      location: r.location || null,
      assigned_to: r.assigned_to || null,
      assigned_to_team: r.assigned_to_team || null,
      purchase_date: normalizeDate(r.purchase_date),
      provision_date: normalizeDate(r.provision_date),
      purchase_cost: r.purchase_cost ? parseFloat(r.purchase_cost) : null,
      warranty_expiry: normalizeDate(r.warranty_expiry),
      notes: r.notes || null,
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
    }))
    const { data, error } = await supabase.from('assets').insert(payload).select()
    if (!error && data) {
      await supabase.from('activity_log').insert(data.map(a => ({
        asset_id: a.id, asset_tag: a.asset_tag, asset_name: a.name,
        type: 'created', message: `Imported via CSV by ${profile?.email}`,
        performed_by: profile?.email,
      })))
    }
    setImporting(false)
    if (error) { setErrors([error.message]) }
    else {
      setResult({ count: data.length })
      setCsv(''); setPreview([]); setErrors([])
      setTimeout(() => { onDone?.(); onClose() }, 1500)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import assets from CSV" width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>Paste your CSV data below or download the template to get started.</p>
          <Btn size="sm" onClick={downloadTemplate}>⬇ Download template</Btn>
        </div>
        <textarea value={csv} onChange={e => handlePaste(e.target.value)} placeholder="Paste CSV data here…" style={{ minHeight: 160, fontFamily: 'var(--mono)', fontSize: 12 }} />
        {errors.length > 0 && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--red)' }}>{e}</div>)}
          </div>
        )}
        {result && (
          <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--green)' }}>
            ✓ Successfully imported {result.count} asset{result.count !== 1 ? 's' : ''}
          </div>
        )}
        {preview.length > 0 && !result && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview (first {preview.length} rows)</div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Tag','Name','Category','Status','Location'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text2)', fontWeight: 500 }}>{h}</th>)}
                </tr></thead>
                <tbody>{preview.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>{r.asset_tag}</td>
                    <td style={{ padding: '6px 10px' }}>{r.name}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.category}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.status}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{r.location}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={doImport} disabled={!csv.trim() || importing || errors.length > 0}>
            {importing ? 'Importing…' : `Import ${csv.trim() ? parseCSV(csv).rows.length : ''} assets`}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
