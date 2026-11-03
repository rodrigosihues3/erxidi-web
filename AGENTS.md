# ERXIDI Engineering & Architecture Guidelines

## Execution Constraints (Strict)
- PROHIBITED: Do not run build commands (`npm run build`, `npm.cmd run build`) or test suites in the terminal. The developer validates compilation locally.
- Keep tool executions minimal. Do not inspect unnecessary files.
- Deliver code directly into the specified file paths.
- Responses must be concise: generate the code and provide a single-line confirmation without conversational fluff or lengthy summaries.

## Database & Schema Authority (Strict)
- SINGLE SOURCE OF TRUTH: All database queries, schema inspections, column references, and foreign keys must be validated strictly against `supabase_schema.sql` located at the project root.
- PROHIBITED: Alucinating or inventing column names, relationships, or tables that do not exist in `supabase_schema.sql`.
- PROHIBITED: Storing business state, audit trails, operational metrics, or incidents in `localStorage` or `sessionStorage`. All business mutations must persist in PostgreSQL via Supabase.

## Architecture & Code Standards
- Adhere to the Presentational / Container component pattern.
- Single Source of Truth for State: Supabase is the primary backend. Mock files (e.g., `mockCatalog.js`, `repartidor.json`) are strictly fallback mechanisms enabled only when `useMock === true`.
- Do not add direct Supabase calls or asynchronous network requests inside presentational components. Encapsulate all database mutations, queries, and Realtime listeners in dedicated hooks (`use*.js`) or services (`*.service.js`).
- WebSockets: Whenever subscribing to Supabase Realtime channels (`supabase.channel(...)`), strictly implement canal cleanup inside the `useEffect` cleanup return (`supabase.removeChannel(channel)`).
- Always verify active variants using `(variant.stock > 0 && variant.is_active !== false)`.
- Reusable UI: strictly import base components from `src/components/ui/` (`Button`, `Card`, `Badge`, `Input`).

## Layout & Hierarchy Rules
- Modular Layout Integration: Do not duplicate top navigation headers, brand logos, or logout buttons inside feature views. Layout containers provide the global shell; feature views render only their domain content.
- Mobile Constraints: Mobile-focused operational dashboards must constrain root containers to `w-full max-w-md mx-auto px-4` to prevent horizontal viewport overflow.

## Styling & Design System
- Framework: Tailwind CSS v3 strictly adhering to `tailwind.config.js`.
- Use designated tokens: `bg-surface-card`, `bg-surface-subtle`, `border-border`, `text-brand-primary`, `text-brand-secondary`, `bg-accent`.
- Micro-borders: enforce 1px clean borders (`border border-border`). Avoid heavy shadows.
- Avoid full-viewport chromatic tinting (e.g., full green/amber backgrounds); keep interfaces on neutral B2B surfaces (`bg-surface-subtle`) and restrict status colors to badges, accents, and pulsing indicators.
- Typography: monospaced formatting (`font-mono`) for SKUs, prices (in `S/`), metrics, and dimensions.