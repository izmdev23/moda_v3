import { ProductCategory } from './types';

export type ExtractOutfitResultUrl =
    | string
    | readonly string[]
    | {
        readonly url?: string;
        readonly href?: string;
    }
    | undefined;

export interface VariantValidationInput {
    readonly name: string;
    readonly price: string;
    readonly stock: string;
    readonly sale_price: string;
    readonly sale_end_date: Date | undefined;
    readonly is_full_body: boolean;
    readonly try_on_image_url: string | null;
    readonly extracted_outfit_url: string | null;
}

export interface ParsedVariantPayload {
    readonly name: string;
    readonly price: number;
    readonly stock: number;
    readonly salePrice: number | null;
    readonly saleEndDate: string | null;
    readonly isFullBody: boolean;
    readonly tryOnImageUrl: string | null;
    readonly extractedOutfitUrl: string | null;
}

function parsePositiveNumber(rawValue: string, fieldLabel: string): number {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error(`${fieldLabel} must be greater than 0.`);
    }
    return parsedValue;
}

function parseNonNegativeInteger(rawValue: string, fieldLabel: string): number {
    const parsedValue = Number(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        throw new Error(`${fieldLabel} must be a valid whole number.`);
    }
    return parsedValue;
}

function parseOptionalSalePrice(rawValue: string): number | null {
    const trimmedValue = rawValue.trim();
    if (trimmedValue.length === 0) {
        return null;
    }

    return parsePositiveNumber(trimmedValue, 'Sale price');
}

export function isAccessoryCategory(category: ProductCategory): boolean {
    return category === 'accessory';
}

export function normalizeExtractionResultUrl(rawValue: ExtractOutfitResultUrl): string {
    if (typeof rawValue === 'string') {
        return rawValue.trim();
    }

    if (Array.isArray(rawValue)) {
        const firstValue = rawValue.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
        return typeof firstValue === 'string' ? firstValue.trim() : '';
    }

    if (typeof rawValue === 'object' && rawValue !== null && !Array.isArray(rawValue)) {
        const objectValue = rawValue as { readonly url?: string; readonly href?: string };

        if (typeof objectValue.url === 'string' && objectValue.url.trim().length > 0) {
            return objectValue.url.trim();
        }
        if (typeof objectValue.href === 'string' && objectValue.href.trim().length > 0) {
            return objectValue.href.trim();
        }
    }

    return '';
}

export function parseVariantPayloads(
    variants: readonly VariantValidationInput[],
    category: ProductCategory,
): ParsedVariantPayload[] {
    const categoryIsAccessory = isAccessoryCategory(category);

    return variants.map((variant, index) => {
        const variantLabel = `Variant ${index + 1}`;
        const variantName = variant.name.trim();
        if (variantName.length === 0) {
            throw new Error(`${variantLabel} name is required.`);
        }

        if (!categoryIsAccessory && (variant.extracted_outfit_url === null || variant.try_on_image_url === null)) {
            throw new Error(`${variantLabel} requires a virtual try-on image and extracted outfit result.`);
        }

        return {
            name: variantName,
            price: parsePositiveNumber(variant.price, `${variantLabel} price`),
            stock: parseNonNegativeInteger(variant.stock, `${variantLabel} stock`),
            salePrice: parseOptionalSalePrice(variant.sale_price),
            saleEndDate: variant.sale_end_date ? variant.sale_end_date.toISOString() : null,
            isFullBody: categoryIsAccessory ? false : variant.is_full_body,
            tryOnImageUrl: categoryIsAccessory ? null : variant.try_on_image_url,
            extractedOutfitUrl: categoryIsAccessory ? null : variant.extracted_outfit_url,
        };
    });
}
