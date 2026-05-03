import type { TablesInsert } from '../supabase/database.types';
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

interface MockedSupabaseChain {
    from: jest.Mock;
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    eq: jest.Mock;
    range: jest.Mock;
    single: jest.Mock;
}

const mockedSupabase = supabase as unknown as MockedSupabaseChain;

describe('Database API Layer (Phase 3)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('BaseApi Class', () => {
        const api = new BaseApi('users');

        it('should correctly format a getByUid query', async () => {
            const mockResult = { data: { id: 1, uid: 'test-uid', name: 'Test' }, error: null };
            mockedSupabase.single.mockResolvedValueOnce(mockResult);

            const result = await api.getByUid('test-uid');

            expect(mockedSupabase.from).toHaveBeenCalledWith('users');
            expect(mockedSupabase.select).toHaveBeenCalledWith('*');
            expect(mockedSupabase.eq).toHaveBeenCalledWith('uid', 'test-uid');
            expect(result).toEqual(mockResult);
        });

        it('should correctly format an insert query', async () => {
            const mockResult = { data: { id: 1, name: 'New' }, error: null };
            mockedSupabase.single.mockResolvedValueOnce(mockResult);

            const payload: TablesInsert<'users'> = {
                first_name: 'Test',
                last_name: 'User',
                gender: 'male',
                date_of_birth: '2000-01-01',
                email: 'new-user@example.com',
                role: 'buyer',
                auth_id: '00000000-0000-0000-0000-000000000000',
            };
            const result = await api.create(payload);

            expect(mockedSupabase.from).toHaveBeenCalledWith('users');
            expect(mockedSupabase.insert).toHaveBeenCalledWith(payload);
            expect(mockedSupabase.single).toHaveBeenCalled();
            expect(result).toEqual(mockResult);
        });

        it('should correctly format a soft delete query', async () => {
            const mockResult = { data: { id: 1 }, error: null };
            mockedSupabase.single.mockResolvedValueOnce(mockResult);

            const result = await api.softDelete('test-uid');

            expect(mockedSupabase.from).toHaveBeenCalledWith('users');
            expect(mockedSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
                deleted_at: expect.any(String),
            }));
            expect(mockedSupabase.eq).toHaveBeenCalledWith('uid', 'test-uid');
            expect(result).toEqual(mockResult);
        });
    });
});
