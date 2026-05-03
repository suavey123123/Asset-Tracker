import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Badge } from './UI'

export default function GlobalSearch({ onViewAsset }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('assets')
        .select('id, asset_tag, name, status, category, location, assigned_to')
        .or(`name.ilike.%${query}%,asset_tag.ilike.%${query}%,model.ilike.%${query}%,serial_number.ilike.%${query}%,location.ilike.%${query}%,assigned_to.ilike.%${query}%`)
        .limit(8)
      setResults(data || [])
      setOpen(true)
      setLoading(false)
    }, 250)
  }, [query])

  function select(asset) {
    setQuery('')
    setOpen(false)
    onViewAsset(asset)
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }}>⌕</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="Search assets, tags, people…"
          style={{ paddingLeft: 30, width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)' }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text3)' }}>…</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)', zIndex: 500, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {results.map((a, i) => (
            <div
              key={a.id}
              onClick={() => select(a)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px', cursor: 'pointer',
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                  {a.asset_tag}{a.location ? ` · ${a.location}` : ''}{a.assigned_to ? ` · ${a.assigned_to}` : ''}
                </div>
              </div>
              <Badge status={a.status} />
            </div>
          ))}
        </div>
      )}

      {open && query && results.length === 0 && !loading && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)', zIndex: 500, padding: '12px 14px',
          fontSize: 13, color: 'var(--text3)',
        }}>
          No assets found for "{query}"
        </div>
      )}
    </div>
  )
}
