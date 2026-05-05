import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Spinner, Modal, FormField, EmptyState } from './UI'

export default function Tenants() {
  const { profile, tenant } = useAuth()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({})

  useEffect(() => { fetchTenants() }, [])

  async function fetchTenants() {
    setLoading(true)
    const { data } = await supabase.from('tenants').select('*').order('name')
    setTenants(data || [])

    // Get stats per tenant
    const statsObj = {}
    for (const t of (data || [])) {
      const [{ count: assets }, { count: emps }, { count: users }] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id),
      ])
      statsObj[t.id] = { assets, emps, users }
    }
    setStats(statsObj)
    setLoading(false)
  }

  async function saveTenant() {
    if (!form.name.trim() || !form.slug.trim()) { setError('Name and slug are required.'); return }
    setSaving(true); setError('')
    const slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const { error: err } = await supabase.from('tenants').insert({ name: form.name.trim(), slug })
    setSaving(false)
    if (err) { setError(err.message); return }
    setModalOpen(false)
    setForm({ name: '', slug: '' })
    fetchTenants()
  }

  const card = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }

  return (
    <div className="fade-in">
      {/* Current tenant banner */}
      <div style={{ ...card, marginBottom: '1.5rem', borderLeft: '3px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>Current tenant</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{tenant?.name || 'Unknown'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{tenant?.slug}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <Btn variant="primary" onClick={() => { setModalOpen(true); setError('') }}>+ Add tenant</Btn>
      </div>

      {loading ? <Spinner /> : tenants.length === 0 ? <EmptyState message="No tenants found." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {tenants.map(t => (
            <div key={t.id} style={{ ...card, borderLeft: t.id === tenant?.id ? '3px solid var(--accent)' : '3px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{t.slug}</div>
                </div>
                {t.id === tenant?.id && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)', background: 'var(--accent-bg)', padding: '2px 6px', borderRadius: 4 }}>YOU</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[['Assets', stats[t.id]?.assets], ['Employees', stats[t.id]?.emps], ['Users', stats[t.id]?.users]].map(([label, val]) => (
                  <div key={label} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--mono)' }}>{val ?? '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text2)' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>Created {new Date(t.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add tenant" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Company name" required>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') }))} placeholder="e.g. NHN America" />
          </FormField>
          <FormField label="Slug (URL-safe identifier)" required>
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} placeholder="e.g. nhnamerica" style={{ fontFamily: 'var(--mono)' }} />
          </FormField>
          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveTenant} disabled={saving}>{saving ? 'Creating…' : 'Create tenant'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
