import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../../supabase/supabaseClient';
import { UserRole } from '../../utils/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRoleContextProps {
    readonly role: UserRole | null;
    readonly userId: string | null;
    /** The internal numeric users.id — used for FK queries (e.g. cart_items.user_id) */
    readonly numericUserId: number | null;
    /** Available for sellers only — the uid of the current user's shop */
    readonly shopUid: string | null;
    readonly isLoading: boolean;
    readonly refreshRole: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UserRoleContext = createContext<UserRoleContextProps | undefined>(undefined);

/**
 * useUserRole
 *
 * Hook to access the current authenticated user's role ('buyer' | 'seller'),
 * public UID, internal numeric ID, and shop UID (sellers only).
 * Must be used within a component tree wrapped by UserRoleProvider.
 */
export const useUserRole = (): UserRoleContextProps => {
    const context = useContext(UserRoleContext);
    if (!context) {
        throw new Error('useUserRole must be used within a UserRoleProvider');
    }
    return context;
};

/**
 * UserRoleProvider
 *
 * Fetches and caches the authenticated user's role, public uid, internal
 * numeric id, and shop uid (for sellers) from the database. Re-fetches on
 * auth state change (login/logout). Provides all values via context to
 * role-aware components such as the bottom TabBar and CartBadge.
 */
export const UserRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [role, setRole] = useState<UserRole | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [numericUserId, setNumericUserId] = useState<number | null>(null);
    const [shopUid, setShopUid] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const fetchRole = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setRole(null);
                setUserId(null);
                setNumericUserId(null);
                setShopUid(null);
                return;
            }

            // Fetch user's role, public uid, and internal id
            const { data: userData } = await supabase
                .from('users')
                .select('id, role, uid')
                .eq('auth_id', session.user.id)
                .single();

            setRole((userData?.role as UserRole) ?? null);
            setUserId(userData?.uid ?? null);
            setNumericUserId(userData?.id ?? null);

            // Fetch shop UID for sellers — shops.user_id references users.id
            if (userData?.role === 'seller' && userData.id) {
                const { data: shopData } = await supabase
                    .from('shops')
                    .select('uid')
                    .eq('user_id', userData.id)
                    .is('deleted_at', null)
                    .single();
                setShopUid(shopData?.uid ?? null);
            } else {
                setShopUid(null);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchRole();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            void fetchRole();
        });
        return () => subscription.unsubscribe();
    }, [fetchRole]);

    return (
        <UserRoleContext.Provider value={{ role, userId, numericUserId, shopUid, isLoading, refreshRole: fetchRole }}>
            {children}
        </UserRoleContext.Provider>
    );
};
