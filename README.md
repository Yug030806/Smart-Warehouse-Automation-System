# Smart Warehouse Autonomous Logistics Platform

Production-ready master prototype built for Smart India Hackathon (SIH) Logistics Platform. Intelligently routes virtual autonomous amrs to transport registered box packets, uses elevator transits between multiple floors, scans cargo items using QR code simulation, and generates real-time telemetry updates.

## 1. Project Structure

```
src/
├── app/
│   ├── layout.tsx         # Next.js layouts, providers
│   ├── page.tsx           # Session redirection
│   ├── login/             # Quick credentials selectors
│   ├── dashboard/         # Fleet KPIs and mini map view
│   ├── tracking/          # Live path trace simulator controls
│   ├── tracking/demo/     # SIH Auto Demo walk-through Console
│   ├── scanner/           # QR code scan verifiers
│   └── ... (CRUD pages)
├── components/            # Map twin layout and header navbars
└── lib/
    ├── algorithms/astar   # Elevators and A* pathfinding
    ├── simulator/         # Virtual amr controller
    └── supabase/          # Live Supabase and localStorage DB
```

## 2. Setup and Execution

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Schema & RLS Migrations**:
   Deploy the SQL commands in `supabase-schema.sql` in the Supabase query editor.

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Verify Tests / Compilation**:
   ```bash
   npm run build
   ```

## 3. SIH Demo workflow credentials
Login credentials (passwords match roles + "123"):
* **Admin**: `admin@demo.com` / `admin123`
* **Manager**: `manager@demo.com` / `manager123`
* **Operator**: `operator@demo.com` / `operator123`

---

## 4. Completed Feature Checklist

* **Authentication**: Login/Logout, pre-loaded role access, session cache persistence.
* **Warehouse Digital Twin Map**: multi-floor routing elevator switches, layout nodes representation.
* **Route engine**: A* pathfinding, walls and rack obstacle avoidance.
* **Autonomous amr simulator**: Play, Pause, Reset, 1x-10x speed multipliers controls.
* **QR scanner verification**: Manual input simulation, expected values check, mismatch warnings alerts.
* **Analytics**: completed/failed task distributions graphs (Recharts).
* **Audit log**: Security audit log trail entries.
