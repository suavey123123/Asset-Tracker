import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function NotificationCenter({ onNav, onViewAsset }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    setLoading(true)
    const today = new Date()
    const in30 = new Date(); in30.setDate(today.getDate() + 30)

    const [{ data: assets }, { data: licenses }, { data: schedules }, { data: requests }] = await Promise.all([
      supabase.from('assets').select('id, name, asset_tag, model, status, expected_return, warranty_expiry, assigned_to'),
      supabase.from('licenses').select('id, name, expiry_date, seats_total, seats_used'),
      supabase.from('maintenance_schedules').select('*, asset:asset_id(id, asset_tag, model)').lte('next_date', in30.toISOString().slice(0,10)),
      supabase.from('asset_requests').select('id').eq('status', 'pending'),
    ])

    const notifs = []

    // Overdue check-outs
    ;(assets || []).filter(a => a.status === 'Checked Out' && a.expected_return && new Date(a.expected_return) < today).forEach(a => {
      const days = Math.floor((today - new Date(a.expected_return)) / 86400000)
      notifs.push({ id: `overdue-${a.id}`, type: 'overdue', color: 'var(--red)', icon: '⚠', title: `${a.model || a.asset_tag} overdue`, body: `${days}d overdue — assigned to ${a.assigned_to}`, asset: a, nav: 'inventory' })
    })

    // Expiring warranties
    ;(assets || []).filter(a => a.warranty_expiry && new Date(a.warranty_expiry) <= in30 && new Date(a.warranty_expiry) >= today).forEach(a => {
      notifs.push({ id: `warranty-${a.id}`, type: 'warranty', color: 'var(--amber)', icon: '⏱', title: `${a.model || a.asset_tag} warranty expiring`, body: `Expires ${new Date(a.warranty_expiry).toLocaleDateString()}`, asset: a, nav: 'reports' })
    })

    // Expired warranties
    ;(assets || []).filter(a => a.warranty_expiry && new Date(a.warranty_expiry) < today && a.status !== 'Retired').forEach(a => {
      notifs.push({ id: `warranty-exp-${a.id}`, type: 'warranty-expired', color: 'var(--text2)', icon: '◌', title: `${a.model || a.asset_tag} warranty expired`, body: `Expired ${new Date(a.warranty_expiry).toLocaleDateString()}`, asset: a, nav: 'reports' })
    })

    // Expiring licenses
    ;(licenses || []).filter(l => l.expiry_date && new Date(l.expiry_date) <= in30 && new Date(l.expiry_date) >= today).forEach(l => {
      notifs.push({ id: `lic-${l.id}`, type: 'license', color: 'var(--purple)', icon: '📋', title: `${l.name} license expiring`, body: `Expires ${new Date(l.expiry_date).toLocaleDateString()}`, nav: 'licenses' })
    })

    // Expired licenses
    ;(licenses || []).filter(l => l.expiry_date && new Date(l.expiry_date) < today).forEach(l => {
      notifs.push({ id: `lic-exp-${l.id}`, type: 'license-expired', color: 'var(--red)', icon: '📋', title: `${l.name} license EXPIRED`, body: `Expired ${new Date(l.expiry_date).toLocaleDateString()}`, nav: 'licenses' })
    })

    // Pending requests
    if ((requests||[]).length > 0) {
      notifs.push({ id:'requests', type:'request', color:'var(--blue)', icon:'◈', title:`${requests.length} pending asset request${requests.length!==1?'s':''}`, body:'Waiting for admin review', nav:'requests' })
    }

    // Overdue scheduled maintenance
    ;(schedules||[]).filter(s => new Date(s.next_date) < today).forEach(s => {
      notifs.push({ id:`sched-${s.id}`, type:'scheduled', color:'var(--red)', icon:'⏰', title:`${s.asset?.asset_tag} maintenance overdue`, body:`${s.maintenance_type} was due ${new Date(s.next_date).toLocaleDateString()}`, asset: s.asset, nav:'scheduled' })
    })

    // Due soon scheduled maintenance
    ;(schedules||[]).filter(s => new Date(s.next_date) >= today).forEach(s => {
      notifs.push({ id:`sched-soon-${s.id}`, type:'scheduled', color:'var(--amber)', icon:'⏰', title:`${s.asset?.asset_tag} maintenance due soon`, body:`${s.maintenance_type} due ${new Date(s.next_date).toLocaleDateString()}`, asset: s.asset, nav:'scheduled' })
    })

    // Full license seats
    ;(licenses || []).filter(l => l.seats_total && l.seats_used >= l.seats_total).forEach(l => {
      notifs.push({ id: `seats-${l.id}`, type: 'seats', color: 'var(--amber)', icon: '⊡', title: `${l.name} seats full`, body: `${l.seats_used}/${l.seats_total} seats used`, nav: 'licenses' })
    })

    setNotifications(notifs)
    setLoading(false)
  }

  const unread = notifications.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'relative', background: open ? 'var(--bg3)' : 'none',
        border: '1px solid', borderColor: open ? 'var(--border2)' : 'transparent',
        borderRadius: 'var(--radius)', padding: '5px 10px', cursor: 'pointer',
        color: 'var(--text2)', fontSize: 16, fontFamily: 'var(--font)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        🔔
        {unread > 0 && (
          <span style={{ background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 100, fontFamily: 'var(--mono)', minWidth: 16, textAlign: 'center' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 360, maxHeight: 480, overflowY: 'auto',
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)', zIndex: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Notifications</span>
            {unread > 0 && <span style={{ fontSize: 11, color: 'var(--text2)' }}>{unread} alert{unread !== 1 ? 's' : ''}</span>}
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>All clear — no alerts</div>
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} onClick={() => { setOpen(false); if (n.asset) onViewAsset?.(n.asset); else onNav?.(n.nav) }}
                style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{n.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: n.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{n.body}</div>
                </div>
              </div>
            ))
          )}

          {notifications.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setOpen(false); onNav?.('reports') }} style={{ fontSize: 12, color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                View all in Reports →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
