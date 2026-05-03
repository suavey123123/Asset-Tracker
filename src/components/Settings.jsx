import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, FormField } from './UI'

export default function Settings() {
  const { profile, user, fetchProfile } = useAuth()
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

  // Notifications (stored in profile metadata)
  const [notifOverdue, setNotifOverdue] = useState(profile?.notify_overdue ?? true)
  const [notifWarranty, setNotifWarranty] = useState(profile?.notify_warranty ?? true)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')

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

  const TABS = [{ id: 'profile', label: 'Profile' }, { id: 'password', label: 'Password' }, { id: 'notifications', label: 'Notifications' }]

  const card = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', maxWidth: 480 }
  const msg = (m, isErr) => m ? <div style={{ fontSize: 12, color: m.startsWith('✓') ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>{m}</div> : null

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.5rem', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '6px 14px', fontSize: 13, borderRadius: 'var(--radius)',
            background: tab === t.id ? 'var(--bg4)' : 'transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--text2)',
            border: tab === t.id ? '1px solid var(--border2)' : '1px solid transparent',
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>{t.label}</button>
        ))}
      </div>

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
              <Btn variant="primary" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save profile'}</Btn>
              {msg(profileMsg)}
            </div>
          </div>
        </div>
      )}

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
              <Btn variant="primary" onClick={savePassword} disabled={passwordSaving}>{passwordSaving ? 'Saving…' : 'Update password'}</Btn>
              {msg(passwordMsg)}
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

      {tab === 'notifications' && (
        <div style={card} className="fade-in">
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: '0.5rem' }}>Notification preferences</h3>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1.25rem' }}>
            These control what shows on your Dashboard. Email notifications require a connected email service (see README for setup).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['Overdue check-out alerts', 'Show alerts when assets are past their expected return date', notifOverdue, setNotifOverdue],
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
              <Btn variant="primary" onClick={saveNotifications} disabled={notifSaving}>{notifSaving ? 'Saving…' : 'Save preferences'}</Btn>
              {msg(notifMsg)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
