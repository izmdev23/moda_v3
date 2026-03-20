const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");
        
        if (!publishableKey) {
            throw new Error("Stripe publishable key is not configured in the vault.");
        }

        return new Response(JSON.stringify({ publishableKey }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400, // Client catches non-2xx
        });
    }
});
