import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import promptConfigRaw from "../_shared/prompts.json" assert { type: "json" };

// ─── Constants ────────────────────────────────────────────────────────────────

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const REPLICATE_EXTRACTION_MODEL = "prunaai/p-image-edit";
const REPLICATE_MODEL_VERSION_SECRET = "REPLICATE_P_IMAGE_EDIT_VERSION";
const EXTRACTION_RESULTS_BUCKET = "outfit-results";
let cachedExtractionModelVersion: string | null = null;

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface StartBody {
    readonly action: "start";
    readonly sourceImageUrl: string;
    readonly productCategory: string;
    readonly isFullBody?: boolean;
}

interface CheckBody {
    readonly action: "check";
    readonly predictionId: string;
}

type RequestBody = StartBody | CheckBody;

interface ReplicatePrediction {
    readonly id: string;
    readonly status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
    readonly output?: unknown;
    readonly error?: string | null;
}

interface ReplicateModelLookupResponse {
    readonly latest_version?: {
        readonly id?: string | null;
    } | null;
}

type ExtractionCategory = "headwear" | "upperwear" | "lowerwear" | "footwear";
type StorageImageContentType = "image/jpeg" | "image/png" | "image/webp";

interface ResolvedImageFormat {
    readonly contentType: StorageImageContentType;
    readonly extension: "jpg" | "png" | "webp";
}

interface PromptCategoryMap {
    readonly headwear: string;
    readonly upperwear: string;
    readonly lowerwear: string;
    readonly footwear: string;
}

interface PromptConfigSection {
    readonly unsupportedCategoryMessage: string;
    readonly fullBodyPrompt: string;
    readonly categoryPrompts: PromptCategoryMap;
}

interface PromptConfig {
    readonly extractOutfit: PromptConfigSection;
    readonly virtualTryOn: PromptConfigSection;
}

const promptConfig = promptConfigRaw as PromptConfig;
const extractOutfitPromptConfig = promptConfig.extractOutfit;
const EXTRACTION_CATEGORY_DISABLED_MESSAGE = extractOutfitPromptConfig.unsupportedCategoryMessage;

// ─── Helper: responses ────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(body), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        status,
    });
}

function normalizeExtractionCategory(category: string): ExtractionCategory | null {
    const normalizedCategory = category.trim().toLowerCase();

    if (normalizedCategory === "headwear") return "headwear";
    if (normalizedCategory === "upperwear") return "upperwear";
    if (normalizedCategory === "lowerwear") return "lowerwear";
    if (normalizedCategory === "footwear") return "footwear";

    return null;
}

function resolveExtractionPrompt(category: ExtractionCategory, isFullBody: boolean): string {
    if (isFullBody) {
        return extractOutfitPromptConfig.fullBodyPrompt;
    }

    return extractOutfitPromptConfig.categoryPrompts[category];
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
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }

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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payloadPart = parts[1];
    if (!payloadPart) return null;

    const normalizedPayload = payloadPart
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");

    try {
        const decoded = atob(normalizedPayload);
        const parsed = JSON.parse(decoded) as Record<string, unknown>;
        return parsed;
    } catch {
        return null;
    }
}

function resolveSubjectFromToken(token: string): string | null {
    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    const subject = payload.sub;
    return typeof subject === "string" && subject.trim().length > 0 ? subject.trim() : null;
}

// ─── Helper: auth ─────────────────────────────────────────────────────────────

async function resolveUserId(
    supabase: ReturnType<typeof createClient>,
    req: Request,
): Promise<number | null> {
    let authSubject: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        const token = (bearerMatch?.[1] ?? authHeader).trim();

        if (token.length > 0) {
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (!authError && user?.id) {
                authSubject = user.id;
            } else {
                authSubject = resolveSubjectFromToken(token);
            }
        }
    }

    if (authSubject === null) {
        const forwardedAuthUser = req.headers.get("x-supabase-auth-user");
        if (forwardedAuthUser && forwardedAuthUser.trim().length > 0) {
            authSubject = forwardedAuthUser.trim();
        }
    }

    if (authSubject === null) {
        return null;
    }

    const { data: dbUser, error: dbUserError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", authSubject)
        .single();

    if (dbUserError || !dbUser) {
        return null;
    }

    return dbUser.id as number;
}

