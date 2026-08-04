import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Não autenticado");

    const { method } = req;
    
    if (method === "POST") {
       // Generation
       let body = {};
       try { body = await req.json(); } catch(e) {}
       
       const name = (body as { name?: string }).name || `GPT Actions ${new Date().toLocaleDateString("pt-BR")}`;
       
       // Generate key: 32 random bytes
       const rawBytes = new Uint8Array(32);
       crypto.getRandomValues(rawBytes);
       const randomHex = encodeHex(rawBytes);
       
       const rawKey = `sk-saas-${randomHex}`; // This represents the plain string we show once to the user
       const keyPrefix = rawKey.substring(0, 15);
       
       // Calculate SHA-256
       const encoder = new TextEncoder();
       const data = encoder.encode(rawKey);
       const hashBuffer = await crypto.subtle.digest('SHA-256', data);
       const keyHash = encodeHex(new Uint8Array(hashBuffer));
       
       const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
       const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

       const { data: inserted, error: insertError } = await serviceClient.from("chatgpt_integrations").insert({
          user_id: user.id,
          name: name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          is_active: true
       }).select().single();

       if (insertError) throw insertError;

       // Verify hash internally
       const hashBufferRe = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
       const keyHashRe = encodeHex(new Uint8Array(hashBufferRe));
       if (keyHash !== keyHashRe) {
         throw new Error("Erro na integridade do hash gerado");
       }

       return new Response(JSON.stringify({ 
          success: true, 
          raw_key: rawKey, 
          integration: inserted 
       }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
       return new Response(JSON.stringify({ error: "Use POST to generate" }), { status: 405, headers: corsHeaders });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
