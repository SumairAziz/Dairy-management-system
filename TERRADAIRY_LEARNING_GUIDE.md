# TerraDairy Learning Guide

This guide is a practical learning course for the actual TerraDairy codebase in this repository. It starts from zero and moves toward advanced understanding.

This is not a generic Next.js tutorial. Every concept is connected to what exists in this project today.

## How to use this guide

Use this as a learning roadmap, not a quick reference.

1. Read in order.
2. Study the files named in each section.
3. Do not skip the “why it exists” explanation.
4. Before moving to a new level, try one of the practical exercises listed near the end.
5. When a feature is marked as PARTIALLY IMPLEMENTED or NOT IMPLEMENTED, treat it as a caution, not as a gap to ignore.

## Important status labels used in this guide

- CURRENTLY IMPLEMENTED: confirmed in the codebase and used by the app
- PARTIALLY IMPLEMENTED: present but incomplete or only partially wired up
- NOT IMPLEMENTED: not present in the project as code, configuration, or routes

## The one-sentence summary

TerraDairy is a farm management system built with Next.js, Prisma, PostgreSQL, and NextAuth. It lets users manage farms, animal records, milk production, breeding, health, inventory, notifications, chat, permissions, and an AI assistant. The shape of the app is: UI → hooks → API routes → services → Prisma → PostgreSQL.

---

# PART 1 — STARTING FROM ZERO

## 1.1 What a web application is

A web application is software that runs on a server and is accessed through a browser. The browser sends requests, and the server returns responses.

In TerraDairy:

- The browser loads pages from the Next.js app
- The UI is rendered by React in the browser
- The app also calls server APIs for data and actions
- The database lives on PostgreSQL

This is visible in [app/layout.tsx](app/layout.tsx), [app/page.tsx](app/page.tsx), [lib/query-provider.tsx](lib/query-provider.tsx), and [app/api/animals/route.ts](app/api/animals/route.ts).

## 1.2 Frontend vs backend

Frontend is what the user sees and interacts with. Backend is the code and services that run on the server and handle business logic, validation, security, and database access.

TerraDairy frontend:

- [app/](app/)
- [components/](components/)
- [hooks/](hooks/)
- [lib/query-provider.tsx](lib/query-provider.tsx)

TerraDairy backend:

- [app/api/](app/api/)
- [services/](services/)
- [lib/db.ts](lib/db.ts)
- [prisma/schema.prisma](prisma/schema.prisma)

## 1.3 Client vs server

A client runs in the browser. A server runs in Node.js, typically on the host machine or hosting platform.

In TerraDairy, the React pages and hooks run in the browser, but the actual database reading/writing happens in server-side route handlers or server actions. The server side is where Prisma and database calls happen.

Examples:

- Client: [app/login/page.tsx](app/login/page.tsx)
- Server: [app/api/auth/register/route.ts](app/api/auth/register/route.ts)
- Database client: [lib/db.ts](lib/db.ts)

## 1.4 HTTP/HTTPS

HTTP is the protocol used for web requests. HTTPS adds encryption.

In a typical app:

- Browser sends a request such as GET /api/animals
- Server decides what to do
- Server returns JSON

TerraDairy uses Next.js route handlers with HTTP methods like GET, POST, PUT, PATCH, DELETE. For example, [app/api/animals/route.ts](app/api/animals/route.ts) and [app/api/milk-logs/route.ts](app/api/milk-logs/route.ts).

## 1.5 Request/response

Every client-server interaction is a request and a response.

Example request flow:

- UI sends fetch or api.get
- Route handler validates inputs
- Service reads from Prisma
- Database returns records
- API returns JSON response
- Frontend updates the UI

The frontend API wrapper is in [lib/api-client.ts](lib/api-client.ts), and the standard API response shape is in [lib/api-response.ts](lib/api-response.ts).

## 1.6 APIs

An API is a defined way for programs to communicate. TerraDairy uses REST-style route handlers under [app/api/](app/api/).

Examples:

- [app/api/farms/route.ts](app/api/farms/route.ts)
- [app/api/animals/route.ts](app/api/animals/route.ts)
- [app/api/dashboard/route.ts](app/api/dashboard/route.ts)
- [app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts)

## 1.7 REST APIs

REST is a common architecture where endpoints correspond to resources and HTTP methods represent actions.

Examples in TerraDairy:

- GET /api/farms → list farms
- POST /api/farms → create farm
- GET /api/animals/[id] → get one animal
- PUT /api/animals/[id] → update animal
- DELETE /api/animals/[id] → delete animal

The actual route files confirm this. The structure is consistent across many modules.

## 1.8 JSON

JSON is the standard format for sending data between browser and server.

The app standardizes responses with a wrapper like:

- success: true/false
- data: payload
- error: { code, message }

This is visible in [lib/api-response.ts](lib/api-response.ts) and the error handling in [lib/errors.ts](lib/errors.ts).

## 1.9 Database basics

A database stores structured data. TerraDairy uses PostgreSQL and Prisma.

Important database concepts:

- table: a set of records
- row: one record
- column: a field
- primary key: unique identity for a row
- foreign key: a reference to another table
- relation: how records connect with each other

The actual schema lives in [prisma/schema.prisma](prisma/schema.prisma).

## 1.10 SQL basics

SQL is the language used to read and write relational database data.

Common SQL operations:

- SELECT
- INSERT
- UPDATE
- DELETE
- JOIN
- GROUP BY
- WHERE

TerraDairy uses Prisma most of the time, but some database queries are written with raw SQL in [services/dashboard.service.ts](services/dashboard.service.ts) and AI report logic in [lib/ai/reports/](lib/ai/reports/).

## 1.11 Authentication vs authorization

Authentication asks: Who are you?

Authorization asks: Are you allowed to do this?

This project implements both.

- Authentication: [lib/auth.ts](lib/auth.ts)
- Authorization: [lib/rbac/permissions.ts](lib/rbac/permissions.ts)
- Route protection: [middleware.ts](middleware.ts)
- API protection: [lib/api-auth.ts](lib/api-auth.ts)

## 1.12 Sessions

A session keeps track of a logged-in user across requests.

TerraDairy uses NextAuth with JWT sessions. The session is configured in [lib/auth.ts](lib/auth.ts), and the session provider is added in [lib/auth-provider.tsx](lib/auth-provider.tsx).

## 1.13 Environment variables

Environment variables are configuration values outside the source code, such as database credentials and API keys.

Examples in TerraDairy:

- DATABASE_URL
- NEXTAUTH_SECRET
- GEMINI_API_KEY
- OPENAI_API_KEY

The project’s actual configuration patterns are visible in the code and the doc files, especially in package scripts and AI configuration.

## 1.14 Development vs production

Development means running on a local machine with hot reload and local database access.

Production means a deployed environment with production settings, optimized builds, and real secrets.

This project has commands in [package.json](package.json) for development and build.

