import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, EmptyState, Spinner, Modal, FormField } from './UI'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export default function Users() {
  const { profile, user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [actionMsg, setActionMsg] = useState({})

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

  async function callEdgeFunction(action, userId) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, userId }),
    })
    const json = await res.json()
    return json
  }

  async function disableUser(u) {
    if (!confirm(`Disable ${u.email}? They will be immediately signed out and blocked from logging in.`)) return
    setSaving(u.id)
    const result = await callEdgeFunction('disable', u.id)
    setSaving(null)
    if (result.error) {
      setActionMsg({ [u.id]: { type: 'error', text: result.error } })
    } else {
      setActionMsg({ [u.id]: { type: 'success', text: 'User disabled' } })
      fetchUsers()
    }
  }

  async function enableUser(u) {
    if (!confirm(`Re-enable ${u.email}? They will be able to log in again.`)) return
    setSaving(u.id)
    const result = await callEdgeFunction('enable', u.id)
    setSaving(null)
    if (result.error) {
      setActionMsg({ [u.id]: { type: 'error', text: result.error } })
    } else {
      setActionMsg({ [u.id]: { type: 'success', text: 'User enabled' } })
      fetchUsers()
    }
  }

  async function deleteUser(u) {
    if (!confirm(`Permanently delete ${u.email}? This removes them from authentication entirely and cannot be undone.`)) return
    setSaving(u.id)
    const result = await callEdgeFunction('delete', u.id)
    setSaving(null)
    if (result.error) {
      setActionMsg({ [u.id]: { type: 'error', text: result.error } })
    } else {
      fetchUsers()
    }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail.trim(),
      options: { shouldCreateUser: true }
    })
    setInviting(false)
    setInviteMsg(error ? 'error:' + error.message : `✓ Invite sent to ${inviteEmail}`)
    if (!error) setInviteEmail('')
  }

  const isError = inviteMsg.startsWith('error:')

  return (
    <div className="fade-in">
      {/* Invite */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Invite team member</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>They'll receive a magic link to sign in.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendInvite()} placeholder="colleague@company.com" type="email" style={{ flex: 1 }} />
          <Btn variant="primary" onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>{inviting ? 'Sending…' : 'Send invite'}</Btn>
        </div>
        {inviteMsg && (
          <div style={{ marginTop: 8, fontSize: 12, padding: '6px 10px', borderRadius: 'var(--radius)', background: isError ? 'var(--red-bg)' : 'var(--green-bg)', border: `1px solid ${isError ? 'var(--red)' : 'var(--green)'}`, color: isError ? 'var(--red)' : 'var(--green)' }}>
            {isError ? inviteMsg.replace('error:', '') : inviteMsg}
          </div>
        )}
      </div>

      {/* Edge function setup notice */}
      <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 12, color: 'var(--blue)', marginBottom: '1rem' }}>
        💡 Disable/Delete requires the <strong>manage-user</strong> edge function to be deployed. Run: <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg4)', padding: '1px 4px', borderRadius: 3 }}>npx supabase functions deploy manage-user</code>
      </div>

      {/* Users table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem' }}><Spinner /></div> :
         users.length === 0 ? <EmptyState message="No users found." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', opacity: u.blocked ? 0.6 : 1 }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{u.full_name || u.email}</div>
                    {u.full_name && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{u.email}</div>}
                    {u.id === profile?.id && <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>you</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}><Badge status={u.role} /></td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.blocked
                      ? <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--red)', background: 'var(--red-bg)', padding: '2px 8px', borderRadius: 100 }}>DISABLED</span>
                      : <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', padding: '2px 8px', borderRadius: 100 }}>ACTIVE</span>
                    }
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.id !== profile?.id ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {u.role !== 'admin' && <Btn size="sm" variant="primary" disabled={!!saving} onClick={() => setRole(u.id, 'admin')}>Make admin</Btn>}
                        {u.role !== 'viewer' && <Btn size="sm" disabled={!!saving} onClick={() => setRole(u.id, 'viewer')}>Make viewer</Btn>}
                        {u.blocked
                          ? <Btn size="sm" disabled={saving === u.id} onClick={() => enableUser(u)}>{saving === u.id ? '…' : 'Enable'}</Btn>
                          : <Btn size="sm" variant="danger" disabled={saving === u.id} onClick={() => disableUser(u)}>{saving === u.id ? '…' : 'Disable'}</Btn>
                        }
                        <Btn size="sm" variant="danger" disabled={saving === u.id} onClick={() => deleteUser(u)}>{saving === u.id ? '…' : 'Delete'}</Btn>
                        {actionMsg[u.id] && (
                          <span style={{ fontSize: 11, color: actionMsg[u.id].type === 'error' ? 'var(--red)' : 'var(--green)' }}>{actionMsg[u.id].text}</span>
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
