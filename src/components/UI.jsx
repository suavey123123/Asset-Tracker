export function Badge({ status }) {
  const map = {
    'Available':    { bg: 'var(--green-bg)',  color: 'var(--green)',  label: 'Available' },
    'Checked Out':  { bg: 'var(--blue-bg)',   color: 'var(--blue)',   label: 'Checked Out' },
    'Maintenance':  { bg: 'var(--amber-bg)',  color: 'var(--amber)',  label: 'Maintenance' },
    'Retired':      { bg: '#2a2a2a',          color: 'var(--text2)',  label: 'Retired' },
    'Ordered':      { bg: 'var(--purple-bg)', color: 'var(--purple)', label: 'Ordered' },
    'Received':     { bg: 'var(--accent-bg)', color: 'var(--accent)', label: 'Received' },
    'Tools & Equipment': { bg: 'var(--amber-bg)', color: 'var(--amber)', label: 'Tools' },
    'admin':        { bg: 'var(--accent-bg)', color: 'var(--accent)', label: 'Admin' },
    'viewer':       { bg: '#222',             color: 'var(--text2)',  label: 'Viewer' },
  }
  const s = map[status] || { bg: '#222', color: 'var(--text2)', label: status }
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: 100,
      fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
      fontFamily: 'var(--mono)',
    }}>{s.label}</span>
  )
}

export function Btn({ children, onClick, variant = 'default', size = 'md', disabled, style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: 'var(--font)', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 'var(--radius)', border: '1px solid', transition: 'all 0.15s',
    opacity: disabled ? 0.5 : 1,
  }
  const sizes = {
    sm: { fontSize: 12, padding: '4px 10px' },
    md: { fontSize: 13, padding: '7px 14px' },
    lg: { fontSize: 14, padding: '10px 20px' },
  }
  const variants = {
    default: { background: 'var(--bg3)', borderColor: 'var(--border2)', color: 'var(--text)' },
    primary: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#0f0f0f' },
    danger:  { background: 'var(--red-bg)', borderColor: 'var(--red)', color: 'var(--red)' },
    ghost:   { background: 'transparent', borderColor: 'transparent', color: 'var(--text2)' },
    success: { background: 'var(--green-bg)', borderColor: 'var(--green)', color: 'var(--green)' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

export function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '1.5rem',
        width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500 }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text2)', fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormField({ label, children, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export function EmptyState({ message }) {
  return (
    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      {message}
    </div>
  )
}

export function Spinner({ size = 20 }) {
  return (
    <div style={{
      width: size, height: size,
      border: '2px solid var(--border2)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      margin: '0 auto',
    }} />
  )
}

export function ViewOnlyBanner() {
  return (
    <div style={{
      background: 'var(--blue-bg)', border: '1px solid var(--blue)',
      borderRadius: 'var(--radius)', padding: '8px 14px',
      fontSize: 12, color: 'var(--blue)', marginBottom: '1rem',
    }}>
      👁 View-only mode — contact your admin to make changes.
    </div>
  )
}

export function StatusSelect({ value, onChange, style = {} }) {
  const statuses = ['Available', 'Checked Out', 'Maintenance', 'Retired']
  const colors = {
    'Available': 'var(--green)', 'Checked Out': 'var(--blue)',
    'Maintenance': 'var(--amber)', 'Retired': 'var(--text2)',
    'Ordered': 'var(--purple)', 'Received': 'var(--accent)',
  }
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...style, color: colors[value] || 'var(--text)', fontFamily: 'var(--mono)', fontSize: 12 }}>
      {statuses.map(s => <option key={s} value={s} style={{ color: colors[s] }}>{s}</option>)}
    </select>
  )
}