---

# PART 2 — TECHNOLOGIES USED IN TERRADAIRY

## 2.1 JavaScript

What it is:

JavaScript is the core language of the web. It runs in the browser and also in Node.js server environments.

Why TerraDairy uses it:

The app is a modern JavaScript stack: React for UI, Node.js for server runtime, Next.js for framework, and Prisma client for database access.

Where it exists:

- [package.json](package.json)
- [app/](app/)
- [hooks/](hooks/)
- [services/](services/)

Basic concepts:

- variables
- functions
- arrays and objects
- asynchronous code
- event handling

## 2.2 TypeScript

What it is:

TypeScript adds static types to JavaScript.

Why TerraDairy uses it:

This project is TypeScript-heavy, which makes model shapes, API payloads, and validation easier to reason about.

Where it exists:

- [tsconfig.json](tsconfig.json)
- all app and service files
- validators under [validators/](validators/)

Basic concepts:

- type annotations
- interfaces
- unions
- generics

Intermediate:

- discriminated unions
- mapped types
- type narrowing

Advanced:

- strict typing with Prisma-generated types
- API payload typing
- route validation typed with Zod

## 2.3 React

What it is:

React is a UI library for building component-based interfaces.

Why TerraDairy uses it:

The dashboard, animal forms, inventory pages, and chat UI are all React components.

Where it exists:

- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)
- [app/login/page.tsx](app/login/page.tsx)
- [components/](components/)

Need to learn:

- components
- props
- state
- hooks
- events
- rendering

## 2.4 Next.js

What it is:

Next.js is a React framework with routing, server rendering, API routes, and deployment conventions.

Why TerraDairy uses it:

The project is a Next.js App Router project. It provides routes under [app/](app/) and API endpoint handlers under [app/api/](app/api/).

Where it exists:

- [next.config.js](next.config.js)
- [app/layout.tsx](app/layout.tsx)
- [middleware.ts](middleware.ts)
- [package.json](package.json)

Basic concepts:

- pages / route folders
- App Router
- server components
- client components

## 2.5 App Router

What it is:

Next.js App Router organizes routes by folder structure.

Where it exists:

- [app/animals/](app/animals/)
- [app/api/](app/api/)
- [app/login/](app/login/)
- [app/settings/](app/settings/)

In TerraDairy, routes are not just pages; they also include backend endpoints in [app/api/](app/api/).

## 2.6 Server Components / Client Components

What they are:

Next.js supports server and client rendering boundaries. Client components use browser APIs and React hooks.

Why TerraDairy uses them:

The UI is mostly client-side, especially forms and tables, but some pages and layouts are server-oriented. The login page is a client component, while server route handlers do database work.

Examples:

- client: [app/login/page.tsx](app/login/page.tsx)
- server route: [app/api/animals/route.ts](app/api/animals/route.ts)
- layout: [app/layout.tsx](app/layout.tsx)

## 2.7 API routes

What they are:

Route handlers attached to the app router that respond to HTTP requests.

Why TerraDairy uses them:

The project separates frontend and server logic using API endpoints under [app/api/](app/api/).

Examples:

- [app/api/farms/route.ts](app/api/farms/route.ts)
- [app/api/dashboard/route.ts](app/api/dashboard/route.ts)
- [app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts)

## 2.8 PostgreSQL

What it is:

PostgreSQL is a relational database system.

Why TerraDairy uses it:

This project’s schema and database logic are built around PostgreSQL, with Prisma as the ORM layer.

Examples:

- [prisma/schema.prisma](prisma/schema.prisma)
- [lib/db.ts](lib/db.ts)

Concepts to learn:

- tables
- relations
- constraints
- transactions
- indexes
- dates and decimals

## 2.9 SQL

What it is:

SQL is the query language for relational databases.

Why TerraDairy uses it:

The project relies on Prisma for most queries but also uses SQL snippets in reporting and dashboard code.

Examples:

- [services/dashboard.service.ts](services/dashboard.service.ts)
- [lib/ai/reports/](lib/ai/reports/)

## 2.10 Prisma

What it is:

Prisma is an ORM that maps TypeScript models to PostgreSQL tables.

Why TerraDairy uses it:

It is the main database layer for TerraDairy.

Files:

- [prisma/schema.prisma](prisma/schema.prisma)
- [lib/db.ts](lib/db.ts)

Need to learn:

- schema
- models
- relations
- Prisma Client
- query filters
- transactions
- migrations / db push

## 2.11 Prisma Client

What it is:

Prisma Client is the generated database client used in app code.

Why TerraDairy uses it:

It is used across services and route handlers for all data access.

Examples:

- [services/animal.service.ts](services/animal.service.ts)
- [services/inventory.service.ts](services/inventory.service.ts)
- [services/dashboard.service.ts](services/dashboard.service.ts)

## 2.12 NextAuth

What it is:

NextAuth is an authentication library for Next.js.

Why TerraDairy uses it:

It handles credentials-based login and session JWTs.

Files:

- [lib/auth.ts](lib/auth.ts)
- [app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts)
- [lib/auth-provider.tsx](lib/auth-provider.tsx)
- [middleware.ts](middleware.ts)

Basic concepts:

- credentials provider
- session
- JWT
- callback hooks
- protected pages / API routes

## 2.13 Zod

What it is:

Zod is a schema validation library for TypeScript.

Why TerraDairy uses it:

The app validates API request bodies and AI tool arguments before data access.

Examples:

- [validators/animal.validator.ts](validators/animal.validator.ts)
- [validators/milk-log.validator.ts](validators/milk-log.validator.ts)
- [lib/ai/tools/animals.tools.ts](lib/ai/tools/animals.tools.ts)

This is one of the main safety layers for the application.

## 2.14 React Query / TanStack Query

What it is:

TanStack Query provides caching, fetching, and invalidation for client data.

Why TerraDairy uses it:

It is used for dashboard, animal, breeding, milk, notification, and chat data.

Files:

- [lib/query-provider.tsx](lib/query-provider.tsx)
- [hooks/use-animals.ts](hooks/use-animals.ts)
- [hooks/use-dashboard.ts](hooks/use-dashboard.ts)

Concepts:

- queryKey
- queryFn
- invalidation
- mutation
- cached state

## 2.15 Tailwind CSS

What it is:

Tailwind is a utility-first CSS framework.

Why TerraDairy uses it:

The UI is styled using utility classes and theme configuration.

Files:

- [tailwind.config.ts](tailwind.config.ts)
- [app/globals.css](app/globals.css)
- [app/login/page.tsx](app/login/page.tsx)

## 2.16 shadcn/ui

What it is:

shadcn/ui gives reusable component patterns built on top of Radix and Tailwind.

Why TerraDairy uses it:

The project includes a [components.json](components.json) config and likely UI building blocks under [components/ui/](components/ui/).

This is a design-system layer on top of custom app components.

