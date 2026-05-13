import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, StatusSelect } from './UI'
import CategorySelect from './CategorySelect'
import { SPEC_FIELDS, TECH_SPEC_CATEGORIES } from '../lib/constants'
import EmployeeSelect from './EmployeeSelect'
import ImportCSV from './ImportCSV'
import CheckoutAgreement from './CheckoutAgreement'
import PrintSheet from './PrintSheet'

function getAssetAge(purchase_date) {
  if (!purchase_date) return null
  const years = (Date.now() - new Date(purchase_date)) / (1000 * 60 * 60 * 24 * 365)
  if (years >= 4) return { label: `${Math.floor(years)}yr`, color: 'var(--red)', title: 'Due for replacement' }
  if (years >= 3) return { label: `${Math.floor(years)}yr`, color: 'var(--amber)', title: 'Aging asset' }
  return null
}

const EMPTY_FORM = {
  asset_tag:'', name:'', category:'LAPTOP', status:'Available',
  model:'', serial_number:'', location:'', purchase_date:'',
  purchase_cost:'', warranty_expiry:'', notes:'',
  specs: {}, assigned_to: '', assigned_to_team: '', site_id: '', provision_date: '',
}

function LazyAssetPhoto({ assetId, onClick }) {
  const [url, setUrl] = React.useState(null)
  const [loaded, setLoaded] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const ref = useRef()

  useEffect(() => {
    const obs = new IntersectionObserver(async ([entry]) => {
      if (entry.isIntersecting && !loaded) {
        setLoaded(true)
        obs.disconnect()
        const { data: files } = await supabase.storage.from('asset-photos').list(`${assetId}/`, { limit: 1 })
        if (files?.length) {
          const { data: { publicUrl } } = supabase.storage.from('asset-photos').getPublicUrl(`${assetId}/${files[0].name}`)
          setUrl(publicUrl)
        }
      }
    }, { rootMargin: '100px' })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [assetId])

  return (
    <div ref={ref} onClick={onClick}
      onMouseEnter={()=>url&&setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{ width:32, height:32, borderRadius:4, background:'var(--bg4)', border:'1px solid var(--border)', flexShrink:0, overflow:'hidden', cursor:'pointer', position:'relative' }}>
      {url ? <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'var(--text3)' }}>▦</div>}
      {hovered && url && (
        <div style={{ position:'fixed', zIndex:9999, width:200, height:200, borderRadius:8, overflow:'hidden', border:'2px solid var(--border2)', boxShadow:'0 8px 24px rgba(0,0,0,0.6)', pointerEvents:'none' }}
          ref={el=>{if(el&&ref.current){const r=ref.current.getBoundingClientRect();el.style.top=(r.bottom+4)+'px';el.style.left=r.left+'px'}}}>
          <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
      )}

    </div>
  )
}

