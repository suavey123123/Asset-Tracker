import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Btn, Modal, FormField } from './UI'

// Supported systems
const SYSTEMS = [
  { id: 'jira', label: 'Jira', placeholder: 'PROJ-123', urlPattern: (base, ticket) => `${base}/browse/${ticket}` },
  { id: 'servicenow', label: 'ServiceNow', placeholder: 'INC0012345', urlPattern: (base, ticket) => `${base}/nav_to.do?uri=incident.do?number=${ticket}` },
  { id: 'zendesk', label: 'Zendesk', placeholder: '12345', urlPattern: (base, ticket) => `${base}/agent/tickets/${ticket}` },
  { id: 'freshdesk', label: 'Freshdesk', placeholder: '12345', urlPattern: (base, ticket) => `${base}/a/tickets/${ticket}` },
  { id: 'other', label: 'Other', placeholder: 'Ticket #', urlPattern: (base, ticket) => ticket },
]

export default function HelpdeskIntegration({ assetId, assetTag, onDone }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [system, setSystem] = useState('jira')
  const [ticketNum, setTicketNum] = useState('')
  const [ticketTitle, setTicketTitle] = useState('')
  const [maintenanceType, setMaintenanceType] = useState('Repair')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [helpdeskBase, setHelpdeskBase] = useState(() => localStorage.getItem('helpdesk_base_url') || '')

  const sys = SYSTEMS.find(s => s.id === system)

  async function createRecord() {
    if (!ticketNum.trim()) return
    setSaving(true)

    const ticketUrl = sys?.urlPattern(helpdeskBase, ticketNum.trim())
    const message = `${ticketTitle ? ticketTitle + ' — ' : ''}Ticket: ${ticketNum.trim()}${helpdeskBase ? ` (${sys?.label})` : ''}`

    await supabase.from('maintenance_records').insert({
      asset_id: assetId,
      asset_tag: assetTag,
      maintenance_type: maintenanceType,
      notes: notes + (ticketUrl ? `\n\nTicket: ${ticketUrl}` : `\nTicket: ${ticketNum}`),
      performed_by: profile?.email,
      performed_date: new Date().toISOString().slice(0, 10),
      ticket_number: ticketNum.trim(),
      ticket_url: ticketUrl || null,
      ticket_system: system,
    })

    await supabase.from('activity_log').insert({
      asset_id: assetId,
      asset_tag: assetTag,
      asset_name: assetTag,
      type: 'maintenance',
      message: `Maintenance record created from ${sys?.label} ticket ${ticketNum}`,
      performed_by: profile?.email,
    })

    setSaving(false)
    setOpen(false)
    setTicketNum(''); setTicketTitle(''); setNotes('')
    onDone?.()
  }

  return (
    <>
      <Btn size="sm" onClick={() => setOpen(true)}>🎫 Link ticket</Btn>

      <Modal open={open} onClose={() => setOpen(false)} title="Create maintenance from ticket" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* System selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SYSTEMS.map(s => (
              <button key={s.id} onClick={() => setSystem(s.id)}
                style={{ padding: '5px 12px', fontSize: 12, borderRadius: 'var(--radius)', border: '1px solid', borderColor: system === s.id ? 'var(--accent)' : 'var(--border2)', background: system === s.id ? 'var(--accent-bg)' : 'var(--bg3)', color: system === s.id ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: system === s.id ? 600 : 400 }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Base URL (saved per browser) */}
          <FormField label={`${sys?.label} base URL (saved for future use)`}>
            <input value={helpdeskBase} onChange={e => { setHelpdeskBase(e.target.value); localStorage.setItem('helpdesk_base_url', e.target.value) }}
              placeholder={system === 'jira' ? 'https://yourcompany.atlassian.net' : system === 'servicenow' ? 'https://yourcompany.service-now.com' : 'https://...'} />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <FormField label="Ticket number" required>
              <input value={ticketNum} onChange={e => setTicketNum(e.target.value)}
                placeholder={sys?.placeholder} style={{ fontFamily: 'var(--mono)' }} />
            </FormField>
            <FormField label="Ticket title (optional)">
              <input value={ticketTitle} onChange={e => setTicketTitle(e.target.value)} placeholder="Brief description" />
            </FormField>
          </div>

          <FormField label="Maintenance type">
            <select value={maintenanceType} onChange={e => setMaintenanceType(e.target.value)}>
              {['Repair', 'Replacement', 'Inspection', 'Software Issue', 'Hardware Issue', 'User Request', 'Preventive'].map(t => <option key={t}>{t}</option>)}
            </select>
          </FormField>

          <FormField label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes…" style={{ minHeight: 70 }} />
          </FormField>

          {ticketNum && helpdeskBase && (
            <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>
              🔗 Will link to: <a href={sys?.urlPattern(helpdeskBase, ticketNum)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{sys?.urlPattern(helpdeskBase, ticketNum)}</a>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={createRecord} disabled={saving || !ticketNum.trim()}>
              {saving ? 'Creating…' : 'Create maintenance record'}
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
