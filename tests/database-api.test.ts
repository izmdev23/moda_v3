import { BaseApi } from '../utils/database/api';

// Mock the supersonic client
jest.mock('../supabase/supabaseClient', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn(),
    },
}));

import { supabase } from '../supabase/supabaseClient';

describe('Database API Layer (Phase 3)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('BaseApi Class', () => {
        interface TestData {
            id: number;
            uid: string;
            name: string;
        }
        const api: BaseApi<TestData> = new BaseApi<TestData>('users' as any);

        it('should correctly format a getByUid query', async () => {
            const mockResult = { data: { id: 1, uid: 'test-uid', name: 'Test' }, error: null };
            (supabase.single as jest.Mock).mockResolvedValueOnce(mockResult);

            const result = await api.getByUid('test-uid');

            expect(supabase.from).toHaveBeenCalledWith('users');
            expect(supabase.select).toHaveBeenCalledWith('*');
            expect(supabase.eq).toHaveBeenCalledWith('uid', 'test-uid');
            expect(result).toEqual(mockResult);
        });

        it('should correctly format an insert query', async () => {
            const mockResult = { data: { id: 1, name: 'New' }, error: null };
            (supabase.single as jest.Mock).mockResolvedValueOnce(mockResult);

            const payload = { name: 'New' };
            const result = await api.create(payload);

            expect(supabase.from).toHaveBeenCalledWith('users');
            expect(supabase.insert).toHaveBeenCalledWith(payload);
            expect(supabase.single).toHaveBeenCalled();
            expect(result).toEqual(mockResult);
        });

        it('should correctly format a soft delete query', async () => {
            const mockResult = { data: { id: 1 }, error: null };
            (supabase.single as jest.Mock).mockResolvedValueOnce(mockResult);

            const result = await api.softDelete('test-uid');

            expect(supabase.from).toHaveBeenCalledWith('users');
            expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({
                deleted_at: expect.any(String),
            }));
            expect(supabase.eq).toHaveBeenCalledWith('uid', 'test-uid');
            expect(result).toEqual(mockResult);
        });
    });
});
