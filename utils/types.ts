// Types
export type UserRole = 'buyer' | 'seller';
export type Gender = 'male' | 'female' | 'non-binary';
export type ProductCategory = 'headwear' | 'tops' | 'bottoms' | 'footwear' | 'full_body' | 'accessory';
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
export type ActivityType = 'view' | 'search' | 'purchase' | 'cart_add';
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type MessageType = 'text' | 'image';

// Interfaces
export interface UserRow {
    id: number;
    uid: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    gender: Gender;
    date_of_birth: string;
    email: string;
    role: UserRole;
    avatar_url?: string;
    auth_id: string;
    deleted_at?: string;
    created_at: string;
    updated_at: string;
}

export interface ShopRow {
    id: number;
    uid: string;
    user_id: number;
    shop_name: string;
    country: string;
    province: string;
    city: string;
    address_detail: string;
    banner_url?: string;
    description?: string;
    deleted_at?: string;
    created_at: string;
    updated_at: string;
}

export interface ProductRow {
    id: number;
    uid: string;
    shop_id: number;
    shop_name: string;
    name: string;
    description: string;
    category: ProductCategory;
    tags: string[];
    thumbnail_url: string;
    rating_avg: number;
    total_sales: number;
    deleted_at?: string;
    created_at: string;
    updated_at: string;
}

export interface AdministrativeBoundary {
    id: number;
    parent_id: number | null;
    name: string;
    level: number;
}

export interface BoundaryItem {
    readonly id: number;
    readonly name: string;
}
