npm run db:seed
→ Creates complete demo farm data.

npm run db:seed:inventory
→ Adds sample inventory and stock movements.

npm run db:seed:e2e-lifecycle
→ Creates a complete animal lifecycle with health, treatment, vaccination, breeding, pregnancy, calving, offspring, and milk data.

npm run db:sync-animals
→ Reconciles animal lifecycle, pregnancy, lactation, and active-status data.

npm run db:normalize-units
→ Normalizes farm units and assigns animals according to their lifecycle stage.

npx tsx prisma/catch-up-farm-to-date.ts
→ Advances existing farm data from its last recorded date to the current date, including milk, health, breeding, pregnancy, vaccination, treatment, growth, and animal status.