# Smart Warehouse Platform - Missing Features Specification

Date: August 24, 2026

---

## 1. Core Missing Management Modules

1. **Warehouse Zones & Racks Management UI**:
   - UI forms and pages to define Zone boundaries, zone color codes, rack capacities, rack width/height, and rack aisle layout.

2. **Full CRUD for All Entities**:
   - Edit & Delete modals for Warehouses, Floors, Locations, Boxes, Vehicles, and Profiles.

3. **Manual Vehicle Task Assignment**:
   - Modal on Tasks page allowing operators to pick a specific vehicle from the fleet to assign to a task.

---

## 2. Advanced QR & Scanning Capabilities

4. **Camera-Based Live QR Scanner**:
   - Integration with `@zxing/library` or `html5-qrcode` to enable device camera scanning on mobile/tablet/desktop.

5. **Downloadable QR Code Labels**:
   - Download QR code PNG/SVG button on Box Details page.

---

## 3. Realtime & Backend Integration

6. **Live Supabase PostgreSQL Database Connection**:
   - Real Supabase client export and query execution instead of `mockDb` local proxy.

7. **Supabase Realtime WebSockets**:
   - Live state synchronization across multiple tabs and browser windows via Supabase `channel('schema-db-changes')`.

8. **Supabase Auth Integration**:
   - Server-side JWT session validation and Supabase Auth user profiles instead of `localStorage` (`sih_session`).

9. **Server-Side Row Level Security (RLS)**:
   - RLS enforcement directly in PostgreSQL.

---

## 4. Simulator & Pathfinding Enhancements

10. **Dynamic Obstacle Avoidance**:
    - Multi-agent collision avoidance for active vehicles operating on the same floor.
