# Smart Warehouse Platform - Architecture Issues Analysis

Date: August 24, 2026

---

## 1. Primary Architectural Flaws

### Flaw 1: Mock Client Proxy Overrides Real Supabase Client
- **File**: `src/lib/supabase/client.ts`
- **Issue**: `getSupabaseClient()` returns an in-memory JS mock client (`mockDb.ts`) by default. Even when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are provided in environment variables, `supabaseReal` is created but never used or returned by `getSupabaseClient()`.
- **Impact**:
  - Application data does not persist to PostgreSQL.
  - Multi-user collaboration across devices is impossible.
  - Row Level Security (RLS) policies defined in `supabase-schema.sql` are completely ignored.

---

### Flaw 2: Auth Session Storage in `localStorage`
- **File**: `src/lib/supabase/AuthProvider.tsx`
- **Issue**: User authentication creates a plain JSON payload in `localStorage` under `sih_session`.
- **Impact**:
  - Security vulnerability: Session tokens can be modified in browser dev tools.
  - No session expiration or refresh token handling.
  - Hardcoded fallback user emails in audit log calls instead of retrieving logged-in user session.

---

### Flaw 3: Simulated Polling vs Realtime WebSockets
- **Files**: `src/app/dashboard/page.tsx`, `src/app/tracking/page.tsx`, `src/components/Navbar.tsx`, `src/app/tasks/page.tsx`
- **Issue**: Every page uses `setInterval(..., 2000)` polling to query `mockDb`.
- **Impact**:
  - Unnecessary UI re-render cycles every 2 seconds.
  - Not leveraging Supabase Realtime Postgres Changes subscriptions.

---

### Flaw 4: Partial Entity CRUD Interfaces
- **Issue**: UI components implement Create and Read for boxes/vehicles/warehouses, but omit Update and Delete handlers in the UI.

---

## 2. Recommended Architectural Roadmap

1. **Unify Supabase Client (`client.ts`)**:
   - Update `client.ts` to use real Supabase client when credentials are present, with seamless fallback to local storage only when credentials are absent.
2. **Connect Auth to Supabase Auth**:
   - Delegate `signInWithPassword`, `signOut`, and session listeners to `@supabase/supabase-js`.
3. **Replace Polling with Supabase Realtime Subscriptions**:
   - Implement `supabase.channel('custom-filter-channel')` for live updates on `vehicles`, `tasks`, and `alerts`.
4. **Complete Entity CRUD Modals**:
   - Implement missing Edit/Delete modals for Warehouses, Floors, Locations, Boxes, Vehicles, and Profiles.
