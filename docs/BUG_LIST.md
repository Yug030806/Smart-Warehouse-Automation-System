# Smart Warehouse Platform - Comprehensive Bug List

Date: August 24, 2026

---

## Critical Bugs

1. **Supabase Client Hardcoded to Local `mockDb` (`src/lib/supabase/client.ts`)**:
   - `getSupabaseClient()` bypasses `supabaseReal` completely and returns the local `mockDb` proxy regardless of whether `.env` credentials exist.
   - Consequence: Data is lost on browser storage clear, multiple tabs/devices cannot share state, RLS policies are completely ignored.

2. **React Rules of Hooks Order Violation (`src/app/boxes/[id]/page.tsx`)** [FIXED in initial step]:
   - `useState` hook for `mobileMenuOpen` was placed after conditional return `if (!box) return ...`.
   - Fixed by moving hook to top level.

3. **Hardcoded User Credentials in Audit Logs**:
   - `src/app/boxes/[id]/page.tsx` line 55 hardcodes `user_email: 'manager@demo.com'`.
   - `src/app/scanner/page.tsx` line 138 hardcodes `user_email: 'operator@demo.com'`.
   - `src/app/settings/page.tsx` line 51 hardcodes `user_email: 'admin@demo.com'`.
   - Consequence: Audit logs ignore actual logged-in user session email.

4. **Missing Edit & Delete Functionality for Entities**:
   - Warehouses: Edit modal missing.
   - Floors: Edit & Delete actions missing.
   - Locations: Edit & Delete actions missing.
   - Boxes: Edit & Delete forms missing.
   - Vehicles: Edit form missing.
   - User Profiles: Edit profile modal missing.

5. **Missing QR Download Feature**:
   - Box details page displays QR code image and Print button, but Download QR button/handler is missing.

6. **Missing Camera Scanner Integration**:
   - Scanner page only supports manual typing or simulated click input for box codes. HTML5 WebCam QR scanner integration is missing.

7. **Simulated Realtime Polling Instead of Supabase Realtime Subscriptions**:
   - Pages use `setInterval(..., 2000)` polling loops against `mockDb` instead of real WebSockets / Supabase Realtime `postgres_changes` channels.

---

## High Priority UI & Logic Bugs

8. **Zones and Racks Management UI Missing**:
   - Zones and Racks are hardcoded in `mockDb.ts`. There are no UI screens or modals for creating, updating, or deleting warehouse Zones or Racks.

9. **Manual Vehicle Task Assignment Missing**:
   - Dispatcher cannot manually assign a specific vehicle to a pending task from the Tasks page UI (only Auto-Assign is supported).

10. **Lack of Dynamic Vehicle Collision Avoidance**:
    - The A* algorithm avoids static racks on the current floor, but does not take into account other moving AGV/AMR vehicles on the same grid cell coordinates.
