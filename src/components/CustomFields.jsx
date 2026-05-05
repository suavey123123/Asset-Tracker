import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Spinner } from './UI'

// Default field suggestions per category
const SUGGESTIONS = {
  'IT Equipment': ['IP Address', 'MAC Address', 'OS Version', 'RAM', 'Storage', 'Processor', 'Last Imaged', 'MDM Enrolled'],
  'Tools & Equipment': ['Blade Size', 'Voltage', 'Fuel Type', 'Max Load', 'Calibration Date', 'Next Service', 'Certification Required'],
}

export default function CustomFields({ assetId, category, readOnly }) {
  const { isAdmin } = useAuth()
  const [saveError, setSaveError] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')

  useEffect(() => { fetchFields() }, [assetId])

  async function fetchFields() {
    setLoading(true)
    const { data } = await supabase.from('asset_custom_fields').select('*').eq('asset_id', assetId).order('field_key')
    setFields(data || [])
    setLoading(false)
  }

  async function addField() {
    if (!newKey.trim() || !newVal.trim()) return
    await supabase.from('asset_custom_fields').insert({ asset_id: assetId, field_key: newKey.trim(), field_value: newVal.trim() })
    setNewKey(''); setNewVal(''); setAdding(false)
    fetchFields()
  }

  async function updateField(id) {
    await supabase.from('asset_custom_fields').update({ field_value: editVal }).eq('id', id)
    setEditId(null)
    fetchFields()
  }

  async function deleteField(id) {
    await supabase.from('asset_custom_fields').delete().eq('id', id)
    fetchFields()
  }

  const suggestions = SUGGESTIONS[category] || []
  const existingKeys = fields.map(f => f.field_key)
  const availableSuggestions = suggestions.filter(s => !existingKeys.includes(s))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Custom fields ({fields.length})</div>
        {isAdmin && !readOnly && !adding && (
          <Btn size="sm" onClick={() => setAdding(true)}>+ Add field</Btn>
        )}
      </div>

      {loading ? <Spinner size={16} /> : (
        <>
          {fields.length === 0 && !adding && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>No custom fields yet.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 120, fontWeight: 500 }}>{f.field_key}</span>
                {editId === f.id ? (
                  <input value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && updateField(f.id)} style={{ flex: 1, padding: '3px 8px' }} autoFocus />
                ) : (
                  <span style={{ fontSize: 13, flex: 1 }}>{f.field_value}</span>
                )}
                {isAdmin && !readOnly && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {editId === f.id ? (
                      <>
                        <Btn size="sm" variant="primary" onClick={() => updateField(f.id)}>Save</Btn>
                        <Btn size="sm" onClick={() => setEditId(null)}>Cancel</Btn>
                      </>
                    ) : (
                      <>
                        <Btn size="sm" onClick={() => { setEditId(f.id); setEditVal(f.field_value) }}>Edit</Btn>
                        <Btn size="sm" variant="danger" onClick={() => deleteField(f.id)}>×</Btn>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {adding && isAdmin && (
            <div style={{ marginTop: 8, padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--border2)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Field name" list="field-suggestions" />
                  <datalist id="field-suggestions">
                    {availableSuggestions.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div style={{ flex: 1 }}>
                  <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="Value" onKeyDown={e => e.key === 'Enter' && addField()} />
                </div>
              </div>
              {availableSuggestions.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Suggestions:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {availableSuggestions.map(s => (
                      <button key={s} onClick={() => setNewKey(s)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)' }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn size="sm" variant="primary" onClick={addField} disabled={!newKey.trim() || !newVal.trim()}>Add field</Btn>
                <Btn size="sm" onClick={() => { setAdding(false); setNewKey(''); setNewVal('') }}>Cancel</Btn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
