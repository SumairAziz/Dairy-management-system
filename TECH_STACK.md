# TerraDairy — Technology Stack

> **Purpose:** A complete, evidence-based inventory of technologies used in the TerraDairy Smart Dairy Farm Management System.  
> **Last verified against:** `package.json`, `prisma/schema.prisma`, application source, API routes, tests, and configuration files in this repository.

---

## 1. Frontend

### Core framework

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **Next.js** | 15.0.3 | App Router, SSR/SSG, API routes, middleware, routing | `app/`, `middleware.ts`, `next.config.js` |
| **React** | 19.0.0 | UI rendering | All `*.tsx` pages and components |
| **React DOM** | 19.0.0 | Browser rendering | `app/layout.tsx`, client components |
| **TypeScript** | 5.6.3 | Static typing across frontend and backend | `tsconfig.json`, all `.ts`/`.tsx` files |

Next.js App Router pages live under `app/` (e.g. `app/animals/list/page.tsx`, `app/inventory/dashboard/page.tsx`, `app/messages/page.tsx`, `app/animals/assistant/page.tsx`).

### UI & styling

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **Tailwind CSS** | 3.4.15 | Utility-first styling | `tailwind.config.ts`, `app/globals.css`, component class names |
| **PostCSS** | 8.4.49 | CSS processing pipeline | `postcss.config.js` |
| **Autoprefixer** | 10.4.20 | Vendor prefixes for CSS | `postcss.config.js` |
| **tw-animate-css** | 1.4.0 | Animation utility classes | `@import "tw-animate-css"` in `app/globals.css` |
| **clsx** | 2.1.1 | Conditional class names | `lib/utils.ts` (`cn()` helper) |
| **tailwind-merge** | 3.6.0 | Merge Tailwind classes without conflicts | `lib/utils.ts` (`cn()` helper) |
| **Geist (Google Font)** | via `next/font` | Primary UI typeface | `app/layout.tsx` |
| **Custom theme tokens** | — | Brand colors, dark/light CSS variables, chart palettes | `tailwind.config.ts`, `lib/theme.ts`, `app/context/theme-context.tsx` |

TerraDairy uses a **custom design system** (surface cards, badges, stat cards) rather than a full third-party component library. Most pages use shared components in `app/components/` (e.g. `navbar`, `modal`, `stat-card`, `custom-charts`).

### Component / UI primitives

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **Radix UI** (`radix-ui`) | 1.6.0 | Accessible headless primitives (Dialog, Popover, Slot) | `components/ui/dialog.tsx`, `popover.tsx`, `button.tsx` |
| **cmdk** | 1.1.1 | Command palette / searchable list primitive | `components/ui/command.tsx` |
| **class-variance-authority (CVA)** | 0.7.1 | Variant-based component styling | `components/ui/button.tsx`, `input-group.tsx` |

These follow **shadcn-style patterns** (component files under `components/ui/` and `app/components/ui/`), but the **`shadcn` npm package is not imported in application source code**.

### Icons

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **Lucide React** | 0.460.0 | Icon set across navigation, dashboards, forms, tables | Most pages under `app/`, e.g. `AnimalsDashboard.tsx`, `milk-production/page.tsx` |

### State management & data fetching

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **TanStack React Query** | 5.101.1 | Server-state caching, mutations, invalidation | `lib/query-provider.tsx`, all `hooks/use-*.ts` files |
| **Custom fetch client** | — | Typed REST calls to `/api/*` | `lib/api-client.ts` |
| **URL filter state** | — | Persist list filters in query strings | `hooks/use-url-filters.ts`, animals/milk/inventory list pages |

There is **no Redux, Zustand, or Jotai** in dependencies. Local UI state uses React `useState`/`useMemo` in page components.

### Forms & validation

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **Zod** | 4.4.3 | Request/query/body validation (client + server) | `validators/*.ts`, API routes, login/register forms |
| **Native HTML forms + controlled inputs** | — | User input on CRUD pages | e.g. `app/animals/list/page.tsx`, `app/login/page.tsx` |

There is **no React Hook Form** in dependencies.

### Charts & visualization (frontend)

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **Custom SVG charts** | — | Pie, bar, line, horizontal bar, metric cards for dashboards | `app/components/custom-charts.tsx` — used on animals dashboard, farm/unit pages |
| **Recharts** | 3.10.1 | Chart rendering inside AI assistant responses | `components/assistant/ChartRenderer.tsx` |
| **HTML tables** | — | Primary data grids on list pages | e.g. animals list, milk production, inventory transactions |