## 2.17 Radix UI

What it is:

Radix is a low-level UI primitive library.

Why TerraDairy uses it:

It is part of the app’s component architecture and shadcn pattern.

Files:

- [components.json](components.json)
- [components/ui/](components/ui/)

## 2.18 Node.js

What it is:

Node.js is the JavaScript runtime that executes the server code.

Why TerraDairy uses it:

Next.js, Prisma, and the app server all run under Node.js.

## 2.19 npm

What it is:

npm is the package manager used to install and run the project dependencies.

Why TerraDairy uses it:

The scripts are defined in [package.json](package.json): dev, build, test, db:seed, db:sync-animals, etc.

## 2.20 Git

What it is:

Git is the version control system used for project history and branch-based development.

Why TerraDairy uses it:

This project is a Git repository; it is the standard method for tracking changes, commits, and collaborating.

## 2.21 Vitest

What it is:

Vitest is a JavaScript test runner.

Why TerraDairy uses it:

The project has a test setup and many unit tests under [__tests__/](__tests__/).

Files:

- [vitest.config.ts](vitest.config.ts)
- [__tests__/setup.ts](__tests__/setup.ts)

## 2.22 Playwright

What it is:

Playwright is an end-to-end browser testing framework.

Why TerraDairy uses it:

It is used for app flow and auth route tests under [e2e/](e2e/).

Files:

- [playwright.config.ts](playwright.config.ts)
- [e2e/auth.spec.ts](e2e/auth.spec.ts)
- [e2e/dashboard.spec.ts](e2e/dashboard.spec.ts)

## 2.23 Google Gemini / AI integration

What it is:

The TerraDairy AI assistant integrates with Google Gemini and optionally OpenAI provider abstractions.

Why TerraDairy uses it:

The project includes an AI assistant that can route questions to database tools or web grounding.

Files:

- [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts)
- [lib/ai/providers/](lib/ai/providers/)
- [lib/ai/web-search.ts](lib/ai/web-search.ts)
- [app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts)
- [docs/AI_SOURCE_MAP.md](docs/AI_SOURCE_MAP.md)

CURRENTLY IMPLEMENTED:

- AI chat route
- provider abstraction
- database-backed tool-calling
- Gemini web grounding
- source routing

PARTIALLY IMPLEMENTED:

- veterinary knowledge base is not actually implemented yet
- external web grounding is configured but not a full vetted KB system

NOT IMPLEMENTED:

- true RAG knowledge base with approved documents and embeddings

---

# PART 3 — PROJECT STRUCTURE

## 3.1 High-level structure

TerraDairy is organized by feature and by app layer.

Key folders:

- [app/](app/) — UI pages and API routes
- [components/](components/) — reusable UI components
- [hooks/](hooks/) — TanStack Query hooks
- [services/](services/) — Prisma-backed business logic
- [lib/](lib/) — shared utilities, security, RBAC, AI logic, database client, route config
- [validators/](validators/) — Zod validation schemas
- [prisma/](prisma/) — schema and data scripts
- [__tests__/](__tests/) — Vitest tests
- [e2e/](e2e/) — Playwright tests
- [docs/](docs/) — project docs and AI architecture notes

## 3.2 Folder-by-folder explanation

### [app/](app/)

Responsible for: Next.js pages and route handlers.

Why it exists:

This is where the web app and REST API live.

Examples:

- [app/login/page.tsx](app/login/page.tsx)
- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)
- [app/api/animals/route.ts](app/api/animals/route.ts)

Communication:

- UI uses hooks to call API routes
- API routes call services
- Services call Prisma

### [components/](components/)

Responsible for: reusable UI building blocks, charts, assistant UI, export controls, and general app UI.

Examples:

- [components/assistant/](components/assistant/)
- [components/chat/](components/chat/)
- [components/export/](components/export/)
- [components/ui/](components/ui/)

### [hooks/](hooks/)

Responsible for: TanStack Query hooks that wrap API calls.

Examples:

- [hooks/use-animals.ts](hooks/use-animals.ts)
- [hooks/use-dashboard.ts](hooks/use-dashboard.ts)
- [hooks/use-inventory.ts](hooks/use-inventory.ts)

Why it exists:

This keeps UI logic readable and makes caching/invalidation consistent.

### [services/](services/)

Responsible for: database operations and business logic.

Examples:

- [services/animal.service.ts](services/animal.service.ts)
- [services/inventory.service.ts](services/inventory.service.ts)
- [services/dashboard.service.ts](services/dashboard.service.ts)

This is a major layer: route handlers should not directly import Prisma in a large production app, and TerraDairy mostly follows that pattern.

### [lib/](lib/)

Responsible for: shared utilities and core app infrastructure.

Examples:

- [lib/db.ts](lib/db.ts)
- [lib/auth.ts](lib/auth.ts)
- [lib/errors.ts](lib/errors.ts)
- [lib/rbac/permissions.ts](lib/rbac/permissions.ts)
- [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts)

### [validators/](validators/)

Responsible for: input validation via Zod.

Examples:

- [validators/animal.validator.ts](validators/animal.validator.ts)
- [validators/inventory.validator.ts](validators/inventory.validator.ts)
- [validators/auth.validator.ts](validators/auth.validator.ts)

### [prisma/](prisma/)

Responsible for: schema and database maintenance scripts.

Examples:

- [prisma/schema.prisma](prisma/schema.prisma)
- [prisma/seed.ts](prisma/seed.ts)
- [prisma/normalize-units-data.ts](prisma/normalize-units-data.ts)
- [prisma/catch-up-farm-to-date.ts](prisma/catch-up-farm-to-date.ts)

### [__tests__/](__tests/)

Responsible for: unit tests and logic checks.

### [e2e/](e2e/)

Responsible for: browser-driven workflow tests.

### [docs/](docs/)

Responsible for: architecture notes and AI source maps.

Examples:

- [docs/AI_SOURCE_MAP.md](docs/AI_SOURCE_MAP.md)
- [README.md](README.md)
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)

## 3.3 Actual flow in TerraDairy

The real flow is:

UI
↓
React components / pages
↓
TanStack Query hooks
↓
API routes
↓
requirePermission / validation
↓
services
↓
Prisma / PostgreSQL
↓
serialized response
↓
React state update

This is how a page such as [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx) works.

---

# PART 4 — ARCHITECTURE

## 4.1 Layers and responsibilities

TerraDairy has these main layers:

1. Presentation layer
   - React pages and components
   - [app/](app/)
   - [components/](components/)

2. Data access layer
   - TanStack Query hooks in [hooks/](hooks/)
   - API wrapper in [lib/api-client.ts](lib/api-client.ts)

3. API layer
   - route handlers in [app/api/](app/api/)
   - response formatting in [lib/api-response.ts](lib/api-response.ts)

