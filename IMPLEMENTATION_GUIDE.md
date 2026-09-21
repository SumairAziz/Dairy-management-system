# TerraDairy Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Authentication & Authorization](#authentication--authorization)
5. [API Conventions](#api-conventions)
6. [Frontend Conventions](#frontend-conventions)
7. [Database Schema](#database-schema)
8. [Service Layer](#service-layer)
9. [Validation Layer](#validation-layer)
10. [Testing](#testing)
11. [Known Issues & Future Improvements](#known-issues--future-improvements)

---

## Overview

TerraDairy is a full-stack smart dairy farm management system built for managing every aspect of modern dairy operations — from animal registration and lineage tracking to milk production analytics, health incident management, vaccination scheduling, breeding programs, heat cycle monitoring, and pregnancy tracking. The system is designed as a multi-tenant, role-based platform where farm administrators, managers, veterinarians, field workers, and read-only viewers each interact with a tailored subset of functionality.

The application is built on **Next.js 15.0.3** using the App Router architecture with React 19 RC, TypeScript 5.6, and Tailwind CSS 3.4 for styling. Data is persisted in **PostgreSQL** via **Prisma 7.8** (using the `@prisma/adapter-pg` driver adapter for direct pg connections). Authentication is handled by **NextAuth v4** with a JWT-based session strategy. The frontend uses **TanStack React Query v5** for all data fetching, caching, and mutation management, with **Zod v4** providing end-to-end type-safe validation on both server and client. The UI is composed using **shadcn/ui** base components alongside custom shared components for modals, forms, and navigation.

The system encompasses 15 Prisma models covering users, audit logs, notifications, animals, breeds, species, farms, units, growth logs, health incidents, milk logs, vaccination records, breeding records, heat cycle records, pregnancy records, and treatment records. There are 15 API route groups with approximately 55 HTTP handlers, 13 frontend pages, 15 hook files containing approximately 55 React Query hooks, 18+ service files, and 17+ validator files. The test suite includes 197 Vitest unit tests and 2 Playwright E2E spec files covering authentication flows and route guard behavior.

---

## Architecture

TerraDairy follows a strict layered architecture that enforces separation of concerns across five distinct layers. Each layer has a single responsibility and communicates only with its adjacent layers, never skipping levels.

### Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                       │
│  React Pages → React Query Hooks → ApiClient (fetch)     │
└─────────────────────────┬───────────────────────────────┘
                          │  HTTP (JSON)
                          ▼
┌─────────────────────────────────────────────────────────┐
│               Next.js Middleware (middleware.ts)          │
│  JWT verification via getToken() → attach headers        │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               API Route Handlers (app/api/*/route.ts)     │
│  1. requirePermission(resource, action) → authenticated  │
│  2. resolveId(params) → unwrap async params              │
│  3. Zod schema.parse() / safeParse() → validated input   │
│  4. Service layer call (never direct Prisma)             │
│  5. auditLog() for mutation operations                   │
│  6. Response via successResponse / errorResponse helpers  │
│  7. handleApiError() catch-all error handler              │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Service Layer (services/*.ts)          │
│  Prisma queries wrapped in serialize()                   │
│  NotFoundError thrown for missing records                │
│  Pagination via skip/take with parallel count queries    │
│  Filtering via dynamic Prisma WhereInput construction    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Prisma Client + @prisma/adapter-pg          │
│  lib/db.ts — singleton PrismaClient with pg adapter      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      PostgreSQL                          │
│  15 tables with indexes, unique constraints, FKs         │
└─────────────────────────────────────────────────────────┘
```

### Request Lifecycle

A typical request follows this path:

1. **Browser** — A React Query hook (e.g., `useAnimals`) calls `api.get("/animals?page=1&pageSize=20")` on the `ApiClient` singleton.
2. **Middleware** — The Next.js middleware (`middleware.ts`) intercepts all requests except static assets and public paths (`/login`, `/register`, `/api/auth`). For API routes, it verifies the JWT via `getToken()` from `next-auth/jwt` and, if valid, attaches `x-user-id` and `x-user-role` headers to the forwarded request. For page routes, it redirects unauthenticated users to `/login` with a `callbackUrl` query parameter. Already-authenticated users visiting `/login` or `/register` are redirected to `/`.
3. **Route Handler** — The API route handler (e.g., `app/api/animals/route.ts`) executes the six-step pattern: permission check → ID resolution → validation → service call → audit log → response.
4. **Service Layer** — The service function (e.g., `animal.service.findAll()`) constructs a dynamic Prisma `WhereInput` from filter parameters, executes a parallel `findMany` + `count` query, wraps results in `serialize()` to convert `Decimal`/`BigInt` types to plain numbers, and returns the paginated result.
5. **Prisma** — The Prisma Client translates the query into SQL via the `@prisma/adapter-pg` driver adapter and sends it to PostgreSQL.
6. **PostgreSQL** — The database executes the query using available indexes (e.g., `idx_animals_farm_id`, `idx_animals_breed_id`) and returns the result set.
7. **Response** — The serialized data flows back through the layers. The route handler wraps it in `paginatedResponse()` which produces `{ success: true, data, total, page, pageSize }`. The `ApiClient` unwraps `json.data` on the client side. React Query caches the result and triggers a re-render.

### Error Handling Chain

Errors propagate upward through the layers and are caught by a single centralized handler. The `handleApiError()` function in `lib/errors.ts` handles four error categories in order:

1. **AppError subclasses** (custom) — `NotFoundError` (404), `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `ConflictError` (409) — each carries a `statusCode` and `code` that map directly to the JSON response.
2. **ZodError** — Parsed into a `VALIDATION_ERROR` response with per-field details array.
3. **Prisma.PrismaClientKnownRequestError** — `P2002` (unique constraint) becomes 409 CONFLICT; `P2025` (record not found) becomes 404 NOT_FOUND; all others become 500 DATABASE_ERROR.
4. **Unknown errors** — Logged to console and returned as 500 INTERNAL_ERROR.

---

## Project Structure

```
terradairy/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (QueryProvider, SessionProvider)
│   ├── page.tsx                  # Dashboard page
│   ├── globals.css               # Global styles + Tailwind directives
│   ├── login/page.tsx            # Login page
│   ├── register/page.tsx         # Registration page
│   ├── animals/
│   │   ├── page.tsx              # Animals list (filter + table + create modal)
│   │   └── [id]/
│   │       ├── page.tsx          # Animal detail (tabbed: profile, growth, health, milk, vaccination, breeding)
│   │       └── components/       # Tab components for animal detail
│   ├── farms/page.tsx            # Farms list
│   ├── units/page.tsx            # Units list
│   ├── species-breeds/page.tsx   # Combined species & breeds management
│   ├── milk-production/page.tsx  # Milk log entries with stats
│   ├── vaccinations/page.tsx     # Vaccination records
│   ├── breeding/page.tsx         # Breeding records
│   ├── heat-cycles/page.tsx      # Heat cycle records
│   ├── pregnancy/page.tsx        # Pregnancy records
│   ├── components/               # Shared application components
│   │   ├── modal.tsx             # Modal, Field, inputCls exports
│   │   ├── navbar.tsx            # Top navigation bar
│   │   ├── sidebar.tsx           # Side navigation with role-based links
│   │   ├── stat-card.tsx         # Dashboard stat card
│   │   ├── custom-charts.tsx     # Chart components (recharts)
│   │   ├── milk-metric-card.tsx  # Milk production metric card
│   │   ├── use-fetch.ts          # Legacy fetch hook (pre-ApiClient)
│   │   └── ui/                   # App-level shadcn-style UI components
│   │       ├── card.tsx, badge.tsx, input.tsx, button.tsx, table.tsx
│   ├── context/
│   │   └── theme-context.tsx     # Dark/light theme provider
│   └── api/                      # API route handlers
│       ├── auth/
│       │   ├── [...nextauth]/route.ts  # NextAuth handler
│       │   └── register/route.ts       # User registration
│       ├── animals/
│       │   ├── route.ts                # GET (list) + POST (create)
│       │   └── [id]/
│       │       ├── route.ts            # GET + PUT + DELETE
│       │       ├── growth-logs/route.ts
│       │       └── health-incidents/
│       │           ├── route.ts
│       │           └── [incidentId]/route.ts
│       ├── farms/route.ts + [id]/route.ts
│       ├── units/route.ts + [id]/route.ts
│       ├── species/route.ts + [id]/route.ts
│       ├── breeds/route.ts + [id]/route.ts
│       ├── milk-logs/route.ts + [id]/route.ts + stats/route.ts
│       ├── vaccinations/route.ts + [id]/route.ts
│       ├── breeding-records/route.ts + [id]/route.ts
│       ├── heat-cycles/route.ts + [id]/route.ts
│       ├── pregnancy-records/route.ts + [id]/route.ts
│       ├── notifications/route.ts + [id]/route.ts + unread-count/route.ts
│       ├── audit-logs/route.ts
│       └── dashboard/route.ts
│
├── lib/                          # Shared utility modules
│   ├── api-auth.ts               # requireAuth(), requirePermission(), resolveId()
│   ├── api-response.ts           # successResponse, errorResponse, paginatedResponse, createdResponse, noContentResponse
│   ├── api-client.ts             # Client-side ApiClient class (get/post/put/patch/del)
│   ├── auth.ts                   # NextAuth options (JWT strategy, credentials provider)
│   ├── db.ts                     # Prisma singleton with @prisma/adapter-pg
│   ├── errors.ts                 # AppError hierarchy + handleApiError()
│   ├── permissions.ts            # RBAC matrix (ROLE_PERMISSIONS) + hasPermission()
│   ├── serialize.ts              # Decimal/BigInt → number JSON serialization
│   ├── query-provider.tsx        # React Query client provider (staleTime: 60s)
│   └── utils.ts                  # General utility (cn for className merging)
│
├── services/                     # Data access layer
│   ├── index.ts                  # Barrel re-exports
│   ├── animal.service.ts         # Animal CRUD + rich includes
│   ├── farm.service.ts           # Farm CRUD
│   ├── unit.service.ts           # Unit CRUD (referenced by index.ts)
│   ├── units.service.ts          # Duplicate — see Known Issues
│   ├── species.service.ts        # Species CRUD
│   ├── breed.service.ts          # Breed CRUD (referenced by index.ts)
│   ├── breeds.service.ts         # Duplicate — see Known Issues
│   ├── milk.service.ts           # Milk log CRUD + stats aggregation
│   ├── health.service.ts         # Health incident CRUD
│   ├── growth.service.ts         # Growth log CRUD
│   ├── vaccination.service.ts    # Vaccination record CRUD
│   ├── breeding.service.ts       # Breeding record CRUD
│   ├── heat-cycle.service.ts     # Heat cycle CRUD
│   ├── pregnancy.service.ts      # Pregnancy record CRUD
│   ├── audit.service.ts          # Audit log creation + querying
│   ├── notification.service.ts   # Notification CRUD (referenced by index.ts)
│   ├── notifications.service.ts  # Duplicate — see Known Issues
│   ├── dashboard.service.ts      # Dashboard aggregation queries
│   └── auth.service.ts           # Registration + user management
│
├── validators/                   # Zod v4 schemas
│   ├── index.ts                  # Barrel re-exports
│   ├── animal.validator.ts       # createAnimal, updateAnimal, animalQuery, animalIdParam
│   ├── farm.validator.ts
│   ├── unit.validator.ts
│   ├── units.validator.ts        # Duplicate
│   ├── species.validator.ts
│   ├── breed.validator.ts
│   ├── breeds.validator.ts       # Duplicate
│   ├── milk-log.validator.ts
│   ├── health-incident.validator.ts
│   ├── health-incidents.validator.ts  # Duplicate
│   ├── growth-log.validator.ts
│   ├── growth-logs.validator.ts  # Duplicate
│   ├── vaccination.validator.ts
│   ├── breeding.validator.ts
│   ├── heat-cycle.validator.ts
│   ├── pregnancy.validator.ts
│   └── auth.validator.ts
│
├── hooks/                        # React Query hooks
│   ├── index.ts                  # Barrel re-exports
│   ├── use-auth.ts               # useSession, login/logout mutations
│   ├── use-animals.ts            # useAnimals, useAnimal, useCreateAnimal, useUpdateAnimal, useDeleteAnimal
│   ├── use-farms.ts
│   ├── use-units.ts
│   ├── use-species.ts
│   ├── use-breeds.ts
│   ├── use-milk-logs.ts
│   ├── use-health-incidents.ts
│   ├── use-growth-logs.ts
│   ├── use-vaccinations.ts
│   ├── use-breeding.ts
│   ├── use-heat-cycles.ts
│   ├── use-pregnancy.ts
│   ├── use-notifications.ts
│   └── use-dashboard.ts
│
├── types/
│   └── index.ts                  # TypeScript interfaces for all entities + API types
│
├── components/ui/                # shadcn/ui base components
│   ├── button.tsx, input.tsx, textarea.tsx, dialog.tsx,
│   ├── popover.tsx, command.tsx, input-group.tsx
│
├── __tests__/                    # Vitest unit tests
│   ├── setup.ts                  # Global mocks (NextResponse, NextAuth, Prisma, bcrypt)
│   ├── lib/                      # Tests for serialize, api-auth, errors, permissions, api-response, api-client
│   ├── validators/               # Tests for animal, farm-unit-species-breed, reproduction, auth, milk-growth-health
│   └── services/                 # Tests for audit service
│
├── e2e/                          # Playwright E2E tests
│   ├── auth.spec.ts              # Auth guard redirects, login page, register page, API 401s
│   └── dashboard.spec.ts         # Dashboard rendering and basic interactions
│
├── prisma/
│   └── schema.prisma             # 15 Prisma models
│
├── middleware.ts                 # JWT auth middleware
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── sql_queries.sql               # Seed/initialization SQL
└── scripts/                      # Code generation scripts
    ├── generate-api-routes.js
    ├── generate-hooks.js
    ├── generate-services.js
    └── generate-phase1.js
```

---

## Authentication & Authorization

### NextAuth JWT Flow

TerraDairy uses NextAuth v4 with a credentials-based authentication provider and JWT session strategy. The configuration in `lib/auth.ts` specifies:

- **Provider**: `CredentialsProvider` accepting `email` and `password`. The `authorize` callback looks up the user by email in the `users` table, compares the password hash using `bcryptjs`, and returns a user object with `id`, `email`, `name`, and `role`.       
- **Session strategy**: `"jwt"` — no server-side session store. The JWT token contains `userId` (number) and `role` (string), injected via the `jwt` callback and exposed on `session.user` via the `session` callback.
- **Type augmentation**: The `next-auth` and `next-auth/jwt` modules are extended to declare the custom `id`, `role` (on User and Session) and `userId`, `role` (on JWT) properties.

### Middleware Authentication

The `middleware.ts` file at the project root runs on every request (matched by `((?!_next/static|_next/image|favicon.ico|favicon.svg).*)`). It performs three checks:

1. **Public paths** (`/login`, `/register`, `/api/auth`) — pass through. Authenticated users visiting `/login` or `/register` are redirected to `/`.
2. **API routes** (`/api/...`) — the JWT is verified via `getToken()`. If invalid or missing, a 401 JSON response is returned immediately. If valid, `x-user-id` and `x-user-role` headers are attached to the forwarded request (though route handlers currently use `getServerSession()` instead of reading these headers).
3. **Page routes** — the JWT is verified. If missing, the user is redirected to `/login?callbackUrl=<current_path>`.

### RBAC Permission Matrix

The `lib/permissions.ts` file defines a `ROLE_PERMISSIONS` constant mapping each of the 5 roles to a dictionary of 12 modules, each with an array of allowed actions. The `hasPermission(userRole, module, action)` function performs the lookup.

| Module | ADMIN | MANAGER | VETERINARIAN | WORKER | VIEWER |
|---|---|---|---|---|---|
| **animals** | CRUD | CRUD | R | R | R |
| **milk** | CRUD | CRUD | R | C, R | R |
| **health** | CRUD | CRUD | CRUD | C, R | R |
| **farms** | CRUD | CRUD | R | R | R |
| **reports** | CRUD | CRUD | R | R | R |
| **vaccinations** | CRUD | CRUD | CRUD | C, R | R |
| **breeding** | CRUD | CRUD | CRUD | R | R |
| **heatCycles** | CRUD | CRUD | R | R | R |
| **units** | CRUD | CRUD | R | R | R |
| **species** | CRUD | CRUD | R | R | R |
| **breeds** | CRUD | CRUD | R | R | R |
| **pregnancy** | CRUD | CRUD | CRUD | R | R |

**Legend**: C = create, R = read, U = update, D = delete, CRUD = all four.

### requirePermission Pattern

Every API route handler that requires authorization calls `requirePermission(module, action)` from `lib/api-auth.ts`. This function:

1. Calls `requireAuth()` which invokes `getServerSession(authOptions)` to retrieve the current session.
2. If no session exists, throws `UnauthorizedError("Authentication required")`.
3. Checks `hasPermission(user.role, module, action)`. If the role lacks the permission, throws `ForbiddenError(...)`.
4. Returns the authenticated user object (with `id`, `email`, `name`, `role`) for use in audit logging.

```typescript
// Typical usage in a route handler:
const user = await requirePermission("animals", "create");
// user.id is used for audit logging
```

The `resolveId(params)` helper is used in `[id]` route handlers to unwrap Next.js 15's async `params` promise and parse the ID as a positive integer. It accepts an optional `field` parameter (defaults to `"id"`) for nested dynamic segments like `[incidentId]`.

---

## API Conventions

### Standard Response Format

All API responses follow a consistent envelope format. Successful responses use `{ success: true, data: ... }`, while errors use `{ success: false, error: { code, message } }`.

**Success (single resource)**:
```json
{ "success": true, "data": { "animal_id": 1, "tag_number": "A001", ... } }
```

**Success (paginated list)**:
```json
{
  "success": true,
  "data": [{ "animal_id": 1, ... }, { "animal_id": 2, ... }],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

**Created** (HTTP 201):
```json
{ "success": true, "data": { "animal_id": 1, ... } }
```

**No Content** (HTTP 204): Empty body.

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      { "field": "tag_number", "message": "Tag number is required" }
    ]
  }
}
```

Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `DATABASE_ERROR`, `INTERNAL_ERROR`.

### Response Helper Functions

Defined in `lib/api-response.ts`:

| Helper | HTTP Status | Use Case |
|---|---|---|
| `successResponse(data)` | 200 | Single resource GET, PUT |
| `createdResponse(data)` | 201 | POST (resource created) |
| `noContentResponse()` | 204 | DELETE |
| `paginatedResponse(data, total, page, pageSize)` | 200 | List GET with pagination |
| `errorResponse(code, message, status)` | Custom | Manual error responses |

### Pagination

List endpoints accept query parameters parsed by Zod query schemas:

- `page` (default: 1) — Current page number (positive integer)
- `pageSize` (default: 20, max: 100) — Items per page
- `sortBy` — Sort field (enum of allowed columns)
- `sortDir` — `"asc"` or `"desc"` (default: `"desc"`)

Services execute `findMany` with `skip: (page - 1) * pageSize` and `take: pageSize` in parallel with a `count()` query for the total.

### Zod Validation Pattern

Every route handler validates input using Zod schemas from the `validators/` directory:

```typescript
// For query parameters (GET list):
const sp = req.nextUrl.searchParams;
const parsed = animalQuerySchema.parse(Object.fromEntries(sp.entries()));

// For request body (POST/PUT):
const body = await req.json();
const parsed = createAnimalSchema.parse(body);
```

Validation failures throw `ZodError`, which is caught by `handleApiError()` and converted to a 400 response with per-field error details.

### Audit Logging Pattern

All mutating operations (POST, PUT, DELETE) produce an audit log entry via the `auditLog()` function from `services/audit.service.ts`:

```typescript
import { log as auditLog } from "@/services/audit.service";

// CREATE
await auditLog(user.id, "animals", created.animal_id, "CREATE", undefined, parsed);

// UPDATE
await auditLog(user.id, "animals", id, "UPDATE", oldRecord, newValues);

// DELETE
await auditLog(user.id, "animals", id, "DELETE", oldRecord);
```

Each audit log record stores: `user_id`, `entity` (string like "animals"), `entity_id`, `action` ("CREATE"/"UPDATE"/"DELETE"), and optional `old_values`/`new_values` JSON columns for change tracking.

---

## Frontend Conventions

### Page Pattern

Every list page in TerraDairy follows a consistent pattern consisting of three main sections:

1. **Navbar** — The `<Navbar title="..." subtitle="..." />` component renders the top bar with the page title and optional subtitle (e.g., record count).

2. **Toolbar** — A flex row containing:
   - A **Filter toggle button** (`<Filter>` icon from lucide-react) that shows/hides the filter panel
   - Inline quick-search inputs (e.g., tag number)
   - A **"New [entity]" button** (`<Plus>` icon) that opens the create modal

3. **Filter Panel** — A collapsible `<div>` with `grid grid-cols-2 md:grid-cols-4 gap-3` layout containing `<Field>` wrapped `<select>` or `<input>` elements. Each filter change resets `page` to 1.

4. **Data Table** — An HTML `<table>` inside a `surface border rounded-2xl overflow-hidden` container. Column headers are clickable for sort toggling (displays `↑`/`↓` arrows). Rows show entity data with a "View" link to the detail page. Loading state shows a centered "Loading..." row. Empty state shows "No [entities] match these filters."

5. **Pagination Controls** — A footer with "Page X of Y" text and `<ChevronLeft>` / `<ChevronRight>` buttons that disable at boundaries.

6. **Modal** — A `<Modal>` component for create/edit forms containing `<Field>` wrapped form inputs in a `grid grid-cols-2 gap-4` layout with a footer containing "Cancel" and "Create"/"Save" buttons.

### Shared Components

- **`Modal`** (`app/components/modal.tsx`) — A fixed overlay modal with title bar (X close button), scrollable content area, and optional footer. Props: `open`, `onClose`, `title`, `children`, `footer`.
- **`Field`** (`app/components/modal.tsx`) — A label + children wrapper that renders a small uppercase tracking-wider label above the form control.
- **`inputCls`** (`app/components/modal.tsx`) — A shared CSS class string: `"w-full surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"`. Used on all `<input>` and `<select>` elements throughout the app for visual consistency.
- **`Navbar`** (`app/components/navbar.tsx`) — Top navigation bar displaying the page title, subtitle, and user menu/notification bell.
- **`Sidebar`** (`app/components/sidebar.tsx`) — Side navigation with role-based link visibility, collapsible on mobile.

### React Query Hook Pattern

All data fetching is done through React Query hooks in the `hooks/` directory. Each hook file exports a consistent set:

```typescript
// Query hook for lists
export function useAnimals(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return useQuery({
    queryKey: ["animals", params],
    queryFn: () => api.get<PaginatedResponse<Animal>>(`/animals?${qs}`),
  });
}

// Query hook for single resource
export function useAnimal(id: number) {
  return useQuery({
    queryKey: ["animal", id],
    queryFn: () => api.get<Animal>(`/animals/${id}`),
    enabled: !!id,  // Don't fetch if id is 0/undefined
  });
}

// Mutation hooks
export function useCreateAnimal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAnimalInput) => api.post<Animal>("/animals", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["animals"] }),
  });
}
```

The `QueryProvider` in `lib/query-provider.tsx` wraps the app with a `QueryClient` configured with `staleTime: 60000` (1 minute), `retry: 1`, and `refetchOnWindowFocus: false`.

### ApiClient Usage

The `ApiClient` class in `lib/api-client.ts` is a thin wrapper around `fetch` that:

- Prepends `/api` to all URLs
- Sets `Content-Type: application/json` automatically
- Handles 204 responses (returns `undefined`)
- Unwraps the response envelope: if `json.data` exists, returns `json.data`; otherwise returns the full `json`
- On non-OK responses, throws an `Error` with `json.error.message`

The singleton is exported as `export const api = new ApiClient()` and imported by all hook files.

---

## Database Schema

TerraDairy uses PostgreSQL with 15 Prisma models. The schema is defined in `prisma/schema.prisma` and uses the `@prisma/adapter-pg` driver adapter for the Prisma 7+ driver architecture. Key naming conventions: table names are lowercase plural (e.g., `animals`, `milk_logs`), primary keys use `{entity}_id` (e.g., `animal_id`, `milk_log_id`), and timestamps use `created_at`/`updated_at`.

### Model Summary

| Model | Primary Key | Key Fields | Relationships | Notable Constraints |
|---|---|---|---|---|
| **users** | `user_id` (auto) | email, name, password_hash, role, is_active | → audit_logs, → notifications | `email` @unique |
| **audit_logs** | `id` (auto) | user_id, entity, entity_id, action, old_values (JSON), new_values (JSON) | ← users | Indexes on user_id, (entity, entity_id), created_at DESC |
| **notifications** | `id` (auto) | user_id, type, title, message, is_read, entity_type, entity_id | ← users | Indexes on user_id, (user_id, is_read) |
| **animals** | `animal_id` (auto) | farm_id, unit_id?, breed_id, tag_number, gender (M/F), date_of_birth, mother_id?, father_id?, birth_weight_kg, lifecycle_stage, is_active | → farms, → units?, → breeds, → mother/father (self-ref), ← growth_logs, health_incidents, milk_logs, vaccination_records, breeding_records, pregnancy_records, heat_cycle_records | **`@@unique([farm_id, tag_number])`**, indexes on farm_id, breed_id, tag_number, lifecycle_stage, is_active |
| **farms** | `farm_id` (auto) | farm_name, owner_name, contact_number, address, city, province, country, total_area_acres, is_active | ← animals, ← units | — |
| **units** | `unit_id` (auto) | farm_id, unit_name, unit_type, capacity, description, is_active | → farms, ← animals | FK to farms (cascade delete) |
| **species** | `species_id` (auto) | species_name, scientific_name, description, is_active | ← breeds | `species_name` @unique |
| **breeds** | `breed_id` (auto) | species_id, breed_name, origin_country, average_milk_production, description, is_active | → species, ← animals | **`@@unique([species_id, breed_name])`** |
| **milk_logs** | `milk_log_id` (auto) | animal_id, production_date, session (Morning/Afternoon/Evening), milk_liters, quality_grade, notes | → animals (cascade) | Indexes on animal_id, production_date |
| **growth_logs** | `growth_log_id` (auto) | animal_id, weight_kg, recorded_date, notes | → animals (cascade) | Indexes on animal_id, recorded_date |
| **health_incidents** | `incident_id` (auto) | animal_id?, incident_date, disease_name, severity, symptoms, treatment, status, veterinarian_id | → animals?, ← treatment_records | Indexes on animal_id, status |
| **vaccination_records** | `vaccination_id` (auto) | animal_id?, vaccine_name, vaccination_date, next_due_date, administered_by, notes | → animals? | Indexes on animal_id, next_due_date |
| **breeding_records** | `breeding_id` (auto) | female_animal_id?, male_animal_id?, breeding_date, method, result, notes | → female animal, → male animal | — |
| **heat_cycle_records** | `heat_cycle_id` (auto) | animal_id?, heat_start_date, heat_end_date, detection_method, confidence_score, notes | → animals? | Index on animal_id |
| **pregnancy_records** | `pregnancy_id` (auto) | animal_id, insemination_date, pregnancy_confirmed, confirmation_date, expected_delivery_date, actual_delivery_date, status | → animals (cascade) | Indexes on animal_id, status |
| **treatment_records** | `treatment_id` (auto) | incident_id?, medicine_id?, dosage, treatment_date, remarks | → health_incidents | — |

### Critical Constraints

- **`unique_tag_per_farm`**: The combination of `farm_id + tag_number` must be unique across the `animals` table. Attempting to create a duplicate triggers Prisma error `P2002`, which `handleApiError` converts to a 409 CONFLICT response.
- **`unique_breed_per_species`**: The combination of `species_id + breed_name` must be unique in `breeds`.
- **Cascade deletes**: Deleting a farm cascades to its units and animals. Deleting an animal cascades to its milk_logs, growth_logs, and pregnancy_records. Deleting a species cascades to its breeds.
- **Lifecycle stages**: Animals track lifecycle through an enum-like string field with values: Calf, Heifer, Pregnant Heifer, Lactating, Dry, Bull, Breeding Bull, Retired, Sold, Deceased.

---

## Service Layer

The service layer in `services/` is the single place where Prisma queries are executed. Route handlers never import Prisma directly — they always call service functions. This separation enables testing, reuse, and future replacement of the ORM without touching route handlers.

### Pattern: Prisma Calls Wrapped in serialize()

Every service function wraps its Prisma return value in `serialize()` before returning. This is critical because Prisma returns `Decimal` objects (for `@db.Decimal` fields like `weight_kg`, `milk_liters`, `birth_weight_kg`) and potentially `BigInt` objects, which cannot be serialized by `JSON.stringify`. The `serialize()` utility in `lib/serialize.ts` performs a round-trip `JSON.parse(JSON.stringify(value, replacer))` that converts `Decimal` (detected via `toFixed` method) and `BigInt` to plain JavaScript numbers.

```typescript
import { serialize } from "@/lib/serialize";

export async function findById(id: number) {
  const animal = await prisma.animals.findUnique({
    where: { animal_id: id },
    include: { farms: true, breeds: { include: { species: true } } },
  });
  if (!animal) throw new NotFoundError("Animal");
  return serialize(animal);  // Decimal → number conversion
}
```

### NotFoundError Pattern

Services throw `NotFoundError` (from `lib/errors.ts`) when a lookup by ID returns null. This error is caught by `handleApiError()` in the route handler and converted to a 404 response. The constructor accepts a resource name for the error message:

```typescript
if (!animal) throw new NotFoundError("Animal");
// → 404 { success: false, error: { code: "NOT_FOUND", message: "Animal not found" } }
```

For update and delete operations, services typically call `findById(id)` first as an existence check before performing the mutation. This ensures a clear 404 is returned rather than a Prisma P2025 error.

### Pagination and Filtering

List services follow a consistent pattern for pagination and filtering:

```typescript
export async function findAll(params: AnimalQueryParams) {
  const { page, pageSize, sortBy, sortDir, ...filters } = params;
  const where: Prisma.animalsWhereInput = {};

  // Dynamic filter construction
  if (filters.farm_id) where.farm_id = filters.farm_id;
  if (filters.tag_number) where.tag_number = { contains: filters.tag_number, mode: "insensitive" };
  if (filters.is_active !== undefined) where.is_active = filters.is_active === "true";

  // Parallel query for data + count
  const [data, total] = await Promise.all([
    prisma.animals.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortDir },
      include: { farms: true, breeds: { include: { species: true } } },
    }),
    prisma.animals.count({ where }),
  ]);
  return serialize({ data, total, page, pageSize });
}
```

Key aspects:
- Pagination uses `skip`/`take` (offset-based, not cursor-based).
- The `sortBy` and `sortDir` values come from the Zod query schema's enum validation, preventing SQL injection.
- Filter values from query parameters are type-coerced by Zod (`z.coerce.number()`) before reaching the service.
- `Promise.all` runs the data and count queries in parallel for performance.

### How Services Are Consumed by Routes

Route handlers import service modules using namespace imports and call exported functions directly:

```typescript
import * as animalService from "@/services/animal.service";

// In GET handler:
const result = await animalService.findAll(parsed);

// In POST handler:
const created = await animalService.create(parsed);

// In PUT handler:
const updated = await animalService.update(id, parsed);

// In DELETE handler:
await animalService.remove(id);
```

The `services/index.ts` barrel file re-exports all service modules, but routes import directly from individual service files for clarity.

---

## Validation Layer

The `validators/` directory contains Zod v4 schemas that define the shape, constraints, and types for every entity in the system. Each entity typically has its own validator file with multiple exported schemas and inferred TypeScript types.

### Schema Separation Pattern

Each entity defines up to four separate schemas:

1. **Create schema** (`create{Entity}Schema`) — All required fields for creating a new record. Fields that are optional in the database but have defaults may use `.optional().default(value)`.

2. **Update schema** (`update{Entity}Schema`) — All fields are optional (`.optional()`) since updates are partial. Required fields from create become optional here.

3. **Query schema** (`{entity}QuerySchema`) — Pagination (`page`, `pageSize`), sorting (`sortBy` with enum of allowed columns, `sortDir`), and filter parameters. Uses `z.coerce.number()` to convert string query parameters to numbers.

4. **ID param schema** (`{entity}IdParamSchema`) — Validates the dynamic route parameter as a numeric string and transforms it to a `number`.

Example from `animal.validator.ts`:

```typescript
export const createAnimalSchema = z.object({
  farm_id: z.number().int().positive("Farm is required"),
  breed_id: z.number().int().positive("Breed is required"),
  tag_number: z.string().min(1, "Tag number is required").max(50),
  gender: z.enum(["M", "F"]),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  lifecycle_stage: z.enum(LIFECYCLE_STAGES).default("Calf"),
  // ... optional fields
});

export const updateAnimalSchema = z.object({
  tag_number: z.string().min(1).max(50).optional(),
  lifecycle_stage: z.string().max(20).optional(),
  is_active: z.boolean().optional(),
  // ... all optional
});

export const animalQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(SORT_FIELDS).default("animal_id"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  farm_id: z.coerce.number().int().positive().optional(),
  tag_number: z.string().optional(),
  // ... filter fields
});
```

### Type Inference Pattern

Types are inferred from schemas using `z.infer<>`, providing end-to-end type safety from validation through service calls to React Query mutations:

```typescript
export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;
export type UpdateAnimalInput = z.infer<typeof updateAnimalSchema>;
export type AnimalQueryParams = z.infer<typeof animalQuerySchema>;
```

These types are imported by service functions (for parameter typing), route handlers (for parsed result typing), and React Query hooks (for mutation input typing):

```typescript
// In hook:
export function useCreateAnimal() {
  return useMutation({
    mutationFn: (data: CreateAnimalInput) => api.post<Animal>("/animals", data),
  });
}
```

---

## Testing

TerraDairy has a two-tier testing strategy: unit tests with Vitest and end-to-end tests with Playwright.

### Unit Tests (Vitest)

**Run command**: `npm test` (single run) or `npm run test:watch` (watch mode)
**Coverage**: `npm run test:coverage` (uses v8 provider, covers `lib/`, `validators/`, `services/`)

**Configuration** (`vitest.config.ts`):
- Environment: `node` (not jsdom — tests are server-side focused)
- Globals: `true` (vi, describe, it, expect available globally)
- Setup file: `__tests__/setup.ts`
- Test pattern: `__tests__/**/*.test.{ts,tsx}`
- Path alias: `@` → project root

**Mocking Strategy** (`__tests__/setup.ts`):
The global setup file mocks all server-side dependencies that cannot run in the Vitest Node environment:

| Module | Mock |
|---|---|
| `next/server` | `MockNextResponse` class with static `json()` and instance `json()` methods |
| `next-auth` | `getServerSession`, `NextAuth`, `default` → `vi.fn()` |
| `next-auth/jwt` | `getToken` → `vi.fn()` |
| `next/navigation` | `useRouter`, `useSearchParams`, `usePathname`, `redirect` |
| `@prisma/client` | `PrismaClientKnownRequestError` (for instanceof checks), `PrismaClient` |
| `@/lib/db` | `prisma: {}` (empty object — no real DB connection) |
| `bcryptjs` | `hash`, `compare` → `vi.fn()` |
| `next-auth/providers/credentials` | `default` → `vi.fn()` |

**Test Structure** (197 tests across these files):

| Directory | Files | What is Tested |
|---|---|---|
| `__tests__/lib/` | `serialize.test.ts`, `api-auth.test.ts`, `errors.test.ts`, `permissions.test.ts`, `api-response.test.ts`, `api-client.test.ts` | Utility functions, error handling, RBAC logic, API client |
| `__tests__/validators/` | `animal.test.ts`, `farm-unit-species-breed.test.ts`, `reproduction.test.ts`, `auth.test.ts`, `milk-growth-health.test.ts` | Zod schema validation for all entities |
| `__tests__/services/` | `audit.test.ts` | Audit service functions |

### E2E Tests (Playwright)

**Run command**: `npm run test:e2e` or `npm run test:e2e:ui` (interactive UI mode)

**Configuration** (`playwright.config.ts`): Standard Playwright configuration targeting the running Next.js dev server.

**Test Files**:

- **`e2e/auth.spec.ts`** — The primary E2E suite with tests for:
  - Unauthenticated redirect to `/login` from all protected pages (dashboard, animals, farms, milk-production, vaccinations, breeding, heat-cycles, pregnancy, units, species-breeds)
  - Unauthenticated API requests returning 401 JSON for all 14 API endpoints
  - Login page rendering (email/password fields, sign-in button)
  - Login validation (empty submit shows error, wrong credentials shows error)
  - Register page rendering (name, email, password fields, register button, login link)
  - Public route accessibility (`/api/auth/csrf`)
  - TerraDairy branding presence on login page

- **`e2e/dashboard.spec.ts`** — Dashboard page rendering and basic interaction tests.

---

## Known Issues & Future Improvements

### Zod v3/v4 `.errors` vs `.issues` Bug in `lib/errors.ts`

The `handleApiError()` function in `lib/errors.ts` accesses `error.errors` on the `ZodError` object:

```typescript
if (error instanceof ZodError) {
  details: error.errors.map((e) => ({ ... })),
}
```

In **Zod v3**, the property was called `.errors`. In **Zod v4** (which this project uses: `"zod": "^4.4.3"`), the property has been renamed to `.issues`. The v4 package may still export `.errors` as an alias for backward compatibility, but this should be verified and updated to use `.issues` explicitly to avoid future breakage when the alias is removed.

**Fix**: Change `error.errors.map(...)` to `error.issues.map(...)` in `lib/errors.ts` line 62.

### `resolveId` Does Not Reject Negative Numbers

The `resolveId()` function in `lib/api-auth.ts` validates that the ID is a finite number, but does not check for negative values:

```typescript
export async function resolveId(params: Ctx["params"], field = "id"): Promise<number> {
  const p = await params;
  const id = Number(p[field]);
  if (!id || !Number.isFinite(id)) throw new Error(`Invalid ${field}`);
  return id;
}
```

Since database auto-increment IDs are always positive, passing a negative ID (e.g., `/api/animals/-1`) would pass validation and result in a 404 from the service layer, but it would be cleaner to reject it early.

**Fix**: Add `id <= 0` to the guard: `if (!id || !Number.isFinite(id) || id <= 0) throw new Error(...)`.

### Duplicate Service Files

There are three pairs of duplicate service files with slightly different implementations:

| Canonical (used by `index.ts`) | Duplicate (unused) | Difference |
|---|---|---|
| `services/unit.service.ts` | `services/units.service.ts` | `units.service.ts` imports typed validators and throws `NotFoundError`; `unit.service.ts` uses `Record<string, unknown>` and returns `null` instead of throwing |
| `services/breed.service.ts` | `services/breeds.service.ts` | `breeds.service.ts` includes `species` relation in queries; `breed.service.ts` does not |
| `services/notification.service.ts` | `services/notifications.service.ts` | `notification.service.ts` has alert generation logic (`checkAndGenerateAlerts`); `notifications.service.ts` has cleaner typed functions with proper ownership checks |

Only the canonical files are re-exported from `services/index.ts`, so the duplicates are dead code. They should be removed to avoid confusion.

### Duplicate Validator Files

Similarly, there are duplicate validator files following the same naming pattern:

| Canonical | Duplicate |
|---|---|
| `validators/unit.validator.ts` | `validators/units.validator.ts` |
| `validators/breed.validator.ts` | `validators/breeds.validator.ts` |
| `validators/health-incident.validator.ts` | `validators/health-incidents.validator.ts` |
| `validators/growth-log.validator.ts` | `validators/growth-logs.validator.ts` |

### Other Future Improvements

- **Middleware header usage**: The middleware attaches `x-user-id` and `x-user-role` headers to API requests, but route handlers use `getServerSession()` instead of reading these headers. The middleware header approach could eliminate the redundant `getServerSession()` call in every route handler, improving performance.
- **Cursor-based pagination**: The current offset-based pagination (`skip`/`take`) can produce inconsistent results when records are added/deleted between page loads. Cursor-based pagination using the primary key or a unique sort field would be more robust for large datasets.
- **Notification alert scheduling**: The `checkAndGenerateAlerts()` function in `notification.service.ts` exists but has no scheduled trigger. It should be called by a cron job (e.g., via a Node.js scheduler or external cron service) to periodically generate vaccination due, delivery expected, and critical health alerts.
- **Service layer consistency**: Some services (e.g., `unit.service.ts`) use `Record<string, unknown>` instead of properly typed inputs. These should be migrated to use Zod-inferred types like `animal.service.ts` does.
- **Form validation on the frontend**: Current forms use manual `alert()` calls for validation (e.g., `if (!form.farm_id) { alert("Please select a farm."); return; }`). These should be replaced with Zod client-side validation using the same schemas from the validators directory, providing consistent error messages and better UX.
- **E2E test coverage**: The current E2E suite only tests unauthenticated scenarios. Adding authenticated test flows (login → create animal → verify in list → edit → delete) would significantly increase confidence in the full stack.
- **Test coverage for services**: Only `audit.service.ts` has unit tests. The remaining 14+ service files lack test coverage. Since the setup file already mocks `@/lib/db`, service tests can mock individual Prisma methods for isolated testing.