export default function Inventory({ onViewAsset, onViewEmployee, editAssetProp, onEditDone }) {
  const { isAdmin, isAdminOrManager, canWriteAssets, isTechnician, canReadFinancials, profile } = useAuth()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => sessionStorage.getItem('inv_search') || '')
  const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem('inv_status') || '')
  const [filterCat, setFilterCat] = useState(() => sessionStorage.getItem('inv_cat') || '')
  const [filterSite, setFilterSite] = useState(() => sessionStorage.getItem('inv_site') || '')
  const [filterAssigned, setFilterAssigned] = useState(() => sessionStorage.getItem('inv_assigned') || '')
  const [filterModels, setFilterModels] = useState(() => { try { return JSON.parse(sessionStorage.getItem('inv_models') || '[]') } catch { return [] } })
  const [modelDropOpen, setModelDropOpen] = useState(false)
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
  const [allEmployees, setAllEmployees] = useState([])
  const [filterTag, setFilterTag] = useState('')
  const [allTags, setAllTags] = useState([])

  // Reset page on filter changes
  useEffect(() => { setPage(1); sessionStorage.setItem('inv_page','1') }, [filterStatus, filterCat, filterTag, filterSite, filterAssigned, filterModels, search])
  const [assetPhotos, setAssetPhotos] = useState({})
  const [page, setPage] = useState(() => parseInt(sessionStorage.getItem('inv_page') || '1'))
  const [showAll, setShowAll] = useState(false)
  const PAGE_SIZE = 25
  const [savedFilters, setSavedFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inventory_filters') || '[]') } catch { return [] }
  })
  const [saveFilterName, setSaveFilterName] = useState('')
  const [showSaveFilter, setShowSaveFilter] = useState(false)
  const [sortCol, setSortCol] = useState(() => sessionStorage.getItem('inv_sort_col') || '')
  const [sortDir, setSortDir] = useState(() => sessionStorage.getItem('inv_sort_dir') || 'asc')
  const [viewMode, setViewMode] = useState(() => window.innerWidth < 768 ? 'card' : 'table')
  const [showColPicker, setShowColPicker] = useState(false)
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('inventory_cols')
      if (!saved) return ['tag','model','category','status','assigned_to','site','actions']
      const parsed = JSON.parse(saved)
      // Validate - must be array with known col ids
      const valid = ['tag','model','category','status','assigned_to','site','serial','purchase','purchase_date','warranty','actions']
      if (!Array.isArray(parsed) || !parsed.every(c => valid.includes(c))) {
        localStorage.removeItem('inventory_cols')
        return ['tag','model','category','status','assigned_to','site','actions']
      }
      return parsed
    } catch { return ['tag','model','category','status','assigned_to','site','actions'] }
  })

  const ALL_COLS = [
    { id:'tag',         label:'Tag',            fixed: true },
    { id:'model',       label:'Model / Brand',  fixed: false },
    { id:'category',    label:'Category',       fixed: false },
    { id:'status',      label:'Status',         fixed: false },
    { id:'assigned_to', label:'Assigned To',    fixed: false },
    { id:'site',        label:'Site',           fixed: false },
    { id:'serial',      label:'Serial Number',  fixed: false },
    { id:'purchase',    label:'Purchase Cost',  fixed: false },
    { id:'purchase_date', label:'Purchase Date',  fixed: false },
    { id:'warranty',    label:'Warranty Expiry',fixed: false },
    { id:'actions',     label:'Actions',        fixed: true },
  ]

  function exportFilteredCSV() {
    const cols = ['asset_tag','model','category','status','assigned_to','assigned_to_team','location','serial_number','purchase_date','purchase_cost','warranty_expiry','provision_date','locked_status','carrier','imei']
    const headers = ['Asset Tag','Model','Category','Status','Assigned To','Assigned Team','Site','Serial Number','Purchase Date','Purchase Cost','Warranty Expiry','Provision Date','Lock Status','Carrier','IMEI']
    const numericTextCols = ['imei', 'serial_number', 'asset_tag']
    const rows = filtered.map(a => cols.map(c => {
      const v = a[c] ?? ''
      if (!v) return ''
      // Force Excel to treat as text for numeric-looking fields
      if (numericTextCols.includes(c) && v) return `="` + String(v) + `"`
      return String(v).includes(',') ? `"${v}"` : v
    }))
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = `assets-export-${new Date().toISOString().slice(0,10)}.csv`; el.click()
    URL.revokeObjectURL(url)
  }

  function toggleCol(id) {
    if (ALL_COLS.find(c=>c.id===id)?.fixed) return
    setVisibleCols(prev => {
      const updated = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
      localStorage.setItem('inventory_cols', JSON.stringify(updated))
      return [...updated] // new array ref forces re-render
    })
  }

  function handleSort(colId) {
    if (colId === 'actions' || colId === 'tag') {
      // tag sorts by asset_tag
      const field = colId === 'tag' ? 'asset_tag' : colId
      if (sortCol === field) { setSortDir(d => { const n = d === 'asc' ? 'desc' : 'asc'; sessionStorage.setItem('inv_sort_dir', n); return n }) }
      else { setSortCol(field); sessionStorage.setItem('inv_sort_col', field); setSortDir('asc'); sessionStorage.setItem('inv_sort_dir', 'asc') }
      return
    }
    const fieldMap = { model:'model', category:'category', status:'status', assigned_to:'assigned_to', site:'location', serial:'serial_number', purchase:'purchase_cost', warranty:'warranty_expiry' }
    const field = fieldMap[colId] || colId
    if (sortCol === field) { setSortDir(d => { const n = d === 'asc' ? 'desc' : 'asc'; sessionStorage.setItem('inv_sort_dir', n); return n }) }
    else { setSortCol(field); sessionStorage.setItem('inv_sort_col', field); setSortDir('asc'); sessionStorage.setItem('inv_sort_dir', 'asc') }
  }

  function resetCols() {
    const defaults = ['tag','model','category','status','assigned_to','site','actions']
    setVisibleCols(defaults)
    localStorage.setItem('inventory_cols', JSON.stringify(defaults))
  }

  const has = (id) => id === 'actions' || visibleCols.includes(id)

  // Close col picker on outside click
  useEffect(() => {
    if (!showColPicker) return
    function close(e) {
      if (!e.target.closest || !e.target.closest('[data-colpicker]')) setShowColPicker(false)
    }
    setTimeout(() => document.addEventListener('mousedown', close), 100)
    return () => document.removeEventListener('mousedown', close)
  }, [showColPicker])
  const [checkoutModal, setCheckoutModal] = useState(null)
  const [tagExists, setTagExists] = useState(false)
  const [checkingTag, setCheckingTag] = useState(false)
  const [agreementModal, setAgreementModal] = useState(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkAssignedTo, setBulkAssignedTo] = useState('')
  const [bulkAssignedTeam, setBulkAssignedTeam] = useState('')
  const [bulkLicenses, setBulkLicenses] = useState([])
  const [bulkLicenseMode, setBulkLicenseMode] = useState('add')
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [bulkModel, setBulkModel] = useState('')
  const [bulkPurchaseCost, setBulkPurchaseCost] = useState('') // 'add' | 'remove'
  const [bulkCheckinOpen, setBulkCheckinOpen] = useState(false)
  const [bulkCheckinCondition, setBulkCheckinCondition] = useState('Good')
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkSite, setBulkSite] = useState('') // asset object
  const [checkinModal, setCheckinModal] = useState(null)   // asset object
  const [qcPerson, setQcPerson] = useState('')
  const [qcDate, setQcDate] = useState('')
  const [qcNotes, setQcNotes] = useState('')
  const [qcCondition, setQcCondition] = useState('Good')

  useEffect(() => {
    fetchAssets(); fetchLicenses(); fetchSites(); fetchTags()
    // Listen for keyboard shortcuts
    function handleShortcut(e) {
      if (e.type === 'shortcut:new-asset') openAdd()
      if (e.type === 'shortcut:escape') { setModalOpen(false); setBulkEditOpen(false); setBulkCheckinOpen(false) }
    }
    window.addEventListener('shortcut:new-asset', handleShortcut)
    window.addEventListener('shortcut:escape', handleShortcut)
    return () => {
      window.removeEventListener('shortcut:new-asset', handleShortcut)
      window.removeEventListener('shortcut:escape', handleShortcut)
    }
  }, [])

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
    const { data: emps } = await supabase.from('employees').select('id, name, email, title, department, phone').limit(500)
    setAllEmployees(emps || [])
  }

  function saveFilter() {
    if (!saveFilterName.trim()) return
    const filter = { name: saveFilterName.trim(), status: filterStatus, category: filterCat, tag: filterTag, id: Date.now() }
    const updated = [...savedFilters, filter]
    setSavedFilters(updated)
    localStorage.setItem('inventory_filters', JSON.stringify(updated))
    setSaveFilterName(''); setShowSaveFilter(false)
  }

  function loadFilter(f) {
    setFilterStatus(f.status || ''); setFilterCat(f.category || ''); setFilterTag(f.tag || ''); setPage(1)
  }

  function deleteFilter(id) {
    const updated = savedFilters.filter(f => f.id !== id)
    setSavedFilters(updated)
    localStorage.setItem('inventory_filters', JSON.stringify(updated))
  }

  async function fetchTags() {
    const { data } = await supabase.from('asset_tags').select('tag').order('tag')
    const unique = [...new Set((data||[]).map(t=>t.tag))]
    setAllTags(unique)
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
    setForm({ asset_tag:asset.asset_tag||'', name:asset.name||'', category:asset.category||'LAPTOP', status:asset.status||'Available', model:asset.model||'', serial_number:asset.serial_number||'', location:asset.location||'', purchase_date:asset.purchase_date?.slice(0,10)||'', purchase_cost:asset.purchase_cost||'', warranty_expiry:asset.warranty_expiry?.slice(0,10)||'', provision_date:asset.provision_date?.slice(0,10)||'', notes:asset.notes||'', specs:asset.specs||{}, locked_status:asset.locked_status||'', carrier:asset.carrier||'', imei:asset.imei||'', seat_number:asset.seat_number||'', assigned_to:asset.assigned_to||'', assigned_to_team:asset.assigned_to_team||'', site_id:'' })
    setFormLicenses([]); setError(''); setModalOpen(true)
  }

  function duplicateAsset(asset) {
    setEditAsset(null)
    setForm({ asset_tag:asset.asset_tag+'-COPY', name:asset.name+' (Copy)', category:asset.category, status:'Available', model:asset.model||'', serial_number:'', location:asset.location||'', purchase_date:asset.purchase_date||'', purchase_cost:asset.purchase_cost||'', warranty_expiry:asset.warranty_expiry||'', notes:asset.notes||'', specs: asset.specs||{} })
    setError(''); setModalOpen(true)
  }

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
      location: form.site_id ? (allSites.find(s=>s.id===form.site_id)?.name || null) : form.location || null,
    }
    let err
    if (editAsset) {
      const { error: e } = await supabase.from('assets').update(payload).eq('id', editAsset.id)
      err = e
      if (!e) await logActivity(editAsset.id, editAsset.asset_tag, editAsset.name, 'updated', `Asset updated by ${profile?.email}`)
    } else {
      const { data, error: e } = await supabase.from('assets').insert(payload).select().single()
      err = e
      if (!e && data) {
        await logActivity(data.id, data.asset_tag, data.name, 'created', `Asset added by ${profile?.email}`)
        // Assign licenses using the returned asset ID directly
        if (formLicenses.length > 0) {
          for (const licId of formLicenses) {
            try {
              await supabase.from('asset_license_assignments').insert({ asset_id: data.id, license_id: licId, assigned_to: form.assigned_to || null })
              await supabase.rpc('increment_license_seats', { license_id: licId })
            } catch(e) {}
          }
        }
      }
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); setFormLicenses([]); fetchAssets()
  }

  async function deleteAsset(asset) {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return
    await releaseLicenses(asset.id)
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

  async function doBulkCheckin() {
    const toCheckin = selected.filter(id => assets.find(a=>a.id===id)?.status==='Checked Out')
    for (const id of toCheckin) {
      const asset = assets.find(a=>a.id===id)
      const newStatus = bulkCheckinCondition === 'Needs maintenance' ? 'Maintenance' : 'Available'
      await supabase.from('assets').update({ status: newStatus, assigned_to: null, expected_return: null }).eq('id', id)
      await logActivity(id, asset.asset_tag, asset.name, 'checkin', `Bulk checked in — condition: ${bulkCheckinCondition}`)
    }
    setSelected([]); setBulkCheckinOpen(false); fetchAssets()
  }

  async function doBulkEdit() {
    if (!bulkStatus && !bulkSite && !bulkCategory && bulkAssignedTo === undefined && bulkAssignedTeam === undefined) return
    const updates = {}
    if (bulkStatus) updates.status = bulkStatus
    if (bulkSite) { const site = allSites.find(s => s.id === bulkSite); if (site) updates.location = site.name }
    if (bulkCategory) updates.category = bulkCategory.toUpperCase()
    if (bulkAssignedTo) updates.assigned_to = bulkAssignedTo
    if (bulkAssignedTeam) { updates.assigned_to_team = bulkAssignedTeam; updates.assigned_to = null }
    if (bulkModel) updates.model = bulkModel
    if (bulkPurchaseCost) updates.purchase_cost = parseFloat(bulkPurchaseCost.replace(/[^0-9.]/g, ''))
    for (const id of selected) {
      await supabase.from('assets').update(updates).eq('id', id)
    }
    // Handle license assignments
    if (bulkLicenses.length > 0) {
      for (const assetId of selected) {
        for (const licenseId of bulkLicenses) {
          if (bulkLicenseMode === 'add') {
            await supabase.from('asset_license_assignments').upsert({ asset_id: assetId, license_id: licenseId })
            await supabase.rpc('increment_license_seats', { license_id: licenseId })
          } else {
            await supabase.from('asset_license_assignments').delete().eq('asset_id', assetId).eq('license_id', licenseId)
            await supabase.rpc('decrement_license_seats', { license_id: licenseId })
          }
        }
      }
    }
    setBulkProcessing(false)
    setSelected([]); setBulkEditOpen(false); setBulkStatus(''); setBulkSite(''); setBulkCategory(''); setBulkAssignedTo(''); setBulkAssignedTeam(''); setBulkLicenses([]); setBulkLicenseMode('add'); setBulkModel(''); setBulkPurchaseCost('')
    fetchAssets()
    // Show success via toast if available
    setBulkSuccessMsg(`✓ Updated ${selected.length} asset${selected.length!==1?'s':''}`)
    setTimeout(()=>setBulkSuccessMsg(''),3000)
  }

  async function releaseLicenses(assetId) {
    const { data: assignments } = await supabase.from('asset_license_assignments').select('*, license:license_id(id, seats_used)').eq('asset_id', assetId)
    if (assignments?.length) {
      for (const a of assignments) {
        if (a.license) {
          await supabase.rpc('decrement_license_seats', { license_id: a.license.id })
        }
      }
      await supabase.from('asset_license_assignments').delete().eq('asset_id', assetId)
    }
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.length} asset${selected.length!==1?'s':''}? This cannot be undone.`)) return
    for (const id of selected) {
      await releaseLicenses(id)
      await supabase.from('assets').delete().eq('id', id)
    }
    setSelected([])
    fetchAssets()
  }

  async function checkTagExists(tag) {
    if (!tag.trim()) { setTagExists(false); return }
    setCheckingTag(true)
    const { data } = await supabase.from('assets').select('id, asset_tag').eq('asset_tag', tag.trim()).maybeSingle()
    setTagExists(!!data)
    setCheckingTag(false)
  }

  function initiateCheckout() {
    doQuickCheckout()
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
    if (filterSite && a.location!==filterSite) return false
    if (filterAssigned && a.assigned_to !== filterAssigned && a.assigned_to_team !== filterAssigned) return false
    if (filterModels.length > 0 && !filterModels.includes(a.model)) return false
    // tag filtering done client-side after fetch
    if (search) {
      const q = search.toLowerCase()
      if (!`${a.name} ${a.asset_tag} ${a.model} ${a.location} ${a.serial_number} ${a.assigned_to}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Sort
  const sorted = sortCol ? [...filtered].sort((a, b) => {
    let av = a[sortCol] ?? ''
    let bv = b[sortCol] ?? ''
    if (sortCol === 'purchase_cost') { av = parseFloat(av)||0; bv = parseFloat(bv)||0 }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase() }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  }) : filtered

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = showAll ? sorted : sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

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
        <input value={search} onChange={e=>{setSearch(e.target.value);sessionStorage.setItem('inv_search',e.target.value)}} placeholder="Search assets…" style={{ width:200 }} />
        <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);sessionStorage.setItem('inv_status',e.target.value)}} style={{ width:150 }}>
          <option value="">All statuses</option>
          <option>Available</option><option>Checked Out</option><option>Maintenance</option><option>Retired</option>
        </select>
        <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);sessionStorage.setItem('inv_cat',e.target.value)}} style={{ width:160 }}>
          <option value="">All categories</option>
          <option>LAPTOP</option><option>DESKTOP</option><option>PHONE</option><option>TABLET</option><option>CAMERA</option><option>TV</option><option>PRINTER</option><option>ROUTER</option><option>MOUSE</option><option>KEYBOARD</option><option>MONITOR</option><option>Tools & Equipment</option>
        </select>
        <select value={filterSite} onChange={e=>{setFilterSite(e.target.value);sessionStorage.setItem('inv_site',e.target.value)}} style={{ width:150 }}>
          <option value="">All sites</option>
          {allSites.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select value={filterAssigned} onChange={e=>{setFilterAssigned(e.target.value);sessionStorage.setItem('inv_assigned',e.target.value)}} style={{ width:180 }}>
          <option value="">All assigned to</option>
          <optgroup label="Employees">
            {[...new Set(assets.map(a=>a.assigned_to).filter(Boolean))].sort().map(n=><option key={n} value={n}>{n}</option>)}
          </optgroup>
          <optgroup label="Team use">
            {[...new Set(assets.map(a=>a.assigned_to_team).filter(Boolean))].sort().map(n=><option key={n} value={n}>{n}</option>)}
          </optgroup>
        </select>
        <div style={{ position:'relative' }} data-modeldrop>
          <button onClick={()=>setModelDropOpen(o=>!o)}
            style={{ height:32, padding:'0 10px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background:'var(--bg3)', cursor:'pointer', fontFamily:'var(--font)', fontSize:13, color:'var(--text)', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', minWidth:160 }}>
            {filterModels.length === 0 ? 'All models' : filterModels.length === 1 ? filterModels[0].length > 20 ? filterModels[0].slice(0,20)+'…' : filterModels[0] : `${filterModels.length} models`}
            <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text3)' }}>▾</span>
          </button>
          {modelDropOpen && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:200, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'0 8px 24px rgba(0,0,0,0.3)', width:240, maxHeight:280, display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'var(--text2)', fontWeight:500 }}>{filterModels.length > 0 ? `${filterModels.length} selected` : 'All models'}</span>
                {filterModels.length > 0 && <button onClick={()=>{setFilterModels([]);sessionStorage.setItem('inv_models','[]')}} style={{ fontSize:11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>Clear</button>}
              </div>
              <div style={{ overflowY:'auto', maxHeight:220 }}>
                {[...new Set(assets.map(a=>a.model).filter(Boolean))].sort().map(m => {
                  const checked = filterModels.includes(m)
                  return (
                    <label key={m} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', cursor:'pointer', background:checked?'var(--accent-bg)':'transparent', borderBottom:'1px solid var(--border)' }}>
                      <input type="checkbox" checked={checked} onChange={()=>{
                        const next = checked ? filterModels.filter(x=>x!==m) : [...filterModels, m]
                        setFilterModels(next); sessionStorage.setItem('inv_models', JSON.stringify(next))
                      }} style={{ width:'auto', accentColor:'var(--accent)', flexShrink:0 }} />
                      <span style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div style={{ flex:1 }} />
        {allTags.length>0 && (
          <select value={filterTag} onChange={e=>setFilterTag(e.target.value)} style={{ width:140 }}>
            <option value="">All labels</option>
            {allTags.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {isAdmin && selected.length>0 && (
          <>
            <Btn size="sm" variant="success" onClick={()=>setBulkCheckoutOpen(true)} disabled={selectedAvailable.length===0}>
              Check out {selectedAvailable.length} selected
            </Btn>
            <Btn size="sm" variant="danger" onClick={bulkDelete}>
              🗑 Delete {selected.length} selected
            </Btn>
            {selected.filter(id=>assets.find(a=>a.id===id)?.status==='Checked Out').length > 0 && (
              <Btn size="sm" onClick={()=>setBulkCheckinOpen(true)}>
                ↩ Check in {selected.filter(id=>assets.find(a=>a.id===id)?.status==='Checked Out').length}
              </Btn>
            )}
            <Btn size="sm" onClick={()=>setBulkEditOpen(true)}>
              ✎ Edit {selected.length} selected
            </Btn>
            <PrintSheet assets={assets.filter(a=>selected.includes(a.id))} />
          </>
        )}
        <Btn size="sm" onClick={exportFilteredCSV}>⬇ Export CSV</Btn>
        {isAdmin && <Btn size="sm" onClick={()=>setImportOpen(true)}>⬆ Import CSV</Btn>}
        <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:'var(--radius)', padding:3, border:'1px solid var(--border2)' }}>
          {['table','card'].map(m => (
            <button key={m} onClick={()=>setViewMode(m)} style={{ padding:'4px 10px', borderRadius:'var(--radius)', fontSize:12, border:'none', cursor:'pointer', fontFamily:'var(--font)', background:viewMode===m?'var(--bg2)':'transparent', color:viewMode===m?'var(--text)':'var(--text3)', fontWeight:viewMode===m?500:400 }}>
              {m==='table'?'≡ Table':'⊞ Cards'}
            </button>
          ))}
        </div>
        <div style={{ position:'relative' }} data-colpicker>
          <button onClick={()=>setShowColPicker(p=>!p)} title="Customize columns" style={{ padding:'6px 10px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background: showColPicker?'var(--bg4)':'var(--bg3)', color:'var(--text2)', cursor:'pointer', fontSize:13, fontFamily:'var(--font)' }}>⊞ Columns</button>
          {showColPicker && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-lg)', zIndex:200, padding:'10px', minWidth:180, boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Show columns</div>
                <button onClick={resetCols} style={{ fontSize:10, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>Reset</button>
              </div>
              {ALL_COLS.map(c => (
                <label key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', cursor: c.fixed?'not-allowed':'pointer', opacity:c.fixed?0.5:1 }}>
                  <input type="checkbox" checked={has(c.id)} disabled={!!c.fixed} onChange={()=>toggleCol(c.id)} style={{ width:'auto', accentColor:'var(--accent)' }} />
                  <span style={{ fontSize:13 }}>{c.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add asset</Btn>}
      </div>

      {/* Card view for mobile */}
      {viewMode === 'card' && (
        <div>
          {loading ? <div style={{ padding:'2rem' }}><Spinner /></div> :
           sorted.length === 0 ? <div style={{ padding:'2rem', textAlign:'center', color:'var(--text3)' }}>No assets match your filters.</div> :
           paginated.map(a => {
             const warn = rowWarning(a)
             const isSelected = selected.includes(a.id)
             return (
               <div key={a.id} style={{ background:'var(--bg2)', border:`1px solid ${warn||'var(--border)'}`, borderRadius:'var(--radius-lg)', padding:'1rem', marginBottom:8, borderLeft:`3px solid ${warn||'var(--border)'}`, opacity: isSelected ? 0.85 : 1 }}>
                 <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                   {isAdmin && <input type="checkbox" checked={isSelected} onChange={e=>setSelected(s=>e.target.checked?[...s,a.id]:s.filter(x=>x!==a.id))} style={{ width:'auto', marginTop:4 }} />}
                   <LazyAssetPhoto assetId={a.id} onClick={()=>onViewAsset?.(a)} />
                   <div style={{ flex:1, minWidth:0 }}>
                     <button onClick={()=>onViewAsset?.(a)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left', fontFamily:'var(--font)' }}>
                       <div style={{ fontWeight:500, fontSize:13, color:'var(--accent)', fontFamily:'var(--mono)' }}>{a.asset_tag}</div>
                       <div style={{ fontSize:13, color:'var(--text)', marginTop:2 }}>{a.model || <span style={{ color:'var(--text3)' }}>—</span>}</div>
                     </button>
                   </div>
                   <Badge status={a.status} />
                 </div>
                 <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px', fontSize:12, marginBottom:10 }}>
                   <div><span style={{ color:'var(--text3)' }}>Category </span>{a.category}</div>
                   <div><span style={{ color:'var(--text3)' }}>Site </span>{a.location||'—'}</div>
                   <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--text3)' }}>Assigned to </span>{a.assigned_to || (a.assigned_to_team ? <span style={{ color:'var(--blue)' }}>{a.assigned_to_team} (team)</span> : '—')}</div>
                 </div>
                 {a.quick_note && <div style={{ fontSize:12, color:'var(--text2)', background:'rgba(212,255,78,0.05)', borderRadius:'var(--radius)', padding:'6px 10px', marginBottom:8 }}>📝 {a.quick_note}</div>}
                 <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                   <Btn size="sm" onClick={()=>onViewAsset?.(a)}>View</Btn>
                   {isAdmin && a.status==='Available' && <Btn size="sm" variant="success" onClick={()=>{setCheckoutModal(a);setQcPerson('');setQcDate('');setQcNotes('')}}>Check out</Btn>}
                   {isAdmin && a.status==='Checked Out' && <Btn size="sm" variant="primary" onClick={()=>{setCheckinModal(a);setQcCondition('Good');setQcNotes('')}}>Check in</Btn>}
                   {isAdmin && <Btn size="sm" onClick={()=>openEditModal(a)}>Edit</Btn>}
                 </div>
               </div>
             )
           })}
        </div>
      )}

      {/* Table view */}
      <div style={{ display: viewMode === 'table' ? 'block' : 'none', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        {loading ? <div style={{ padding:'3rem' }}><Spinner /></div> :
         filtered.length===0 ? <EmptyState message={assets.length===0?'No assets yet. Add your first asset to get started.':'No assets match your filters.'} /> : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {isAdmin && <th style={{ padding:'10px 14px', width:32 }}>
                  <input type="checkbox" checked={allSelected} onChange={e => setSelected(e.target.checked ? filtered.map(a=>a.id) : [])} style={{ width:'auto', cursor:'pointer' }} />
                </th>}
                {ALL_COLS.filter(c => has(c.id)).map(c => {
                  const fieldMap = { tag:'asset_tag', model:'model', category:'category', status:'status', assigned_to:'assigned_to', site:'location', serial:'serial_number', purchase:'purchase_cost', warranty:'warranty_expiry' }
                  const field = fieldMap[c.id]
                  const isActive = sortCol === field
                  const canSort = c.id !== 'actions'
                  return (
                    <th key={c.id} onClick={() => canSort && handleSort(c.id)}
                      style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color: isActive ? 'var(--accent)' : 'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', cursor: canSort ? 'pointer' : 'default', userSelect:'none' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        {c.label}
                        {canSort && <span style={{ fontSize:10, opacity: isActive ? 1 : 0.3 }}>{isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {paginated.map(a => {
                const warn = rowWarning(a)
                const isSelected = selected.includes(a.id)
                return (
                  <tr key={a.id} style={{ borderBottom:'1px solid var(--border)', borderLeft:`3px solid ${warn||'transparent'}`, background:isSelected?'var(--accent-bg)':undefined }}>
                    {isAdmin && <td style={{ padding:'10px 14px' }}>
                      <input type="checkbox" checked={isSelected} onChange={e=>setSelected(s=>e.target.checked?[...s,a.id]:s.filter(x=>x!==a.id))} style={{ width:'auto', cursor:'pointer' }} />
                    </td>}
                    {has('tag') && <td style={{ padding:'8px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}
                          onMouseEnter={e=>{ const btn=e.currentTarget.querySelector('.copy-btn'); if(btn) btn.style.opacity=1 }}
                          onMouseLeave={e=>{ const btn=e.currentTarget.querySelector('.copy-btn'); if(btn) btn.style.opacity=0 }}>
                          <button onClick={()=>onViewAsset?.(a)} style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0, fontFamily:'var(--mono)' }}>
                            <div style={{ fontWeight:500, fontSize:12, color:'var(--accent)' }}>{a.asset_tag}</div>
                          </button>
                          <button className="copy-btn" title="Copy tag"
                            onClick={e=>{ e.stopPropagation(); navigator.clipboard.writeText(a.asset_tag) }}
                            style={{ opacity:0, transition:'opacity 0.15s', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:3, cursor:'pointer', fontSize:10, color:'var(--text2)', padding:'1px 5px', lineHeight:1.4, flexShrink:0 }}>
                            ⎘
                          </button>
                        </div>
                      </div>
                    </td>}
                    {has('model') && <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ fontSize:13, color: a.model ? 'var(--text)' : 'var(--text3)' }}>{a.model || '—'}</div>
                        {getAssetAge(a.purchase_date) && (
                          <span title={getAssetAge(a.purchase_date).title} style={{ fontSize:9, fontFamily:'var(--mono)', fontWeight:600, color:getAssetAge(a.purchase_date).color, background:getAssetAge(a.purchase_date).color+'18', padding:'1px 5px', borderRadius:3 }}>
                            {getAssetAge(a.purchase_date).label}
                          </span>
                        )}
                      </div>
                    </td>}
                    {has('category') && <td style={{ padding:'10px 14px', fontSize:11 }}><span style={{ padding:'2px 8px', borderRadius:4, background:'var(--bg4)', color:'var(--text2)', fontFamily:'var(--mono)' }}>{a.category}</span></td>}
                    {has('status') && <td style={{ padding:'10px 14px' }}>
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
                    </td>}
                    {has('assigned_to') && <td style={{ padding:'10px 14px', fontSize:12 }}>
                      {a.assigned_to
                        ? <span style={{ color:'var(--text)', cursor: onViewEmployee ? 'pointer' : 'default', textDecoration: onViewEmployee ? 'underline' : 'none', textDecorationColor:'var(--border2)' }} onClick={e=>{e.stopPropagation(); if(onViewEmployee){const emp=allEmployees?.find(emp=>emp.name===a.assigned_to); onViewEmployee(emp||{name:a.assigned_to})}}}>{a.assigned_to}</span>
                        : a.assigned_to_team
                          ? <span style={{ color:'var(--blue)', fontSize:11, padding:'2px 8px', borderRadius:100, background:'var(--blue-bg)', fontFamily:'var(--mono)' }}>{a.assigned_to_team}</span>
                          : <span style={{ color:'var(--text3)' }}>—</span>}
                    </td>}
                    {has('site') && <td style={{ padding:'10px 14px', fontSize:12, color:a.location?'var(--text)':'var(--text3)' }}>{a.location||'—'}</td>}
                    {has('serial') && <td style={{ padding:'10px 14px', fontSize:12, fontFamily:'var(--mono)', color:'var(--text2)' }}>{a.serial_number||'—'}</td>}
                    {has('purchase') && <td style={{ padding:'10px 14px', fontSize:12, fontFamily:'var(--mono)' }}>{a.purchase_cost?'$'+parseFloat(a.purchase_cost).toFixed(0):'—'}</td>}
                    {has('purchase_date') && <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{a.purchase_date?new Date(a.purchase_date).toLocaleDateString():'—'}</td>}
                    {has('warranty') && <td style={{ padding:'10px 14px', fontSize:12, color: a.warranty_expiry&&new Date(a.warranty_expiry)<new Date()?'var(--red)':'var(--text2)' }}>{a.warranty_expiry?new Date(a.warranty_expiry).toLocaleDateString():'—'}</td>}
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
            <EmployeeSelect value={form.assigned_to||''} onChange={v=>setForm(f=>({...f,assigned_to:v,assigned_to_team:'',status:v?'Checked Out':'Available'}))} placeholder="Search employee or leave blank" />
          </FormField>
          <FormField label="Assign to team / department">
            <input value={form.assigned_to_team||''} onChange={e=>setForm(f=>({...f,assigned_to_team:e.target.value,assigned_to:'',status:e.target.value?'Checked Out':'Available'}))} placeholder="e.g. Finance Team, Conference Room B, IT Shared" />
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
            <FormField label="Purchase date"><input type="date" value={form.purchase_date} onChange={e=>setForm(f=>({...f,purchase_date:e.target.value}))} /></FormField>
            <FormField label="Provision date"><input type="date" value={form.provision_date||''} onChange={e=>setForm(f=>({...f,provision_date:e.target.value}))} /></FormField>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Warranty expiry"><input type="date" value={form.warranty_expiry} onChange={e=>setForm(f=>({...f,warranty_expiry:e.target.value}))} /></FormField>
            <FormField label="Purchase cost ($)"><input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e=>setForm(f=>({...f,purchase_cost:e.target.value}))} /></FormField>
          </div>
          {allLicenses.length > 0 && (
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
          {form.category?.toUpperCase() === 'MONITOR' && (
            <FormField label="Seat number">
              <input value={form.seat_number||''} onChange={e=>setForm(f=>({...f,seat_number:e.target.value}))} placeholder="e.g. A-101, Desk 4" />
            </FormField>
          )}
          {form.category?.toUpperCase() === 'PHONE' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <FormField label="Lock status">
                <select value={form.locked_status||''} onChange={e=>setForm(f=>({...f,locked_status:e.target.value}))}>
                  <option value="">— Select —</option>
                  <option>Unlocked</option>
                  <option>Locked</option>
                  <option>Carrier Locked</option>
                </select>
              </FormField>
              <FormField label="Carrier / Provider">
                <input value={form.carrier||''} onChange={e=>setForm(f=>({...f,carrier:e.target.value}))} placeholder="e.g. AT&T, Verizon, T-Mobile" />
              </FormField>
              <FormField label="IMEI" style={{ gridColumn:'1/-1' }}>
                <input value={form.imei||''} onChange={e=>setForm(f=>({...f,imei:e.target.value}))} placeholder="e.g. 123456789012345" style={{ fontFamily:'var(--mono)' }} />
              </FormField>
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


      {/* Pagination */}
      {sorted.length > PAGE_SIZE && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:12, fontSize:13, color:'var(--text2)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12 }}>{sorted.length} assets {!showAll ? `· Page ${page} of ${totalPages}` : '· Showing all'}</span>
            <button onClick={()=>{ setShowAll(s=>!s); setPage(1) }} style={{ fontSize:12, color:'var(--accent)', background:'none', border:'1px solid var(--border2)', borderRadius:'var(--radius)', padding:'3px 10px', cursor:'pointer', fontFamily:'var(--font)' }}>
              {showAll ? '📄 Show pages' : '⊞ Show all'}
            </button>
          </div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button onClick={()=>setPage(1)} disabled={page===1} style={{ padding:'5px 10px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background:'var(--bg3)', color:page===1?'var(--text3)':'var(--text)', cursor:page===1?'not-allowed':'pointer', fontFamily:'var(--font)', fontSize:12 }}>«</button>
            <button onClick={()=>setPage(p=>p-1)} disabled={page===1} style={{ padding:'5px 10px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background:'var(--bg3)', color:page===1?'var(--text3)':'var(--text)', cursor:page===1?'not-allowed':'pointer', fontFamily:'var(--font)', fontSize:12 }}>‹ Prev</button>
            {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
              const p=Math.max(1,Math.min(totalPages-4,page-2))+i
              return p<=totalPages?<button key={p} onClick={()=>setPage(p)} style={{ padding:'5px 10px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background:p===page?'var(--accent)':'var(--bg3)', color:p===page?'#0f0f0f':'var(--text)', cursor:'pointer', fontFamily:'var(--mono)', fontSize:12, fontWeight:p===page?600:400 }}>{p}</button>:null
            })}
            <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} style={{ padding:'5px 10px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background:'var(--bg3)', color:page===totalPages?'var(--text3)':'var(--text)', cursor:page===totalPages?'not-allowed':'pointer', fontFamily:'var(--font)', fontSize:12 }}>Next ›</button>
            <button onClick={()=>setPage(totalPages)} disabled={page===totalPages||showAll} style={{ padding:'5px 10px', borderRadius:'var(--radius)', border:'1px solid var(--border2)', background:'var(--bg3)', color:(page===totalPages||showAll)?'var(--text3)':'var(--text)', cursor:(page===totalPages||showAll)?'not-allowed':'pointer', fontFamily:'var(--font)', fontSize:12 }}>»</button>
          </div>
        </div>
      )}

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
            <Btn variant="primary" onClick={initiateCheckout} disabled={!qcPerson.trim()}>Check out</Btn>
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

      {/* Bulk Check-in Modal */}
      <Modal open={bulkCheckinOpen} onClose={()=>setBulkCheckinOpen(false)} title={`Check in ${selected.filter(id=>assets.find(a=>a.id===id)?.status==='Checked Out').length} asset(s)`} width={380}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <FormField label="Condition on return">
            <select value={bulkCheckinCondition} onChange={e=>setBulkCheckinCondition(e.target.value)}>
              <option>Good</option><option>Needs maintenance</option><option>Damaged</option>
            </select>
          </FormField>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Btn onClick={()=>setBulkCheckinOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={doBulkCheckin}>Check in all</Btn>
          </div>
        </div>
      </Modal>

      {/* Bulk Edit Modal */}
      <Modal open={bulkEditOpen} onClose={()=>setBulkEditOpen(false)} title={`Bulk edit — ${selected.length} asset${selected.length!==1?'s':''}`} width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:12, color:'var(--text2)', background:'var(--bg3)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
            Leave fields blank to keep current values. Only filled fields will be updated.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FormField label="Change status">
              <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}>
                <option value="">— Keep current —</option>
                <option>Available</option><option>Checked Out</option><option>Maintenance</option><option>Retired</option>
              </select>
            </FormField>
            <FormField label="Change category">
              <input value={bulkCategory} onChange={e=>setBulkCategory(e.target.value)} placeholder="e.g. LAPTOP, MONITOR" />
            </FormField>
            <FormField label="Move to site">
              <select value={bulkSite} onChange={e=>setBulkSite(e.target.value)}>
                <option value="">— Keep current —</option>
                {allSites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Assign to employee">
              <EmployeeSelect value={bulkAssignedTo} onChange={v=>{setBulkAssignedTo(v); if(v) setBulkAssignedTeam('')}} placeholder="Search employee…" />
            </FormField>
            <FormField label="Model / Brand">
              <input value={bulkModel} onChange={e=>setBulkModel(e.target.value)} placeholder="e.g. MacBook Pro 16&quot;" />
            </FormField>
            <FormField label="Purchase cost ($)">
              <input value={bulkPurchaseCost} onChange={e=>setBulkPurchaseCost(e.target.value)} placeholder="e.g. 1299" />
            </FormField>
          </div>
          <FormField label="Assign to team / department">
            <input value={bulkAssignedTeam} onChange={e=>{setBulkAssignedTeam(e.target.value); if(e.target.value) setBulkAssignedTo('')}} placeholder="e.g. Finance Team, IT Shared" />
          </FormField>
          {allLicenses.length > 0 && (
            <div style={{ paddingTop:8, borderTop:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11, color:'var(--text2)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>Licenses</div>
                <div style={{ display:'flex', gap:4 }}>
                  {['add','remove'].map(m => (
                    <button key={m} onClick={()=>setBulkLicenseMode(m)} style={{ padding:'3px 10px', fontSize:11, borderRadius:'var(--radius)', border:'1px solid', borderColor:bulkLicenseMode===m?'var(--accent)':'var(--border2)', background:bulkLicenseMode===m?'var(--accent-bg)':'var(--bg3)', color:bulkLicenseMode===m?'var(--accent)':'var(--text3)', cursor:'pointer', fontFamily:'var(--font)' }}>
                      {m === 'add' ? '+ Assign' : '− Remove'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:140, overflowY:'auto' }}>
                {allLicenses.map(l => {
                  const checked = bulkLicenses.includes(l.id)
                  const seatsLeft = l.seats_total ? l.seats_total - (l.seats_used||0) : null
                  const full = seatsLeft !== null && seatsLeft <= 0 && bulkLicenseMode === 'add'
                  return (
                    <label key={l.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:full?'not-allowed':'pointer', opacity:full?0.5:1, padding:'6px 10px', borderRadius:'var(--radius)', background:checked?'var(--accent-bg)':'var(--bg3)', border:`1px solid ${checked?'var(--accent-border,var(--accent))':'var(--border)'}` }}>
                      <input type="checkbox" checked={checked} disabled={full}
                        onChange={e=>setBulkLicenses(fl=>e.target.checked?[...fl,l.id]:fl.filter(x=>x!==l.id))}
                        style={{ width:'auto', accentColor:'var(--accent)' }} />
                      <span style={{ flex:1, fontWeight:500 }}>{l.name}</span>
                      {l.vendor && <span style={{ color:'var(--text3)', fontSize:11 }}>{l.vendor}</span>}
                      {seatsLeft !== null && <span style={{ fontSize:10, fontFamily:'var(--mono)', color:full?'var(--red)':seatsLeft<=3?'var(--amber)':'var(--green)' }}>{full?'Full':`${seatsLeft} left`}</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          <div style={{ fontSize:12, color:'var(--amber)', fontWeight:500 }}>
            ⚠ This will update all {selected.length} selected assets immediately.
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Btn onClick={()=>setBulkEditOpen(false)} disabled={bulkProcessing}>Cancel</Btn>
            <Btn variant="primary" onClick={doBulkEdit} disabled={bulkProcessing || (!bulkStatus && !bulkSite && !bulkCategory && !bulkAssignedTo && !bulkAssignedTeam && !bulkModel && !bulkPurchaseCost && bulkLicenses.length === 0)}>
              {bulkProcessing ? `⟳ Updating ${selected.length} assets…` : `Apply to ${selected.length} assets`}
            </Btn>
          </div>
        </div>
      </Modal>

      <CheckoutAgreement
        open={!!agreementModal}
        onClose={() => setAgreementModal(null)}
        asset={agreementModal?.asset}
        employee={agreementModal?.employee}
        onSign={() => { setAgreementModal(null); doQuickCheckout() }}
      />

      <ImportCSV open={importOpen} onClose={()=>setImportOpen(false)} onDone={fetchAssets} />
    </div>
  )
}