4. Security layer
   - authentication in [lib/auth.ts](lib/auth.ts)
   - authorization in [lib/rbac/permissions.ts](lib/rbac/permissions.ts)
   - route middleware in [middleware.ts](middleware.ts)

5. Service layer
   - [services/](services/)
   - performs Prisma logic and business rules

6. Persistence layer
   - [lib/db.ts](lib/db.ts)
   - [prisma/schema.prisma](prisma/schema.prisma)
   - PostgreSQL database

7. AI layer
   - [lib/ai/](lib/ai/)
   - [app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts)

## 4.2 What each layer is allowed to access

- Frontend: can only send requests and render data; it does not directly access database or secrets.
- API route: can read request data, validate, call services, and return JSON.
- Service: can query Prisma and apply business logic.
- Prisma client: can access database models only through the defined schema.
- AI layer: can call database tools and external Google search; it must not bypass validation or allowed server APIs.

## 4.3 What each layer must not access

- Frontend: must not directly call Prisma or read secrets.
- API route: must not silently skip permission checks.
- Service: should not receive raw unvalidated user input without validation.
- Database: must not be accessed by browser code.

## 4.4 Data flow

A basic request flow is:

User action
→ page component
→ useQuery/useMutation hook
→ api.get/api.post wrapper
→ route handler
→ requirePermission
→ Zod validation
→ service
→ Prisma query
→ database
→ serialized response
→ UI update

## 4.5 Example: complete request from UI to database

Take creating an animal.

1. User fills form in [app/animals/list/page.tsx](app/animals/list/page.tsx) or a related component.
2. Hook runs mutation from [hooks/use-animals.ts](hooks/use-animals.ts).
3. api.post calls POST /api/animals.
4. [app/api/animals/route.ts](app/api/animals/route.ts) validates permission and input.
5. It calls animalService.create in [services/animal.service.ts](services/animal.service.ts).
6. Prisma creates rows in animals.
7. Response is serialized and returned to the browser.
8. React Query invalidates list queries and refreshes the table.

This is a representative request path for the entire project.

---

# PART 5 — DATABASE

## 5.1 Database basics

A relational database stores data in tables with rows and columns.

Core concepts:

- table: [prisma/schema.prisma](prisma/schema.prisma)
- primary key: model IDs such as animal_id, farm_id, user_id
- foreign key: references between model tables
- one-to-many: one farm has many animals
- many-to-many: represented through join tables or link tables
- constraints: uniqueness and validation in schema
- indexes: faster lookups
- transactions: atomic database operations

## 5.2 Prisma schema

The main schema is [prisma/schema.prisma](prisma/schema.prisma).

Important things to notice:

- datasource db { provider = "postgresql" }
- generator client { provider = "prisma-client-js" }
- model names like farms, users, animals, milk_logs, breeding_records, vaccination_records
- relation fields indicate real connections between tables

## 5.3 Prisma Client and schema sync

The app uses Prisma Client generated at runtime and in scripts. The initialization is in [lib/db.ts](lib/db.ts).

Commands in [package.json](package.json):

- db:pull
- db:push
- db:init
- db:seed

This means the project has both SQL bootstrap and Prisma workflow patterns.

## 5.4 Seed data

The project seeds demo data in [prisma/seed.ts](prisma/seed.ts).

This script intentionally resets data and rebuilds a realistic farm dataset. It is not a harmless default: it deletes and recreates data.

IMPORTANT: dangerous / destructive script

- [prisma/seed.ts](prisma/seed.ts): resets tables and reseeds data
- [prisma/seed-e2e-lifecycle-animal.ts](prisma/seed-e2e-lifecycle-animal.ts): touches lifecycle data and test records

Do not run these against a production-like database unless you intend to clear data.

## 5.5 Conceptual database model

A conceptual view is:

Farm
→ Units
→ Animals
→ Breeds / Species

Animal
→ Growth logs
→ Health incidents
→ Milk logs
→ Heat cycle records
→ Breeding records
→ Pregnancy records
→ Calving records
→ Vaccination records

Inventory
→ inventory_items
→ inventory_lots
→ inventory_transactions

Users
→ notifications
→ audit_logs
→ chat conversations
→ presence

## 5.6 Important models in TerraDairy

### Farms

Model: farms

Fields include: farm_id, farm_name, owner_name, city, country, total_area_acres.

Relationship: a farm has many animals, units, inventory items.

### Units

Model: units

Represents physical sections or sheds, such as milking unit, maternity unit, calf shed.

### Species and breeds

Models: species and breeds

A species contains many breeds. Each breed belongs to a species.

### Animals

Model: animals

This is the central model. It stores:

- tag_number
- gender
- date_of_birth
- farm_id
- unit_id
- breed_id
- pregnancy_status
- lactation_status
- lifecycle_stage

This is the core of the farm system.

### Growth

Model: growth_logs

Stores weight records over time.

### Health

Model: health_incidents

Stores disease or incident details, severity, symptoms, treatment, and status.

### Treatments

Model: treatment_records

Healthcare treatment entries linked to health incidents or group treatment batches.

### Vaccinations

Model: vaccination_records

Tracks vaccine name, date, due date, source, dosage, and animal or breeding/pregnancy linkage.

### Heat cycles

Model: heat_cycle_records

Tracks animal heat cycle start/end dates and detection method.

### Breeding

Model: breeding_records

Tracks breeding date, male/female animals, method, result, semen batch reference, and notes.

### Pregnancy

Model: pregnancy_records

Tracks insemination date, confirmation, due date, actual delivery, and status.

### Calving

Model: calving_records

Tracks calving outcomes, calf tag and calf ID, mother, and related pregnancy/lactation records.

### Milk

Model: milk_logs

Stores per animal milk production, date, session, and liters.

### Inventory

Model: inventory_items, inventory_lots, inventory_transactions

Stores stock, lots, quantity, expiry, movement history, and item metadata.

### Users and roles

Model: users and role_permissions

The permissions model is in [lib/rbac/permissions.ts](lib/rbac/permissions.ts) and the database model is in [prisma/schema.prisma](prisma/schema.prisma).

### Chat and messages

Models: chat_conversations, chat_conversation_participants, chat_messages, chat_message_attachments, chat_message_reads, user_presence

This supports a message system and active presence.

### Notifications

Model: notifications

Tracks user-specific alerts.

### Audit logs

Model: audit_logs

Records changes to entities.

---

# PART 6 — AUTHENTICATION & AUTHORIZATION

## 6.1 Basic concepts

Authentication: confirms user identity.

Authorization: determines permissions.

Password hashing: one-way transformation of password before storage.

Sessions: a way to know the current user between requests.

Roles: named user types.

Permissions: specific allowed actions.

Route protection: only logged-in users can view certain pages.

API protection: routes should reject unauthorized requests.

## 6.2 TerraDairy implementation

Authentication in [lib/auth.ts](lib/auth.ts)

