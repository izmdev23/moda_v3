import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "npm:stripe@^14.0.0";

Deno.serve(async (req) => {
    try {
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

        if (!stripeSecretKey || !webhookSecret) {
            return new Response("Missing configuration", { status: 500 });
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2023-10-16",
            httpClient: Stripe.createFetchHttpClient(),
        });

        const signature = req.headers.get("stripe-signature");
        if (!signature) {
            return new Response("Missing signature", { status: 400 });
        }

        const body = await req.text(); // We need raw body for signature verification

        let event;
        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err: any) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }

        console.log("Stripe Webhook Event:", event.type);

        if (event.type !== "payment_intent.succeeded" && event.type !== "payment_intent.payment_failed") {
            return new Response("OK", { status: 200 });
        }

        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase configuration");
        }

        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch transaction
        const { data: transaction, error: txnError } = await supabaseClient
            .from("transaction_history")
            .select("*, orders(*), order_items(*)")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .single();

        if (txnError || !transaction) {
            console.error("Transaction not found for PI:", paymentIntentId);
            return new Response("Not Found but OK", { status: 200 });
        }

        if (event.type === "payment_intent.succeeded") {
            await supabaseClient
                .from("transaction_history")
                .update({ status: "success" })
                .eq("id", transaction.id);

            await supabaseClient
                .from("orders")
                .update({ status: "confirmed" })
                .eq("id", transaction.order_id);
        } else if (event.type === "payment_intent.payment_failed") {
            await supabaseClient
                .from("transaction_history")
                .update({ status: "failed" })
                .eq("id", transaction.id);

            await supabaseClient
                .from("orders")
                .update({ status: "cancelled" })
                .eq("id", transaction.order_id);
        }

        return new Response("OK", { status: 200 });
    } catch (error: any) {
        console.error("Webhook Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
});
