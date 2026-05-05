import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, EmptyState, Spinner, Modal, FormField } from './UI'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export default function Users() {
  const { profile } = useAuth()
  const [fetchError, setFetchError] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [actionMsg, setActionMsg] = useState({})
  const [pwdModal, setPwdModal] = useState(null)
  const [newPwd, setNewPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')
  const [resetLinkModal, setResetLinkModal] = useState(null)
  const [resetLink, setResetLink] = useState('')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  async function callEdge(action, payload = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, ...payload }),
    })
    return res.json()
  }

  function setMsg(userId, type, text) {
    setActionMsg(prev => ({ ...prev, [userId]: { type, text } }))
    setTimeout(() => setActionMsg(prev => { const n={...prev}; delete n[userId]; return n }), 4000)
  }

  async function setRole(userId, role) {
    setSaving(userId)
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setSaving(null); fetchUsers()
  }

  async function disableUser(u) {
    if (!confirm(`Disable ${u.email}? They will be immediately blocked from logging in.`)) return
    setSaving(u.id)
    const r = await callEdge('disable', { userId: u.id })
    setSaving(null)
    r.error ? setMsg(u.id, 'error', r.error) : (setMsg(u.id, 'success', '✓ User disabled'), fetchUsers())
  }

  async function enableUser(u) {
    if (!confirm(`Re-enable ${u.email}?`)) return
    setSaving(u.id)
    const r = await callEdge('enable', { userId: u.id })
    setSaving(null)
    r.error ? setMsg(u.id, 'error', r.error) : (setMsg(u.id, 'success', '✓ User enabled'), fetchUsers())
  }

  async function deleteUser(u) {
    if (!confirm(`Permanently delete ${u.email}? Cannot be undone.`)) return
    setSaving(u.id)
    const r = await callEdge('delete', { userId: u.id })
    setSaving(null)
    r.error ? setMsg(u.id, 'error', r.error) : fetchUsers()
  }

  async function setPassword() {
    if (!newPwd || newPwd.length < 6) { setPwdMsg('Password must be at least 6 characters'); return }
    setPwdSaving(true); setPwdMsg('')
    const r = await callEdge('set_password', { userId: pwdModal.id, password: newPwd })
    setPwdSaving(false)
    if (r.error) { setPwdMsg(r.error); return }
    setPwdMsg('✓ Password updated successfully')
    setTimeout(() => { setPwdModal(null); setNewPwd(''); setPwdMsg('') }, 1500)
  }

  async function generateResetLink(u) {
    setSaving(u.id)
    const r = await callEdge('send_reset', { userId: u.email })
    setSaving(null)
    if (r.error) { setMsg(u.id, 'error', r.error); return }
    setResetLink(r.link || '')
    setResetLinkModal(u)
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
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>They'll receive a magic link to sign in and set their password.</div>
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
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', opacity: u.blocked ? 0.65 : 1 }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{u.full_name || u.email}</div>
                    {u.full_name && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{u.email}</div>}
                    {u.id === profile?.id && <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>you</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}><Badge status={u.role} /></td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, padding: '2px 8px', borderRadius: 100, color: u.blocked ? 'var(--red)' : 'var(--green)', background: u.blocked ? 'var(--red-bg)' : 'var(--green-bg)' }}>
                      {u.blocked ? 'DISABLED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.id !== profile?.id ? (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {u.role !== 'admin' && <Btn size="sm" variant="primary" disabled={!!saving} onClick={() => setRole(u.id, 'admin')}>Make admin</Btn>}
                        {u.role !== 'viewer' && <Btn size="sm" disabled={!!saving} onClick={() => setRole(u.id, 'viewer')}>Make viewer</Btn>}
                        <Btn size="sm" variant="primary" onClick={() => { setPwdModal(u); setNewPwd(''); setPwdMsg('') }}>Set password</Btn>
                        <Btn size="sm" onClick={() => generateResetLink(u)} disabled={saving === u.id}>{saving === u.id ? '…' : '🔗 Reset link'}</Btn>
                        {u.blocked
                          ? <Btn size="sm" disabled={saving === u.id} onClick={() => enableUser(u)}>Enable</Btn>
                          : <Btn size="sm" variant="danger" disabled={saving === u.id} onClick={() => disableUser(u)}>Disable</Btn>
                        }
                        <Btn size="sm" variant="danger" disabled={saving === u.id} onClick={() => deleteUser(u)}>Delete</Btn>
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

      {/* Set password modal */}
      <Modal open={!!pwdModal} onClose={() => setPwdModal(null)} title={`Set password — ${pwdModal?.email}`} width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Manually set a new password for this user. Share it with them securely.</div>
          <FormField label="New password">
            <input type="text" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min. 6 characters" onKeyDown={e => e.key === 'Enter' && setPassword()} />
          </FormField>
          {pwdMsg && <div style={{ fontSize: 12, color: pwdMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{pwdMsg}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setPwdModal(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={setPassword} disabled={pwdSaving || !newPwd}>{pwdSaving ? 'Saving…' : 'Set password'}</Btn>
          </div>
        </div>
      </Modal>

      {/* Reset link modal */}
      <Modal open={!!resetLinkModal} onClose={() => { setResetLinkModal(null); setResetLink('') }} title={`Password reset link — ${resetLinkModal?.email}`} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {resetLink
              ? 'Share this link with the user. It expires after 1 hour and can only be used once.'
              : 'A reset email has been sent to the user.'}
          </div>
          {resetLink && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '10px 12px', wordBreak: 'break-all', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
              {resetLink}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {resetLink && (
              <Btn variant="primary" onClick={() => { navigator.clipboard.writeText(resetLink); }}>📋 Copy link</Btn>
            )}
            <Btn onClick={() => { setResetLinkModal(null); setResetLink('') }}>Close</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