- Uses NextAuth credentials provider
- Validates email/password against Prisma users
- Compares the submitted password with stored bcrypt hash
- Adds role and permissions to session JWT

Password hashing is done with bcrypt in [services/auth.service.ts](services/auth.service.ts) and [lib/auth.ts](lib/auth.ts).

Authorization is in [lib/rbac/permissions.ts](lib/rbac/permissions.ts).

Route protection is done in [middleware.ts](middleware.ts):

- public paths: /login, /register, /api/auth, /forbidden
- all other routes require a valid session
- redirect to /login if absent

API protection is performed by [lib/api-auth.ts](lib/api-auth.ts) using requirePermission and requirePermissionKey.

## 6.3 Real login flow

Actual flow:

1. User enters email and password on [app/login/page.tsx](app/login/page.tsx)
2. Hook calls signIn from [hooks/use-auth.ts](hooks/use-auth.ts)
3. NextAuth credentials provider validates login in [lib/auth.ts](lib/auth.ts)
4. If valid, JWT session includes userId, role, permissions
5. Middleware checks route access on every request
6. Protected API routes run requirePermission
7. UI receives session and current permissions

This is the most important security boundary in the application.

## 6.4 Roles and permissions

Roles are defined in [lib/rbac/permissions.ts](lib/rbac/permissions.ts), with default permission grants for ADMIN, FARM_MANAGER, VETERINARIAN, INVENTORY_MANAGER, FARM_WORKER, VIEWER.

Permission matrix examples:

- dashboard.view
- animals.create
- milk.edit
- inventory.stock_in
- ai_assistant.view
- roles.edit

These build the authorization system used across the app.

---

# PART 7 — API SYSTEM

## 7.1 Major API groups in TerraDairy

The app has a large API surface under [app/api/](app/api/). Common modules include:

- animals
- farms
- breeds/species
- units
- milk-logs
- breeding-records
- vaccinations
- pregnancy-records
- inventory
- dashboard
- notifications
- roles
- users
- chat
- assistant

## 7.2 Representative endpoint patterns

Examples from actual code:

- [app/api/animals/route.ts](app/api/animals/route.ts)
- [app/api/milk-logs/route.ts](app/api/milk-logs/route.ts)
- [app/api/roles/route.ts](app/api/roles/route.ts)
- [app/api/notifications/route.ts](app/api/notifications/route.ts)
- [app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts)

Typical flow:

- GET: list/filter
- POST: create
- PUT/PATCH: update
- DELETE: remove

## 7.3 Example: animals API

[app/api/animals/route.ts](app/api/animals/route.ts)

- requires permission animals.read for GET
- requires permission animals.create for POST
- parses request parameters with Zod
- calls animalService.findAll or .create
- returns paginated or created response

## 7.4 Example: role API

[app/api/roles/route.ts](app/api/roles/route.ts)

- GET loads the role matrix (requires roles.view)
- PUT updates permissions (requires roles.edit)
- invalidates permission cache after change

This is a concrete example of authorization enforcement plus runtime permission refresh.

## 7.5 Example: AI assistant API

[app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts)

- validates chat transcript
- ensures the last message is from the user
- requires permission assistant.read via requirePermission
- calls runAssistant
- returns answer, toolsUsed, and sourceRoute

This is a major feature because it is the app’s AI interface.

---

# PART 8 — VALIDATION & ERROR HANDLING

## 8.1 Zod

Zod validates user-supplied inputs before a service runs.

Examples:

- [validators/auth.validator.ts](validators/auth.validator.ts)
- [validators/animal.validator.ts](validators/animal.validator.ts)
- [validators/inventory.validator.ts](validators/inventory.validator.ts)

The system always parses incoming data before writing or querying database records.

## 8.2 Input validation

Validation is used to check:

- required fields
- string length
- enum values
- date formatting
- numeric constraints

This avoids bad data entering the system and reduces many classes of bug.

## 8.3 Error handling architecture

The central error handling is in [lib/errors.ts](lib/errors.ts).

Classes include:

- AppError
- NotFoundError
- ValidationError
- UnauthorizedError
- ForbiddenError
- ConflictError

The API layer wraps exceptions into JSON payloads via [lib/api-response.ts](lib/api-response.ts).

## 8.4 HTTP status codes

Common patterns in TerraDairy:

- 200 OK
- 201 Created
- 400 ValidationError
- 401 Unauthorized
- 403 Forbidden
- 404 Not found
- 409 Conflict
- 500 Internal error

## 8.5 Prisma errors

Prisma client errors are converted in [lib/errors.ts](lib/errors.ts) to friendly API responses.

Common handling:

- P2002: unique conflict
- P2025: not found

## 8.6 How errors reach the frontend

A route catches errors and calls handleApiError. The frontend uses [lib/api-client.ts](lib/api-client.ts) to read the JSON error payload and throws an ApiRequestError.

This makes UI error handling predictable.

## 8.7 Example: successful request

POST /api/animals with valid payload

- validation passes
- service creates record
- database writes row
- route returns createdResponse
- frontend receives JSON data
- query invalidates and refreshes the list

## 8.8 Example: failed request

A bad milk log or invalid permission request

- route fails validation or permission check
- handleApiError returns JSON
- frontend shows error
- no database write occurs

---

# PART 9 — FRONTEND

## 9.1 React basics

This app uses React components, state through hooks, and mutation/query flows for data.

Core concepts:

- component
- props
- state
- hooks
- event handlers
- conditional rendering

Examples:

- [app/login/page.tsx](app/login/page.tsx)
- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)
- [components/assistant/](components/assistant/)

## 9.2 Next.js routing

The app is route-driven by the App Router.

Examples:

- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)
- [app/animals/list/page.tsx](app/animals/list/page.tsx)
- [app/settings/page.tsx](app/settings/page.tsx)

The route map is defined in [lib/routes.ts](lib/routes.ts).

## 9.3 Data fetching

The app uses TanStack Query hooks from [hooks/](hooks/). The UI is not hitting the database directly; it calls the API layer.

Example:

- [hooks/use-dashboard.ts](hooks/use-dashboard.ts)
- [hooks/use-animals.ts](hooks/use-animals.ts)

## 9.4 Loading and error states

The dashboard code has explicit loading and error handling in [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx).

This is good practice for user experience and state clarity.

## 9.5 Tables, filters, and search

The system includes many list pages with query parameters, filters, and paginated lists.

Examples:

- [services/animal.service.ts](services/animal.service.ts)
- [app/api/animals/route.ts](app/api/animals/route.ts)
- [hooks/use-animals.ts](hooks/use-animals.ts)

## 9.6 Modals and charts

The dashboard and reporting UIs include charts and custom presentation components.

Examples:

- [app/components/custom-charts.tsx](app/components/custom-charts.tsx) if present in the app tree
- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)

## 9.7 Reusable components

The UI is structured around reusable blocks:

- cards
- buttons
- tables
- forms
- charts
- filters

