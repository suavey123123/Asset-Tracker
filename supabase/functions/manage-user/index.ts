import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: callerProfile } = await supabaseClient.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') return new Response('Forbidden — admins only', { status: 403, headers: corsHeaders })

    // Use service role for the actual operation
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { action, userId } = await req.json()

    if (action === 'disable') {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: '876600h' }) // 100 years
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      await adminClient.from('profiles').update({ blocked: true }).eq('id', userId)
      return new Response(JSON.stringify({ success: true, action: 'disabled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'enable') {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: 'none' })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      await adminClient.from('profiles').update({ blocked: false }).eq('id', userId)
      return new Response(JSON.stringify({ success: true, action: 'enabled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      await adminClient.from('profiles').delete().eq('id', userId)
      return new Response(JSON.stringify({ success: true, action: 'deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response('Unknown action', { status: 400, headers: corsHeaders })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
