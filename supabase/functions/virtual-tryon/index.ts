import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ─── Constants ────────────────────────────────────────────────────────────────

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const IDMVTON_VERSION = "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

/** Maximum number of virtual try-ons per day per user. */
const DAILY_LIMIT = 5;

/** Maximum number of virtual try-ons per calendar month per user. */
const MONTHLY_LIMIT = 50;

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface StartBody {
    readonly action: "start";
    readonly garmentImageUrl: string;
    readonly humanImageUrl: string;
    readonly garmentDescription?: string;
    readonly productId: number;
}

interface CheckBody {
    readonly action: "check";
    readonly predictionId: string;
    readonly uid: string;
}

type RequestBody = StartBody | CheckBody;

interface ReplicatePrediction {
    readonly id: string;
    readonly status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
    readonly output?: unknown;
    readonly error?: string | null;
}

type StorageImageContentType = "image/jpeg" | "image/png" | "image/webp";

interface ResolvedImageFormat {
    readonly contentType: StorageImageContentType;
    readonly extension: "jpg" | "png" | "webp";
}

type ReplicateGarmentCategory = "upper_body" | "lower_body" | "dresses";

function mapProductCategoryToReplicateCategory(category: string): ReplicateGarmentCategory | null {
    if (category === "tops") return "upper_body";
    if (category === "bottoms") return "lower_body";
    if (category === "full_body") return "dresses";
    return null;
}

// ─── Helper: json response ────────────────────────────────────────────────────

function jsonResponse(body: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(body), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        status,
    });
}

function normalizeContentType(header: string | null): StorageImageContentType | null {
    if (header === null) return null;

    const baseType = header.split(";")[0]?.trim().toLowerCase() ?? "";

    if (baseType === "image/jpeg" || baseType === "image/jpg" || baseType === "image/pjpeg") {
        return "image/jpeg";
    }
    if (baseType === "image/png" || baseType === "image/x-png") {
        return "image/png";
    }
    if (baseType === "image/webp") {
        return "image/webp";
    }

    return null;
}

function detectContentTypeFromBytes(bytes: Uint8Array): StorageImageContentType | null {
    // JPEG magic bytes: FF D8 FF
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes.length >= 8
        && bytes[0] === 0x89
        && bytes[1] === 0x50
        && bytes[2] === 0x4e
        && bytes[3] === 0x47
        && bytes[4] === 0x0d
        && bytes[5] === 0x0a
        && bytes[6] === 0x1a
        && bytes[7] === 0x0a
    ) {
        return "image/png";
    }

    // WEBP starts with RIFF....WEBP
    if (
        bytes.length >= 12
        && bytes[0] === 0x52
        && bytes[1] === 0x49
        && bytes[2] === 0x46
        && bytes[3] === 0x46
        && bytes[8] === 0x57
        && bytes[9] === 0x45
        && bytes[10] === 0x42
        && bytes[11] === 0x50
    ) {
        return "image/webp";
    }

    return null;
}

function getExtensionForContentType(contentType: StorageImageContentType): "jpg" | "png" | "webp" {
    if (contentType === "image/jpeg") return "jpg";
    if (contentType === "image/webp") return "webp";
    return "png";
}

function resolveImageFormat(header: string | null, bytes: Uint8Array): ResolvedImageFormat {
    const fromHeader = normalizeContentType(header);
    const contentType = fromHeader ?? detectContentTypeFromBytes(bytes) ?? "image/png";

    return {
        contentType,
        extension: getExtensionForContentType(contentType),
    };
}

function resolveReplicateOutputUrl(output: unknown): string | null {
    if (typeof output === "string") {
        const value = output.trim();
        return value.length > 0 ? value : null;
    }

    if (Array.isArray(output)) {
        for (const item of output) {
            if (typeof item === "string" && item.trim().length > 0) {
                return item.trim();
            }
            if (typeof item === "object" && item !== null) {
                const obj = item as { url?: unknown; href?: unknown };
                if (typeof obj.url === "string" && obj.url.trim().length > 0) {
                    return obj.url.trim();
                }
                if (typeof obj.href === "string" && obj.href.trim().length > 0) {
                    return obj.href.trim();
                }
            }
        }
        return null;
    }

    if (typeof output === "object" && output !== null) {
        const obj = output as { url?: unknown; href?: unknown };
        if (typeof obj.url === "string" && obj.url.trim().length > 0) {
            return obj.url.trim();
        }
        if (typeof obj.href === "string" && obj.href.trim().length > 0) {
            return obj.href.trim();
        }
    }

    return null;
}

// ─── Helper: authenticate and resolve internal user ID ───────────────────────

async function resolveUserId(
    supabase: ReturnType<typeof createClient>,
    req: Request,
): Promise<{ userId: number } | Response> {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: dbUser, error: dbUserError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

    if (dbUserError ?? !dbUser) {
        return jsonResponse({ error: "User not found" }, 404);
    }

    return { userId: dbUser.id as number };
}

