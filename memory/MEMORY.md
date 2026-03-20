# Moda v3 — Project Memory

## Architecture Overview
- **Expo Router** with App Router file-based structure
- `app/_layout.tsx` — root layout, Stripe + SafeArea + ErrorBoundary + AppThemeProvider + **UserRoleProvider** + NavigationThemeProvider
- `app/home/_layout.tsx` — persistent TabBar rendered based on `TABBED_SCREENS` set + Stack
- `app/(tabs)/_layout.tsx` — thin shell, all content is in `app/home/`
- `app/index.tsx` — session check → redirects buyers to `/home/catalog`, sellers to `/home/seller-profile`

## Navigation Architecture (Phase 20)
- Tab bar lives in `app/home/_layout.tsx` as a custom `TabBar` component
- `TABBED_SCREENS` set controls when tab bar is visible (main screens vs detail screens)
- Buyer tabs: Catalog / Cart (badge) / Orders / Profile
- Seller tabs: My Shop / Upload / Orders / Profile
- Deep links: `moda://product/<uid>` → `/home/product-details?uid=<uid>`, `moda://shop/<uid>` → `/home/shop-landing?uid=<uid>`
- Back button blocked during payment (`paymentLoading` in checkout, `checking`/`awaiting` in order-confirmation)

## Key Files
- `components/ui/user-role-context.tsx` — UserRoleProvider, useUserRole() → role, userId (uid), numericUserId, shopUid
- `components/navigation-components.tsx` — TabBar, CartBadge, HeaderBackButton
- `components/ui/theme-provider.tsx` — useTheme() → theme, isDark, toggleTheme
- `supabase/supabaseClient.ts` — import path: `@supabase/supabaseClient`
- `utils/types.ts` — UserRole, all shared types
- `utils/animation.ts` — Animation.Presets namespace

## DB Patterns
- `users.id` (numeric) — internal FK used in cart_items, orders etc.
- `users.uid` (UUID) — public-facing identifier
- `users.auth_id` — Supabase auth user.id — used to look up the user row
- `shops.user_id` references `users.id` (numeric)
- `cart_items.user_id` references `users.id` (numeric) — NOT the auth UUID

## Supabase Secrets Required
- `REPLICATE_API_KEY` — for `virtual-tryon` edge function. Set with: `supabase secrets set REPLICATE_API_KEY=<key>`
- `GEMINI_API_KEY` — for `describe-image` edge function
- Edge functions: payment-config, payment-create, payment-redirect, payment-webhook, virtual-tryon, describe-image

## Completed Phases
Phase 1-18, Phase 20 complete. Phase 19 (VTON) and Phase 21-22 remaining.

## Icon Mapping
Icon names in `components/ui/icon-symbol.tsx` use SF Symbol names mapped to Material Icons.
New additions: `storefront.fill`, `square.and.arrow.up.fill`, `arrow.left`, `chevron.left`, `xmark`, `clock.arrow.circlepath`, `bubble.left.and.bubble.right.fill`, `chart.bar.fill`

## Coding Rules Reminders
- useTheme() for ALL colors — never hardcode
- One component per file (except *-components.tsx collections)
- Users.id (numeric) for all FK references — not uid
- Supabase free tier — select only needed columns