Used across the app.

---

# PART 10 — MAJOR TERRADAIRY FEATURES

## 10.1 Animal management

What it does:

Tracks animal records, status, life cycle, and related health/milk data.

Database models:

- animals
- breeds
- species
- units
- farms

API:

- [app/api/animals/route.ts](app/api/animals/route.ts)
- [app/api/animals/[id]/route.ts](app/api/animals/[id]/route.ts)

Service:

- [services/animal.service.ts](services/animal.service.ts)

Frontend:

- [app/animals/list/](app/animals/list/)
- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)

Data flow:

animal list query → API → service → Prisma → records → UI

## 10.2 Animal lifecycle

This includes lifecycle_stage, pregnancy_status, lactation_status, and dynamics around dry, lactating, pregnant, calf, and retired states.

Relevant logic:

- [lib/animal-rules.ts](lib/animal-rules.ts)
- [lib/production-status.ts](lib/production-status.ts)
- [lib/pregnancy-status.ts](lib/pregnancy-status.ts)
- [services/lactation.service.ts](services/lactation.service.ts)

## 10.3 Milk production

What it does:

Tracks daily milk yields and trends.

Database models:

- milk_logs
- animals

API:

- [app/api/milk-logs/route.ts](app/api/milk-logs/route.ts)
- [app/api/milk-logs/stats/route.ts](app/api/milk-logs/stats/route.ts)

Service:

- [services/milk.service.ts](services/milk.service.ts)
- [services/dashboard.service.ts](services/dashboard.service.ts)

Frontend:

- [app/animals/milk-production/](app/animals/milk-production/)

## 10.4 Health and treatments

Models:

- health_incidents
- treatment_records
- group_treatment_batches

API:

- [app/api/animals/[id]/health-incidents/route.ts](app/api/animals/[id]/health-incidents/route.ts)

Service:

- [services/health.service.ts](services/health.service.ts)

## 10.5 Vaccinations

Models:

- vaccination_records

API:

- [app/api/vaccinations/route.ts](app/api/vaccinations/route.ts)

Frontend:

- [app/animals/vaccinations/](app/animals/vaccinations/)

## 10.6 Breeding, heat cycles, pregnancy, calving

Models:

- breeding_records
- heat_cycle_records
- pregnancy_records
- calving_records
- lactation_periods

Relevant services:

- [services/breeding.service.ts](services/breeding.service.ts)
- [services/pregnancy.service.ts](services/pregnancy.service.ts)
- [services/calving.service.ts](services/calving.service.ts)
- [services/heat-cycle.service.ts](services/heat-cycle.service.ts)

## 10.7 Inventory

Models:

- inventory_items
- inventory_lots
- inventory_transactions

Service:

- [services/inventory.service.ts](services/inventory.service.ts)
- [lib/inventory-lots.ts](lib/inventory-lots.ts)
- [lib/inventory-enrich.ts](lib/inventory-enrich.ts)

API:

- [app/api/inventory/route.ts](app/api/inventory/route.ts)

## 10.8 Dashboard and analytics

Service:

- [services/dashboard.service.ts](services/dashboard.service.ts)

API:

- [app/api/dashboard/route.ts](app/api/dashboard/route.ts)

Frontend:

- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)

## 10.9 Notifications

Model:

- notifications

API:

- [app/api/notifications/route.ts](app/api/notifications/route.ts)

## 10.10 Chat and user collaboration

Models:

- chat_conversations
- chat_messages
- chat_message_reads
- user_presence

API:

- [app/api/chat/](app/api/chat/)

## 10.11 User roles and permissions

Models:

- users
- role_permissions

Core files:

- [lib/rbac/permissions.ts](lib/rbac/permissions.ts)
- [services/role-permission.service.ts](services/role-permission.service.ts)
- [app/api/roles/route.ts](app/api/roles/route.ts)

## 10.12 AI assistant

This is a major feature area with its own architecture:

- [app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts)
- [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts)
- [lib/ai/tools/](lib/ai/tools/)
- [lib/ai/source-router.ts](lib/ai/source-router.ts)
- [lib/ai/web-search.ts](lib/ai/web-search.ts)

---

# PART 11 — AI ASSISTANT

## 11.1 Basic concepts

- LLM: model that predicts and generates text
- AI API: service endpoint for model inference
- prompt: instruction given to the model
- context: prior conversation and retrieved records
- tool/function calling: model chooses a tool with structured arguments
- retrieval: fetching relevant data from a source
- RAG: retrieval-augmented generation
- knowledge base: curated documents for trusted info
- source routing: deciding whether to use database or web search

## 11.2 TerraDairy implementation

This project implements a database-first assistant with optional web grounding.

The actual architecture:

- request enters [app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts)
- orchestrator runs [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts)
- source router decides DATABASE / WEB / COMBINED in [lib/ai/source-router.ts](lib/ai/source-router.ts)
- tools are defined in [lib/ai/tools/](lib/ai/tools/)
- data retrieval happens through tool handlers calling Prisma and services
- Gemini or OpenAI provider handles model calls through [lib/ai/providers/](lib/ai/providers/)
- external web grounding is done in [lib/ai/web-search.ts](lib/ai/web-search.ts)

## 11.3 Why the assistant uses the database first

The key rule from [docs/AI_SOURCE_MAP.md](docs/AI_SOURCE_MAP.md): farm-specific facts must come from the database, not from the web.

Example:

Question: “How many animals are on my farm?”

This should use the database because it asks about actual farm records. The AI should not guess or search the web for a count that is already stored in PostgreSQL.

This is implemented by the source-routing logic and tool system.

## 11.4 AI tool calling flow

User question
→ source route classification
→ tool selection
→ validated tool arguments
→ service/query execution
→ tool result JSON returned to model
→ model explains answer
→ UI shows final output

This is the real logic in [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts) and [lib/ai/security.ts](lib/ai/security.ts).

## 11.5 Important status note

CURRENTLY IMPLEMENTED:

- database-aware AI tools for animals, farms, milk, reports, etc.
- AI chat route and permission checks
- Google web grounding integration
- source routing logic

PARTIALLY IMPLEMENTED:

- source routing is implemented, but a dedicated veterinary knowledge base is not

NOT IMPLEMENTED:

- full certified veterinary KB with embeddings, vector storage, and trusted citations

---

# PART 12 — TESTING

## 12.1 Testing basics

- unit tests: test a single function or logic block
- integration tests: test multiple layers together
- end-to-end tests: exercise real browser flows

## 12.2 TerraDairy testing

Vitest:

- [vitest.config.ts](vitest.config.ts)
- [__tests__/setup.ts](__tests__/setup.ts)
- many tests under [__tests__/](__tests/)

Playwright:

- [playwright.config.ts](playwright.config.ts)
- [e2e/auth.spec.ts](e2e/auth.spec.ts)
- [e2e/dashboard.spec.ts](e2e/dashboard.spec.ts)

