import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Spinner } from './UI'

export default function AssetComments({ assetId }) {
  const { profile } = useAuth()
  const [fetchError, setFetchError] = useState('')
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchComments() }, [assetId])

  async function fetchComments() {
    setLoading(true)
    const { data } = await supabase
      .from('asset_comments')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
    setComments(data || [])
    setLoading(false)
  }

  async function addComment() {
    if (!text.trim()) return
    setSaving(true)
    await supabase.from('asset_comments').insert({
      asset_id: assetId,
      message: text.trim(),
      author: profile?.email || 'Unknown',
    })
    setText('')
    setSaving(false)
    fetchComments()
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: '0.75rem' }}>Comments ({comments.length})</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment()}
          placeholder="Add a comment… (Enter to submit)"
          style={{ flex: 1 }}
        />
        <Btn size="sm" variant="primary" onClick={addComment} disabled={saving || !text.trim()}>
          {saving ? '…' : 'Post'}
        </Btn>
      </div>

      {loading ? <Spinner size={16} /> : comments.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>No comments yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {comments.map(c => (
            <div key={c.id} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px 12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                  {c.author?.[0]?.toUpperCase() || '?'}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{c.author}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{c.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
