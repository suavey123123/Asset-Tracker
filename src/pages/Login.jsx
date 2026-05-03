import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card} className="fade-in">
        <div style={styles.logo}>
          <span style={styles.logoBox}>AT</span>
          <span style={styles.logoText}>Asset Tracker</span>
        </div>
        <p style={styles.sub}>Sign in to your workspace</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={styles.hint}>Contact your admin if you don't have an account.</p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  logoBox: {
    width: 36,
    height: 36,
    background: 'var(--accent)',
    color: '#0f0f0f',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--mono)',
    fontWeight: 500,
    fontSize: 13,
  },
  logoText: {
    fontWeight: 500,
    fontSize: 16,
    letterSpacing: '-0.02em',
  },
  sub: {
    color: 'var(--text2)',
    fontSize: 13,
    marginBottom: '1.5rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, color: 'var(--text2)', fontWeight: 500 },
  error: {
    background: 'var(--red-bg)',
    border: '1px solid var(--red)',
    borderRadius: 'var(--radius)',
    color: 'var(--red)',
    fontSize: 12,
    padding: '8px 12px',
  },
  btn: {
    background: 'var(--accent)',
    color: '#0f0f0f',
    fontWeight: 600,
    fontSize: 13,
    padding: '10px',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    marginTop: 4,
    transition: 'opacity 0.15s',
    border: 'none',
    fontFamily: 'var(--font)',
  },
  hint: {
    marginTop: '1rem',
    fontSize: 11,
    color: 'var(--text3)',
    textAlign: 'center',
  },
}
