import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // Verify caller is admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: callerProfile } = await supabaseClient.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') return new Response('Forbidden', { status: 403, headers: corsHeaders })

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { action, userId, password } = await req.json()

    if (action === 'disable') {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: '876600h' })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      await adminClient.from('profiles').update({ blocked: true }).eq('id', userId)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'enable') {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: 'none' })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      await adminClient.from('profiles').update({ blocked: false }).eq('id', userId)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      await adminClient.from('profiles').delete().eq('id', userId)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'set_password') {
      if (!password || password.length < 6) return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'send_reset') {
      // Use admin to generate a magic link instead of relying on email
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: userId, // passing email here
        options: { redirectTo: Deno.env.get('APP_URL') || 'https://nhncorp-assets.vercel.app' }
      })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ success: true, link: data.properties?.action_link }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response('Unknown action', { status: 400, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
