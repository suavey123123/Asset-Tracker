import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, Btn, EmptyState, Spinner } from './UI'

export default function Users() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

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

  return (
    <div className="fade-in">
      <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--amber)', marginBottom: '1rem' }}>
        <strong>How to invite users:</strong> Go to your Supabase dashboard → Authentication → Users → Invite user. Once they sign up, set their role here.
      </div>

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
                    {u.id !== profile?.id && (
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
                    )}
                    {u.id === profile?.id && <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>}
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