function normalizeModelVersion(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function resolveExtractionModelVersion(replicateKey: string): Promise<string> {
    const envVersion = normalizeModelVersion(Deno.env.get(REPLICATE_MODEL_VERSION_SECRET));
    if (envVersion !== null) {
        cachedExtractionModelVersion = envVersion;
        return envVersion;
    }

    if (cachedExtractionModelVersion !== null) {
        return cachedExtractionModelVersion;
    }

    const modelLookupResponse = await fetch(`${REPLICATE_API_BASE}/models/${REPLICATE_EXTRACTION_MODEL}`, {
        headers: { Authorization: `Token ${replicateKey}` },
    });

    if (!modelLookupResponse.ok) {
        const errorText = await modelLookupResponse.text();
        throw new Error(
            `Failed to resolve Replicate model version (${modelLookupResponse.status}). `
            + `Set ${REPLICATE_MODEL_VERSION_SECRET} secret. Details: ${errorText}`,
        );
    }

    const modelLookup = await modelLookupResponse.json() as ReplicateModelLookupResponse;
    const latestVersionId = normalizeModelVersion(modelLookup.latest_version?.id ?? null);

    if (latestVersionId === null) {
        throw new Error(
            `Replicate model version could not be resolved. Set ${REPLICATE_MODEL_VERSION_SECRET} secret.`,
        );
    }

    cachedExtractionModelVersion = latestVersionId;
    return latestVersionId;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleStart(
    replicateKey: string,
    body: StartBody,
): Promise<Response> {
    const { sourceImageUrl, productCategory, isFullBody } = body;

    if (!sourceImageUrl || !productCategory) {
        return jsonResponse({ error: "sourceImageUrl and productCategory are required" }, 400);
    }

    const category = normalizeExtractionCategory(productCategory);
    if (category === null) {
        return jsonResponse({ error: EXTRACTION_CATEGORY_DISABLED_MESSAGE }, 400);
    }

    const modelVersion = await resolveExtractionModelVersion(replicateKey);

    const predictionRes = await fetch(`${REPLICATE_API_BASE}/predictions`, {
        method: "POST",
        headers: {
            Authorization: `Token ${replicateKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            version: modelVersion,
            input: {
                images: [sourceImageUrl],
                prompt: resolveExtractionPrompt(category, isFullBody === true),
                aspect_ratio: "match_input_image",
                turbo: false,
                disable_safety_checker: true,
                steps: 20,
                crop: false,
            },
        }),
    });

    if (!predictionRes.ok) {
        const errText = await predictionRes.text();
        throw new Error(`Replicate API error ${predictionRes.status}: ${errText}`);
    }

    const prediction: ReplicatePrediction = await predictionRes.json() as ReplicatePrediction;
    return jsonResponse({ predictionId: prediction.id, status: prediction.status });
}

async function handleCheck(
    supabase: ReturnType<typeof createClient>,
    replicateKey: string,
    userId: number | null,
    body: CheckBody,
): Promise<Response> {
    const { predictionId } = body;

    if (!predictionId) {
        return jsonResponse({ error: "predictionId is required" }, 400);
    }

    const pollRes = await fetch(`${REPLICATE_API_BASE}/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${replicateKey}` },
    });

    if (!pollRes.ok) {
        throw new Error(`Replicate polling error: ${pollRes.status}`);
    }

    const prediction: ReplicatePrediction = await pollRes.json() as ReplicatePrediction;

    if (prediction.status === "succeeded") {
        const outputUrl = resolveReplicateOutputUrl(prediction.output);
        if (!outputUrl) {
            return jsonResponse({ status: "failed", error: "Replicate returned no valid output URL" });
        }

        const imageRes = await fetch(outputUrl, {
            headers: { Authorization: `Token ${replicateKey}` },
        });

        if (!imageRes.ok) {
            return jsonResponse({ status: "failed", error: `Failed to download extracted image: ${imageRes.status}` });
        }

        const imageBytes = new Uint8Array(await imageRes.arrayBuffer());
        const { contentType, extension } = resolveImageFormat(imageRes.headers.get("content-type"), imageBytes);
        const ownerPrefix = userId === null ? "anonymous" : String(userId);
        const storagePath = `${ownerPrefix}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

        let { error: uploadError } = await supabase.storage
            .from(EXTRACTION_RESULTS_BUCKET)
            .upload(storagePath, imageBytes, { contentType, upsert: true });

        if (uploadError) {
            const retry = await supabase.storage
                .from(EXTRACTION_RESULTS_BUCKET)
                .upload(storagePath, imageBytes, { contentType: "image/png", upsert: true });
            uploadError = retry.error;
        }

        if (uploadError) {
            return jsonResponse({ status: "failed", error: `Failed to save extracted image: ${uploadError.message}` });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(EXTRACTION_RESULTS_BUCKET)
            .getPublicUrl(storagePath);

        return jsonResponse({
            status: "succeeded",
            resultUrl: publicUrl,
            storagePath,
        });
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
        return jsonResponse({ status: "failed", error: prediction.error ?? `Prediction ${prediction.status}` });
    }

    return jsonResponse({ status: prediction.status });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * Edge Function: extract-outfit
 *
 * action: "start" -> submits extraction prediction and returns predictionId.
 * action: "check" -> polls prediction once and stores the extracted outfit to
 *                     the `outfit-results` storage bucket on success.
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

        const body: RequestBody = await req.json() as RequestBody;

        if (body.action === "start") {
            console.log("[extract-outfit] action=start");
            return await handleStart(replicateKey, body);
        }

        if (body.action === "check") {
            console.log("[extract-outfit] action=check", { predictionId: body.predictionId });
            const userId = await resolveUserId(supabase, req);
            return await handleCheck(supabase, replicateKey, userId, body);
        }

        return jsonResponse({ error: "Invalid action. Use \"start\" or \"check\"." }, 400);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("[extract-outfit]", message);
        return jsonResponse({ error: message }, 500);
    }
});
