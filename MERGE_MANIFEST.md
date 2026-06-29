# TerraDairy Unification — Merge Manifest

Single canonical project root: `terradairy/`. No `project-original/`,
`project-improved/`, `old/`, `new/`, or `backup/` folders exist.

## Base
Project B (the audit-driven "improved" rebuild) was used as the base, since
it already contains a superset of Project A's Prisma models, dependencies,
and route structure (auth, RBAC, validation, service layer, audit log,
notifications, React Query hooks, tests, docs).

## Verified superset (no merge needed)
- `prisma/schema.prisma` — B contains every model from A plus `audit_logs`,
  `notifications`, `users`. No relations were dropped.
- `package.json` — every dependency in A's `dependencies`/`devDependencies`
  is already present in B.
- `app/farms/page.tsx`, `app/species-breeds/page.tsx`,
  `app/milk-production/page.tsx` — diffed line-by-line against A; these are
  faithful hooks-based refactors that preserve every original filter,
  modal, and table feature.

## Modified Files (functionality merged back in)
- **`app/units/page.tsx`** — B's refactor had dropped the original's
  multi-farm overview grid, capacity bar, lifecycle pie chart, daily-milk
  metric, and the full filter panel (health / vaccination / pregnancy /
  heat-cycle / lifecycle / weight range / checkup & vaccination date
  ranges). Rewrote the page to restore all of that on top of B's
  React-Query mutation architecture and editable fields.
- **`services/units.service.ts`** (`findById`) — extended the Prisma
  `include` so the unit-detail endpoint returns each animal's latest
  health incident, vaccination record, growth log, pregnancy record, heat
  cycle record, and milk log — the relational equivalent of the flat
  status columns the original schema used, needed to power the restored
  Units filters.
- **`services/notifications.service.ts`** — merged in `checkAndGenerateAlerts()`
  from the duplicate `notification.service.ts` (vaccination/delivery/critical
  incident alert generation), since the route-facing plural service was
  otherwise missing that logic.
- **`types/index.ts`** — added missing `FarmDetail` and `UnitDetail`
  interfaces (referenced by `app/farms/page.tsx` and the rewritten
  `app/units/page.tsx` but never defined — a latent bug in B).
- **`hooks/use-farms.ts`, `hooks/use-units.ts`** — `useFarm`/`useUnit` now
  typed against `FarmDetail`/`UnitDetail`.
- **`hooks/use-breeds.ts`** — fixed import to canonical `breeds.validator`.
- **`hooks/use-animals.ts`** — `useAnimals(params)` param made optional.
- **`app/animals/page.tsx`**, **`app/species-breeds/page.tsx`** — added
  missing `is_active: true` on create payloads (compile-time bug in B).
- **`app/milk-production/page.tsx`** — cast `session` to its literal union
  type.
- **`app/animals/[id]/page.tsx`**, **`app/animals/[id]/components/AnimalHealthTab.tsx`**,
  **`app/animals/[id]/components/AnimalProfileTab.tsx`** — fixed
  `useAllAnimals` → `useAnimals`, fixed `useUpdateHealthIncident` call
  signature, wired up `AnimalLineageCard`/`AnimalLocationCard` imports and
  props.
- **`services/index.ts`** — converted ambiguous `export *` barrel (every
  service module exports `findAll`/`create`/etc., causing name collisions)
  to namespaced `export * as XService` re-exports.
- **`validators/index.ts`** — de-duplicated barrel exports.
- **`tsconfig.json`** — added `"types": ["vitest/globals"]` so `vi` resolves
  in test files under `tsc --noEmit`.

## Deleted Files (duplicates removed, canonical kept)
| Removed | Kept (canonical) | Reason |
|---|---|---|
| `services/breed.service.ts` | `services/breeds.service.ts` | All API routes already import the plural file; it also includes the `species` relation the singular one lacked. |
| `services/unit.service.ts` | `services/units.service.ts` | Same — routes/hooks already use the plural file. |
| `services/notification.service.ts` | `services/notifications.service.ts` | Routes use the plural file; its unique `checkAndGenerateAlerts` logic was merged into the plural file before deletion. |
| `validators/breed.validator.ts` | `validators/breeds.validator.ts` | Routes/services import the plural file; missing `breedIdParamSchema` was ported over before deletion. |
| `validators/unit.validator.ts` | `validators/units.validator.ts` | Same pattern; `unitIdParamSchema` ported over. |
| `validators/growth-log.validator.ts` | `validators/growth-logs.validator.ts` | Routes/services/hooks all use the plural file. |
| `validators/health-incident.validator.ts` | `validators/health-incidents.validator.ts` | Same; `healthIncidentIdParamSchema` ported over. |
| `app/animals/[id]/components/AnimalTabSwitcher.tsx` | — | Dead/unused leftover component; the real tab UI lives directly in `app/animals/[id]/page.tsx`. |
| `scripts/generate-*.js` | — | One-off code-generation scripts used to scaffold Project B; not part of the running application. |
| `package-lock.json` | — | Regenerate via `npm install` against the merged `package.json`. |

## Added Files
- `MERGE_MANIFEST.md` (this file)
- `FarmDetail` / `UnitDetail` type definitions (see above)

## Known pre-existing issues (not introduced by this merge, left as-is)
- `prisma generate` could not run in the sandbox used for this merge because
  outbound access to `binaries.prisma.sh` is network-restricted here; run
  `npx prisma generate` after installing in an environment with normal
  network access. Several `@prisma/client` type errors disappear once that
  runs.
- A handful of pre-existing strict-mode type-narrowing issues in
  `lib/errors.ts`, `lib/api-auth.ts`, `services/milk.service.ts`, and two
  test files (`__tests__/lib/errors.test.ts`, `__tests__/lib/api-auth.test.ts`)
  predate this merge and are unrelated to the original-vs-improved
  reconciliation; flagging here rather than silently rewriting test
  expectations.

## Final structure
```
terradairy/
├── app/            # routes, pages, API handlers
├── components.json
├── prisma/         # unified schema (superset of original + audit/notifications/users)
├── services/       # one canonical service per domain
├── validators/      # one canonical Zod validator per domain
├── types/
├── hooks/          # React Query hooks
├── lib/
├── middleware.ts   # NextAuth + RBAC
├── __tests__/, e2e/
├── docs (README.md, API_REFERENCE.md, DEPLOYMENT_GUIDE.md, IMPLEMENTATION_GUIDE.md)
├── package.json
└── ...
```
