import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const SUGGESTIONS = ['needs-repair', 'loaner', 'executive', 'shared', 'spare', 'end-of-life', 'high-priority', 'locked', 'new', 'refurbished']

export default function AssetTags({ assetId }) {
  const { isAdmin } = useAuth()
  const [saveError, setSaveError] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [tags, setTags] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => { fetchTags() }, [assetId])

  async function fetchTags() {
    setLoading(true)
    const { data } = await supabase.from('asset_tags').select('*').eq('asset_id', assetId).order('tag')
    setTags(data || [])
    setLoading(false)
  }

  async function addTag(tag) {
    const clean = tag.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!clean || tags.find(t => t.tag === clean)) return
    await supabase.from('asset_tags').insert({ asset_id: assetId, tag: clean })
    setInput(''); setShowSuggestions(false)
    fetchTags()
  }

  async function removeTag(id) {
    await supabase.from('asset_tags').delete().eq('id', id)
    fetchTags()
  }

  const filteredSuggestions = SUGGESTIONS.filter(s => s.includes(input.toLowerCase()) && !tags.find(t => t.tag === s))

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: '0.75rem' }}>Labels ({tags.length})</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tags.length > 0 ? 10 : 0 }}>
        {tags.map(t => (
          <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, background: 'var(--bg4)', border: '1px solid var(--border2)', fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
            {t.tag}
            {isAdmin && <button onClick={() => removeTag(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>}
          </span>
        ))}
        {tags.length === 0 && !isAdmin && <div style={{ fontSize: 13, color: 'var(--text3)' }}>No labels assigned.</div>}
      </div>

      {isAdmin && (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
              onKeyDown={e => { if (e.key === 'Enter' && input.trim()) addTag(input) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Add label (Enter to add)…"
              style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
            />
          </div>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', zIndex: 100, overflow: 'hidden' }}>
              {filteredSuggestions.map(s => (
                <div key={s} onClick={() => addTag(s)} style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
