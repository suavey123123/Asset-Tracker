import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Spinner, Modal, FormField, EmptyState } from './UI'

export default function Tenants() {
  const { profile, tenant, fetchProfile, isAdmin } = useAuth()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTenant, setEditTenant] = useState(null)
  const [form, setForm] = useState({ name: '', slug: '', accent_color: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({})
  const [switching, setSwitching] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { fetchTenants() }, [])

  async function fetchTenants() {
    setLoading(true)
    const { data, error } = await supabase.from('tenants').select('*').order('name')
    if (error) { console.error(error); setLoading(false); return }
    setTenants(data || [])

    // Use SQL to get counts across all tenants bypassing RLS
    const statsObj = {}
    for (const t of (data || [])) {
      const { data: counts } = await supabase.rpc('get_tenant_stats', { p_tenant_id: t.id })
      statsObj[t.id] = counts?.[0] || { assets: 0, emps: 0 }
    }
    setStats(statsObj)
    setLoading(false)
  }

  function openAdd() {
    setEditTenant(null)
    setForm({ name: '', slug: '' })
    setError('')
    setModalOpen(true)
  }

  function openEdit(t) {
    setEditTenant(t)
    setForm({ name: t.name, slug: t.slug, accent_color: t.accent_color || '' })
    setError('')
    setModalOpen(true)
  }

  async function saveTenant() {
    if (!form.name.trim() || !form.slug.trim()) { setError('Name and slug are required.'); return }
    setSaving(true); setError('')
    const slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const payload = { name: form.name.trim(), slug, accent_color: form.accent_color || null }

    const { error: err } = editTenant
      ? await supabase.from('tenants').update(payload).eq('id', editTenant.id)
      : await supabase.from('tenants').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false)
    setForm({ name: '', slug: '' })
    setEditTenant(null)
    fetchTenants()
  }

  async function deleteTenant(t) {
    // Check it's not the current tenant
    if (t.id === tenant?.id) { setError("Can't delete your current tenant."); return }
    const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id)
    if (count > 0) { setConfirmDelete({ ...t, assetCount: count }); return }
    await supabase.from('tenants').delete().eq('id', t.id)
    fetchTenants()
  }

  async function confirmDeleteTenant() {
    if (!confirmDelete) return
    await supabase.from('tenants').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null)
    fetchTenants()
  }

  async function switchTenant(t) {
    if (t.id === tenant?.id) return
    if (!confirm(`Switch to ${t.name}?\n\nAll data will switch to this tenant's context.`)) return
    setSwitching(t.id)
    await supabase.from('profiles').update({ tenant_id: t.id }).eq('id', profile.id)
    await fetchProfile(profile.id)
    setSwitching(null)
    window.location.reload()
  }

  const card = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }

  return (
    <div className="fade-in">
      {/* Current tenant banner */}
      <div style={{ ...card, marginBottom: '1.5rem', borderLeft: '3px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>Active tenant</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{tenant?.name || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>ID: {tenant?.id}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>
          <div>All data is scoped to this tenant</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Switch tenant to view another company's data</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {isAdmin && <Btn variant="primary" onClick={openAdd}>+ Add tenant</Btn>}
      </div>

      {loading ? <Spinner /> : tenants.length === 0 ? <EmptyState message="No tenants found." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {tenants.map(t => {
            const isCurrent = t.id === tenant?.id
            return (
              <div key={t.id} style={{ ...card, borderLeft: `3px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`, opacity: switching && switching !== t.id ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: t.accent_color || 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏢</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.name}
                      {isCurrent && <span style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)' }}>ACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{t.slug}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Created {new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {[['Assets', stats[t.id]?.assets], ['Employees', stats[t.id]?.emps]].map(([label, val]) => (
                    <div key={label} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '8px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--mono)', color: isCurrent ? 'var(--accent)' : 'var(--text)' }}>{val ?? 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--text2)' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {!isCurrent && (
                    <Btn variant="primary" onClick={() => switchTenant(t)} disabled={!!switching} style={{ flex: 1, justifyContent: 'center' }}>
                      {switching === t.id ? '⟳ Switching…' : '⇄ Switch to this tenant'}
                    </Btn>
                  )}
                  {isAdmin && <Btn size="sm" onClick={() => openEdit(t)}>Edit</Btn>}
                  {!isCurrent && (
                    {isAdmin && <Btn size="sm" variant="danger" onClick={() => deleteTenant(t)}>Delete</Btn>}
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTenant ? `Edit — ${editTenant.name}` : 'Add tenant'} width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Company name" required>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: editTenant ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') }))}
              placeholder="e.g. NHN America" />
          </FormField>
          <FormField label="Accent color (optional)">
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {/* Preset palette */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { color:'#d4ff4e', label:'Default green' },
                  { color:'#60a5fa', label:'Blue' },
                  { color:'#f472b6', label:'Pink' },
                  { color:'#34d399', label:'Emerald' },
                  { color:'#fb923c', label:'Orange' },
                  { color:'#a78bfa', label:'Purple' },
                  { color:'#f87171', label:'Red' },
                  { color:'#facc15', label:'Yellow' },
                  { color:'#2dd4bf', label:'Teal' },
                  { color:'#e2e8f0', label:'Silver' },
                ].map(({ color, label }) => (
                  <button key={color} title={label} onClick={() => setForm(f => ({ ...f, accent_color: color }))}
                    style={{ width:32, height:32, borderRadius:'50%', background:color, border: form.accent_color === color ? '3px solid white' : '2px solid transparent', cursor:'pointer', outline: form.accent_color === color ? `2px solid ${color}` : 'none', outlineOffset:2, transition:'all 0.15s', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }} />
                ))}
                <button title="No color (default)" onClick={() => setForm(f => ({ ...f, accent_color: '' }))}
                  style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg4)', border:'2px dashed var(--border2)', cursor:'pointer', fontSize:14, color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
              {/* Current selection preview */}
              {form.accent_color && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg3)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:form.accent_color, flexShrink:0 }} />
                  <span style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--text2)' }}>{form.accent_color}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', marginLeft:'auto' }}>This color will be applied when this tenant is active</span>
                </div>
              )}
            </div>
          </FormField>
          <FormField label="Slug" required>
            <input value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
              placeholder="e.g. nhnamerica"
              style={{ fontFamily: 'var(--mono)' }} />
          </FormField>
          {error && <div style={{ fontSize: 12, color: 'var(--red)', padding: '6px 10px', background: 'var(--red-bg)', borderRadius: 'var(--radius)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveTenant} disabled={saving}>{saving ? 'Saving…' : editTenant ? 'Save changes' : 'Create tenant'}</Btn>
          </div>
        </div>
      </Modal>

      {/* Confirm delete with data modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete tenant with data?" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            <strong>{confirmDelete?.name}</strong> has <strong style={{ color: 'var(--red)' }}>{confirmDelete?.assetCount} assets</strong> assigned to it.
            Deleting this tenant will orphan all its data. This cannot be undone.
          </div>
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 12, color: 'var(--red)' }}>
            ⚠ Reassign or delete all assets in this tenant first, or they will become inaccessible.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setConfirmDelete(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={confirmDeleteTenant}>Delete anyway</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
