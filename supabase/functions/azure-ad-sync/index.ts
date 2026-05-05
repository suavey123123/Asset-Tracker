import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAzureToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get Azure token: ' + JSON.stringify(data))
  return data.access_token
}

async function getAzureUsers(token: string): Promise<any[]> {
  const users: any[] = []
  let url = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,jobTitle,department,mobilePhone,accountEnabled&$top=100'
  
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (data.value) users.push(...data.value)
    url = data['@odata.nextLink'] || null
  }
  return users
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const azureTenantId = Deno.env.get('AZURE_TENANT_ID')
    const azureClientId = Deno.env.get('AZURE_CLIENT_ID')
    const azureClientSecret = Deno.env.get('AZURE_CLIENT_SECRET')
    const appTenantId = Deno.env.get('APP_TENANT_ID') // your Supabase tenant UUID

    if (!azureTenantId || !azureClientId || !azureClientSecret) {
      return new Response(JSON.stringify({ error: 'Azure credentials not configured in secrets' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get Azure users
    const token = await getAzureToken(azureTenantId, azureClientId, azureClientSecret)
    const azureUsers = await getAzureUsers(token)

    let created = 0, updated = 0, offboarded = 0

    for (const azUser of azureUsers) {
      if (!azUser.mail) continue

      const empData = {
        name: azUser.displayName,
        email: azUser.mail,
        title: azUser.jobTitle || null,
        department: azUser.department || null,
        phone: azUser.mobilePhone || null,
        tenant_id: appTenantId,
        azure_id: azUser.id,
      }

      // Check if employee exists
      const { data: existing } = await adminClient
        .from('employees')
        .select('id, name')
        .eq('email', azUser.mail)
        .maybeSingle()

      if (existing) {
        if (!azUser.accountEnabled) {
          // Offboard - check in all assets
          const { data: empAssets } = await adminClient
            .from('assets')
            .select('id, asset_tag')
            .eq('assigned_to', existing.name)

          if (empAssets?.length) {
            await adminClient.from('assets')
              .update({ status: 'Available', assigned_to: null, assigned_to_team: null })
              .in('id', empAssets.map((a: any) => a.id))

            for (const asset of empAssets) {
              await adminClient.from('activity_log').insert({
                asset_id: asset.id,
                asset_tag: asset.asset_tag,
                asset_name: asset.asset_tag,
                type: 'checkin',
                message: `Auto-returned via Azure AD offboarding — ${existing.name} disabled`,
                tenant_id: appTenantId,
              })
            }
            offboarded++
          }
        } else {
          // Update existing
          await adminClient.from('employees').update(empData).eq('id', existing.id)
          updated++
        }
      } else if (azUser.accountEnabled) {
        // Create new employee
        await adminClient.from('employees').insert(empData)
        created++
      }
    }

    return new Response(JSON.stringify({ success: true, created, updated, offboarded, total: azureUsers.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
