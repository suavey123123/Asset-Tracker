import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Spinner } from './UI'

export default function Home({ onNav, onViewAsset }) {
  const [assets, setAssets] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from('assets').select('*').order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
    ])
    setAssets(a || [])
    setLog(l || [])
    setLoading(false)
  }

  if (loading) return <div style={{ padding: '3rem' }}><Spinner /></div>

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate() + 30)

  const stats = {
    total: assets.length,
    available: assets.filter(a => a.status === 'Available').length,
    checkedOut: assets.filter(a => a.status === 'Checked Out').length,
    maintenance: assets.filter(a => a.status === 'Maintenance').length,
  }

  const overdueCheckouts = assets.filter(a =>
    a.status === 'Checked Out' && a.expected_return && new Date(a.expected_return) < today
  )

  const expiringWarranties = assets.filter(a =>
    a.warranty_expiry && new Date(a.warranty_expiry) <= in30 && new Date(a.warranty_expiry) >= today
  )

  const expiredWarranties = assets.filter(a =>
    a.warranty_expiry && new Date(a.warranty_expiry) < today && a.status !== 'Retired'
  )

  const recentAssets = assets.slice(0, 5)

  const TYPE_STYLES = {
    checkout:    { color: 'var(--blue)',   label: 'OUT' },
    checkin:     { color: 'var(--green)',  label: 'IN' },
    maintenance: { color: 'var(--amber)',  label: 'MNT' },
    created:     { color: 'var(--accent)', label: 'NEW' },
    updated:     { color: 'var(--text2)',  label: 'UPD' },
    note:        { color: 'var(--text3)',  label: 'NOTE' },
  }

  return (
    <div className="fade-in">
      {/* Alert banners */}
      {overdueCheckouts.length > 0 && (
        <div style={alertStyle('var(--red)', 'var(--red-bg)')} onClick={() => onNav('checkout')} >
          <span style={{ fontWeight: 500 }}>⚠ {overdueCheckouts.length} overdue check-out{overdueCheckouts.length > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12, marginLeft: 8 }}>
            {overdueCheckouts.map(a => a.name).join(', ')}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12 }}>View →</span>
        </div>
      )}
      {expiringWarranties.length > 0 && (
        <div style={alertStyle('var(--amber)', 'var(--amber-bg)')} onClick={() => onNav('inventory')}>
          <span style={{ fontWeight: 500 }}>⏱ {expiringWarranties.length} warranty expiring within 30 days</span>
          <span style={{ marginLeft: 'auto', fontSize: 12 }}>View →</span>
        </div>
      )}
      {expiredWarranties.length > 0 && (
        <div style={alertStyle('var(--text2)', 'var(--bg3)')} onClick={() => onNav('inventory')}>
          <span style={{ fontWeight: 500 }}>◌ {expiredWarranties.length} expired warranty</span>
          <span style={{ marginLeft: 'auto', fontSize: 12 }}>View →</span>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total assets', value: stats.total, color: 'var(--text)', nav: 'inventory' },
          { label: 'Available', value: stats.available, color: 'var(--green)', nav: 'inventory' },
          { label: 'Checked out', value: stats.checkedOut, color: 'var(--blue)', nav: 'checkout' },
          { label: 'In maintenance', value: stats.maintenance, color: 'var(--amber)', nav: 'maintenance' },
        ].map(s => (
          <div key={s.label} onClick={() => onNav(s.nav)} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 16px',
            cursor: 'pointer', transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: s.color, fontFamily: 'var(--mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Recently added assets */}
        <div style={cardStyle}>
          <div style={cardHeader}>
            <span style={cardTitle}>Recent assets</span>
            <button onClick={() => onNav('inventory')} style={linkBtn}>View all →</button>
          </div>
          {recentAssets.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '1rem 0' }}>No assets yet.</div>
          ) : recentAssets.map(a => (
            <div key={a.id} onClick={() => onViewAsset(a)} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{a.asset_tag}</div>
              </div>
              <Badge status={a.status} />
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <div style={cardStyle}>
          <div style={cardHeader}>
            <span style={cardTitle}>Recent activity</span>
            <button onClick={() => onNav('history')} style={linkBtn}>View all →</button>
          </div>
          {log.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '1rem 0' }}>No activity yet.</div>
          ) : log.map(e => {
            const ts = TYPE_STYLES[e.type] || TYPE_STYLES.note
            return (
              <div key={e.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, color: ts.color, background: ts.color + '18', padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 1 }}>{ts.label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{e.asset_name} · {new Date(e.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Overdue checkouts */}
        {overdueCheckouts.length > 0 && (
          <div style={{ ...cardStyle, borderColor: 'rgba(255,90,90,0.3)' }}>
            <div style={cardHeader}>
              <span style={{ ...cardTitle, color: 'var(--red)' }}>⚠ Overdue check-outs</span>
            </div>
            {overdueCheckouts.map(a => (
              <div key={a.id} onClick={() => onViewAsset(a)} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Assigned to {a.assigned_to}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--red)' }}>
                  Due {new Date(a.expected_return).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expiring warranties */}
        {expiringWarranties.length > 0 && (
          <div style={{ ...cardStyle, borderColor: 'rgba(255,184,74,0.3)' }}>
            <div style={cardHeader}>
              <span style={{ ...cardTitle, color: 'var(--amber)' }}>⏱ Expiring warranties</span>
            </div>
            {expiringWarranties.map(a => (
              <div key={a.id} onClick={() => onViewAsset(a)} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{a.asset_tag}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--amber)' }}>
                  {new Date(a.warranty_expiry).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const alertStyle = (color, bg) => ({
  background: bg, border: `1px solid ${color}`,
  borderRadius: 'var(--radius)', padding: '8px 14px',
  fontSize: 13, color, marginBottom: 10,
  display: 'flex', alignItems: 'center', gap: 6,
  cursor: 'pointer',
})

const cardStyle = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
}

const cardHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: '0.75rem',
}

const cardTitle = { fontSize: 13, fontWeight: 500, color: 'var(--text)' }

const linkBtn = {
  fontSize: 12, color: 'var(--text2)', background: 'none',
  border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
}

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '7px 0', borderBottom: '1px solid var(--border)',
  cursor: 'pointer',
}
