---
trigger: always_on
---

# Antigravity Agent Rules & Protocols: Expo + Supabase

Your code must be lightweight, frictionless, strictly typed, highly stable, and strictly adhere to the project's React Native (Expo) and Supabase architecture. You must follow these deterministic constraints at all times.

## I. TypeScript Strictness & Type Safety

* **TypeScript Supremacy:** Use TypeScript (`.ts`, `.tsx`) exclusively. **NEVER** generate plain JavaScript (`.js`, `.jsx`).
* **The "No Any" Mandate:** **NEVER** use the `any` type under any circumstances. If a data type is truly dynamic, use `unknown` and implement type narrowing/type guards before usage.
* **Explicit Variable Typing:** Every variable, argument, and class property **MUST** have an explicitly defined type. Do not rely on implicit type inference.
* **Explicit Return Types:** Every function, hook, and component **MUST** have an explicitly defined return type in its signature (e.g., `React.FC<Props>`, `JSX.Element`, `void`, `boolean`).
* **Strict Equality:** Exclusively use the strict equality (`===`) and strict inequality (`!==`) operators.
* **Prop Interfaces:** Always define a dedicated `interface` for component props (e.g., `interface ButtonProps { ... }`). **NEVER** define inline prop types inside the function parameter list.
* **ALWAYS** add an activity indicator modal when doing an aynchronous operation.

## II. Project Structure & File Placement

* **Immutable Root Directory:** **NEVER** create new folders in the root directory unless explicitly instructed. You may only create files/folders within the existing directories outlined in the project tree.
* **App Initialization:** All global app initialization (providers, fonts, splash screens) **MUST** occur in the root layout file: `app/_layout.tsx`.
* **Shared Utilities:** All reusable helper functions **MUST** be placed in `utils/utils.ts`.
* **Shared Types (`utils/types.ts`):** All shared TypeScript definitions belong here. You **MUST** declare `type` aliases at the top of the file, followed by `interface` declarations below them.
* **Environment Variables:** All external tool API keys and secrets **MUST** be defined in a `.env` file in the root directory. **NEVER** hardcode keys.

## III. React Architecture & Component Modularity

* **Single Component Principle:** Strictly maintain exactly one React component per `.tsx` file. **NEVER** define custom helper or nested components within the same file as the component that uses them.
* **Component Placement:**
    * **Global:** Reusable, app-wide UI components belong in `components/ui/`.
    * **Page-Specific:** Nested or supporting components exclusive to a specific route **MUST** be placed in `app/components/[page-name]-components.tsx` (e.g., `app/components/home-components.tsx`).
* **Component Splitting Trigger:** If a component grows too large, manages distinct sections of UI, or contains complex nested maps, you **MUST** extract the sub-sections into their own components following the placement rules above.
* **Immutability Preferred:** Treat props and state as strictly immutable. Use `readonly` modifiers inside your interfaces where applicable.
* **Predictable Naming:** Use `PascalCase` for files containing React components and their interfaces. Use `camelCase` for all standard functions, hooks, and variables.

## IV. "Antigravity" Frictionless Protocols

* **Graceful Fallbacks:** If rendering data from props or an API, **ALWAYS** account for `null`, `undefined`, or empty arrays to prevent the UI from crashing.
* **No Magic Numbers or Strings:** Extract all hardcoded numbers, timeout values, and specific string literals into explicitly typed, uppercase `const` variables at the top of the file or in a shared config.
* **Empty Lists:** If a list/FlatList is empty, it **MUST** render a dedicated custom "Empty State" component. This component must contain an icon and a catchy, context-specific text string indicating the list is empty.
* **Destructive Actions:** Any `UPDATE` or `DELETE` action **MUST** trigger a generic, reusable Confirmation Dialog Modal. The action can only proceed if the user confirms it within the modal.
* **Activity Indicators:** Whenever an `ActivityIndicator` is used, it **MUST** have the `size="small"` prop and use the `primary` color defined in the theme.

## V. Supabase Database & Backend Architecture

* **Free Tier Optimization:** Supabase is on the free tier. You **MUST** write highly optimized queries, request only necessary columns (e.g., `.select('col1, col2')`), and minimize database round-trips.
* **Typed Supabase Client:** Whenever making requests via the Supabase client, you **MUST** explicitly pass the auto-generated database types to ensure end-to-end type safety.
* **Primary Keys vs. Public UIDs:**
    * Every table **MUST** have a private primary key defined as `id int8 generated always as identity`. **NEVER** expose this `id` to the frontend.
    * Every table **MUST** have a public identifier column named `uid` defined as `uuid default gen_random_uuid()`. 
    * All frontend API requests and database foreign key client references **MUST** use the `uid`.
* **Strict RLS:** Row-Level Security (RLS) **MUST** be enabled for EVERY table. Always write explicit policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
* **Foreign Key Cascades:** When referencing a row in the database via a foreign key, it **MUST** be set up to cascade on updates (`ON UPDATE CASCADE`).

## VI. Local-First Migration Workflow

When modifying the database schema or creating new tables, you **MUST** strictly adhere to this local-first workflow:
1.  **NEVER** use tools to send DDL/SQL directly to the remote Supabase project.
2.  Generate migrations locally using: `supabase migration new <descriptive_name>`.
3.  Write the required PostgreSQL statements (including RLS policies and triggers) into the newly generated `.sql` file inside `supabase/migrations/`.
4.  Stop your execution. Instruct the user to review the `.sql` code and manually run `supabase db push` in their terminal to apply the changes.

## VII. Security & Theming

* **Password Requirements:** Any manual password validation must enforce: Minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number.
* **Encryption:** If manual cryptographic hashing or encryption is required, you **MUST** use SHA-256.
* **Theme Declaration:** The theme file (`utils/theme.ts`) **MUST** use a strict custom `interface` to define exhaustive colors for both light mode and dark mode.

## VIII. Documentation & Safety Guards

* **Component Signatures:** Every component function **MUST** have a JSDoc-style block comment summarizing its purpose, expected behavior, and role in the UI hierarchy.
* **Algorithmic Comments:** For complex logic or data transformations, write inline comments explaining the *why* behind the logic, not just the *what*.
* **Danger Zones:** For functions that mutate global state, interact with critical APIs, or can break the project if misused, you **MUST** add a prominent `// WARNING:` tag in the docstring.
* **Usage Instructions:** If a function carries a warning tag, the docstring **MUST** include an `@example` tag demonstrating both the correct usage and the incorrect usage to avoid.