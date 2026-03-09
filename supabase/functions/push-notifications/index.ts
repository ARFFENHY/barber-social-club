import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey);
}

async function getOrCreateVapidKeys(admin: ReturnType<typeof createClient>) {
  // Check if keys exist in shop_settings
  const { data: pubRow } = await admin
    .from("shop_settings")
    .select("value")
    .eq("key", "vapid_public_key")
    .maybeSingle();

  const { data: privRow } = await admin
    .from("shop_settings")
    .select("value")
    .eq("key", "vapid_private_key")
    .maybeSingle();

  if (pubRow?.value && privRow?.value) {
    return {
      publicKey: pubRow.value as string,
      privateKey: privRow.value as string,
    };
  }

  // Generate new VAPID keys
  const keys = webpush.generateVAPIDKeys();

  // Store them
  await admin.from("shop_settings").upsert(
    { key: "vapid_public_key", value: keys.publicKey },
    { onConflict: "key" }
  );
  await admin.from("shop_settings").upsert(
    { key: "vapid_private_key", value: keys.privateKey },
    { onConflict: "key" }
  );

  return keys;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = getAdminClient();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET VAPID PUBLIC KEY
    if (action === "vapid-key") {
      const keys = await getOrCreateVapidKeys(admin);
      return new Response(JSON.stringify({ publicKey: keys.publicKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SUBSCRIBE
    if (action === "subscribe") {
      const { subscription, userId } = await req.json();
      if (!subscription || !userId) {
        return new Response(JSON.stringify({ error: "Missing data" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UNSUBSCRIBE
    if (action === "unsubscribe") {
      const { endpoint, userId } = await req.json();
      await admin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEND PUSH TO ALL ADMIN SUBSCRIBERS
    if (action === "send") {
      const { title, body } = await req.json();
      const keys = await getOrCreateVapidKeys(admin);

      webpush.setVapidDetails(
        "mailto:admin@barbershop.com",
        keys.publicKey,
        keys.privateKey
      );

      // Get admin user IDs
      const { data: adminIds } = await admin.rpc("get_admin_user_ids");
      if (!adminIds || adminIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get push subscriptions for admins
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("*")
        .in("user_id", adminIds);

      if (!subs || subs.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.stringify({ title, body });
      let sent = 0;
      const failures: string[] = [];

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sent++;
        } catch (err: any) {
          // If subscription expired, remove it
          if (err.statusCode === 410 || err.statusCode === 404) {
            await admin
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }
          failures.push(err.message || "unknown");
        }
      }

      return new Response(
        JSON.stringify({ sent, total: subs.length, failures }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
