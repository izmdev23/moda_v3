// ─── Constants ────────────────────────────────────────────────────────────────

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const GEMINI_REPLICATE_MODEL = "google/gemini-2.5-flash";

/** Maximum time (ms) to wait for the Replicate prediction to complete. */
const DESCRIBE_TIMEOUT_MS = 30_000;

/** Polling interval (ms) between prediction status checks. */
const POLL_INTERVAL_MS = 2_000;

const DESCRIPTION_PROMPT =
    "You are a professional fashion copywriter. Generate a compelling, concise product description for the clothing item shown in the image. " +
    "Include: fabric feel/material (infer if visible), style/silhouette, key design details, and best occasions to wear it. " +
    "Keep the description between 80–150 words. Write in third person. Do not include pricing.";

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DescribeRequestBody {
    /** Publicly accessible URL of the product image to describe. Provide this OR imageBase64. */
    readonly imageUrl?: string;
    /** Base64-encoded image data. Required when imageUrl is not provided. */
    readonly imageBase64?: string;
    /** MIME type of the image when using imageBase64 (e.g. "image/jpeg"). */
    readonly mimeType?: string;
}

interface ReplicatePrediction {
    readonly id: string;
    readonly status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
    readonly output?: string | string[] | null;
    readonly error?: string | null;
}

// ─── Helper: json response ────────────────────────────────────────────────────

function jsonResponse(body: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(body), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        status,
    });
}

// ─── Helper: extract text from Replicate output ───────────────────────────────

function extractText(output: string | string[] | null | undefined): string {
    if (!output) return "";
    if (Array.isArray(output)) return output.join("").trim();
    return output.trim();
}

// ─── Helper: poll Replicate until done or timeout ────────────────────────────

async function pollPrediction(predictionId: string, replicateKey: string): Promise<string> {
    const start = Date.now();

    while (Date.now() - start < DESCRIBE_TIMEOUT_MS) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        const pollRes = await fetch(`${REPLICATE_API_BASE}/predictions/${predictionId}`, {
            headers: { Authorization: `Token ${replicateKey}` },
        });

        if (!pollRes.ok) {
            throw new Error(`Replicate polling error: ${pollRes.status}`);
        }

        const prediction: ReplicatePrediction = await pollRes.json() as ReplicatePrediction;

        if (prediction.status === "succeeded") {
            const text = extractText(prediction.output);
            if (!text) throw new Error("Replicate returned empty output");
            return text;
        }

        if (prediction.status === "failed" || prediction.status === "canceled") {
            throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error ?? "unknown error"}`);
        }
        // Still "starting" or "processing" — keep polling
    }

    throw new Error(`describe-image timed out after ${DESCRIBE_TIMEOUT_MS / 1000}s`);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * Edge Function: describe-image
 *
 * Accepts a product image (URL or base64) and calls google/gemini-2.5-flash
 * via Replicate to generate a product description for the seller upload page.
 *
 * WARNING: REPLICATE_API_KEY is read exclusively from Supabase secrets (server-side only).
 * Never expose this key to the client.
 *
 * @example Correct usage — call via supabase.functions.invoke('describe-image', { body: { imageUrl } })
 * @example Incorrect usage — do NOT call with REPLICATE_API_KEY from the client
 */
Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    try {
        // ── Environment ─────────────────────────────────────────────────────

        const replicateKey = Deno.env.get("REPLICATE_API_KEY");
        if (!replicateKey) {
            throw new Error("Server configuration error: REPLICATE_API_KEY not set");
        }

        // ── Auth (allow sellers to call this) ───────────────────────────────

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return jsonResponse({ error: "Missing Authorization header" }, 401);
        }

        // ── Parse request ───────────────────────────────────────────────────

        const body: DescribeRequestBody = await req.json() as DescribeRequestBody;
        const { imageUrl, imageBase64, mimeType: bodyMimeType } = body;

        if (!imageUrl && !imageBase64) {
            return jsonResponse({ error: "imageUrl or imageBase64 is required" }, 400);
        }

        // ── Resolve image input for Replicate ───────────────────────────────
        // Replicate accepts a public URL or a data URI for inline images.

        let imageInput: string;

        if (imageBase64) {
            const mime = bodyMimeType ?? "image/jpeg";
            imageInput = `data:${mime};base64,${imageBase64}`;
        } else {
            imageInput = imageUrl as string;
        }

        // ── Submit prediction to Replicate ──────────────────────────────────

        const predictionRes = await fetch(`${REPLICATE_API_BASE}/models/${GEMINI_REPLICATE_MODEL}/predictions`, {
            method: "POST",
            headers: {
                Authorization: `Token ${replicateKey}`,
                "Content-Type": "application/json",
                Prefer: "wait",
            },
            body: JSON.stringify({
                input: {
                    prompt: DESCRIPTION_PROMPT,
                    image: imageInput,
                },
            }),
        });

        if (!predictionRes.ok) {
            const errText = await predictionRes.text();
            throw new Error(`Replicate API error ${predictionRes.status}: ${errText}`);
        }

        const prediction: ReplicatePrediction = await predictionRes.json() as ReplicatePrediction;

        // ── Resolve output (immediate or polled) ────────────────────────────

        let description: string;

        if (prediction.status === "succeeded") {
            description = extractText(prediction.output);
        } else {
            description = await pollPrediction(prediction.id, replicateKey);
        }

        if (!description) {
            throw new Error("Replicate returned an empty description");
        }

        return jsonResponse({ description });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("[describe-image]", message);
        return jsonResponse({ error: message }, 500);
    }
});
