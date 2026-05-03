import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function EmployeeSelect({ value, onChange, placeholder = 'Employee name or type new…' }) {
  const [employees, setEmployees] = useState([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const ref = useRef(null)

  useEffect(() => {
    supabase.from('employees').select('id, name, department, title').order('name').then(({ data }) => setEmployees(data || []))
  }, [])

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = employees.filter(e => e.name.toLowerCase().includes(query.toLowerCase()))

  function select(name) { setQuery(name); onChange(name); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && (filtered.length > 0) && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map(e => (
            <div key={e.id} onClick={() => select(e.name)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={el => el.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={el => el.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
              {(e.title || e.department) && (
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{[e.title, e.department].filter(Boolean).join(' · ')}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
