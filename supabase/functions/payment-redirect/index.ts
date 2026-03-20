import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  const url = new URL(req.url);
  const paymentIntentId = url.searchParams.get("payment_intent");

  if (!paymentIntentId) {
    return new Response("Missing payment_intent", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const supabaseClient = createClient(supabaseUrl!, supabaseServiceKey!);

  const { data: txn } = await supabaseClient
    .from("transaction_history")
    .select("uid, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .single();

  const status = txn?.status === "success" ? "success" : "pending";
  const appRedirectUrl = `moda://home/order-confirmation?status=${status}&transactionId=${txn?.uid}`;

  return new Response(null, {
    status: 302,
    headers: {
      "Location": appRedirectUrl,
    },
  });
});
