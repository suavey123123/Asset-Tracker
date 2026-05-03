import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, EmptyState, Spinner, Modal, FormField } from './UI'

export default function Users() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  async function setRole(userId, role) {
    setSaving(userId)
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setSaving(null)
    fetchUsers()
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg('')
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail.trim())
    if (error) {
      // admin.inviteUserByEmail requires service role — use signUp with magic link instead
      const { error: e2 } = await supabase.auth.signInWithOtp({
        email: inviteEmail.trim(),
        options: { shouldCreateUser: true }
      })
      if (e2) {
        setInviteMsg('error:' + e2.message)
      } else {
        // Set their role after invite
        setInviteMsg(`✓ Invite sent to ${inviteEmail}. They'll receive a magic link to sign in.`)
        setInviteEmail('')
      }
    } else {
      setInviteMsg(`✓ Invite sent to ${inviteEmail}`)
      setInviteEmail('')
    }
    setInviting(false)
  }

  const isError = inviteMsg.startsWith('error:')

  return (
    <div className="fade-in">
      {/* Invite section */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>Invite team members</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>They'll receive a sign-in link via email.</div>
          </div>
          <Btn variant="primary" onClick={() => { setInviteOpen(true); setInviteMsg(''); setInviteEmail('') }}>
            + Invite user
          </Btn>
        </div>

        {/* Quick invite inline */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
              placeholder="colleague@company.com"
              type="email"
            />
          </div>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: 120 }}>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <Btn variant="primary" onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? 'Sending…' : 'Send invite'}
          </Btn>
        </div>

        {inviteMsg && (
          <div style={{
            marginTop: 10, fontSize: 12, padding: '8px 12px', borderRadius: 'var(--radius)',
            background: isError ? 'var(--red-bg)' : 'var(--green-bg)',
            border: `1px solid ${isError ? 'var(--red)' : 'var(--green)'}`,
            color: isError ? 'var(--red)' : 'var(--green)',
          }}>
            {isError ? inviteMsg.replace('error:', '') : inviteMsg}
          </div>
        )}
      </div>

      {/* Pending invites notice */}
      <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 12, color: 'var(--blue)', marginBottom: '1rem' }}>
        💡 After someone accepts their invite, they'll appear below. Set their role using the buttons in the Actions column.
      </div>

      {/* Users table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         users.length === 0 ? <EmptyState message="No users found." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Role', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{u.full_name || u.email}</div>
                    {u.full_name && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{u.email}</div>}
                    {u.id === profile?.id && <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>you</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}><Badge status={u.role} /></td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.id !== profile?.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {u.role !== 'admin' && (
                          <Btn size="sm" variant="primary" disabled={saving === u.id} onClick={() => setRole(u.id, 'admin')}>
                            {saving === u.id ? '…' : 'Make admin'}
                          </Btn>
                        )}
                        {u.role !== 'viewer' && (
                          <Btn size="sm" disabled={saving === u.id} onClick={() => setRole(u.id, 'viewer')}>
                            {saving === u.id ? '…' : 'Make viewer'}
                          </Btn>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