### Other frontend libraries

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **react-markdown** | 10.1.0 | Render AI assistant markdown replies | `components/assistant/MarkdownMessage.tsx` |
| **remark-gfm** | 4.0.1 | GitHub-flavored markdown (tables, task lists) for assistant | `components/assistant/MarkdownMessage.tsx` |
| **NextAuth React session** | via `next-auth` | Client session provider | `lib/auth-provider.tsx`, `hooks/use-auth.ts` |

---

## 2. Backend

### Server architecture

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **Next.js App Router API Routes** | 15.0.3 | REST-style HTTP handlers | `app/api/**/route.ts` (~70 route files) |
| **Next.js Middleware** | 15.0.3 | Auth gate + route-level RBAC for pages | `middleware.ts` |
| **Service layer** | — | Business logic separated from routes | `services/*.service.ts` |
| **Validator layer** | — | Zod schemas for inputs | `validators/*.ts` |

**Server Actions:** Not used. A codebase search found no `"use server"` directives.

### API surface (representative modules)

| Module | Route prefix | Service(s) |
|---|---|---|
| Animals | `/api/animals` | `animal.service.ts`, `animal-stats.service.ts`, `lactation.service.ts` |
| Milk | `/api/milk-logs` | `milk.service.ts` |
| Breeding / pregnancy / calving / heat | `/api/breeding-records`, `/api/pregnancy-records`, `/api/calving`, `/api/heat-cycles` | Matching `*.service.ts` files |
| Inventory | `/api/inventory` | `inventory.service.ts`, `inventory-stats.service.ts` |
| Chat / messages | `/api/chat` | `chat.service.ts` |
| AI assistant | `/api/assistant/chat` | `lib/ai/orchestrator.ts` |
| Dashboard | `/api/dashboard` | `dashboard.service.ts` |
| Export | `/api/export/[resource]` | `lib/export/service.ts` |
| Auth / users / roles | `/api/auth`, `/api/users`, `/api/roles` | `auth.service.ts`, `user.service.ts`, `role-permission.service.ts` |

### Authentication

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **NextAuth.js** | 4.24.14 | Session-based authentication | `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts` |
| **Credentials provider** | — | Email/password login against `users` table | `lib/auth.ts` |
| **JWT sessions** | — | Stateless session tokens | `session: { strategy: "jwt" }` in `lib/auth.ts` |
| **bcryptjs** | 3.0.3 | Password hashing and verification | `lib/auth.ts`, `services/auth.service.ts`, registration |

### Authorization / roles

| Technology | Purpose | Where used |
|---|---|---|
| **Custom RBAC** | Role + permission keys, route access matrix | `lib/rbac/permissions.ts`, `lib/rbac/permission-resolver.ts` |
| **`requirePermission()`** | API-level module/action checks | `lib/api-auth.ts`, all protected API routes |
| **Middleware route checks** | Page-level access by role/permissions | `middleware.ts` |
| **`role_permissions` table** | DB-backed permission grants | `prisma/schema.prisma`, `services/role-permission.service.ts` |

Roles include `ADMIN`, `FARM_MANAGER`, `VETERINARIAN`, `INVENTORY_MANAGER`, `FARM_WORKER`, `VIEWER` (see `types/index.ts`).

### Validation & errors

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **Zod** | 4.4.3 | Parse and validate API inputs | `validators/`, route handlers |
| **Custom error types** | — | `NotFoundError`, `ValidationError`, `ForbiddenError`, etc. | `lib/errors.ts`, `lib/api-response.ts` |

### Background processing

No dedicated job queue (Bull, Inngest, etc.) is present. Long-running work is handled **inline in API requests** or via **CLI seed/sync scripts** (`prisma/*.ts`, `npm run db:*`).

Side effects (notifications, pregnancy workflow vaccinations, audit logs) run synchronously inside services.

### Other backend utilities

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **dotenv** | 17.4.2 | Load environment variables | `prisma.config.ts`, scripts |
| **Node.js built-ins** | — | `fs`, `child_process`, streams | chat media processing, export |

---

