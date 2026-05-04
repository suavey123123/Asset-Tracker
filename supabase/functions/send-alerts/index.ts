import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'alerts@nhncorp-assets.vercel.app'
const ALERT_EMAIL = Deno.env.get('ALERT_EMAIL') // admin email to notify

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date()
  const in30 = new Date(); in30.setDate(today.getDate() + 30)

  // Fetch alerts
  const [{ data: overdue }, { data: warranties }, { data: licenses }] = await Promise.all([
    supabase.from('assets').select('name, asset_tag, assigned_to, expected_return')
      .eq('status', 'Checked Out').lt('expected_return', today.toISOString().slice(0, 10)).not('expected_return', 'is', null),
    supabase.from('assets').select('name, asset_tag, warranty_expiry')
      .lte('warranty_expiry', in30.toISOString().slice(0, 10)).gte('warranty_expiry', today.toISOString().slice(0, 10)),
    supabase.from('licenses').select('name, expiry_date')
      .lte('expiry_date', in30.toISOString().slice(0, 10)).gte('expiry_date', today.toISOString().slice(0, 10)),
  ])

  const hasAlerts = (overdue?.length || 0) + (warranties?.length || 0) + (licenses?.length || 0) > 0
  if (!hasAlerts) return new Response('No alerts', { status: 200 })

  // Build email HTML
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0f0f0f;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:#d4ff4e;margin:0;font-size:18px">Asset Tracker Alerts</h1>
        <p style="color:#999;margin:4px 0 0;font-size:12px">${today.toLocaleDateString()}</p>
      </div>
      <div style="background:#161616;padding:20px;border-radius:0 0 8px 8px;border:1px solid #2a2a2a">
        ${overdue?.length ? `
        <h2 style="color:#ff5a5a;font-size:14px;margin:0 0 12px">⚠ Overdue Check-outs (${overdue.length})</h2>
        ${overdue.map(a => `
          <div style="background:#1e1e1e;padding:10px 14px;border-radius:6px;margin-bottom:8px;border-left:3px solid #ff5a5a">
            <strong style="color:#e8e8e8">${a.name || a.asset_tag}</strong>
            <span style="color:#999;font-size:12px"> · ${a.asset_tag}</span>
            <div style="color:#999;font-size:12px;margin-top:4px">Assigned to ${a.assigned_to} · Due ${new Date(a.expected_return).toLocaleDateString()}</div>
          </div>
        `).join('')}` : ''}

        ${warranties?.length ? `
        <h2 style="color:#ffb84a;font-size:14px;margin:16px 0 12px">⏱ Expiring Warranties (${warranties.length})</h2>
        ${warranties.map(a => `
          <div style="background:#1e1e1e;padding:10px 14px;border-radius:6px;margin-bottom:8px;border-left:3px solid #ffb84a">
            <strong style="color:#e8e8e8">${a.name || a.asset_tag}</strong>
            <span style="color:#999;font-size:12px"> · ${a.asset_tag}</span>
            <div style="color:#999;font-size:12px;margin-top:4px">Expires ${new Date(a.warranty_expiry).toLocaleDateString()}</div>
          </div>
        `).join('')}` : ''}

        ${licenses?.length ? `
        <h2 style="color:#a78bfa;font-size:14px;margin:16px 0 12px">📋 Expiring Licenses (${licenses.length})</h2>
        ${licenses.map(l => `
          <div style="background:#1e1e1e;padding:10px 14px;border-radius:6px;margin-bottom:8px;border-left:3px solid #a78bfa">
            <strong style="color:#e8e8e8">${l.name}</strong>
            <div style="color:#999;font-size:12px;margin-top:4px">Expires ${new Date(l.expiry_date).toLocaleDateString()}</div>
          </div>
        `).join('')}` : ''}

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #2a2a2a;text-align:center">
          <a href="${Deno.env.get('APP_URL') || 'https://nhncorp-assets.vercel.app'}" style="background:#d4ff4e;color:#0f0f0f;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px">Open Asset Tracker</a>
        </div>
      </div>
    </div>
  `

  // Send via Resend
  if (RESEND_API_KEY && ALERT_EMAIL) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ALERT_EMAIL],
        subject: `Asset Tracker: ${(overdue?.length||0) + (warranties?.length||0) + (licenses?.length||0)} alerts need attention`,
        html,
      }),
    })
  }

  return new Response(JSON.stringify({ sent: true, alerts: { overdue: overdue?.length, warranties: warranties?.length, licenses: licenses?.length } }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
