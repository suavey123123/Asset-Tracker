import { useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Btn, Modal } from './UI'


// --- Normalization helpers ---

function normalizeDate(val) {
  if (!val || !String(val).trim()) return null
  const v = String(val).trim()
  // Excel serial date (e.g. 45692) — clamp to year 2050 max to avoid absurd future dates
  if (/^\d{4,5}$/.test(v)) {
    const serial = parseInt(v)
    if (serial > 30000 && serial < 60000) {
      const excelEpoch = new Date(1899, 11, 30)
      const date = new Date(excelEpoch.getTime() + serial * 86400000)
      if (date.getFullYear() < 2100) return date.toISOString().slice(0, 10)
      return null
    }
  }
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

function normalizeImei(val) {
  if (!val) return null
  let s = String(val)
  // Excel formula representation: =\"351876499606414\" or ="351876499606414"
  s = s.replace(/^=?"?/, '').replace(/"?\s*$/, '').trim()
  if (s.includes('E+') || s.includes('e+')) return String(Math.round(parseFloat(s)))
  return s
}

function buildSpecs(r) {
  const specs = {
    CPU: r.cpu || null, GPU: r.gpu || null, RAM: r.ram || null,
    SSD: r.ssd || null, HDD: r.hdd || null,
    'MAC ADDRESS (WIFI)': r.mac_wifi || null,
    'MAC ADDRESS (LAN)': r.mac_lan || null,
    'OS VERSION': r.os_version || null,
    'RESOLUTION': r.resolution || null,
    'SIZE': r.size || null,
  }
  return Object.values(specs).some(v => v) ? specs : null
}

// Truncate long display strings (subStep, labels)
function truncate(str, max = 50) {
  if (!str || str.length <= max) return str
  return str.substring(0, max).replace(/\S+$/, '…') + str.substring(str.length - 20)
}

// --- CSV parsing ---

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

function detectDelimiter(headerLine) {
  // Count semicolons and commas that are NOT inside quoted fields
  let semiCount = 0, commaCount = 0, inQ = false
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i]
    if (ch === '"') inQ = !inQ
    else if (!inQ) {
      if (ch === ';') semiCount++
      else if (ch === ',') commaCount++
    }
  }
  return semiCount > commaCount ? ';' : ','
}

function parseCSVRow(line, delimiter) {
  if (delimiter === ';') return line.split(';').map(v => v.trim().replace(/^"|"$/g, ''))
  return parseCSVLine(line)
}

function parseCSV(text) {
  const raw = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = raw.split('\n').filter(l => l.replace(/,/g,'').replace(/;/g,'').trim())
  if (lines.length < 2) return { rows: [], errors: ['Need a header row and at least one data row.'] }

  // Auto-detect delimiter with better counting
  const delimiter = detectDelimiter(lines[0])

  const headers = parseCSVRow(lines[0], delimiter).map(h =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  )
  const errs = []
  const rows = lines.slice(1).map((line, i) => {
    const vals = parseCSVRow(line, delimiter)
    const row = {}
    headers.forEach((h, j) => { row[h] = (vals[j] || '').trim() })
    return { ...row, _line: i + 2 }
  })

  // Validate: rows with assigned_to_team must have asset_tag
  rows.filter(r => r.assigned_to_team?.trim() && !r.asset_tag?.trim()).forEach(r => {
    errs.push(`Row ${r._line}: assigned_to_team set but asset_tag is missing`)
  })

  // Warn about asset_tag rows with no employee name/assigned_to
  rows.filter(r => r.asset_tag && !r.name?.trim() && !r.assigned_to?.trim()).forEach(r => {
    if (!r.assigned_to_team) {
      errs.push(`Row ${r._line}: asset_tag "${r.asset_tag}" has no employee name or assigned_to`)
    }
  })

  const validRows = rows.filter(r => (r.name && r.name.trim()) || (r.asset_tag && r.assigned_to_team))
  return { rows: validRows, errors: errs }
}


// --- Template ---

