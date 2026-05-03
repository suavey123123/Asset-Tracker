import { useAuth } from '../lib/AuthContext'
import { Badge } from './UI'

const NAV = [
  { id: 'home',        label: 'Dashboard',    icon: '⊞' },
  { id: 'inventory',   label: 'Inventory',    icon: '▦' },
  { id: 'checkout',    label: 'Check In/Out', icon: '⇄' },
  { id: 'maintenance', label: 'Maintenance',  icon: '⚙' },
  { id: 'history',     label: 'History',      icon: '◷' },
  { id: 'users',       label: 'Users',        icon: '◉', adminOnly: true },
]

export default function Sidebar({ active, onNav, alerts = 0 }) {
  const { profile, signOut, isAdmin } = useAuth()

  return (
    <aside style={s.sidebar}>
      <div style={s.logo}>
        <span style={s.logoBox}>AT</span>
        <span style={s.logoText}>Asset Tracker</span>
      </div>

      <nav style={s.nav}>
        {NAV.filter(n => !n.adminOnly || isAdmin).map(n => (
          <button
            key={n.id}
            onClick={() => onNav(n.id)}
            style={{ ...s.navItem, ...(active === n.id ? s.navActive : {}) }}
          >
            <span style={s.navIcon}>{n.icon}</span>
            {n.label}
            {n.id === 'home' && alerts > 0 && (
              <span style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 100, fontFamily: 'var(--mono)' }}>
                {alerts}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={s.footer}>
        <div style={s.userRow}>
          <div style={s.avatar}>{profile?.email?.[0]?.toUpperCase() || '?'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name || profile?.email}
            </div>
            <Badge status={profile?.role || 'viewer'} />
          </div>
        </div>
        <button onClick={signOut} style={s.signOut}>Sign out</button>
      </div>
    </aside>
  )
}

const s = {
  sidebar: {
    width: 200, minWidth: 200, height: '100vh',
    background: 'var(--bg2)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column',
    padding: '1.25rem 0.75rem', position: 'sticky', top: 0,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 9, padding: '0 0.5rem', marginBottom: '1.5rem' },
  logoBox: {
    width: 30, height: 30, background: 'var(--accent)', color: '#0f0f0f',
    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 11, flexShrink: 0,
  },
  logoText: { fontSize: 14, fontWeight: 500, letterSpacing: '-0.02em' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '7px 10px', borderRadius: 'var(--radius)',
    fontSize: 13, color: 'var(--text2)', background: 'none',
    border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
    transition: 'all 0.1s',
  },
  navActive: {
    background: 'var(--accent-bg)', color: 'var(--accent)',
    border: '1px solid var(--accent-border)',
  },
  navIcon: { fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 },
  footer: { borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' },
  userRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: {
    width: 28, height: 28, borderRadius: '50%',
    background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 500, flexShrink: 0,
  },
  signOut: {
    width: '100%', fontSize: 12, color: 'var(--text3)',
    background: 'none', border: 'none', cursor: 'pointer',
    textAlign: 'left', padding: '4px 2px',
  },
}
