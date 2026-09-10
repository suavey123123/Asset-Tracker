import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Badge } from './UI'

export default function GlobalSearch({ onViewAsset }) {
  const [query, setQuery] = useState('')
  const [assets, setAssets] = useState([])
  const [employees, setEmployees] = useState([])
  const [licenses, setLicenses] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [empIdToName, setEmpIdToName] = useState({})
  const ref = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch employees periodically (every 5 min) so search result names stay current.
  useEffect(() => {
    function refresh() {
      supabase.from('employees').select('id, name').then(({ data }) => {
        const map = {}
        data?.forEach(e => { map[e.id] = e.name })
        setEmpIdToName(map)
      })
    }
    refresh()
    const id = setInterval(refresh, 300000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!query.trim()) { setAssets([]); setEmployees([]); setLicenses([]); setOpen(false); return }
    setLoading(true)
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      try {
        const [{ data: rawAssets }, { data: emps }, { data: lics }, { data: matchEmps }] = await Promise.all([
          // Search assets by name, tag, model, serial, location, AND assigned_to name
          supabase.from('assets').select('id, asset_tag, name, model, status, category, location, assigned_to')
            .or(`name.ilike.%${query}%,asset_tag.ilike.%${query}%,model.ilike.%${query}%,serial_number.ilike.%${query}%,location.ilike.%${query}%,assigned_to.ilike.%${query}%`),
          // Search employees by name, email
          supabase.from('employees').select('id, name, email, department').or(`name.ilike.%${query}%,email.ilike.%${query}%`).limit(5),
          // Search licenses by name, vendor
          supabase.from('licenses').select('id, name, vendor, license_type').or(`name.ilike.%${query}%,vendor.ilike.%${query}%`).limit(3),
          // Find employees whose name matches, then fetch their assigned assets
          supabase.from('employees').select('id,name').or(`name.ilike.%${query}%,email.ilike.%${query}%`).limit(10),
        ])

        // Merge assets assigned to matching employees (so searching "John" shows all of John's assets)
        if (matchEmps?.length) {
          const matchNames = matchEmps.map(e => e.name).filter(Boolean)
          // assigned_to stores employee names, so match by name list (dual: also include IDs for legacy data)
          const matchIds = matchEmps.map(e => e.id).filter(Boolean)
          const { data: assignedAssets } = await supabase.from('assets').select('id, asset_tag, name, model, status, category, location, assigned_to')
            .or(`assigned_to.in.(${matchNames.map(n => `'${n.replace(/'/g, "''")}'`)})`.replace('()', `(${[...new Set([...matchNames, ...matchIds])].map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')})`)
          if (assignedAssets?.length) {
            const existingIds = new Set((rawAssets || []).map(a => a.id))
            const merged = [...rawAssets || []]
            assignedAssets.forEach(a => {
              const idx = merged.findIndex(x => x.id === a.id)
              if (idx >= 0) merged[idx] = a
              else { merged.push(a); existingIds.add(a.id) }
            })
            setAssets(merged)
          } else {
            setAssets(rawAssets || [])
          }
        } else {
          setAssets(rawAssets || [])
        }
        setEmployees(emps || [])
        setLicenses(lics || [])
        setOpen(true)
      } catch (e) {
        if (e.name !== 'AbortError') setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [query])

  const selectAsset = useCallback((asset) => {
    setQuery('')
    setOpen(false)
    onViewAsset(asset)
  }, [onViewAsset])

  const totalResults = assets.length + employees.length + licenses.length

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

      {open && totalResults > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)', zIndex: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          ...(totalResults > 10 ? { maxHeight: '500px', overflowY: 'auto' } : {}),
        }}>
          {/* Employee results */}
          {employees.length > 0 && (
            <div style={{ padding: '6px 0' }}>
              <div style={{ padding: '4px 14px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>People</div>
              {employees.map((e, i) => (
                <div key={e.id} style={{ padding: '7px 14px 7px 22px', fontSize: 12, color: 'var(--text3)', borderBottom: i < employees.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {e.name}{e.department ? ` · ${e.department}` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Asset results */}
          {assets.length > 0 && (
            <div style={{ padding: '6px 0' }}>
              {employees.length > 0 && (
                <div style={{ padding: '4px 14px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assets</div>
              )}
              {assets.map((a, i) => (
                <div
                  key={a.id}
                  onClick={() => selectAsset(a)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px', cursor: 'pointer',
                    borderBottom: i < assets.length - 1 && licenses.length === 0 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.model && a.model !== a.asset_tag ? a.model : a.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                      {a.asset_tag}{a.location ? ` · ${a.location}` : ''}{a.assigned_to ? ` · ${empIdToName[a.assigned_to] || a.assigned_to}` : ''}
                    </div>
                  </div>
                  <Badge status={a.status} />
                </div>
              ))}
            </div>
          )}

          {/* License results */}
          {licenses.length > 0 && (
            <div style={{ padding: '6px 0' }}>
              {(employees.length > 0 || assets.length > 0) && (
                <div style={{ padding: '4px 14px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Licenses</div>
              )}
              {licenses.map((l, i) => (
                <div key={l.id} style={{ padding: '7px 14px 7px 22px', fontSize: 12, color: 'var(--text)', borderBottom: i < licenses.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {l.name}{l.vendor ? ` · ${l.vendor}` : ''}{l.license_type ? ` · ${l.license_type}` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Result count */}
          <div style={{
            padding: '6px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
            textAlign: 'center',
          }}>
            {totalResults} result{totalResults !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {open && query && totalResults === 0 && !loading && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)', zIndex: 500, padding: '12px 14px',
          fontSize: 13, color: 'var(--text3)',
        }}>
          No results for "{query}"
        </div>
      )}
    </div>
  )
}
