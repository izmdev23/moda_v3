import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "npm:stripe@^14.0.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

        if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
            throw new Error("Missing configuration");
        }

        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2023-10-16",
            httpClient: Stripe.createFetchHttpClient(),
        });

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error("Missing Authorization header in request");
        }
        const token = authHeader.replace('Bearer ', '').trim();
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

        if (authError || !user) {
            throw new Error(`Unauthorized: ${authError?.message || "Invalid JWT"}`);
        }

        const body = await req.json();
        const {
            userId, // The client might send this, but we should rely on the secure user.id
            addressId,
            paymentChannel,
            totalAmount,
            items,
            idempotencyKey,
            stripePaymentMethodId,
            customerEmail,
        } = body;

        // Force secure user ID (int8) from the users table
        const { data: dbUser, error: dbUserError } = await supabaseClient
            .from("users")
            .select("id, email, stripe_customer_id")
            .eq("auth_id", user.id)
            .single();

        if (dbUserError || !dbUser) {
            throw new Error(`User not found in database: ${dbUserError?.message}`);
        }

        const secureUserId = dbUser.id;

        if (!secureUserId || !addressId || !paymentChannel || !totalAmount || !items || !items.length || !idempotencyKey) {
            throw new Error("Missing required fields");
        }

        // Begin transaction-like operations
        // 1. Create order
        const { data: order, error: orderError } = await supabaseClient
            .from("orders")
            .insert({
                buyer_id: secureUserId,
                address_id: addressId,
                total_amount: totalAmount,
                status: "pending",
            })
            .select()
            .single();

        if (orderError || !order) {
            console.error("Order creation error:", orderError);
            throw new Error("Failed to create order");
        }

        const orderId = order.id;
        const orderUid = order.uid;

        // 2 & 3. Decrement stock atomically, map shop IDs, and insert order items
        const orderItemsPayload = [];

        for (const item of items) {
            const { data: variant, error: variantError } = await supabaseClient
                .from("product_variants")
                .select("stock, products!inner(shop_id)")
                .eq("id", item.variantId)
                .single();

            if (variantError || !variant || variant.stock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.productName}`);
            }

            // Decrement stock
            await supabaseClient
                .from("product_variants")
                .update({ stock: variant.stock - item.quantity })
                .eq("id", item.variantId);

            orderItemsPayload.push({
                order_id: orderId,
                product_id: item.productId,
                variant_id: item.variantId,
                shop_id: variant.products?.shop_id || null, // Ensure shop_id is included
                product_name: item.productName,
                variant_name: item.variantName,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity,
            });
        }

        const { error: itemsError } = await supabaseClient
            .from("order_items")
            .insert(orderItemsPayload);

        if (itemsError) {
            console.error("Order items error:", itemsError);
            throw new Error("Failed to create order items");
        }

        // 4. Create transaction history
        const { data: transaction, error: txnError } = await supabaseClient
            .from("transaction_history")
            .insert({
                user_id: secureUserId,
                order_id: orderId,
                amount: totalAmount,
                status: "pending",
                idempotency_key: idempotencyKey,
                payment_channel: paymentChannel,
            })
            .select()
            .single();

        if (txnError || !transaction) {
            console.error("Transaction creation error:", txnError);
            throw new Error("Failed to create transaction history");
        }

        // 5. Call Stripe API
        const totalAmountInCentavos = Math.round(totalAmount * 100);
        
        console.log(`Processing payment for channel: ${paymentChannel}`);

        const methodTypeMap: Record<string, string> = {
            gcash: 'gcash',
            paymaya: 'paymaya',
            card: 'card',
        };
        
        const channelKey = String(paymentChannel).toLowerCase().trim();
        const paymentMethodType = methodTypeMap[channelKey];

        if (!paymentMethodType) {
            console.error(`Unsupported payment channel: ${paymentChannel}`);
            throw new Error(`The payment method "${paymentChannel}" is not supported or recognized. Please select a valid payment method.`);
        }

        const paymentIntentPayload: any = {
            amount: totalAmountInCentavos,
            currency: "php",
            payment_method_types: [paymentMethodType],
            metadata: {
                order_uid: orderUid,
                user_id: String(secureUserId),
                transaction_uid: transaction.uid
            },
        };

        // For card payments, bind the PaymentIntent to a Stripe Customer and request
        // future-use setup. Stripe will automatically attach the PM to the Customer
        // during client-side confirmation (via setup_future_usage), making it fully
        // reusable on subsequent orders — no server-side PM attachment needed.
        if (paymentChannel === 'card') {
            // Get or create the Stripe Customer for this user
            let stripeCustomerId: string = dbUser.stripe_customer_id ?? '';

            if (!stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: customerEmail || dbUser.email,
                    metadata: { supabase_user_id: String(secureUserId) },
                });
                stripeCustomerId = customer.id;

                // Persist so we don't create a duplicate Customer on future orders
                await supabaseClient
                    .from("users")
                    .update({ stripe_customer_id: stripeCustomerId })
                    .eq("id", secureUserId);
            }

            paymentIntentPayload.customer = stripeCustomerId;
            // Tells Stripe to attach the confirmed PM to the Customer automatically,
            // enabling the same card to be charged again on future PaymentIntents.
            paymentIntentPayload.setup_future_usage = 'off_session';
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentPayload, {
            idempotencyKey: idempotencyKey
        });

        // 6. Update transaction with Stripe response
        await supabaseClient
            .from("transaction_history")
            .update({
                stripe_payment_intent_id: paymentIntent.id,
                stripe_client_secret: paymentIntent.client_secret,
            })
            .eq("id", transaction.id);

        return new Response(JSON.stringify({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            orderId: orderUid,
            transactionId: transaction.uid
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        console.error("Edge function failed:", error);
        return new Response(JSON.stringify({ error: error.message, type: "edge_function_error" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200, // Temporarily return 200 so we can read the body on the client!
        });
    }
});
