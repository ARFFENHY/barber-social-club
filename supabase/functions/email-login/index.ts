// Email-only login: ensures user exists and password matches derived value, then returns ok.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function derivePassword(email: string): Promise<string> {
  const enc = new TextEncoder().encode(`bsc::${email.toLowerCase().trim()}::v1`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, full_name, phone } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return new Response(JSON.stringify({ error: "Email requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const password = await derivePassword(cleanEmail);

    // Find existing user by email (paginate)
    let existing: any = null;
    for (let page = 1; page <= 20 && !existing; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      existing = data.users.find((u: any) => (u.email || "").toLowerCase() === cleanEmail) || null;
      if (data.users.length < 200) break;
    }

    if (existing) {
      // Ensure password matches derived value and email is confirmed.
      await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
    } else {
      const { error } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || cleanEmail.split("@")[0],
          phone: phone || "",
        },
      });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
