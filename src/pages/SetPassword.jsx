import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('invite') // 'invite' | 'recovery'

  useEffect(() => {
    // Parse hash params from Supabase redirect
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace('#', '?'))
    const type = params.get('type')
    if (type === 'recovery') setMode('recovery')

    // Supabase auth handles the session from the hash automatically
  }, [])

  async function handleSubmit(e) {
    e?.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/' }, 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            {mode === 'recovery' ? 'Reset your password' : 'Set your password'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {mode === 'recovery' ? 'Choose a new password for your account.' : 'Welcome! Set a password to activate your account.'}
          </div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--green)', marginBottom: 4 }}>Password set!</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Redirecting you to the app…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, display: 'block', marginBottom: 4 }}>New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters" autoFocus style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, display: 'block', marginBottom: 4 }}>Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Same password again" style={{ width: '100%' }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>{error}</div>}
            <button type="submit" disabled={loading || !password || !confirm}
              style={{ width: '100%', padding: '10px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'var(--font)' }}>
              {loading ? 'Setting password…' : mode === 'recovery' ? 'Reset password' : 'Set password & sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