const TEMPLATE = `name,email,title,department,phone,hire_date,asset_tag,asset_category,asset_model,asset_serial,purchase_date,provision_date,purchase_cost,assigned_to,assigned_to_team,cpu,gpu,ram,ssd,hdd,mac_wifi,mac_lan,os_version,resolution,size,seat_number,locked_status,carrier,imei,notes
John Smith,john@company.com,IT Engineer,IT,555-1234,2024-01-15,IT-001,LAPTOP,Dell XPS 15,SN-12345,5/29/2025,6/1/2025,$1899.00,John Smith,,Intel i7-13700H,NVIDIA RTX 4060,16GB DDR5,512GB NVMe,,00:1A:2B:3C:4D:5E,00:1A:2B:3C:4D:5F,Windows 11 Pro,2560x1600,15",,,,
John Smith,john@company.com,IT Engineer,IT,555-1234,2024-01-15,IT-045,PHONE,iPhone 15,SN-67890,5/29/2025,6/1/2025,$999.00,John Smith,,A15 6-core,4-core graphics,4GB,64GB,,d0:88:0c:c4:b5:c6,,iOS 17,,6.1",Unlocked,T-Mobile,351876499606414
Jane Doe,jane@company.com,IT Manager,IT,555-5678,2023-06-01,IT-002,LAPTOP,MacBook Pro 14,SN-11111,5/25/2023,6/1/2023,$2499.00,Jane Doe,,Apple M3 Pro,Apple M3 GPU,18GB,512GB NVMe,,00:AA:BB:CC:DD:EE,00:AA:BB:CC:DD:EF,macOS Sonoma 14,3024x1964,14",,,
,,,,,,IT-099,MONITOR,Dell S2722DC,SN-99999,1/1/2024,1/5/2024,$350.00,,Tradeshow Equipment,,,,,,,,,,27",A-101,,, `

const NOTES = [
  'One row per asset. If an employee has 2 assets, add 2 rows with the same employee details.',
  'asset_tag is required per row. All other asset fields are optional.',
  'If the asset tag already exists it will be assigned. If not, a new asset will be created.',
  'Employee details only get created once — duplicate names are automatically skipped.',
  'Dates accept any format: 5/29/2025, 2025-05-29, 29/05/2025 etc.',
  'Costs accept $ signs and commas: $1,899.00 or 1899.00 both work.',
  'IMEI numbers from Excel may show as formulas (e.g. ="3.5187E+14") — these are auto-normalized.',
  'Maximum file size: 5 MB.',
]


// --- Main component ---

