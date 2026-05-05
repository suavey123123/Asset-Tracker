import { useAuth } from '../lib/AuthContext'
import { Badge } from './UI'

const NAV_GROUPS = [
  {
    label: 'Assets',
    items: [
      { id: 'home',        label: 'Dashboard',    icon: '⊞' },
      { id: 'inventory',   label: 'Inventory',    icon: '▦' },
      { id: 'lifecycle',   label: 'Lifecycle',    icon: '◎' },
      { id: 'scanner',     label: 'Scanner',      icon: '◈' },
    { id: 'qrlabels',    label: 'QR Labels',    icon: '⬛' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { id: 'transfer',    label: 'Transfer',     icon: '↔' },
      { id: 'requests',    label: 'Requests',     icon: '◉' },
      { id: 'maintenance', label: 'Maintenance',  icon: '⚙' },
      { id: 'scheduled',   label: 'Scheduled',    icon: '⏰' },
    ]
  },
  {
    label: 'People',
    items: [
      { id: 'employees',   label: 'Employees',    icon: '◑' },
      { id: 'offboarding', label: 'Offboarding',  icon: '⊗' },
      { id: 'sites',       label: 'Sites',        icon: '⊕' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { id: 'licenses',      label: 'Licenses',       icon: '⊡' },
      { id: 'valuedashboard', label: 'Asset Values',    icon: '$' },
      { id: 'consumables',   label: 'Consumables',    icon: '⊞' },
      { id: 'reports',       label: 'Reports',        icon: '⊟' },
      { id: 'compliance',    label: 'Compliance',     icon: '✓' },
    { id: 'reportbuilder', label: 'Report Builder',  icon: '📊' },
    ]
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { id: 'users',       label: 'Users',        icon: '◉', adminOnly: true },
      { id: 'tenants',     label: 'Tenants',      icon: '🏢', adminOnly: true },
      { id: 'settings',    label: 'Settings',     icon: '⚙', adminOnly: true },
    ]
  },
]

const BOTTOM_ITEMS = [
  { id: 'history',     label: 'History',      icon: '◷' },
  { id: 'settings',   label: 'Settings',     icon: '⚙' },
]

export default function Sidebar({ active, onNav, alerts = 0 }) {
  const { profile, signOut, isAdmin, isAdminOrManager, isTechnician } = useAuth()

  return (
    <aside style={s.sidebar}>
      {/* Logo */}
      <div style={s.logo}>
        <span style={s.logoBox}>AT</span>
        <span style={s.logoText}>Asset Tracker</span>
      </div>

      {/* Nav groups */}
      <nav style={s.nav}>
        {NAV_GROUPS.filter(g => {
          if (g.adminOnly && !isAdmin) return false
          if (g.technicianHide && isTechnician) return false
          return true
        }).map(group => (
          <div key={group.label} style={s.group}>
            <div style={s.groupLabel}>{group.label}</div>
            {group.items.filter(n => !n.adminOnly || isAdmin).map(n => (
              <button key={n.id} onClick={() => onNav(n.id)}
                style={{ ...s.navItem, ...(active === n.id ? s.navActive : {}) }}>
                <span style={s.navIcon}>{n.icon}</span>
                {n.label}
                {n.id === 'home' && alerts > 0 && (
                  <span style={s.badge}>{alerts}</span>
                )}
                {n.id === 'requests' && alerts > 0 && (
                  <span style={s.badge}>{alerts}</span>
                )}
              </button>
            ))}
          </div>
        ))}

        {/* Bottom items */}
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          {BOTTOM_ITEMS.map(n => (
            <button key={n.id} onClick={() => onNav(n.id)}
              style={{ ...s.navItem, ...(active === n.id ? s.navActive : {}) }}>
              <span style={s.navIcon}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      {/* User footer */}
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
  sidebar: { width: 200, minWidth: 200, height: '100vh', background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '1rem 0.75rem 0.75rem', position: 'sticky', top: 0, overflowY: 'auto' },
  logo: { display: 'flex', alignItems: 'center', gap: 9, padding: '0 0.5rem', marginBottom: '1rem' },
  logoBox: { width: 28, height: 28, background: 'var(--accent)', color: '#0f0f0f', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 11, flexShrink: 0 },
  logoText: { fontSize: 13, fontWeight: 500, letterSpacing: '-0.02em' },
  nav: { display: 'flex', flexDirection: 'column', flex: 1, gap: 2 },
  group: { marginBottom: 4 },
  groupLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px 3px', fontFamily: 'var(--mono)' },
  navItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.1s', fontFamily: 'var(--font)' },
  navActive: { background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' },
  navIcon: { fontSize: 13, width: 14, textAlign: 'center', flexShrink: 0 },
  badge: { marginLeft: 'auto', background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 100, fontFamily: 'var(--mono)' },
  footer: { borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' },
  userRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatar: { width: 26, height: 26, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 },
  signOut: { width: '100%', fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '3px 2px', fontFamily: 'var(--font)' },
}
