import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, Modal, FormField, Spinner, StatusSelect } from './UI'
import CategorySelect from './CategorySelect'
import { SPEC_FIELDS, TECH_SPEC_CATEGORIES } from '../lib/constants'
import EmployeeSelect from './EmployeeSelect'

const EMPTY_FORM = {
  asset_tag: '', name: '', category: 'LAPTOP', status: 'Available', model: '',
  serial_number: '', location: '', purchase_date: '', purchase_cost: '',
  warranty_expiry: '', provision_date: '', notes: '', specs: {},
  locked_status: '', carrier: '', imei: '', seat_number: '',
  assigned_to: '', assigned_to_team: '', site_id: '',
}

export default function AssetEditModal({ asset, open, onSave, onCancel, allSites, allLicenses, isCreate }) {
  const { profile } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [formLicenses, setFormLicenses] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sites, setSites] = useState(allSites || [])
  const [licenses, setLicenses] = useState(allLicenses || [])
  const [loadingExisting, setLoadingExisting] = useState(false)
  const originalLicenses = useRef(null)

  useEffect(() => { setSites(allSites || []) }, [allSites])
  useEffect(() => { setLicenses(allLicenses || []) }, [allLicenses])

  // Reset form when asset changes or modal opens
  useEffect(() => {
    if (!open) { setFormLicenses([]); setError(''); setLoadingExisting(false); return }

    if (isCreate) {
      setForm({ asset_tag: '', name: '', category: 'LAPTOP', status: 'Available', model: '', serial_number: '', location: '', purchase_date: '', purchase_cost: '', warranty_expiry: '', provision_date: '', notes: '', specs: {}, locked_status: '', carrier: '', imei: '', seat_number: '', assigned_to: '', assigned_to_team: '', site_id: '' })
      setFormLicenses([])
      setError('')
      setLoadingExisting(false)
    } else if (asset) {
      setForm({
        asset_tag: asset.asset_tag || '',
        name: asset.name || '',
        category: asset.category || 'LAPTOP',
        status: asset.status || 'Available',
        model: asset.model || '',
        serial_number: asset.serial_number || '',
        location: asset.location || '',
        purchase_date: asset.purchase_date?.slice(0, 10) || '',
        purchase_cost: asset.purchase_cost || '',
        warranty_expiry: asset.warranty_expiry?.slice(0, 10) || '',
        provision_date: asset.provision_date?.slice(0, 10) || '',
        notes: asset.notes || '',
        specs: asset.specs || {},
        locked_status: asset.locked_status || '',
        carrier: asset.carrier || '',
        imei: asset.imei || '',
        seat_number: asset.seat_number || '',
        assigned_to: asset.assigned_to || '',
        assigned_to_team: asset.assigned_to_team || '',
        site_id: asset.site_id || '',
      })
      // Load existing license assignments
      setLoadingExisting(true)
      setFormLicenses([])
      setError('')
      supabase.from('asset_license_assignments').select('license_id').eq('asset_id', asset.id)
        .then(({ data }) => {
          const ids = data?.map(a => a.license_id) || []
          originalLicenses.current = new Set(ids)
          setFormLicenses(ids)
          setLoadingExisting(false)
        })
        .catch(() => { setLoadingExisting(false) })
    }
  }, [asset, open, isCreate])

  async function save() {
    if (!form.asset_tag.trim()) { setError('Asset Tag is required.'); return }
    const finalName = form.asset_tag.trim()
    setSaving(true); setError('')
    const payload = {
      ...form,
      name: finalName,
      purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
      purchase_date: form.purchase_date || null,
      provision_date: form.provision_date || null,
      warranty_expiry: form.warranty_expiry || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      notes: form.notes || null,
      locked_status: form.locked_status || null,
      carrier: form.carrier || null,
      imei: form.imei || null,
      seat_number: form.seat_number || null,
      specs: form.specs || {},
      site_id: form.site_id || null,
      location: form.site_id ? (sites.find(s => s.id === form.site_id)?.name || null) : form.location || null,
    }
    try {
      let savedAsset
      if (isCreate) {
        const { data: created, error: e } = await supabase.from('assets').insert(payload).select().single()
        if (e) { setError(e.message); setSaving(false); return }
        savedAsset = created
        // Assign licenses for new asset
        if (formLicenses.length > 0) {
          for (const licId of formLicenses) {
            try {
              await supabase.from('asset_license_assignments').insert({ asset_id: created.id, license_id: licId, assigned_to: form.assigned_to || null })
              await supabase.rpc('increment_license_seats', { license_id: licId })
            } catch { /* non-critical */ }
          }
        }
      } else {
        // Edit mode — save asset fields + handle license additions/removals
        const { error: e } = await supabase.from('assets').update(payload).eq('id', asset.id)
        if (e) { setError(e.message); setSaving(false); return }
        savedAsset = { ...asset, ...payload }
        // Diff: current checkboxes vs what was loaded on mount
        const currentLicIds = new Set(formLicenses)
        const origLicIds = originalLicenses.current || new Set()
        for (const licId of origLicIds) {
          if (!currentLicIds.has(licId)) {
            try {
              await supabase.from('asset_license_assignments').delete().eq('asset_id', asset.id).eq('license_id', licId)
              await supabase.rpc('decrement_license_seats', { license_id: licId })
            } catch { /* non-critical */ }
          }
        }
        for (const licId of currentLicIds) {
          if (!origLicIds.has(licId)) {
            try {
              await supabase.from('asset_license_assignments').insert({ asset_id: asset.id, license_id: licId, assigned_to: form.assigned_to || null })
              await supabase.rpc('increment_license_seats', { license_id: licId })
            } catch { /* non-critical */ }
          }
        }
      }
      await logActivity(savedAsset.id, savedAsset.asset_tag, savedAsset.name, isCreate ? 'created' : 'updated', `Asset ${isCreate ? 'added' : 'updated'} by ${profile?.email}`)
      onSave?.(savedAsset, isCreate)
    } catch (e) {
      setError(e.message || 'Failed to save asset')
      setSaving(false)
    }
    setSaving(false)
  }

  async function logActivity(assetId, assetTag, assetName, type, message) {
    try { await supabase.from('activity_log').insert({ asset_id: assetId, asset_tag: assetTag, asset_name: assetName, type, message, performed_by: profile?.email }) } catch {}
  }

  return (
    <Modal open={open} onClose={onCancel} title={isCreate ? 'Add new asset' : 'Edit asset'} width={520}>
      {loadingExisting && isCreate === false ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text2)', fontSize: 13 }}><Spinner size={16} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Asset tag / ID" required>
            <input value={form.asset_tag} onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))} placeholder="e.g. IT-0042" />
          </FormField>
          <FormField label="Name">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. MacBook Pro 14" />
          </FormField>
          <FormField label="Assign to employee">
            <EmployeeSelect value={form.assigned_to || ''} onChange={v => setForm(f => ({ ...f, assigned_to: v, assigned_to_team: '', status: v ? 'Checked Out' : 'Available' }))} placeholder="Search employee or leave blank" />
          </FormField>
          <FormField label="Assign to team / department">
            <input value={form.assigned_to_team || ''} onChange={e => setForm(f => ({ ...f, assigned_to_team: e.target.value, assigned_to: '', status: e.target.value ? 'Checked Out' : 'Available' }))} placeholder="e.g. Finance Team, Conference Room B, IT Shared" />
          </FormField>
          <FormField label="Site">
            <select value={form.site_id || ''} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}>
              <option value="">No site assigned</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Category"><CategorySelect value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} /></FormField>
            <FormField label="Status"><StatusSelect value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Brand / Model"><input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></FormField>
            <FormField label="Serial number"><input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Purchase date"><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></FormField>
            <FormField label="Provision date"><input type="date" value={form.provision_date || ''} onChange={e => setForm(f => ({ ...f, provision_date: e.target.value }))} /></FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Warranty expiry"><input type="date" value={form.warranty_expiry} onChange={e => setForm(f => ({ ...f, warranty_expiry: e.target.value }))} /></FormField>
            <FormField label="Purchase cost ($)"><input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))} /></FormField>
          </div>
          {licenses.length > 0 && (
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Assign software licenses</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {licenses.map(l => {
                  const seatsLeft = l.seats_total ? l.seats_total - (l.seats_used || 0) : null
                  const full = seatsLeft !== null && seatsLeft <= 0
                  const checked = formLicenses.includes(l.id)
                  return (
                    <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: full && !checked ? 'not-allowed' : 'pointer', opacity: full && !checked ? 0.5 : 1, padding: '6px 10px', borderRadius: 'var(--radius)', background: checked ? 'var(--accent-bg)' : 'var(--bg3)', border: `1px solid ${checked ? 'var(--accent-border)' : 'var(--border)'}` }}>
                      <input type="checkbox" checked={checked} disabled={full && !checked}
                        onChange={e => setFormLicenses(fl => e.target.checked ? [...fl, l.id] : fl.filter(x => x !== l.id))}
                        style={{ width: 'auto', accentColor: 'var(--accent)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500 }}>{l.name}</span>
                        {l.vendor && <span style={{ color: 'var(--text2)', marginLeft: 6, fontSize: 12 }}>{l.vendor}</span>}
                      </div>
                      {seatsLeft !== null && (
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: full ? 'var(--red)' : seatsLeft <= 3 ? 'var(--amber)' : 'var(--green)' }}>
                          {full ? 'Full' : `${seatsLeft} left`}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {TECH_SPEC_CATEGORIES.includes(form.category) && (
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Tech specs</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SPEC_FIELDS.tech.map(f => (
                  <FormField key={f.key} label={f.key}>
                    <input
                      value={form.specs?.[f.key] || ''}
                      onChange={e => setForm(fm => ({ ...fm, specs: { ...fm.specs, [f.key]: e.target.value } }))}
                      placeholder={f.placeholder}
                    />
                  </FormField>
                ))}
              </div>
            </div>
          )}
          {form.category?.toUpperCase() === 'MONITOR' && (
            <FormField label="Seat number">
              <input value={form.seat_number || ''} onChange={e => setForm(f => ({ ...f, seat_number: e.target.value }))} placeholder="e.g. A-101, Desk 4" />
            </FormField>
          )}
          {form.category?.toUpperCase() === 'PHONE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormField label="Lock status">
                <select value={form.locked_status || ''} onChange={e => setForm(f => ({ ...f, locked_status: e.target.value }))}>
                  <option value="">— Select —</option>
                  <option>Unlocked</option>
                  <option>Locked</option>
                  <option>Carrier Locked</option>
                </select>
              </FormField>
              <FormField label="Carrier / Provider">
                <input value={form.carrier || ''} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} placeholder="e.g. AT&T, Verizon, T-Mobile" />
              </FormField>
              <FormField label="IMEI" style={{ gridColumn: '1/-1' }}>
                <input value={form.imei || ''} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} placeholder="e.g. 123456789012345" style={{ fontFamily: 'var(--mono)' }} />
              </FormField>
            </div>
          )}
          <FormField label="Notes"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={onCancel}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : (isCreate ? 'Add asset' : 'Save asset')}</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}