## 3. Database

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **PostgreSQL** | (external) | Primary relational database | `DATABASE_URL` in env; all Prisma models |
| **Prisma ORM** | 7.8.0 | Schema, client, queries, migrations workflow | `prisma/schema.prisma`, `services/`, `lib/db.ts` |
| **@prisma/client** | 7.8.0 | Generated type-safe DB client | Imported via `lib/db.ts` |
| **@prisma/adapter-pg** | 7.8.0 | Prisma driver adapter for PostgreSQL | `lib/db.ts` |
| **pg** | 8.22.0 | PostgreSQL driver used by Prisma adapter | `@prisma/adapter-pg` |

### pgvector / embeddings

**Not used.** No `pgvector` extension, embedding columns, or vector search queries were found in schema or source code.

### Schema approach

- **Single Prisma schema** with ~25 models including `animals`, `milk_logs`, `lactation_periods`, `inventory_*`, `chat_*`, `users`, `role_permissions`, etc.
- **Relational includes/selects** in services; some milk aggregation uses **`$queryRaw`** for grouped daily register queries (`services/milk.service.ts`).
- **Denormalized status fields** on `animals` (e.g. `pregnancy_status`, `lactation_status`) updated by workflow services, with live pregnancy checks via `pregnancy_records` joins where needed.

### Migrations & seeding

| Tool / script | Purpose |
|---|---|
| `prisma db push` (`npm run db:push`) | Sync schema to database (dev workflow) |
| `prisma db pull` (`npm run db:pull`) | Introspect existing DB |
| `prisma generate` (`postinstall`, `npm run build`) | Generate Prisma Client |
| `prisma/seed.ts` (`npm run db:seed`) | Main demo data |
| `prisma/seed-inventory.ts`, `seed-rbac.ts`, `seed-role-permissions.ts` | Module-specific seeds |
| `prisma/sync-animal-dates.ts`, `normalize-units-data.ts` | Data normalization/maintenance scripts |
| `sql_queries.sql` (`npm run db:init`) | Optional raw SQL initialization |

**Source locations:** `prisma/schema.prisma`, `lib/db.ts`, `prisma.config.ts`, all `services/*.ts`.

---

## 4. AI / Machine Learning

TerraDairy includes a **read-only AI Farm Assistant** that answers herd questions using farm data, optional web grounding, and structured tool calls.

### What is NOT used

- **pgvector / embeddings / RAG over a local knowledge base** — not implemented
- **Dedicated veterinary knowledge base database** — not implemented; veterinary reference comes from **web grounding prompts**, not stored vectors
- **Fine-tuned ML models** — not present

### AI components (actually used)

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **OpenAI SDK** | 7.4.0 | Primary LLM provider (default) for tool-calling chat loop | `lib/ai/providers/openai.provider.ts` |
| **Google Generative AI SDK** | 0.24.1 | Alternate LLM provider; also used for Gemini REST web grounding | `lib/ai/providers/gemini.provider.ts`, `lib/ai/web-search.ts` |
| **AI provider abstraction** | — | Vendor-neutral `AiProvider` interface | `lib/ai/types.ts`, `lib/ai/providers/index.ts` |
| **Tool registry** | — | Domain tools (animals, milk, inventory, reports, …) | `lib/ai/tools/registry.ts`, `lib/ai/tools/*.tools.ts` |
| **Orchestrator** | — | Multi-step tool loop + response assembly | `lib/ai/orchestrator.ts` |
| **Source router** | — | Classifies questions as `DATABASE`, `WEB`, or `COMBINED` before any external call | `lib/ai/source-router.ts` |
| **Web grounding (Google Search via Gemini REST)** | — | External veterinary/dairy guidance for WEB/COMBINED routes | `lib/ai/web-search.ts` |
| **System / routing prompts** | — | Instructions for DB-only vs web vs combined answers | `lib/ai/prompts/system-prompt.ts`, `source-routing-prompt.ts` |
| **AI security layer** | — | Message sanitization, history caps, tool execution guardrails | `lib/ai/security.ts` |
| **Structured report builders** | — | Server-side analytic summaries for assistant tools | `lib/ai/reports/*.report.ts` |
| **Chart blocks in AI replies** | — | JSON chart specs rendered with Recharts | `lib/ai/charts/builders.ts`, `components/assistant/ChartRenderer.tsx` |
| **Gemini retry / model fallback** | — | Resilience for rate limits and model availability | `lib/ai/gemini-retry.ts`, `lib/ai/gemini-config.ts` |