// ─── Handler: start ───────────────────────────────────────────────────────────

/**
 * Creates a Replicate prediction asynchronously (no long-polling server-side),
 * inserts a `pending` row in vton_usage, and returns the prediction ID + uid.
 * The client is responsible for polling via the `check` action.
 */
async function handleStart(
    supabase: ReturnType<typeof createClient>,
    replicateKey: string,
    userId: number,
    body: StartBody,
): Promise<Response> {
    const { garmentImageUrl, humanImageUrl, garmentDescription, productId } = body;

    if (!garmentImageUrl || !humanImageUrl || !productId) {
        return jsonResponse({ error: "garmentImageUrl, humanImageUrl, and productId are required" }, 400);
    }

    const { data: productRow, error: productError } = await supabase
        .from("products")
        .select("category")
        .eq("id", productId)
        .is("deleted_at", null)
        .single();

    if (productError || !productRow) {
        return jsonResponse({ error: "Product not found" }, 404);
    }

    const resolvedProductCategory = typeof productRow.category === "string" ? productRow.category : "";

    const replicateCategory = mapProductCategoryToReplicateCategory(resolvedProductCategory);
    if (replicateCategory === null) {
        return jsonResponse({ error: "Virtual try-on is only available for tops, bottoms, and full_body products." }, 400);
    }

    // ── Check daily + monthly limits in parallel ────────────────────────────

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [{ count: dailyCount }, { count: monthlyCount }] = await Promise.all([
        supabase
            .from("vton_usage")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", todayStart.toISOString()),
        supabase
            .from("vton_usage")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", monthStart.toISOString()),
    ]);

    if ((dailyCount ?? 0) >= DAILY_LIMIT) {
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return jsonResponse({
            error: "Daily limit reached",
            limitType: "daily",
            limit: DAILY_LIMIT,
            resetAt: tomorrow.toISOString(),
        }, 429);
    }

    if ((monthlyCount ?? 0) >= MONTHLY_LIMIT) {
        const nextMonth = new Date(monthStart);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return jsonResponse({
            error: "Monthly limit reached",
            limitType: "monthly",
            limit: MONTHLY_LIMIT,
            resetAt: nextMonth.toISOString(),
        }, 429);
    }

    // ── Submit prediction to Replicate (async, no Prefer:wait) ─────────────

    const predictionRes = await fetch(`${REPLICATE_API_BASE}/predictions`, {
        method: "POST",
        headers: {
            Authorization: `Token ${replicateKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            version: IDMVTON_VERSION,
            input: {
                garm_img: garmentImageUrl,
                human_img: humanImageUrl,
                garment_des: garmentDescription ?? "clothing item",
                // Use current IDM-VTON schema keys so options are actually applied.
                crop: true,
                steps: 20,
                category: replicateCategory,
                seed: 42,
            },
        }),
    });

    if (!predictionRes.ok) {
        const errText = await predictionRes.text();
        throw new Error(`Replicate API error ${predictionRes.status}: ${errText}`);
    }

    const prediction: ReplicatePrediction = await predictionRes.json() as ReplicatePrediction;

    // ── Insert a pending usage row ──────────────────────────────────────────

    const { data: insertedRow, error: insertError } = await supabase
        .from("vton_usage")
        .insert({
            user_id: userId,
            product_id: productId,
            user_image_url: humanImageUrl,
            status: "pending",
        })
        .select("uid")
        .single();

    if (insertError || !insertedRow) {
        console.error("[virtual-tryon] Failed to insert usage row:", insertError);
        // Non-fatal: still return predictionId so client can poll
        return jsonResponse({ predictionId: prediction.id, uid: null });
    }

    return jsonResponse({ predictionId: prediction.id, uid: insertedRow.uid as string });
}

// ─── Handler: check ───────────────────────────────────────────────────────────

/**
 * Polls Replicate once for the given prediction ID.
 *
 * When the prediction succeeds, the result image is downloaded from Replicate
 * (which requires the API key) and re-uploaded to the `vton-results` Supabase
 * Storage bucket so the client can load it without any auth headers.
 * The permanent Supabase URL is stored in vton_usage and returned.
 *
 * Returns one of: { status: 'starting' | 'processing' }
 *                 { status: 'succeeded', resultUrl: string }
 *                 { status: 'failed', error: string }
 */
async function handleCheck(
    supabase: ReturnType<typeof createClient>,
    replicateKey: string,
    userId: number,
    body: CheckBody,
): Promise<Response> {
    const { predictionId, uid } = body;

    if (!predictionId) {
        return jsonResponse({ error: "predictionId is required" }, 400);
    }

    // ── If we have a uid, check if the row is already resolved ─────────────

    if (uid) {
        const { data: existingRow } = await supabase
            .from("vton_usage")
            .select("status, result_image_url")
            .eq("uid", uid)
            .eq("user_id", userId)
            .single();

        if (existingRow?.status === "success" && existingRow?.result_image_url) {
            return jsonResponse({ status: "succeeded", resultUrl: existingRow.result_image_url as string });
        }

        if (existingRow?.status === "failed") {
            return jsonResponse({ status: "failed", error: "Try-on generation failed" });
        }
    }

    // ── Poll Replicate once ─────────────────────────────────────────────────

    const pollRes = await fetch(`${REPLICATE_API_BASE}/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${replicateKey}` },
    });

    if (!pollRes.ok) {
        throw new Error(`Replicate polling error: ${pollRes.status}`);
    }

    const prediction: ReplicatePrediction = await pollRes.json() as ReplicatePrediction;

    if (prediction.status === "succeeded") {
        try {
            const replicateImageUrl = resolveReplicateOutputUrl(prediction.output);
            if (!replicateImageUrl) {
                throw new Error("Replicate returned no valid output URL");
            }

            // ── Download image from Replicate (requires API key) ────────────────
            // Replicate output URLs are not publicly accessible — they need the
            // Authorization header. We proxy via Supabase Storage so the client
            // can load the image without any credentials.

            const imgRes = await fetch(replicateImageUrl, {
                headers: { Authorization: `Token ${replicateKey}` },
            });

            if (!imgRes.ok) {
                throw new Error(`Failed to download result image from Replicate: ${imgRes.status}`);
            }

            const imageBytes = new Uint8Array(await imgRes.arrayBuffer());
            const { contentType, extension } = resolveImageFormat(imgRes.headers.get("content-type"), imageBytes);
            const storagePath = `${userId}/${Date.now()}.${extension}`;

            let { error: uploadError } = await supabase.storage
                .from("vton-results")
                .upload(storagePath, imageBytes, { contentType, upsert: true });

            if (uploadError) {
                // Retry once with image/png. Some providers include unsupported MIME
                // params/aliases that can fail against bucket mime restrictions.
                const retry = await supabase.storage
                    .from("vton-results")
                    .upload(storagePath, imageBytes, { contentType: "image/png", upsert: true });
                uploadError = retry.error;
            }

            if (uploadError) {
                // Replicate delivery URLs require an Authorization header that the
                // React Native Image component cannot provide, so they are unusable
                // on the client. Fail fast so the user can retry.
                throw new Error(`Failed to save result image: ${uploadError.message}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from("vton-results")
                .getPublicUrl(storagePath);
            const resultUrl = publicUrl;

            // Update usage row
            if (uid) {
                await supabase
                    .from("vton_usage")
                    .update({ result_image_url: resultUrl, status: "success" })
                    .eq("uid", uid)
                    .eq("user_id", userId);
            }

            return jsonResponse({ status: "succeeded", resultUrl });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Try-on post-processing failed";
            console.error("[virtual-tryon]", message);

            if (uid) {
                await supabase
                    .from("vton_usage")
                    .update({ status: "failed" })
                    .eq("uid", uid)
                    .eq("user_id", userId);
            }

            // Return a handled failure (200) so the client can show a specific
            // user-facing message instead of generic non-2xx polling errors.
            return jsonResponse({ status: "failed", error: message });
        }
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
        const errorMsg = prediction.error ?? `Prediction ${prediction.status}`;

        if (uid) {
            await supabase
                .from("vton_usage")
                .update({ status: "failed" })
                .eq("uid", uid)
                .eq("user_id", userId);
        }

        return jsonResponse({ status: "failed", error: errorMsg });
    }

    // Still running: return current Replicate status ("starting" or "processing")
    return jsonResponse({ status: prediction.status });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * Edge Function: virtual-tryon
 *
 * Two-action async architecture to avoid Supabase worker compute limits:
 *
 *   action: "start" — submits the Replicate prediction and returns { predictionId, uid }
 *                     immediately. No server-side polling.
 *   action: "check" — checks prediction status once. Client calls this in a
 *                     polling loop every few seconds.
 *
 * WARNING: REPLICATE_API_KEY is read exclusively from Supabase secrets (server-side only).
 * Never expose this key to the client.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const replicateKey = Deno.env.get("REPLICATE_API_KEY");

        if (!supabaseUrl || !supabaseServiceKey || !replicateKey) {
            throw new Error("Server configuration error: missing required secrets");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authResult = await resolveUserId(supabase, req);
        // If it's a Response, authentication failed — return it directly
        if (authResult instanceof Response) return authResult;

        const { userId } = authResult;

        const body: RequestBody = await req.json() as RequestBody;

        if (body.action === "start") {
            return await handleStart(supabase, replicateKey, userId, body);
        }

        if (body.action === "check") {
            return await handleCheck(supabase, replicateKey, userId, body);
        }

        return jsonResponse({ error: "Invalid action. Use \"start\" or \"check\"." }, 400);

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("[virtual-tryon]", message);
        return jsonResponse({ error: message }, 500);
    }
});