The test setup intentionally mocks server-only modules and Prisma to keep tests isolated.

## 12.3 Running tests

From [package.json](package.json):

- npm test
- npm run test:watch
- npm run test:coverage
- npm run test:e2e

## 12.4 How to understand a failure

1. Read the failing assertion
2. Check the actual route or function involved
3. Trace data flow from route → service → Prisma → response
4. Reproduce with the smallest test or a real call
5. Check permissions, validation, environment variables, or missing data

---

# PART 13 — DATABASE / FARM DATA SCRIPTS

## 13.1 Script categories in TerraDairy

There are scripts for:

- seeding demo data: [prisma/seed.ts](prisma/seed.ts)
- lifecycle animal e2e seed: [prisma/seed-e2e-lifecycle-animal.ts](prisma/seed-e2e-lifecycle-animal.ts)
- unit normalization: [prisma/normalize-units-data.ts](prisma/normalize-units-data.ts)
- farm catch-up/backfill: [prisma/catch-up-farm-to-date.ts](prisma/catch-up-farm-to-date.ts)
- animal date sync: [prisma/sync-animal-dates.ts](prisma/sync-animal-dates.ts)
- inventory seed: [prisma/seed-inventory.ts](prisma/seed-inventory.ts)
- RBAC permissions seed: [prisma/seed-rbac.ts](prisma/seed-rbac.ts)
- role permission seed: [prisma/seed-role-permissions.ts](prisma/seed-role-permissions.ts)

## 13.2 Dangerous scripts

The script in [prisma/seed.ts](prisma/seed.ts) is the most destructive. It resets core tables before reseeding. That is a deliberate development/seeding workflow, not a safe application command.

Other scripts may also alter database state or synchronize data; treat them as operational under development, not casual script execution.

## 13.3 When to use them

Use scripts when:

- populating a fresh local database
- generating demo farm data
- fixing data anomalies
- verifying a migration scenario

Do not use them when:

- you are unsure what the DB contains
- you are working on a shared environment
- you want to preserve existing production records

---

# PART 14 — DEVELOPMENT WORKFLOW

The common project workflow is:

1. Start the project: npm run dev
2. Understand the requirement
3. Find the relevant feature and route
4. Identify the database models
5. Identify the API route
6. Identify the service
7. Identify the frontend hooks and page
8. Make the change
9. Test it with unit or route tests
10. Check TypeScript errors and logs
11. Run build
12. Commit changes

Actual project commands from [package.json](package.json):

- npm install
- npm run dev
- npm run build
- npm test
- npm run test:e2e
- npm run db:seed
- npm run db:sync-animals
- npm run db:normalize-units

---

# PART 15 — DEBUGGING

## 15.1 Frontend debugging

Check:

- React Query state
- browser network requests
- route gating and session state
- page-level error handling

Examples:

- [hooks/use-dashboard.ts](hooks/use-dashboard.ts)
- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)

## 15.2 API debugging

Check:

- route handler
- validation parse
- requirePermission failure
- service call outcome
- status and error payload

Examples:

- [app/api/animals/route.ts](app/api/animals/route.ts)
- [lib/errors.ts](lib/errors.ts)

## 15.3 Database debugging

Trace:

- Prisma query filters
- relation names
- model field names
- serialized decimal/date issues

Examples:

- [lib/serialize.ts](lib/serialize.ts)
- [lib/db.ts](lib/db.ts)
- [prisma/schema.prisma](prisma/schema.prisma)

## 15.4 Prisma debugging

Check:

- schema mismatch
- generated client stale state
- missing relation fields
- database state inconsistencies

## 15.5 Authentication debugging

Check:

- session presence
- NEXTAUTH_SECRET
- credential provider logic in [lib/auth.ts](lib/auth.ts)
- middleware redirect behavior in [middleware.ts](middleware.ts)

## 15.6 React Query debugging

Check:

- queryKey mismatch
- stale time
- invalidation patterns
- mutation success callbacks

Example:

- [hooks/use-animals.ts](hooks/use-animals.ts)

## 15.7 TypeScript debugging

Check:

- zod parsing
- payload types
- Prisma model types
- route-response types

## 15.8 AI / Gemini debugging

Check:

- GEMINI_API_KEY
- AI provider selection
- source routing
- tool validation
- tool result serialization

Files:

- [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts)
- [lib/ai/security.ts](lib/ai/security.ts)
- [lib/ai/gemini-config.ts](lib/ai/gemini-config.ts)
- [lib/ai/assistant-errors.ts](lib/ai/assistant-errors.ts)

---

# PART 16 — SECURITY

## 16.1 Security mechanisms already in the project

- bcrypt password hashing in [lib/auth.ts](lib/auth.ts) and [services/auth.service.ts](services/auth.service.ts)
- session-based auth via NextAuth
- route protection via [middleware.ts](middleware.ts)
- permission-based RBAC via [lib/rbac/permissions.ts](lib/rbac/permissions.ts)
- Zod request validation in [validators/](validators/)
- API error handling in [lib/errors.ts](lib/errors.ts)
- AI tool argument validation in [lib/ai/security.ts](lib/ai/security.ts)
- secret redaction in [lib/ai/assistant-errors.ts](lib/ai/assistant-errors.ts)

## 16.2 SQL injection protection

The project uses Prisma and server-side validation. The AI layer is also constrained: model output is never passed straight to a DB query. The tool schema ensures the model must submit structured, validated arguments.

This is an important security feature.

## 16.3 File upload security

There are chat attachment routes and upload support in [app/api/chat/](app/api/chat/). The project includes file handling, but this guide cannot claim more than the code reveals. The exact upload security model should be checked in the file implementations themselves.

## 16.4 Security gaps / improvements

CURRENTLY IMPLEMENTED:

- standard auth, role gating, validation, hidden secrets handling

PARTIALLY IMPLEMENTED OR REQUIRES REVIEW:

- some advanced security monitoring is not clearly visible in this repo snapshot
- a dedicated security hardening audit would be needed for production deployment

---

# PART 17 — ADVANCED CONCEPTS

These are the concepts that matter once you understand the basics.

## 17.1 Separation of concerns

This project separates:

- UI
- hooks
- API
- permissions
- services
- database
- AI

This is a strong architecture for maintainability.

## 17.2 Service layer

The service layer in [services/](services/) is where business logic and Prisma queries live. This is an important pattern to learn because it keeps route handlers simpler.

## 17.3 Transactions

The app uses transactions for operations that must be atomic, especially inventory and role permission updates.

Examples:

- [services/inventory.service.ts](services/inventory.service.ts)
- [services/role-permission.service.ts](services/role-permission.service.ts)

## 17.4 Data serialization

The project serializes Prisma decimals and dates before sending JSON. See [lib/serialize.ts](lib/serialize.ts).

