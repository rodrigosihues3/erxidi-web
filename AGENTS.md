ERXIDI Engineering & Architecture Guidelines

Execution & Terminal Constraints (Strict)

ENVIRONMENT: Run all terminal operations under standard Windows Command Prompt (cmd.exe). Never use Bash-specific syntax, subshells, or interactive commands that block the terminal.

SKILLS IN EFFECT: Strictly adhere to frontend-design and vercel-composition-patterns. Apply composition over prop-drilling and maintain clean component boundaries.

PROHIBITED: Do not run build commands (npm run build, npm.cmd run build) or test suites in the terminal. The developer validates compilation locally.

ZERO FLUFF: Generate or edit code directly in the target files. Respond strictly with the modified code blocks, unified diffs, or a one-line operational confirmation. Introductory pleasantries, commentary, and concluding summaries are strictly forbidden.

ICONS & VISUAL TOKENS: Strictly import and use native SVG icons from lucide-react. The use of decorative emojis (e.g., 📦, ⚡, 📅, ★) in badges, buttons, headers, or text labels is strictly PROHIBITED.

Database & Schema Authority (Strict)

SINGLE SOURCE OF TRUTH: All database queries, schema inspections, column references, and foreign keys must be validated strictly against supabase_schema.sql located at the project root.

PROHIBITED: Hallucinating or inventing column names, relationships, or tables that do not exist in supabase_schema.sql.

PROHIBITED: Storing business state, audit trails, operational metrics, or incidents in localStorage or sessionStorage. All business mutations must persist in PostgreSQL via Supabase.

Always verify active variants using (variant.stock > 0 && variant.is_active !== false).

Architecture & Code Standards

Adhere to the Presentational / Container component pattern.

Single Source of Truth for State: Supabase is the primary backend. Mock files (e.g., mockCatalog.js) are strictly fallback mechanisms enabled only when useMock === true.

Do not add direct Supabase calls or asynchronous network requests inside presentational components. Encapsulate all database mutations, queries, and Realtime listeners in dedicated hooks (use*.js) or services (*.service.js).

WebSockets: Whenever subscribing to Supabase Realtime channels (supabase.channel(...)), strictly implement channel cleanup inside the useEffect cleanup return (supabase.removeChannel(channel)).

Reusable UI: Strictly import base components from src/components/ui/ (Button, Card, Badge, Input).

Layout & Hierarchy Rules

Modular Layout Integration: Do not duplicate top navigation headers, brand logos, or logout buttons inside feature views. Layout containers provide the global shell; feature views render only their domain content.

Product Photography Standard: All product media containers must respect the 4:5 vertical e-commerce ratio (aspect-[4/5]) with object-contain over neutral surfaces (bg-slate-50) to preserve garment silhouette integrity without optical stretching or cropping.

Mobile Constraints: Mobile-focused operational dashboards must constrain root containers to w-full max-w-md mx-auto px-4 to prevent horizontal viewport overflow.

Styling & Design System

Framework: Tailwind CSS v3 strictly adhering to tailwind.config.js.

Use designated tokens: bg-surface-card, bg-surface-subtle, border-border, text-brand-primary, text-brand-secondary, bg-accent.

Micro-borders: Enforce 1px clean borders (border border-border). Avoid heavy shadows; prefer subtle elevation tokens.

Avoid full-viewport chromatic tinting (e.g., full green/amber backgrounds); keep interfaces on neutral B2B surfaces (bg-surface-subtle) and restrict status colors to badges, accents, and pulsing indicators.

Typography: Monospaced formatting (font-mono) for SKUs, prices (in S/), metrics, transaction codes, and dimensions.