### Environment-driven AI configuration

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | `openai` (default) or `gemini` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI chat provider |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK` | Gemini provider / web grounding |
| `GEMINI_RETRY_MAX`, `GEMINI_RETRY_BASE_MS` | Retry tuning |

**API entry point:** `POST /api/assistant/chat` → `runAssistant()` in `lib/ai/orchestrator.ts`.

---

## 5. Authentication & Security

| Area | Implementation | Location |
|---|---|---|
| Login / session | NextAuth credentials + JWT | `lib/auth.ts`, `app/login/page.tsx` |
| Registration | API route + bcrypt hash | `app/api/auth/register/route.ts`, `services/auth.service.ts` |
| Password change | Authenticated API | `app/api/auth/change-password/route.ts` |
| API auth | `requireAuth()`, `requirePermission()` | `lib/api-auth.ts` |
| Page protection | Middleware JWT check | `middleware.ts` |
| RBAC | Role normalization + permission keys + DB grants | `lib/rbac/*`, `services/role-permission.service.ts` |
| Audit trail | `audit_logs` table + service | `services/audit.service.ts`, `app/api/audit-logs/route.ts` |
| AI input hardening | Sanitize user messages, cap history/tool iterations | `lib/ai/security.ts` |

### Environment variables (secrets — names only)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret |
| `NEXTAUTH_URL` | Canonical app URL for auth callbacks |
| `OPENAI_API_KEY` | OpenAI API access (optional if using Gemini only) |
| `GEMINI_API_KEY` | Gemini API access (required for web grounding; optional for Gemini chat provider) |

Do not commit real values for these variables.

---

## 6. Files / Documents

| Technology | Version | Purpose | Where used |
|---|---|---|---|
| **SheetJS (xlsx)** | 0.18.5 | Excel (`.xlsx`) export generation | `lib/export/workbook.ts`, `lib/export/formatting.ts` |
| **jsPDF** | 4.2.1 | PDF export of assistant chat transcripts | `lib/assistant/chat-pdf.ts` |
| **Sharp** | 0.35.4 | Image resize/compress/thumbnail for chat attachments | `lib/chat/media-processor.ts` |
| **ffmpeg-static** | 5.3.0 | Bundled ffmpeg binary for video processing | `lib/chat/media-processor.ts` |
| **ffprobe-static** | 3.1.0 | Video metadata probing | `lib/chat/media-processor.ts` |
| **fluent-ffmpeg** | 2.1.3 | FFmpeg CLI wrapper | `lib/chat/media-processor.ts` |
| **Local filesystem storage** | — | Chat attachment files on disk | `lib/chat/storage.ts` |

### Formats supported

| Format | Support |
|---|---|
| **Excel (.xlsx)** | ✅ Export via `/api/export/[resource]` and `UniversalExportButton` |
| **PDF** | ✅ Assistant chat PDF download |
| **CSV** | ❌ No dedicated CSV export library or routes found |
| **Word (.doc/.docx)** | ⚠️ Accepted as **chat upload** MIME types only; not generated by the app |
| **Images / video** | ✅ Chat uploads with Sharp/ffmpeg processing |

---

## 7. Data Visualization & Reporting

| Technology | Purpose | Where used |
|---|---|---|
| **Custom SVG charts** | Herd dashboards (stage/breed/farm distributions) | `app/components/custom-charts.tsx`, `AnimalsDashboard.tsx` |
| **Recharts** | AI-generated chart blocks in assistant UI | `components/assistant/ChartRenderer.tsx` |
| **Stat cards / metric cards** | KPI tiles on dashboards and detail pages | `app/components/stat-card.tsx`, `custom-charts.tsx` |
| **Universal export** | Filtered Excel downloads per module | `components/export/UniversalExportButton.tsx`, `lib/export/registry.ts` |
| **AI report tools** | Structured summaries (health, breeding, pregnancy, farm comparison) | `lib/ai/reports/*.report.ts`, `lib/ai/tools/reports.tools.ts` |

Export resources configured in `lib/export/registry.ts` include at least: **animals, milk, vaccinations, breeding, pregnancy, calving, inventory**, and related modules.

---

## 8. Testing

| Technology | Version | Purpose |
|---|---|---|
| **Vitest** | 4.1.9 | Unit/integration tests for lib, services, validators, AI |
| **@vitejs/plugin-react** | 6.0.3 | Vitest React plugin (configured; most tests run in `node` env) |
| **Playwright** | 1.61.1 | End-to-end browser tests |
| **jsdom** | 29.1.1 | Listed in devDependencies; **not imported in test files found** |

### Test layout

| Directory | Count | What it tests |
|---|---|---|
| `__tests__/lib/` | Core utilities, RBAC, export, AI orchestration/tools, assistant helpers | Business rules, AI routing, serialization |
| `__tests__/services/` | Service-layer tests | Inventory, group treatment, audit, role permissions |
| `__tests__/validators/` | Zod schema tests | Auth, animals, reproduction, inventory, chat |
| `__tests__/components/` | Component logic tests | Assistant error formatting |
| `e2e/` | 3 spec files | Auth guards, dashboard, workflows (`auth.spec.ts`, `dashboard.spec.ts`, `workflows.spec.ts`) |

**Commands:** `npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run test:e2e`.

**Config:** `vitest.config.ts`, `playwright.config.ts`, `__tests__/setup.ts`.

---

## 9. Development Tools

| Technology | Version | Purpose |
|---|---|---|
| **npm** | (package manager) | Dependencies, scripts in `package.json` |
| **TypeScript** | 5.6.3 | Type checking (`strict: true`) |
| **tsx** | 4.23.0 | Run TypeScript seed/sync scripts |
| **Prisma CLI** | 7.8.0 | `db push`, `generate`, schema management |
| **Next.js CLI** | 15.0.3 | `next dev`, `next build`, `next start` |
| **Git** | — | Version control (`.git/` present in project) |

**Not found:** ESLint config files, Prettier config, or Husky hooks in the repository root.

---

## 10. External APIs & Services

| Service / API | Required? | Purpose | Where used |
|---|---|---|---|
| **PostgreSQL** | ✅ Required | Primary application database | Prisma via `DATABASE_URL` |
| **OpenAI API** | Optional* | Default LLM for assistant tool-calling | `lib/ai/providers/openai.provider.ts` |
| **Google Gemini API** | Optional* | Alternate LLM provider + **Google Search grounding** for WEB/COMBINED assistant routes | `gemini.provider.ts`, `web-search.ts` |
| **Google Search (via Gemini grounding tool)** | Optional | External veterinary/dairy reference answers | `lib/ai/web-search.ts` |

\*At least **one** LLM provider key is needed for the AI assistant to function. Web grounding specifically requires **`GEMINI_API_KEY`**.

No Stripe, SendGrid, AWS S3, Firebase, or other third-party SaaS integrations were found in source code.

---

## 11. Architecture

### Core application flow

```
User (Browser)
      ↓
Next.js App Router (React 19 pages)
      ↓
Shared UI (Tailwind, custom components, React Query hooks)
      ↓
fetch → /api/* route handlers
      ↓
Zod validators + requirePermission (RBAC)
      ↓
Service layer (business rules)
      ↓
Prisma Client (@prisma/adapter-pg → pg)
      ↓
PostgreSQL (TerraDairy data)
```

### Authentication flow

```
Login form
      ↓
NextAuth Credentials Provider
      ↓
bcrypt.compare → users table
      ↓
JWT session (role + permissions)
      ↓
middleware.ts (pages) / requirePermission (API)
```

### AI assistant flow

```
User question (Assistant UI)
      ↓
POST /api/assistant/chat
      ↓
Source router (DATABASE | WEB | COMBINED)
      ↓
┌─────────────────────┬──────────────────────────┐
│ DATABASE / COMBINED │ WEB / COMBINED (phase 2) │
│ OpenAI or Gemini    │ Gemini + Google Search     │
│ + TerraDairy tools  │ web grounding              │
│ (Prisma queries)    │ (external vet guidance)    │
└─────────────────────┴──────────────────────────┘
      ↓
Orchestrator merges tool results + optional web context
      ↓
Markdown (+ optional Recharts blocks) → UI
```

### Real-time messaging flow

```
Messages UI
      ↓
REST: /api/chat/conversations, /messages, /attachments
      ↓
SSE: /api/chat/events (presence + heartbeat)
      ↓
chat.service.ts + lib/chat/event-bus.ts
      ↓
PostgreSQL chat_* tables + local file storage
```

---

## 12. Feature → Technology Mapping

| TerraDairy Feature | Technologies Used | Purpose |
|---|---|---|
| **Animal Management** | Next.js, React Query, Prisma, Zod, custom badges/charts | CRUD, filtering, production status (lactating/dry), detail tabs |
| **Milk Production** | Prisma raw SQL + services, React Query, custom tables, export (xlsx) | Daily register, stats, lactating-only entry rules |
| **Inventory** | Prisma (`inventory_*`), FEFO lot logic, services, React pages | Stock in/out, transactions, adjustments, low-stock/expiring views |
| **Vaccinations** | Prisma, services, group treatment + inventory deduction | Individual/group vaccination records, stats, workflows |
| **Breeding** | Prisma, breeding service/workflow, notifications | Breeding records, semen batch tracking (string field) |
| **Pregnancy** | Prisma, pregnancy service/workflow, vaccination auto-reminders | Pregnancy tracking, EDD, dry-off milestone scheduling |
| **Heat Cycles** | Prisma, heat-cycle service, status helpers | Heat detection and breeding window tracking |
| **Calving** | Prisma, calving service, lactation service | Calving events, auto-update mother lactation state |
| **Dry / Lactation Lifecycle** | `lactation_periods` table, `lib/production-status.ts`, lactation API | Explicit dry periods, filters, mark dry/lactating actions |
| **Farms & Units** | Prisma, farm/unit services, dashboard aggregations | Multi-farm hierarchy, capacity, daily milk by unit |
| **Species & Breeds** | Prisma reference data | Breed/species master data |
| **Health Incidents** | Prisma, health service | Per-animal health history on detail page |
| **Growth Logs** | Prisma, growth service | Weight tracking over time |
| **Dashboard** | dashboard.service, custom SVG charts, React Query | Herd KPIs, milk trends, distributions |
| **Messages (Chat)** | Prisma chat models, SSE, Sharp, ffmpeg, local storage | Staff messaging with attachments |
| **Notifications** | Prisma notifications, services | In-app alerts (calving, workflows, etc.) |
| **AI Assistant** | OpenAI/Gemini, tool registry, source router, web grounding, react-markdown, Recharts | Natural-language Q&A over farm data + vet reference |
| **Reports / Export** | xlsx, export registry/service, AI report tools | Filtered Excel downloads and assistant-driven summaries |
| **Authentication** | NextAuth, bcryptjs, JWT | Login, registration, sessions |
| **Authorization (RBAC)** | role_permissions, middleware, requirePermission | Role-based page and API access |
| **User / Role Admin** | user.service, role-permission.service, settings pages | User management, permission matrix |
| **Audit Logs** | audit.service, audit_logs table | Change tracking for sensitive operations |

---

## 13. Dependency Summary

| Technology | Version | Category | Purpose |
|---|---|---|---|
| next | 15.0.3 | Framework | Full-stack React framework |
| react | 19.0.0 | Frontend | UI library |
| react-dom | 19.0.0 | Frontend | DOM rendering |
| typescript | 5.6.3 | Dev tool | Static typing |
| tailwindcss | 3.4.15 | Frontend | CSS utilities |
| @tanstack/react-query | 5.101.1 | Frontend | Server-state / data fetching |
| next-auth | 4.24.14 | Auth | Authentication & sessions |
| bcryptjs | 3.0.3 | Security | Password hashing |
| zod | 4.4.3 | Validation | Schema validation |
| prisma | 7.8.0 | Database | ORM CLI |
| @prisma/client | 7.8.0 | Database | DB client |
| @prisma/adapter-pg | 7.8.0 | Database | PostgreSQL adapter |
| pg | 8.22.0 | Database | PostgreSQL driver |
| openai | 7.4.0 | AI | OpenAI chat provider |
| @google/generative-ai | 0.24.1 | AI | Gemini SDK |
| recharts | 3.10.1 | Visualization | AI chart rendering |
| lucide-react | 0.460.0 | Frontend | Icons |
| xlsx | 0.18.5 | Files | Excel export |
| jspdf | 4.2.1 | Files | PDF export |
| sharp | 0.35.4 | Files | Image processing |
| ffmpeg-static | 5.3.0 | Files | Video transcoding binary |
| ffprobe-static | 3.1.0 | Files | Video metadata |
| fluent-ffmpeg | 2.1.3 | Files | FFmpeg wrapper |
| react-markdown | 10.1.0 | Frontend | AI markdown rendering |
| remark-gfm | 4.0.1 | Frontend | GFM markdown support |
| radix-ui | 1.6.0 | UI | Accessible primitives |
| cmdk | 1.1.1 | UI | Command palette primitive |
| class-variance-authority | 0.7.1 | UI | Component variants |
| clsx | 2.1.1 | UI | Class name helper |
| tailwind-merge | 3.6.0 | UI | Tailwind class merging |
| tw-animate-css | 1.4.0 | UI | CSS animations |
| dotenv | 17.4.2 | Backend | Env loading |
| vitest | 4.1.9 | Testing | Unit tests |
| @playwright/test | 1.61.1 | Testing | E2E tests |
| tsx | 4.23.0 | Dev tool | TS script runner |
| shadcn | 4.11.0 | Dev/UI tooling | Present in dependencies; **not imported in app source** |
| react-is | 19.2.8 | Frontend | Likely transitive/support; **no direct imports found** |
| jsdom | 29.1.1 | Testing | Dev dependency; **not used in test files found** |

---

## 14. Current Project Status

### Currently Used

Technologies with clear evidence in running application code:

- Next.js 15 App Router, React 19, TypeScript
- Tailwind CSS + custom TerraDairy UI components
- TanStack React Query + custom `ApiClient`
- NextAuth (credentials/JWT) + bcryptjs + custom RBAC
- PostgreSQL + Prisma 7 + `@prisma/adapter-pg`
- Zod validation across API and forms
- OpenAI and/or Google Gemini for AI assistant
- Gemini Google Search grounding for external veterinary reference
- AI tool registry, orchestrator, source router
- xlsx exports, jsPDF chat export
- Sharp + ffmpeg for chat media
- Lucide icons, react-markdown + remark-gfm
- Recharts (assistant charts only)
- Radix UI + cmdk + CVA (select UI primitives)
- Vitest (48 unit test files) + Playwright (3 E2E specs)

### Installed but Not Clearly Used

Dependencies present in `package.json` without direct application imports found:

| Package | Notes |
|---|---|
| **shadcn** (^4.11.0) | No `from "shadcn"` imports; UI follows shadcn-style copied components instead |
| **react-is** (^19.2.8) | No direct imports; may satisfy Recharts peer/transitive needs |
| **jsdom** (^29.1.1) | Dev dependency; Vitest uses `environment: "node"`, no jsdom imports in tests |

### Configuration / Planned

| Item | Status |
|---|---|
| **ESLint / Prettier** | Not configured in repo root |
| **pgvector / RAG / embeddings** | Not in schema or code |
| **Dedicated veterinary knowledge base** | Not implemented; web grounding used instead |
| **CSV export** | Not implemented |
| **Server Actions** | Not used |
| **Background job queue** | Not implemented |
| **Cloud object storage (S3, etc.)** | Chat files stored locally via `lib/chat/storage.ts` |

---

## 15. Source Locations (Quick Reference)

| Technology / area | Key paths |
|---|---|
| **Prisma schema** | `prisma/schema.prisma` |
| **DB client** | `lib/db.ts` |
| **API routes** | `app/api/**/route.ts` |
| **Business logic** | `services/*.service.ts` |
| **Validation** | `validators/*.ts` |
| **Frontend hooks** | `hooks/use-*.ts`, `hooks/index.ts` |
| **Auth** | `lib/auth.ts`, `middleware.ts`, `lib/api-auth.ts` |
| **RBAC** | `lib/rbac/permissions.ts`, `lib/rbac/permission-resolver.ts` |
| **AI assistant** | `lib/ai/`, `app/api/assistant/chat/route.ts`, `app/animals/assistant/page.tsx` |
| **Export** | `lib/export/`, `app/api/export/[resource]/route.ts` |
| **Chat / messages** | `services/chat.service.ts`, `lib/chat/`, `app/messages/page.tsx` |
| **Production status (dry/lactating)** | `lib/production-status.ts`, `services/lactation.service.ts` |
| **Tests** | `__tests__/`, `e2e/` |
| **Seeds / DB scripts** | `prisma/seed.ts`, `prisma/*.ts`, `package.json` scripts |
| **Theme / charts** | `lib/theme.ts`, `app/components/custom-charts.tsx` |

---

## Notes for Developers

1. After **`prisma generate`** or schema changes, **restart `npm run dev`** — Prisma Client is cached in `globalThis` during development (`lib/db.ts`).
2. Set **`NEXTAUTH_URL`** to the port your dev server actually uses (typically `http://localhost:3000`).
3. The AI assistant requires configured **`OPENAI_API_KEY`** and/or **`GEMINI_API_KEY`** depending on `AI_PROVIDER`; web grounding requires Gemini.
4. This document reflects the codebase as inspected; re-verify after major dependency or architecture changes.