export default function ImportEmployeesCSV({ open, onClose, onDone, sites }) {
  const abortRef = useRef(false)
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ step: '', current: 0, total: 0, subStep: '' })
  const [result, setResult] = useState(null)
  const [siteId, setSiteId] = useState('')

  // Memoized parsed rows to avoid re-parsing on every render
  const parsed = useMemo(() => csv.trim() ? parseCSV(csv) : { rows: [], errors: [] }, [csv])

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setErrors([`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`])
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      setErrors([])
      const { rows, errors: errs } = parseCSV(text)
      setPreview(rows.slice(0, 5))
      setErrors(errs)
      if (!errs.length) {
        setCsv(text)
        setFileName(file.name)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleCSV(text) {
    setCsv(text); setErrors([]); setFileName('')
    if (!text.trim()) { setPreview([]); return }
    const { rows, errors } = parseCSV(text)
    setPreview(rows.slice(0, 5))
    setErrors(errors)
  }

  function onCsvChange(e) {
    setFileName('')
    const v = e.target.value
    if (v.trim()) handleCSV(v)
    else { setCsv(''); setPreview([]); setErrors([]) }
  }

  function downloadTemplate() {
    const blob = new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'employee-asset-import.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport() {
    // Issue #7: allow cancellation
    abortRef.current = false
    const { rows, errors: errs } = parsed
    if (errs.length) { setErrors(errs); return }

    // Separate rows into categories
    const teamRows = rows.filter(r => !r.name?.trim() && r.asset_tag && r.assigned_to_team)
    const employeeRows = rows.filter(r => r.name?.trim())
    const assetRows = rows.filter(r => r.asset_tag && r.name?.trim())

    // Issue #10: O(1) lookup with Set
    const empNameSet = new Set(employeeRows.map(r => r.name))
    const nameSet = new Set()
    employeeRows.forEach(r => nameSet.add(r.name))
    assetRows.filter(r => r.assigned_to?.trim()).forEach(r => nameSet.add(r.assigned_to))
    const extraNames = [...nameSet].filter(n => !empNameSet.has(n))

    // Group employee rows by name
    const empMap = {}
    employeeRows.forEach(r => {
      if (!empMap[r.name]) empMap[r.name] = { details: r, assets: [] }
      if (r.asset_tag) empMap[r.name].assets.push(r)
    })
    extraNames.forEach(n => { empMap[n] = { details: n, assets: [] } })
    const employees = Object.values(empMap)

    let empCreated = 0, empSkipped = 0, empChanged = 0
    let assetCreated = 0, assetAssigned = 0, assetErrors = 0
    const errors = []
    const activityLogEntries = [] // Issue #4: batch activity logs

    // Issue #3: email dedup
    const normalizeForLookup = (name) => name.trim().toLowerCase()

    // Step 1: Create/update employees
    const nameToId = {}
    const seenNormalised = {}

    for (let i = 0; i < employees.length; i++) {
      if (abortRef.current) { errors.push('Import cancelled by user'); break }

      const emp = employees[i]
      const empName = typeof emp.details === 'string' ? emp.details : emp.details.name
      const normName = normalizeForLookup(empName)

      if (seenNormalised[normName]) { empSkipped++; continue }
      seenNormalised[normName] = empName

      setProgress({ step: 'Creating employees', current: i + 1, total: employees.length, subStep: truncate(empName) })

      try {
        // Issue #3: lookup by name AND check email collision
        const { data: existing } = await supabase.from('employees').select('id, name, email').ilike('name', empName).maybeSingle()

        const empPayload = typeof emp.details === 'string'
          ? { name: empName, ...(siteId ? { site_id: siteId } : {}) }
          : {
              name: emp.details.name,
              email: emp.details.email || null,
              title: emp.details.title || null,
              department: emp.details.department || null,
              phone: emp.details.phone || null,
              hire_date: normalizeDate(emp.details.hire_date),
              ...(siteId ? { site_id: siteId } : {}),
            }

        if (existing) {
          // Check if this is a true duplicate (same name + same email) or a name collision
          const empEmail = (empPayload.email || '').toLowerCase()
          const existingEmail = (existing.email || '').toLowerCase()
          const isSamePerson = !empEmail || empEmail === existingEmail
          const isDuplicateName = empEmail && empEmail !== existingEmail

          if (isSamePerson) {
            // Issue #5: diff fields before update, only update changed ones
            const changedFields = {}
            for (const [key, value] of Object.entries(empPayload)) {
              if (String(value ?? '') !== String(existing[key] ?? '')) {
                changedFields[key] = value
              }
            }
            if (Object.keys(changedFields).length > 0) {
              const { error } = await supabase.from('employees').update(changedFields).eq('id', existing.id)
              if (error) errors.push(`Employee ${empName}: ${error.message}`)
              else empChanged++
            }
            nameToId[normName] = existing.id
          } else if (isDuplicateName) {
            // Issue #3: name collision — same name, different email, keep existing
            empSkipped++
            nameToId[normName] = existing.id
            errors.push(`"${empName}": name collision — "${existing.name}" exists with email ${existing.email}; kept existing record`)
          } else {
            empSkipped++
            nameToId[normName] = existing.id
          }
        } else {
          const { data: inserted, error } = await supabase.from('employees').insert(empPayload).select('id').single()
          if (error) { errors.push(`Employee ${empName}: ${error.message}`); empSkipped++ }
          else { empCreated++; nameToId[normName] = inserted?.id }
        }
      } catch (e) {
        // Issue #2: per-row error isolation
        errors.push(`Employee ${empName}: ${e.message}`)
        empSkipped++
      }
    }

    // Step 2: Create/assign assets in batches (Issue #1)
    const assetRowList = rows.filter(r => r.asset_tag)
    const totalAssets = assetRowList.length
    if (totalAssets > 0) setProgress({ step: 'Assigning assets', current: 0, total: totalAssets })

    const resolveEmpId = (rawName) => {
      if (!rawName || !rawName.trim()) return null
      return nameToId[normalizeForLookup(rawName)] || null
    }

    // Process assets in parallel batches of 10
    const BATCH_SIZE = 10
    for (let start = 0; start < assetRowList.length && !abortRef.current; start += BATCH_SIZE) {
      const batch = assetRowList.slice(start, start + BATCH_SIZE)
      setProgress({
        step: 'Assigning assets',
        current: Math.min(start + BATCH_SIZE, totalAssets),
        total: totalAssets,
        subStep: truncate(`${batch[0]?.asset_tag} → ${batch[0]?.name || batch[0]?.assigned_to}`),
      })

      const results = await Promise.all(batch.map(async (r) => {
        try {
          // Issue #2: per-row try/catch
          const { data: existing } = await supabase.from('assets')
            .select('id, asset_tag, model, serial_number, purchase_date, provision_date, purchase_cost, assigned_to, assigned_to_team, seat_number, quick_note, locked_status, carrier, imei, specs')
            .eq('asset_tag', r.asset_tag).maybeSingle()

          if (existing) {
            // Issue #5: diff before update
            const empId = resolveEmpId(r.assigned_to) || resolveEmpId(r.name) || null
            const updates = { status: 'Checked Out' }
            const fieldMap = {
              model: r.asset_model, serial_number: r.asset_serial,
              purchase_date: normalizeDate(r.purchase_date), provision_date: normalizeDate(r.provision_date),
              purchase_cost: cleanCost(r.purchase_cost), assigned_to: empId,
              assigned_to_team: r.assigned_to_team, seat_number: r.seat_number,
              quick_note: r.notes, locked_status: r.locked_status, carrier: r.carrier,
              imei: normalizeImei(r.imei), specs: buildSpecs(r),
            }
            for (const [key, value] of Object.entries(fieldMap)) {
              const existingVal = key === 'specs' ? JSON.stringify(existing.specs) : existing[key]
              if (String(value ?? '') !== String(existingVal ?? '')) updates[key] = value
            }

            const { error } = await supabase.from('assets').update(updates).eq('id', existing.id)
            if (error) { assetErrors++; return { ok: false, tag: r.asset_tag, error: error.message } }

            if (empId && empId !== existing.assigned_to) {
              activityLogEntries.push({
                asset_id: existing.id, asset_tag: existing.asset_tag,
                asset_name: existing.asset_tag, type: 'checkout',
                message: `Assigned to ${r.name || r.assigned_to} via bulk import`,
                performed_by: 'import',
              }) // Issue #4, #14
            }
            assetAssigned++
            return { ok: true }
          } else {
            const empId = resolveEmpId(r.assigned_to) || resolveEmpId(r.name) || null
            const { data: newAsset, error } = await supabase.from('assets').insert({
              asset_tag: r.asset_tag,
              name: r.asset_model || r.asset_tag,
              model: r.asset_model || null,
              category: (r.asset_category || 'OTHER').toUpperCase().trim().replace(/[^A-Z0-9 &()-]/g, '').substring(0, 50) || 'OTHER',
              serial_number: r.asset_serial || null,
              purchase_date: normalizeDate(r.purchase_date),
              provision_date: normalizeDate(r.provision_date),
              purchase_cost: cleanCost(r.purchase_cost),
              status: 'Checked Out',
              assigned_to: empId,
              assigned_to_team: r.assigned_to_team || null,
              location: sites?.find(s => s.id === siteId)?.name || null,
              seat_number: r.seat_number || null,
              quick_note: r.notes || null,
              locked_status: r.locked_status || null,
              carrier: r.carrier || null,
              imei: normalizeImei(r.imei),
              specs: buildSpecs(r),
            }).select().single()

            if (error) { errors.push(`Asset ${r.asset_tag}: ${error.message}`); assetErrors++; return { ok: false } }
            else {
              const msg = empId
                ? `Created and assigned to ${r.name || r.assigned_to} via bulk import`
                : `Created (unassigned) via bulk import`
              activityLogEntries.push({
                asset_id: newAsset.id, asset_tag: newAsset.asset_tag,
                asset_name: newAsset.asset_tag, type: 'created', message: msg,
                performed_by: 'import',
              }) // Issue #4, #14
              assetCreated++
              return { ok: true }
            }
          }
        } catch (e) {
          // Issue #2: per-row error isolation
          errors.push(`Asset ${r.asset_tag}: ${e.message}`)
          assetErrors++
          return { ok: false }
        }
      }))

      if (abortRef.current) { errors.push('Import cancelled by user'); break }
    }

    // Issue #4, #14: batch insert all activity logs
    if (activityLogEntries.length > 0) {
      try {
        await supabase.from('activity_log').insert(
          activityLogEntries
        )
      } catch (e) {
        errors.push(`Activity log: ${e.message}`)
      }
    }

    // Step 3: Team-use assets in batches
    if (teamRows.length > 0) {
      setProgress({ step: 'Team-use assets', current: 0, total: teamRows.length })

      for (let start = 0; start < teamRows.length && !abortRef.current; start += BATCH_SIZE) {
        const batch = teamRows.slice(start, start + BATCH_SIZE)
        setProgress({
          step: 'Team-use assets',
          current: Math.min(start + BATCH_SIZE, teamRows.length),
          total: teamRows.length,
          subStep: truncate(batch[0]?.asset_tag),
        })

        await Promise.all(batch.map(async (r) => {
          try {
            // Issue #2: per-row try/catch
            const { data: existing } = await supabase.from('assets')
              .select('id, asset_tag, status')
              .eq('asset_tag', r.asset_tag).maybeSingle()

            if (existing) {
              const { error } = await supabase.from('assets').update({
                assigned_to_team: r.assigned_to_team,
                status: r.status || 'Available',
              }).eq('id', existing.id)
              if (error) { errors.push(`Team asset ${r.asset_tag}: ${error.message}`); assetErrors++ }
              else {
                assetAssigned++
                activityLogEntries.push({
                  asset_id: existing.id, asset_tag: existing.asset_tag,
                  asset_name: existing.asset_tag, type: 'checkin',
                  message: `Assigned to team "${r.assigned_to_team}" via bulk import`,
                  performed_by: 'import',
                })
              }
            } else {
              const { data: newAsset, error } = await supabase.from('assets').insert({
                asset_tag: r.asset_tag,
                name: r.asset_model || r.asset_tag,
                model: r.asset_model || null,
                category: (r.asset_category || 'OTHER').toUpperCase().trim().replace(/[^A-Z0-9 &()-]/g, '').substring(0, 50) || 'OTHER',
                serial_number: r.asset_serial || null,
                assigned_to_team: r.assigned_to_team,
                status: r.status || 'Available',
                location: sites?.find(s => s.id === siteId)?.name || null,
              }).select().single()

              if (error) { errors.push(`Team asset ${r.asset_tag}: ${error.message}`); assetErrors++ }
              else {
                assetCreated++
                activityLogEntries.push({
                  asset_id: newAsset.id, asset_tag: newAsset.asset_tag,
                  asset_name: newAsset.asset_tag, type: 'created',
                  message: `Created for team "${r.assigned_to_team}" via bulk import`,
                  performed_by: 'import',
                })
              }
            }
          } catch (e) {
            // Issue #2: per-row error isolation
            errors.push(`Team asset ${r.asset_tag}: ${e.message}`)
            assetErrors++
          }
        }))

        if (abortRef.current) { errors.push('Import cancelled by user'); break }
      }
    }

    setImporting(false)
    setProgress({ step: '', current: 0, total: 0, subStep: '' })
    setResult({ empCreated, empSkipped, empChanged, assetCreated, assetAssigned, assetErrors, errors })
  }

  function reset() {
    abortRef.current = true
    setCsv(''); setFileName(''); setPreview([]); setErrors([]); setResult(null); setSiteId('')
    setProgress({ step: '', current: 0, total: 0, subStep: '' })
  }

  const rowCount = parsed.rows.length
  const pct = progress.total > 0 ? Math.round(progress.current / progress.total * 100) : 0

  return (
    <Modal open={open} onClose={() => { if (!result && !importing) { onClose(); reset() } }} title="Import employees + assets" width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--green)', marginBottom: 8 }}>✓ Import complete</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 13 }}>
                <div>👤 {result.empCreated} employee{result.empCreated !== 1 ? 's' : ''} created</div>
                <div style={{ color: 'var(--text2)' }}>⊘ {result.empSkipped} skipped (already exist)</div>
                {result.empChanged > 0 && <div style={{ color: 'var(--amber)' }}>✏ {result.empChanged} employee{result.empChanged !== 1 ? '' : ''} updated</div>}
                <div>🆕 {result.assetCreated} asset{result.assetCreated !== 1 ? 's' : ''} created & assigned</div>
                <div>🔗 {result.assetAssigned} existing asset{result.assetAssigned !== 1 ? 's' : ''} assigned</div>
                {result.assetErrors > 0 && <div style={{ color: 'var(--red)' }}>✖ {result.assetErrors} asset{result.assetErrors !== 1 ? '' : ''} failed</div>}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--red)', marginBottom: 6 }}>Errors:</div>
                {result.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--red)' }}>{e}</div>)}
              </div>
            )}
            <Btn variant="primary" onClick={() => { onDone?.(); onClose(); reset() }}>✓ Done</Btn>
          </div>
        ) : importing ? (
          <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Overall progress */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13 }}>
                <span style={{ fontWeight:500 }}>{progress.step}</span>
                <span style={{ fontFamily:'var(--mono)', color:'var(--accent)' }}>{pct}%</span>
              </div>
              <div style={{ height:10, background:'var(--bg4)', borderRadius:5, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:5, transition:'width 0.2s ease' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:11, color:'var(--text3)' }}>
                <span>{progress.current} of {progress.total}</span>
                <span>{progress.total - progress.current} remaining</span>
              </div>
            </div>
            {/* Current item — Issue #9: populated with meaningful subStep text */}
            {progress.subStep && (
              <div style={{ fontSize:12, color:'var(--text2)', background:'var(--bg3)', borderRadius:'var(--radius)', padding:'8px 12px', fontFamily:'var(--mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                ⟳ {progress.subStep}
              </div>
            )}
            <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>Please keep this window open until import completes</div>
            {/* Issue #7: cancel button */}
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <Btn variant="danger" size="sm" onClick={reset}>Cancel import</Btn>
            </div>
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
                <textarea value={csv} onChange={onCsvChange} placeholder="Paste CSV data here…" style={{ minHeight: 100, fontFamily: 'var(--mono)', fontSize: 12 }} />
              </>
            )}

            {errors.length > 0 && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>
                {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--red)' }}>{e}</div>)}
              </div>
            )}

            {/* Preview — Issue #8: memoized parsed rows used here */}
            {preview.length > 0 && (
              <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)' }}>
                <div style={{ padding:'6px 12px', background:'var(--bg3)', fontSize:11, color:'var(--text2)', fontWeight:500, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>PREVIEW ({preview.length} of {rowCount} rows)</span>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:11, padding:0 }}
                  >
                    {showPreview ? 'Show less ▲' : 'Show all ▼'}
                  </button>
                </div>
                <div style={{ overflowX:'scroll', overflowY:'auto', maxHeight: showPreview ? 400 : 220, WebkitOverflowScrolling:'touch' }}>
                    <table style={{ borderCollapse:'collapse', fontSize:12, tableLayout:'auto', whiteSpace:'nowrap' }}>
                      <thead><tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg3)' }}>
                        {['Name','Email','Asset tag','Category','Model','Serial','Purchase date','Provision date','Cost','Assigned To','Team Use','CPU','GPU','RAM','SSD','HDD','MAC WiFi','MAC LAN','OS Version','Resolution','Size','Seat #','Lock Status','Carrier','IMEI','Notes'].map(h=>(
                          <th key={h} style={{ padding:'6px 12px', textAlign:'left', color:'var(--text2)', fontWeight:500, fontSize:11, whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{(showPreview ? preview : preview.slice(0, 5)).map((r,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                          <td style={{ padding:'6px 12px', fontWeight:500, whiteSpace:'nowrap' }}>{r.name||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.email||'—'}</td>
                          <td style={{ padding:'6px 12px', fontFamily:'var(--mono)', color:r.asset_tag?'var(--accent)':'var(--text3)', whiteSpace:'nowrap' }}>{r.asset_tag||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.asset_category||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.asset_model||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', fontFamily:'var(--mono)', fontSize:11, whiteSpace:'nowrap' }}>{r.asset_serial||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.purchase_date||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.provision_date||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.purchase_cost||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.assigned_to||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.assigned_to_team||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.cpu||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.gpu||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.ram||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.ssd||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.hdd||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', fontFamily:'var(--mono)', fontSize:11, whiteSpace:'nowrap' }}>{r.mac_wifi||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', fontFamily:'var(--mono)', fontSize:11, whiteSpace:'nowrap' }}>{r.mac_lan||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.os_version||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.resolution||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.size||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.seat_number||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.locked_status||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.carrier||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', fontFamily:'var(--mono)', fontSize:11, whiteSpace:'nowrap' }}>{r.imei||'—'}</td>
                          <td style={{ padding:'6px 12px', color:'var(--text2)', whiteSpace:'nowrap' }}>{r.notes||'—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <Btn onClick={() => { onClose(); reset() }}>Cancel</Btn>
              <Btn variant="primary" onClick={doImport} disabled={!csv.trim() || !!errors.length}>
                Import {rowCount > 0 ? rowCount + ' rows' : ''}
              </Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