This is required because Prisma Decimal and Date objects do not serialize cleanly in JSON.

## 17.5 React Query caching

The data layer is heavily cached through TanStack Query. This reduces unnecessary network traffic and improves responsiveness.

## 17.6 Server/client boundaries

TerraDairy strongly separates server logic from browser logic. The database never runs in the browser. This is a major design principle of Next.js and the project.

## 17.7 Security and validation layers

The architecture combines:

- route checks
- permission checks
- Zod validation
- Prisma safety
- AI security checks

This is exactly how a mature app should be structured.

## 17.8 AI tool calling and source routing

The AI system is a layered architecture, not just a single prompt. It includes:

- source detection
- tool selection
- validation
- result formatting
- external web fallback when needed

This is a real system architecture and good to study.

---

# PART 18 — LEARNING ORDER

## LEVEL 0 — Computer and web basics

What to learn:

- browser, server, request, response, HTML, CSS, JavaScript

Why it matters:

You need to understand how the UI and API communicate.

Files to study:

- [app/layout.tsx](app/layout.tsx)
- [lib/api-client.ts](lib/api-client.ts)
- [app/login/page.tsx](app/login/page.tsx)

## LEVEL 1 — JavaScript and TypeScript

What to learn:

- variables, functions, async/await, object literals, types

Files:

- [services/animal.service.ts](services/animal.service.ts)
- [validators/](validators/)

## LEVEL 2 — React

What to learn:

- components, props, hooks, state, events

Files:

- [app/animals/dashboard/page.tsx](app/animals/dashboard/page.tsx)
- [hooks/use-auth.ts](hooks/use-auth.ts)

## LEVEL 3 — Next.js

What to learn:

- App Router, pages, route handlers, layouts, middleware

Files:

- [app/layout.tsx](app/layout.tsx)
- [middleware.ts](middleware.ts)
- [app/api/](app/api/)

## LEVEL 4 — Database and SQL

What to learn:

- tables, relations, joins, indexes, transactions

Files:

- [prisma/schema.prisma](prisma/schema.prisma)
- [services/dashboard.service.ts](services/dashboard.service.ts)

## LEVEL 5 — Prisma

What to learn:

- schema design, model relations, generated client, queries

Files:

- [lib/db.ts](lib/db.ts)
- [services/inventory.service.ts](services/inventory.service.ts)

## LEVEL 6 — Auth and RBAC

What to learn:

- login, sessions, JWT, permissions, roles, route guards

Files:

- [lib/auth.ts](lib/auth.ts)
- [lib/rbac/permissions.ts](lib/rbac/permissions.ts)
- [middleware.ts](middleware.ts)

## LEVEL 7 — API and services

What to learn:

- route handlers, validation, service layer, serialization

Files:

- [app/api/animals/route.ts](app/api/animals/route.ts)
- [services/animal.service.ts](services/animal.service.ts)

## LEVEL 8 — Farm domain modules

What to learn:

- animals, health, breeding, inventory, pregnancy, milk

Files:

- [services/](services/)
- [app/api/](app/api/)

## LEVEL 9 — Testing

What to learn:

- unit tests and E2E checks

Files:

- [__tests__/](__tests/)
- [e2e/](e2e/)

## LEVEL 10 — AI assistant

What to learn:

- source routing, tool calling, Gemini/OpenAI, web grounding

Files:

- [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts)
- [docs/AI_SOURCE_MAP.md](docs/AI_SOURCE_MAP.md)

## LEVEL 11 — Advanced architecture

What to learn:

- maintainability, architecture design, security, scaling, RBAC evolution

Files:

- [lib/](lib/)
- [services/](services/)
- [docs/AI_SOURCE_MAP.md](docs/AI_SOURCE_MAP.md)

---

# PART 19 — HANDS-ON EXERCISES

These are exercises you should do after studying the relevant modules. Do not implement them here; just practice the reasoning.

## Beginner exercises

1. Find the login page and explain the handoff from form → hook → NextAuth → session.
2. Find the Animal model in [prisma/schema.prisma](prisma/schema.prisma) and explain its central fields.
3. Trace the GET /api/animals route and identify the exact files involved.
4. Describe how a page requests dashboard data using TanStack Query.
5. Find the permissions mapping for a FARM_WORKER role.

## Intermediate exercises

1. Explain how inventory stock movement works from schema to service to API.
2. Trace a milk production list request and identify each layer involved.
3. Explain why [lib/serialize.ts](lib/serialize.ts) exists.
4. Identify the difference between authentication and authorization in this codebase.
5. Explain how the AI assistant routes a question to database tools versus web grounding.

## Advanced exercises

1. Design a new API endpoint for a custom farm metric.
2. Add a new relation to the schema and walk through the necessary changes in Prisma, service, route, and UI.
3. Add a new permission and route guard for a new app module.
4. Add a new test case in [__tests__/](__tests/) and explain how it proves behavior.
5. Integrate a new AI tool and ensure it is routed correctly through the source-router and provider stack.

---

# PART 20 — FINAL PROJECT UNDERSTANDING CHECKLIST

You are ready when you can explain all of these with confidence:

- How a request travels from page UI to route handler to service to database and back
- How the TerraDairy database models are connected
- How authentication works with NextAuth and JWT sessions
- How permissions and roles are resolved
- How an animal is created, retrieved, and updated
- How milk records are stored and aggregated
- How inventory changes are tracked
- How pregnancy and calving logic operate in records and status handling
- How the AI assistant decides whether to use the database or web search
- How errors are normalized and returned to the UI
- How tests are structured in Vitest and Playwright
- How to debug a missing or broken feature
- How to add a new feature while preserving project structure

---

# Final note: what is implemented today

This project is a working farm management platform with a strong architecture, but it is not a “generic SaaS starter.” It has real domain logic for animals, milk, breeding, pregnancy, vaccination, health, inventory, permissions, chat, and AI.

Current implementation status summary:

- CURRENTLY IMPLEMENTED: business app structure, auth, RBAC, CRUD APIs, database schema, dashboard, AI assistant, test harness
- PARTIALLY IMPLEMENTED: AI knowledge-base layer for veterinary guidance is not fully implemented; web grounding exists but a curated veterinary RAG store is not present
- NOT IMPLEMENTED: full external KB / pgvector / document ingestion pipeline for authoritative veterinary content

---

# From Zero to TerraDairy Developer

If you study in order, you can move from beginner to contributor in a sensible progression:

1. Learn the web basics
2. Learn JavaScript and TypeScript
3. Learn React
4. Learn Next.js
5. Learn PostgreSQL and SQL
6. Learn Prisma
7. Learn auth and RBAC
8. Learn API and service layers
9. Learn the farm modules
10. Learn testing
11. Learn AI source routing and tool calling
12. Learn debugging and production thinking

That sequence matches the actual project architecture and is the best path to skillfully maintaining and extending TerraDairy.
