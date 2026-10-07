# ERXIDI Engineering & Architecture Guidelines

## Execution Constraints (Strict)
- PROHIBITED: Do not run build commands (`npm run build`, `npm.cmd run build`) or test suites in the terminal. The developer validates compilation locally.
- Keep tool executions minimal. Do not inspect unnecessary files.
- Deliver code directly into the specified file paths.
- Responses must be concise: generate the code and provide a single-line confirmation without conversational fluff or lengthy summaries.

## Architecture & Code Standards
- Adhere to the Presentational / Container component pattern.
- Consume data strictly from the contracts defined in `src/features/catalog/data/mockCatalog.js`.
- Do not add direct Supabase calls or asynchronous network requests inside presentational components.
- Always verify active variants using `(variant.stock > 0 && variant.is_active !== false)`.
- Reusable UI: strictly import base components from `src/components/ui/` (`Button`, `Card`, `Badge`, `Input`).

## Styling & Design System
- Framework: Tailwind CSS v3 strictly adhering to `tailwind.config.js`.
- Use designated tokens: `bg-surface-card`, `bg-surface-subtle`, `border-border`, `text-brand-primary`, `text-brand-secondary`, `bg-accent`.
- Micro-borders: enforce 1px clean borders (`border border-border`). Avoid heavy shadows.
- Typography: monospaced formatting (`font-mono`) for SKUs, prices (in `S/`), and dimensions.