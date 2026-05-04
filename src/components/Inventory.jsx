import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, StatusSelect } from './UI'
import CategorySelect from './CategorySelect'
import { SPEC_FIELDS, TECH_SPEC_CATEGORIES } from '../lib/constants'
import EmployeeSelect from './EmployeeSelect'
import ImportCSV from './ImportCSV'

const EMPTY_FORM = {
  asset_tag:'', name:'', category:'LAPTOP', status:'Available',
  model:'', serial_number:'', location:'', purchase_date:'',
  purchase_cost:'', warranty_expiry:'', notes:'',
  specs: {}, assigned_to: '', site_id: '',
}

export default function Inventory({ onViewAsset, editAssetProp, onEditDone }) {
  const { isAdmin, profile } = useAuth()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editAsset, setEditAsset] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState([])
  const [bulkCheckoutOpen, setBulkCheckoutOpen] = useState(false)
  const [bulkPerson, setBulkPerson] = useState('')
  const [bulkDate, setBulkDate] = useState('')
  const [quickStatusId, setQuickStatusId] = useState(null)
  const [allLicenses, setAllLicenses] = useState([])
  const [formLicenses, setFormLicenses] = useState([])
  const [allSites, setAllSites] = useState([])
  const [checkoutModal, setCheckoutModal] = useState(null) // asset object
  const [checkinModal, setCheckinModal] = useState(null)   // asset object
  const [qcPerson, setQcPerson] = useState('')
  const [qcDate, setQcDate] = useState('')
  const [qcNotes, setQcNotes] = useState('')
  const [qcCondition, setQcCondition] = useState('Good')

  useEffect(() => { fetchAssets(); fetchLicenses(); fetchSites() }, [])

  useEffect(() => {
    if (editAssetProp) { openEditModal(editAssetProp); onEditDone?.() }
  }, [editAssetProp])

  async function fetchLicenses() {
    const { data } = await supabase.from('licenses').select('*').order('name')
    setAllLicenses(data || [])
  }

  async function fetchSites() {
    const { data } = await supabase.from('sites').select('id, name').order('name')
    setAllSites(data || [])
  }

  async function fetchAssets() {
    setLoading(true)
    const { data } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
    setAssets(data || [])
    setLoading(false)
  }

  function openAdd() { setEditAsset(null); setForm(EMPTY_FORM); setFormLicenses([]); setError(''); setModalOpen(true) }

  function openEditModal(asset) {
    setEditAsset(asset)
    setForm({ asset_tag:asset.asset_tag||'', name:asset.name||'', category:asset.category||'LAPTOP', status:asset.status||'Available', model:asset.model||'', serial_number:asset.serial_number||'', location:asset.location||'', purchase_date:asset.purchase_date||'', purchase_cost:asset.purchase_cost||'', warranty_expiry:asset.warranty_expiry||'', notes:asset.notes||'', specs: asset.specs||{} })
    setForm(f => ({...f, site_id: ''}))
    setFormLicenses([]); setError(''); setModalOpen(true)
  }

  function duplicateAsset(asset) {
    setEditAsset(null)
    setForm({ asset_tag:asset.asset_tag+'-COPY', name:asset.name+' (Copy)', category:asset.category, status:'Available', model:asset.model||'', serial_number:'', location:asset.location||'', purchase_date:asset.purchase_date||'', purchase_cost:asset.purchase_cost||'', warranty_expiry:asset.warranty_expiry||'', notes:asset.notes||'', specs: asset.specs||{} })
    setError(''); setModalOpen(true)
  }

  async function save() {
    if (!form.asset_tag.trim()) { setError('Asset Tag is required.'); return }
    const finalName = form.name.trim() || form.asset_tag.trim()
    setSaving(true); setError('')
    const payload = {
      ...form,
      name: finalName,
      purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
      purchase_date: form.purchase_date || null,
      warranty_expiry: form.warranty_expiry || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      location: form.location || null,
      notes: form.notes || null,
      specs: form.specs || {},
      location: form.site_id ? (allSites.find(s=>s.id===form.site_id)?.name || form.location || null) : form.location || null,
      site_id: form.site_id || null,
    }
    let err
    if (editAsset) {
      const { error: e } = await supabase.from('assets').update(payload).eq('id', editAsset.id)
      err = e
      if (!e) await logActivity(editAsset.id, editAsset.asset_tag, editAsset.name, 'updated', `Asset updated by ${profile?.email}`)
    } else {
      const { data, error: e } = await supabase.from('assets').insert(payload).select().single()
      err = e
      if (!e && data) await logActivity(data.id, data.asset_tag, data.name, 'created', `Asset added by ${profile?.email}`)
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    // Close modal immediately on success
    setModalOpen(false); setFormLicenses([]); fetchAssets()
    // Assign licenses in background
    if (!editAsset && formLicenses.length > 0) {
      const { data: newAsset } = await supabase.from('assets').select('id').eq('asset_tag', form.asset_tag).single()
      if (newAsset) {
        for (const licId of formLicenses) {
          try {
            await supabase.from('asset_license_assignments').insert({ asset_id: newAsset.id, license_id: licId })
            const lic = allLicenses.find(l => l.id === licId)
            if (lic) await supabase.from('licenses').update({ seats_used: (lic.seats_used||0)+1 }).eq('id', licId)
          } catch(e) {}
        }
        fetchAssets()
      }
    }
  }

  async function deleteAsset(asset) {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return
    await supabase.from('assets').delete().eq('id', asset.id)
    fetchAssets()
  }

  async function quickStatus(assetId, newStatus) {
    const asset = assets.find(a => a.id === assetId)
    await supabase.from('assets').update({ status: newStatus }).eq('id', assetId)
    await logActivity(assetId, asset.asset_tag, asset.name, 'updated', `Status changed to ${newStatus} by ${profile?.email}`)
    setQuickStatusId(null)
    fetchAssets()
  }

  async function doBulkCheckout() {
    if (!bulkPerson.trim()) return
    const toCheckout = selected.filter(id => assets.find(a=>a.id===id)?.status==='Available')
    for (const id of toCheckout) {
      const asset = assets.find(a=>a.id===id)
      await supabase.from('assets').update({ status:'Checked Out', assigned_to:bulkPerson, expected_return:bulkDate||null }).eq('id', id)
      await logActivity(id, asset.asset_tag, asset.name, 'checkout', `Bulk checked out to ${bulkPerson} by ${profile?.email}`)
    }
    setSelected([]); setBulkPerson(''); setBulkDate(''); setBulkCheckoutOpen(false)
    fetchAssets()
  }

  async function doQuickCheckout() {
    if (!qcPerson.trim()) return
    const asset = checkoutModal
    await supabase.from('assets').update({ status:'Checked Out', assigned_to:qcPerson, expected_return:qcDate||null }).eq('id', asset.id)
    await logActivity(asset.id, asset.asset_tag, asset.name, 'checkout', `Checked out to ${qcPerson}${qcNotes?' — '+qcNotes:''}`)
    setCheckoutModal(null); setQcPerson(''); setQcDate(''); setQcNotes('')
    fetchAssets()
  }

  async function doQuickCheckin() {
    const asset = checkinModal
    const newStatus = qcCondition === 'Needs maintenance' ? 'Maintenance' : 'Available'
    await supabase.from('assets').update({ status:newStatus, assigned_to:null, expected_return:null }).eq('id', asset.id)
    await logActivity(asset.id, asset.asset_tag, asset.name, 'checkin', `Checked in from ${asset.assigned_to||'unknown'} — condition: ${qcCondition}${qcNotes?' — '+qcNotes:''}`)
    setCheckinModal(null); setQcCondition('Good'); setQcNotes('')
    fetchAssets()
  }

  async function logActivity(assetId, assetTag, assetName, type, message) {
    await supabase.from('activity_log').insert({ asset_id:assetId, asset_tag:assetTag, asset_name:assetName, type, message, performed_by:profile?.email })
  }

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate()+30)

  const filtered = assets.filter(a => {
    if (filterStatus && a.status!==filterStatus) return false
    if (filterCat && a.category!==filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${a.name} ${a.asset_tag} ${a.model} ${a.location} ${a.serial_number} ${a.assigned_to}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = {
    total:assets.length,
    available:assets.filter(a=>a.status==='Available').length,
    out:assets.filter(a=>a.status==='Checked Out').length,
    maintenance:assets.filter(a=>a.status==='Maintenance').length,
  }

  function rowWarning(a) {
    if (a.status==='Checked Out' && a.expected_return && new Date(a.expected_return)<today) return 'var(--red)'
    if (a.warranty_expiry && new Date(a.warranty_expiry)<=in30 && new Date(a.warranty_expiry)>=today) return 'var(--amber)'
    return null
  }

  const allSelected = filtered.length>0 && filtered.every(a=>selected.includes(a.id))
  const selectedAvailable = selected.filter(id=>assets.find(a=>a.id===id)?.status==='Available')

  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:'1.5rem' }}>
        {[['Total',stats.total,'var(--text)'],['Available',stats.available,'var(--green)'],['Checked Out',stats.out,'var(--blue)'],['Maintenance',stats.maintenance,'var(--amber)']].map(([l,v,c]) => (
          <div key={l} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:24, fontWeight:500, color:c, fontFamily:'var(--mono)' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets…" style={{ width:200 }} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ width:150 }}>
          <option value="">All statuses</option>
          <option>Available</option><option>Checked Out</option><option>Maintenance</option><option>Ordered</option><option>Received</option><option>Retired</option>
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ width:160 }}>
          <option value="">All categories</option>
          <option>LAPTOP</option><option>DESKTOP</option><option>PHONE</option><option>TABLET</option><option>CAMERA</option><option>TV</option><option>PRINTER</option><option>ROUTER</option><option>MOUSE</option><option>KEYBOARD</option><option>MONITOR</option><option>Tools & Equipment</option>
        </select>
        <div style={{ flex:1 }} />
        {isAdmin && selected.length>0 && (
          <Btn size="sm" variant="success" onClick={()=>setBulkCheckoutOpen(true)} disabled={selectedAvailable.length===0}>
            Check out {selectedAvailable.length} selected
          </Btn>
        )}
        {isAdmin && <Btn size="sm" onClick={()=>setImportOpen(true)}>⬆ Import CSV</Btn>}
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add asset</Btn>}
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        {loading ? <div style={{ padding:'3rem' }}><Spinner /></div> :
         filtered.length===0 ? <EmptyState message={assets.length===0?'No assets yet. Add your first asset to get started.':'No assets match your filters.'} /> : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {isAdmin && <th style={{ padding:'10px 14px', width:32 }}>
                  <input type="checkbox" checked={allSelected} onChange={e => setSelected(e.target.checked ? filtered.map(a=>a.id) : [])} style={{ width:'auto', cursor:'pointer' }} />
                </th>}
                {['Tag','Name','Category','Status','Assigned To','Location','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const warn = rowWarning(a)
                const isSelected = selected.includes(a.id)
                return (
                  <tr key={a.id} style={{ borderBottom:'1px solid var(--border)', borderLeft:`3px solid ${warn||'transparent'}`, background:isSelected?'var(--accent-bg)':undefined }}>
                    {isAdmin && <td style={{ padding:'10px 14px' }}>
                      <input type="checkbox" checked={isSelected} onChange={e=>setSelected(s=>e.target.checked?[...s,a.id]:s.filter(x=>x!==a.id))} style={{ width:'auto', cursor:'pointer' }} />
                    </td>}
                    <td style={{ padding:'10px 14px', fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)' }}>{a.asset_tag}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={()=>onViewAsset?.(a)} style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0, fontFamily:'var(--font)' }}>
                        <div style={{ fontWeight:500, fontSize:13, color:'var(--text)' }}>{a.name}</div>
                        {a.model && <div style={{ fontSize:11, color:'var(--text2)' }}>{a.model}</div>}
                      </button>
                    </td>
                    <td style={{ padding:'10px 14px' }}><Badge status={a.category} /></td>
                    <td style={{ padding:'10px 14px' }}>
                      {isAdmin && quickStatusId===a.id ? (
                        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                          <StatusSelect value={a.status} onChange={v=>quickStatus(a.id,v)} style={{ width:140, padding:'4px 8px' }} />
                          <button onClick={()=>setQuickStatusId(null)} style={{ color:'var(--text3)', fontSize:14, background:'none', border:'none', cursor:'pointer' }}>×</button>
                        </div>
                      ) : (
                        <div onClick={()=>isAdmin&&setQuickStatusId(a.id)} style={{ cursor:isAdmin?'pointer':'default' }} title={isAdmin?'Click to change status':''}>
                          <Badge status={a.status} />
                        </div>
                      )}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:a.assigned_to?'var(--text)':'var(--text3)' }}>{a.assigned_to||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:a.location?'var(--text)':'var(--text3)' }}>{a.location||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        <Btn size="sm" onClick={()=>onViewAsset?.(a)}>View</Btn>
                        {isAdmin && a.status==='Available' && <Btn size="sm" variant="success" onClick={()=>{setCheckoutModal(a);setQcPerson('');setQcDate('');setQcNotes('')}}>Out</Btn>}
                        {isAdmin && a.status==='Checked Out' && <Btn size="sm" variant="primary" onClick={()=>{setCheckinModal(a);setQcCondition('Good');setQcNotes('')}}>In</Btn>}
                        {isAdmin && <Btn size="sm" onClick={()=>openEditModal(a)}>Edit</Btn>}
                        {isAdmin && <Btn size="sm" onClick={()=>duplicateAsset(a)}>Copy</Btn>}
                        {isAdmin && <Btn size="sm" variant="danger" onClick={()=>deleteAsset(a)}>Del</Btn>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editAsset?'Edit asset':'Add new asset'}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <FormField label="Asset tag / ID" required><input value={form.asset_tag} onChange={e=>setForm(f=>({...f,asset_tag:e.target.value}))} placeholder="e.g. IT-0042" /></FormField>
          <FormField label="Assign to employee">
            <EmployeeSelect value={form.assigned_to||''} onChange={v=>setForm(f=>({...f,assigned_to:v,status:v?'Checked Out':'Available'}))} placeholder="Search employee or leave blank" />
          </FormField>
          <FormField label="Site">
            <select value={form.site_id||''} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))}>
              <option value="">No site assigned</option>
              {allSites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Category"><CategorySelect value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} /></FormField>
            <FormField label="Status"><StatusSelect value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} /></FormField>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Brand / Model"><input value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} /></FormField>
            <FormField label="Serial number"><input value={form.serial_number} onChange={e=>setForm(f=>({...f,serial_number:e.target.value}))} /></FormField>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Location"><input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} /></FormField>
            <FormField label="Purchase cost ($)"><input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e=>setForm(f=>({...f,purchase_cost:e.target.value}))} /></FormField>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Purchase date"><input type="date" value={form.purchase_date} onChange={e=>setForm(f=>({...f,purchase_date:e.target.value}))} /></FormField>
            <FormField label="Warranty expiry"><input type="date" value={form.warranty_expiry} onChange={e=>setForm(f=>({...f,warranty_expiry:e.target.value}))} /></FormField>
          </div>
          {!editAsset && allLicenses.length > 0 && (
            <div style={{ paddingTop:8, borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Assign software licenses</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:160, overflowY:'auto' }}>
                {allLicenses.map(l => {
                  const seatsLeft = l.seats_total ? l.seats_total - (l.seats_used||0) : null
                  const full = seatsLeft !== null && seatsLeft <= 0
                  const checked = formLicenses.includes(l.id)
                  return (
                    <label key={l.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor: full && !checked ? 'not-allowed' : 'pointer', opacity: full && !checked ? 0.5 : 1, padding:'6px 10px', borderRadius:'var(--radius)', background: checked?'var(--accent-bg)':'var(--bg3)', border:`1px solid ${checked?'var(--accent-border)':'var(--border)'}` }}>
                      <input type="checkbox" checked={checked} disabled={full && !checked}
                        onChange={e => setFormLicenses(fl => e.target.checked ? [...fl, l.id] : fl.filter(x=>x!==l.id))}
                        style={{ width:'auto', accentColor:'var(--accent)' }}
                      />
                      <div style={{ flex:1 }}>
                        <span style={{ fontWeight:500 }}>{l.name}</span>
                        {l.vendor && <span style={{ color:'var(--text2)', marginLeft:6, fontSize:12 }}>{l.vendor}</span>}
                      </div>
                      {seatsLeft !== null && (
                        <span style={{ fontSize:11, fontFamily:'var(--mono)', color: full?'var(--red)':seatsLeft<=3?'var(--amber)':'var(--green)' }}>
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
            <div style={{ paddingTop:8, borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Tech specs</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {SPEC_FIELDS.tech.map(f => (
                  <FormField key={f.key} label={f.key}>
                    <input
                      value={form.specs?.[f.key]||''}
                      onChange={e=>setForm(fm=>({...fm, specs:{...fm.specs, [f.key]:e.target.value}}))}
                      placeholder={f.placeholder}
                    />
                  </FormField>
                ))}
              </div>
            </div>
          )}
          <FormField label="Notes"><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></FormField>
          {error && <div style={{ color:'var(--red)', fontSize:12 }}>{error}</div>}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Btn onClick={()=>setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save asset'}</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={bulkCheckoutOpen} onClose={()=>setBulkCheckoutOpen(false)} title={`Check out ${selectedAvailable.length} asset${selectedAvailable.length!==1?'s':''}`} width={400}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:13, color:'var(--text2)' }}>
            Assets: {selectedAvailable.map(id=>assets.find(a=>a.id===id)?.name).join(', ')}
          </div>
          <FormField label="Assign to" required><EmployeeSelect value={bulkPerson} onChange={setBulkPerson} placeholder="Search or type employee name" /></FormField>
          <FormField label="Expected return"><input type="date" value={bulkDate} onChange={e=>setBulkDate(e.target.value)} /></FormField>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Btn onClick={()=>setBulkCheckoutOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={doBulkCheckout} disabled={!bulkPerson.trim()}>Check out all</Btn>
          </div>
        </div>
      </Modal>

      {/* Quick Checkout Modal */}
      <Modal open={!!checkoutModal} onClose={()=>setCheckoutModal(null)} title={`Check out — ${checkoutModal?.name||''}`} width={400}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <FormField label="Assign to" required>
            <EmployeeSelect value={qcPerson} onChange={setQcPerson} placeholder="Search or type employee name" />
          </FormField>
          <FormField label="Expected return">
            <input type="date" value={qcDate} onChange={e=>setQcDate(e.target.value)} />
          </FormField>
          <FormField label="Notes">
            <input value={qcNotes} onChange={e=>setQcNotes(e.target.value)} placeholder="Optional notes" />
          </FormField>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Btn onClick={()=>setCheckoutModal(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={doQuickCheckout} disabled={!qcPerson.trim()}>Check out</Btn>
          </div>
        </div>
      </Modal>

      {/* Quick Checkin Modal */}
      <Modal open={!!checkinModal} onClose={()=>setCheckinModal(null)} title={`Check in — ${checkinModal?.name||''}`} width={400}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:13, color:'var(--text2)' }}>Currently assigned to: <strong style={{color:'var(--text)'}}>{checkinModal?.assigned_to||'Unknown'}</strong></div>
          <FormField label="Condition on return">
            <select value={qcCondition} onChange={e=>setQcCondition(e.target.value)}>
              <option>Good</option>
              <option>Needs maintenance</option>
              <option>Damaged</option>
            </select>
          </FormField>
          <FormField label="Notes">
            <input value={qcNotes} onChange={e=>setQcNotes(e.target.value)} placeholder="Optional notes" />
          </FormField>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Btn onClick={()=>setCheckinModal(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={doQuickCheckin}>Check in</Btn>
          </div>
        </div>
      </Modal>

      <ImportCSV open={importOpen} onClose={()=>setImportOpen(false)} onDone={fetchAssets} />
    </div>
  )
}
