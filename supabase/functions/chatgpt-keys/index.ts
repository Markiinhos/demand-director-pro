import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vanilla hex encoder
function bufferToHex(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Não autenticado, JWT inválido.");

    const { method } = req;
    
    if (method === "POST") {
       let body = {};
       try { body = await req.json(); } catch(e) {}
       
       const name = (body as { name?: string }).name || `GPT Actions ${new Date().toLocaleDateString("pt-BR")}`;
       
       // Generate key: 32 random bytes
       const rawBytes = new Uint8Array(32);
       crypto.getRandomValues(rawBytes);
       const randomHex = bufferToHex(rawBytes);
       
       const rawKey = `sk-saas-${randomHex}`;
       const keyPrefix = rawKey.substring(0, 15);
       
       // Calculate SHA-256
       const encoder = new TextEncoder();
       const data = encoder.encode(rawKey);
       const hashBuffer = await crypto.subtle.digest('SHA-256', data);
       const keyHash = bufferToHex(hashBuffer);
       
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
