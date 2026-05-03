import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField, EmptyState, Spinner, ViewOnlyBanner, Badge } from './UI'
import Employees from './Employees'

const EMPTY_SITE = { name: '', address: '', city: '', state: '', country: '', phone: '', notes: '' }

export default function Sites() {
  const { isAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [assets, setAssets] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editSite, setEditSite] = useState(null)
  const [form, setForm] = useState(EMPTY_SITE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeSite, setActiveSite] = useState(null) // null = overview, site object = drill-in
  const [activeTab, setActiveTab] = useState('employees') // employees | assets

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: s }, { data: a }, { data: e }] = await Promise.all([
      supabase.from('sites').select('*').order('name'),
      supabase.from('assets').select('id, name, asset_tag, category, status, location, assigned_to'),
      supabase.from('employees').select('*').order('name'),
    ])
    setSites(s || [])
    setAssets(a || [])
    setEmployees(e || [])
    setLoading(false)
  }

  function openAdd() { setEditSite(null); setForm(EMPTY_SITE); setError(''); setModalOpen(true) }
  function openEdit(site) {
    setEditSite(site)
    setForm({ name: site.name||'', address: site.address||'', city: site.city||'', state: site.state||'', country: site.country||'', phone: site.phone||'', notes: site.notes||'' })
    setError(''); setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('Site name is required.'); return }
    setSaving(true); setError('')
    let err
    if (editSite) {
      const { error: e } = await supabase.from('sites').update(form).eq('id', editSite.id)
      err = e
    } else {
      const { error: e } = await supabase.from('sites').insert(form)
      err = e
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false); fetchAll()
  }

  async function deleteSite(site) {
    if (!confirm(`Delete "${site.name}"? Employees and assets linked to this site won't be deleted.`)) return
    await supabase.from('sites').delete().eq('id', site.id)
    if (activeSite?.id === site.id) setActiveSite(null)
    fetchAll()
  }

  function getSiteEmployees(siteId) {
    return employees.filter(e => e.site_id === siteId)
  }

  function getSiteAssets(siteId) {
    const site = sites.find(s => s.id === siteId)
    if (!site) return []
    return assets.filter(a => a.location?.toLowerCase().includes(site.name.toLowerCase()))
  }

  // Drill-in view for a single site
  if (activeSite) {
    const siteEmployees = getSiteEmployees(activeSite.id)
    const siteAssets = getSiteAssets(activeSite.id)

    return (
      <div className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
          <Btn size="sm" onClick={() => setActiveSite(null)}>← All sites</Btn>
          <div style={{ flex: 1 }} />
          {isAdmin && <Btn size="sm" onClick={() => openEdit(activeSite)}>Edit site</Btn>}
          {isAdmin && <Btn size="sm" variant="danger" onClick={() => deleteSite(activeSite)}>Delete site</Btn>}
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{activeSite.name}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
            {[activeSite.address, activeSite.city, activeSite.state, activeSite.country].filter(Boolean).join(', ')}
            {activeSite.phone && <span style={{ marginLeft: 16 }}>📞 {activeSite.phone}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              ['Employees', siteEmployees.length, 'var(--blue)'],
              ['Assets', siteAssets.length, 'var(--accent)'],
              ['Checked Out', siteAssets.filter(a => a.status === 'Checked Out').length, 'var(--amber)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: c, fontFamily: 'var(--mono)' }}>{v}</div>
              </div>
            ))}
          </div>
          {activeSite.notes && <div style={{ marginTop: '1rem', fontSize: 13, color: 'var(--text2)' }}>{activeSite.notes}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1rem', width: 'fit-content' }}>
          {[['employees', `Employees (${siteEmployees.length})`], ['assets', `Assets (${siteAssets.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: '6px 14px', fontSize: 13, borderRadius: 'var(--radius)',
              background: activeTab === id ? 'var(--bg4)' : 'transparent',
              color: activeTab === id ? 'var(--text)' : 'var(--text2)',
              border: activeTab === id ? '1px solid var(--border2)' : '1px solid transparent',
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}>{label}</button>
          ))}
        </div>

        {activeTab === 'employees' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {siteEmployees.length === 0 ? <EmptyState message="No employees assigned to this site yet. Add employees and set their site." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Title', 'Department', 'Email'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {siteEmployees.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 13 }}>{e.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>{e.title || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>{e.department || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{e.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {siteAssets.length === 0 ? <EmptyState message={`No assets found at ${activeSite.name}. Set an asset's location to include the site name.`} /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Tag', 'Name', 'Category', 'Status', 'Assigned To'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {siteAssets.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{a.asset_tag}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 13 }}>{a.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{a.category}</td>
                      <td style={{ padding: '10px 14px' }}><Badge status={a.status} /></td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>{a.assigned_to || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit site">
          <SiteForm form={form} setForm={setForm} error={error} saving={saving} onSave={save} onCancel={() => setModalOpen(false)} />
        </Modal>
      </div>
    )
  }

  // Overview — all sites
  return (
    <div className="fade-in">
      {!isAdmin && <ViewOnlyBanner />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add site</Btn>}
      </div>

      {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
       sites.length === 0 ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>No sites yet</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.5rem' }}>Add your office locations, warehouses, or branches.</div>
          {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add first site</Btn>}
        </div>
       ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {sites.map(site => {
            const empCount = getSiteEmployees(site.id).length
            const assetCount = getSiteAssets(site.id).length
            return (
              <div key={site.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                onClick={() => setActiveSite(site)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{site.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {[site.city, site.state, site.country].filter(Boolean).join(', ') || 'No address set'}
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <Btn size="sm" onClick={() => openEdit(site)}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => deleteSite(site)}>Del</Btn>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>Employees</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--blue)', fontFamily: 'var(--mono)' }}>{empCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>Assets</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{assetCount}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
       )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editSite ? 'Edit site' : 'Add new site'}>
        <SiteForm form={form} setForm={setForm} error={error} saving={saving} onSave={save} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  )
}

function SiteForm({ form, setForm, error, saving, onSave, onCancel }) {
  const f = (key) => ({ value: form[key], onChange: e => setForm(s => ({ ...s, [key]: e.target.value })) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FormField label="Site name" required><input {...f('name')} placeholder="e.g. HQ, Warehouse A, NYC Office" /></FormField>
      <FormField label="Address"><input {...f('address')} placeholder="Street address" /></FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="City"><input {...f('city')} placeholder="City" /></FormField>
        <FormField label="State / Province"><input {...f('state')} placeholder="State" /></FormField>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="Country"><input {...f('country')} placeholder="Country" /></FormField>
        <FormField label="Phone"><input {...f('phone')} placeholder="Site phone number" /></FormField>
      </div>
      <FormField label="Notes"><textarea {...f('notes')} placeholder="Any additional info…" /></FormField>
      {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save site'}</Btn>
      </div>
    </div>
  )
}
