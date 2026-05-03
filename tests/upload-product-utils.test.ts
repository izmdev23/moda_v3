import {
    isAccessoryCategory,
    normalizeExtractionResultUrl,
    parseVariantPayloads,
    type VariantValidationInput,
} from '../utils/upload-product-utils';

function buildVariant(overrides?: Partial<VariantValidationInput>): VariantValidationInput {
    return {
        name: 'Variant A',
        price: '1499',
        stock: '5',
        sale_price: '',
        sale_end_date: undefined,
        is_full_body: true,
        try_on_image_url: 'https://cdn.example.com/try-on.jpg',
        extracted_outfit_url: 'https://cdn.example.com/outfit.jpg',
        ...overrides,
    };
}

describe('upload-product-utils', () => {
    describe('isAccessoryCategory', () => {
        it('returns true for accessory category', () => {
            expect(isAccessoryCategory('accessory')).toBe(true);
        });

        it('returns false for non-accessory categories', () => {
            expect(isAccessoryCategory('upperwear')).toBe(false);
            expect(isAccessoryCategory('headwear')).toBe(false);
        });
    });

    describe('normalizeExtractionResultUrl', () => {
        it('normalizes string values', () => {
            expect(normalizeExtractionResultUrl('  https://cdn.example.com/outfit.png  ')).toBe('https://cdn.example.com/outfit.png');
        });

        it('normalizes array values', () => {
            expect(normalizeExtractionResultUrl(['', '  https://cdn.example.com/a.png  '])).toBe('https://cdn.example.com/a.png');
        });

        it('normalizes object values', () => {
            expect(normalizeExtractionResultUrl({ url: 'https://cdn.example.com/url.png' })).toBe('https://cdn.example.com/url.png');
            expect(normalizeExtractionResultUrl({ href: 'https://cdn.example.com/href.png' })).toBe('https://cdn.example.com/href.png');
        });

        it('returns empty string for unsupported values', () => {
            expect(normalizeExtractionResultUrl(undefined)).toBe('');
            expect(normalizeExtractionResultUrl([])).toBe('');
            expect(normalizeExtractionResultUrl({})).toBe('');
        });
    });

    describe('parseVariantPayloads', () => {
        it('parses non-accessory variants successfully', () => {
            const [payload] = parseVariantPayloads([
                buildVariant({ sale_price: '999', sale_end_date: new Date('2026-12-31T00:00:00.000Z') }),
            ], 'upperwear');

            expect(payload).toEqual({
                name: 'Variant A',
                price: 1499,
                stock: 5,
                salePrice: 999,
                saleEndDate: '2026-12-31T00:00:00.000Z',
                isFullBody: true,
                tryOnImageUrl: 'https://cdn.example.com/try-on.jpg',
                extractedOutfitUrl: 'https://cdn.example.com/outfit.jpg',
            });
        });

        it('requires extracted assets for non-accessory variants', () => {
            expect(() => parseVariantPayloads([
                buildVariant({ extracted_outfit_url: null }),
            ], 'lowerwear')).toThrow('Variant 1 requires a virtual try-on image and extracted outfit result.');
        });

        it('bypasses try-on requirements for accessories', () => {
            const [payload] = parseVariantPayloads([
                buildVariant({
                    is_full_body: true,
                    try_on_image_url: null,
                    extracted_outfit_url: null,
                }),
            ], 'accessory');

            expect(payload.isFullBody).toBe(false);
            expect(payload.tryOnImageUrl).toBeNull();
            expect(payload.extractedOutfitUrl).toBeNull();
        });

        it('throws for invalid stock values', () => {
            expect(() => parseVariantPayloads([
                buildVariant({ stock: '-1' }),
            ], 'headwear')).toThrow('Variant 1 stock must be a valid whole number.');
        });

        it('throws for non-positive prices', () => {
            expect(() => parseVariantPayloads([
                buildVariant({ price: '0' }),
            ], 'footwear')).toThrow('Variant 1 price must be greater than 0.');
        });
    });
});
