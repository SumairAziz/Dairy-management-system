# TerraDairy — Smart Dairy Farm Management

Full-stack dashboard built with **Next.js 15 (App Router) + Prisma + PostgreSQL + Tailwind CSS**.
React 19 compatible. Charts are custom inline SVG (no recharts), so there are no peer-dep conflicts.

## 1. Prerequisites
- Node.js 20+
- PostgreSQL running locally (default assumed: `postgres:12345@localhost:5432`)
- A database named `terradairy`. Create it if needed:
  ```bash
  createdb -U postgres terradairy
  ```

## 2. Configure environment
```bash
cp .env.example .env
# edit DATABASE_URL if your credentials differ
```

## 3. Install dependencies
```bash
npm install
```

## 4. Initialize the schema
If your database is **empty**, create the tables from the bundled SQL:
```bash
npm run db:init
```
If your database **already contains** the TerraDairy schema, introspect it:
```bash
npx prisma db pull
npx prisma generate
```
If you prefer Prisma migrations, run:
```bash
npx prisma db push
```

## 5. Run the dev server
```bash
npm run dev
```
Open http://localhost:3000

## Project structure
```
app/
  api/                  REST endpoints (Next.js Route Handlers)
    dashboard/          GET aggregated stats
    farms/[id]/         CRUD + per-farm stats
    units/[id]/         CRUD + per-unit stats
    species/  breeds/   CRUD
    animals/[id]/       CRUD + growth-logs/ + health-incidents/
  components/           Sidebar, Navbar, custom SVG charts, modal, fetch hook
  context/              Theme (light/dark) context
  farms/  units/  species-breeds/  animals/  animals/[id]/   Pages
prisma/schema.prisma    Prisma models matching sql_queries.sql
lib/db.ts               PrismaClient singleton
lib/serialize.ts        Decimal-safe JSON serializer
sql_queries.sql         One-shot SQL to initialize an empty database
```

## Notes
- All `Decimal` and `Date` fields are normalized in the API layer so the frontend gets plain JSON.
- Theme preference is persisted to `localStorage`; toggle via the moon/sun icon top-right.
- The `New animal` form filters units by the selected farm.
- Editing a status field on an animal profile saves on `blur`; dashboard counts update on next load.
