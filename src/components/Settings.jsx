import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, FormField } from './UI'

export default function Settings() {
  const { profile, user, fetchProfile } = useAuth()
  const [fetchError, setFetchError] = useState('')
  const [tab, setTab] = useState('profile')

  // Profile
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')

  // Notifications
  const [notifOverdue, setNotifOverdue] = useState(profile?.notify_overdue ?? true)
  const [notifWarranty, setNotifWarranty] = useState(profile?.notify_warranty ?? true)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    localStorage.setItem('theme', theme)
    const vars = theme === 'light' ? {
      '--bg': '#f5f5f5', '--bg2': '#ffffff', '--bg3': '#f0f0f0', '--bg4': '#e8e8e8',
      '--border': '#e0e0e0', '--border2': '#d0d0d0',
      '--text': '#111111', '--text2': '#555555', '--text3': '#999999',
    } : {
      '--bg': '#0f0f0f', '--bg2': '#161616', '--bg3': '#1e1e1e', '--bg4': '#262626',
      '--border': '#2a2a2a', '--border2': '#333',
      '--text': '#e8e8e8', '--text2': '#999', '--text3': '#555',
    }
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
  }, [theme])

  async function saveProfile() {
    setProfileSaving(true); setProfileMsg('')
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    setProfileSaving(false)
    setProfileMsg(error ? error.message : '✓ Profile updated')
    if (!error) fetchProfile?.(user.id)
  }

  async function savePassword() {
    if (newPassword.length < 6) { setPasswordMsg('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordMsg('Passwords do not match.'); return }
    setPasswordSaving(true); setPasswordMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    setPasswordMsg(error ? error.message : '✓ Password updated')
    if (!error) { setNewPassword(''); setConfirmPassword('') }
  }

  async function saveNotifications() {
    setNotifSaving(true); setNotifMsg('')
    const { error } = await supabase.from('profiles').update({ notify_overdue: notifOverdue, notify_warranty: notifWarranty }).eq('id', user.id)
    setNotifSaving(false)
    setNotifMsg(error ? error.message : '✓ Preferences saved')
  }

  const TABS = ['profile', 'password', 'notifications', 'email']
  const LABELS = { profile: 'Profile', password: 'Password', notifications: 'Notifications', email: 'Email Alerts' }

  const card = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', maxWidth: 480 }

  function StatusMsg({ msg }) {
    if (!msg) return null
    const isErr = !msg.startsWith('✓')
    return (
      <div style={{ fontSize: 12, color: isErr ? 'var(--red)' : 'var(--green)', marginTop: 4 }}>{msg}</div>
    )
  }

  return (
    <div className="fade-in">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.5rem', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', fontSize: 13, borderRadius: 'var(--radius)',
            background: tab === t ? 'var(--bg4)' : 'transparent',
            color: tab === t ? 'var(--text)' : 'var(--text2)',
            border: tab === t ? '1px solid var(--border2)' : '1px solid transparent',
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>{LABELS[t]}</button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div style={card} className="fade-in">
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: '1.25rem' }}>Profile settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormField label="Email">
              <input value={user?.email || ''} disabled style={{ opacity: 0.5 }} />
            </FormField>
            <FormField label="Full name">
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
            </FormField>
            <FormField label="Role">
              <input value={profile?.role || 'viewer'} disabled style={{ opacity: 0.5, fontFamily: 'var(--mono)', fontSize: 12 }} />
            </FormField>
            <div>
              <Btn variant="primary" onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save profile'}
              </Btn>
              <StatusMsg msg={profileMsg} />
            </div>
            <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Appearance</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['dark', 'light'].map(t => (
                  <button key={t} onClick={() => setTheme(t)} style={{
                    padding: '8px 20px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    fontFamily: 'var(--font)', fontSize: 13,
                    background: theme === t ? 'var(--accent)' : 'var(--bg3)',
                    color: theme === t ? '#0f0f0f' : 'var(--text2)',
                    border: `1px solid ${theme === t ? 'var(--accent)' : 'var(--border2)'}`,
                    fontWeight: theme === t ? 600 : 400,
                  }}>
                    {t === 'dark' ? '🌙 Dark' : '☀ Light'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password tab */}
      {tab === 'password' && (
        <div style={card} className="fade-in">
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: '1.25rem' }}>Change password</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormField label="New password">
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
            </FormField>
            <FormField label="Confirm new password">
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
            </FormField>
            <div>
              <Btn variant="primary" onClick={savePassword} disabled={passwordSaving}>
                {passwordSaving ? 'Saving…' : 'Update password'}
              </Btn>
              <StatusMsg msg={passwordMsg} />
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Forgot your password? Send a reset link to your email.</p>
            <Btn size="sm" onClick={async () => {
              await supabase.auth.resetPasswordForEmail(user?.email)
              setPasswordMsg('✓ Reset email sent to ' + user?.email)
            }}>Send reset email</Btn>
          </div>
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div style={card} className="fade-in">
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: '0.5rem' }}>Notification preferences</h3>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1.25rem' }}>
            These control what shows on your Dashboard alerts.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['Overdue check-out alerts', 'Show alerts when assets are past their return date', notifOverdue, setNotifOverdue],
              ['Warranty expiry alerts', 'Show alerts when warranties expire within 30 days', notifWarranty, setNotifWarranty],
            ].map(([label, desc, val, set]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ width: 'auto', marginTop: 2, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{desc}</div>
                </div>
              </div>
            ))}
            <div>
              <Btn variant="primary" onClick={saveNotifications} disabled={notifSaving}>
                {notifSaving ? 'Saving…' : 'Save preferences'}
              </Btn>
              <StatusMsg msg={notifMsg} />
            </div>
          </div>
        </div>
      )}

      {/* Email alerts tab */}
      {tab === 'email' && (
        <div style={card} className="fade-in">
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: '0.5rem' }}>Email alert setup</h3>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1.25rem' }}>
            Email alerts are sent via a Supabase Edge Function using Resend (free tier available).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { n: 1, title: 'Create a free Resend account', desc: 'Go to resend.com and sign up. Get your API key from Settings then API Keys.' },
              { n: 2, title: 'Add secrets to Supabase', desc: 'Go to Supabase, then Edge Functions, then Secrets. Add: RESEND_API_KEY, ALERT_EMAIL, APP_URL, FROM_EMAIL' },
              { n: 3, title: 'Deploy the edge function', desc: 'Run this in PowerShell from your project folder: npx supabase functions deploy send-alerts' },
              { n: 4, title: 'Schedule it (optional)', desc: 'In Supabase, go to Edge Functions and set a cron schedule like: 0 9 * * * — this sends alerts every morning at 9am.' },
            ].map(step => (
              <div key={step.n} style={{ display: 'flex', gap: 12, padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{step.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{step.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--blue)' }}>
              The edge function file is included in your project at: supabase/functions/send-alerts/index.ts
            </div>
          </div>
        </div>
      )}
    </div>
  )
}