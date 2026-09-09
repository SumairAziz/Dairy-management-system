# TerraDairy — QA Test Matrix

Generated from a full source inspection (pages, API routes, Prisma schema, services, validators, and shared `lib/` logic) of the TerraDairy dairy-farm management app. Every row below is grounded in actual code — file paths are cited in-line where a fact isn't obvious from the module name.

**How to read this document:** each module has a Features summary followed by one test-case table. The **Category** column is one of: `CRUD`, `Filter`, `Dashboard`, `Navigation`, `Automation`, `Edge Case`. Every row has an explicit **Expected Result** — that's the assertion to verify.

A companion **[Known Issues / Cross-Cutting Risks](#known-issues--cross-cutting-risks)** section at the end lists real inconsistencies and bugs found during this inspection (not hypothetical) — treat these as regression-watch items, not assumptions to test "should pass."

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Farms](#2-farms)
3. [Units](#3-units)
4. [Species & Breeds](#4-species--breeds)
5. [Animals](#5-animals)
6. [Milk Production](#6-milk-production)
7. [Vaccinations](#7-vaccinations)
8. [Breeding](#8-breeding)
9. [Heat Cycles](#9-heat-cycles)
10. [Pregnancy](#10-pregnancy)
11. [Calving](#11-calving)
12. [Known Issues / Cross-Cutting Risks](#known-issues--cross-cutting-risks)

---

## 1. Dashboard

**Route:** `/` only. Read-only aggregate view — no create/update/delete UI of its own; every number is recomputed live on each page load (no caching). Backed by `GET /api/dashboard` → `services/dashboard.service.ts`.

**Features:** herd/farm/species KPI tiles, 14-day milk trend, breeding/pregnancy/heat-cycle-method distribution charts, farm capacity utilization, lifecycle stage distribution, milk-by-farm, health summary, vaccination coverage donut + top-vaccines list, recently-added-animals table, a dynamic alerts bar, and a Quick Actions panel linking to every other module's create flow.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| DASH-01 | Dashboard | Active Animals KPI | Load `/` | Shows `animals.count(is_active:true)`; hint = count of `lifecycle_stage="Lactating"` |
| DASH-02 | Dashboard | Today's Milk KPI | Load `/` on a day with milk logs | Value = last point of 14-day trend (today's sum); hint shows `L/cow` and a trend badge vs. yesterday |
| DASH-03 | Edge Case | Today's Milk trend badge when yesterday = 0 | Ensure no milk logged yesterday | Trend badge/arrow is **hidden** (delta % is `null`, avoids divide-by-zero) |
| DASH-04 | Edge Case | L/cow with zero lactating animals | No animals with `lifecycle_stage="Lactating"` | Hint shows `"—"` instead of a division result |
| DASH-05 | Dashboard | Confirmed Pregnant KPI | Load `/` with confirmed pregnancies | Value = `pregnancyByStatus["Confirmed"]`, falling back to raw active-status count if no "Confirmed" group; hint = Pending count |
| DASH-06 | Dashboard | Due in 30 Days KPI | Have a pregnancy with EDD within 30 days | Value = count of non-terminal pregnancies with `expected_delivery_date` in `[now, now+30d]` |
| DASH-07 | Dashboard | Vaccination Alerts KPI | Have both overdue and upcoming vaccinations | Value = count with `next_due_date <= now+7d` (**includes overdue**, no lower bound); hint shows overdue count if any, else "due within 7 days" |
| DASH-08 | Dashboard | Health Issues KPI | Have animals with Sick/Critical/Injured or Open/In Progress incidents | Value = sum of both status groups |
| DASH-09 | Dashboard | Alerts bar visibility | No alert-worthy conditions exist | Alerts bar is not rendered at all |
| DASH-10 | Navigation | Today's Milk card click | Click card | Navigates to `/milk-production?date_from=<today>&date_to=<today>` |
| DASH-11 | Navigation | Confirmed Pregnant card click | Click card | Navigates to `/pregnancy?status=confirmed` |
| DASH-12 | Navigation | Vaccination Alerts card click | Click with overdue > 0 | Navigates to `/vaccinations?status=overdue`; with 0 overdue → `?status=due_soon` |
| DASH-13 | Navigation | Health Issues card click | Click card | Navigates to `/animals?has_health_issue=true` |
| DASH-14 | Navigation | 14-day milk trend point click | Click any point on the line chart | Navigates to `/milk-production?date_from=<date>&date_to=<date>` for that specific day |
| DASH-15 | Navigation | Breeding Results pie slice click | Click a non-"Unknown" slice | Navigates to `/breeding?result=<label>` |
| DASH-16 | Navigation | Pregnancy Status pie slice click | Click a non-"Unknown" slice | Navigates to `/pregnancy?status=<RawLabel>` (raw capitalized DB value — see Known Issues #7) |
| DASH-17 | Navigation | Farm Capacity bar click | Click a farm's bar | Navigates to `/animals?farm_id=<id>` (drills into Animals, not Farms) |
| DASH-18 | Navigation | Lifecycle Stage bar click | Click a bar | Navigates to `/animals?lifecycle_stage=<label>` |
| DASH-19 | Navigation | Species Distribution pie slice click | Click a slice | Navigates to `/animals?species_id=<id>` |
| DASH-20 | Navigation | Recently Added Animals row "View" | Click a row | Navigates to `/animals/<animal_id>` |
| DASH-21 | Dashboard | Vaccination Coverage donut | Load with several vaccine types on record | Shows `vaccTotal / animalCount` — ratio **can exceed 100%** since one animal can have multiple records; not literally "% of animals vaccinated" |
| DASH-22 | Edge Case | Farm Capacity empty state | No units exist on any farm | Empty state: "No farm capacity data" / "Add units to farms to see capacity utilization." |
| DASH-23 | Edge Case | Recently Added Animals empty state | No animals in the system | "No animals yet. Add your first animal to get started." spans all 8 columns |
| DASH-24 | Edge Case | Dashboard fetch failure | Simulate DB/API error | "Failed to load dashboard. Is the database running?" (plain text, no retry button) |
| DASH-25 | Dashboard | Quick Actions panel colors | Load `/` | Each action tinted by module identity: New Animal=emerald, Log Milk=sky, Breeding=pink, Vaccinate=amber, Pregnancy=purple, Heat Cycle=orange |
| DASH-26 | Edge Case | "In Heat Now" summary stat vs. Heat Cycles page count | Have a heat-cycle-open **pregnant** animal | Dashboard's raw count **includes** pregnant animals (no `isActivePregnancy` exclusion); Heat Cycles page's own "In Heat" KPI **excludes** them — the two numbers can diverge (see Known Issues #10) |

---

## 2. Farms

**Route:** `/farms` — single page, master-detail via client-side tab state (no URL sync; selection resets on refresh). Backed by `services/farm.service.ts`, `validators/farm.validator.ts`.

**Features:** farm list with animal/unit counts, inline blur-to-save edit of every field, create/delete, per-farm stats (animal/unit counts, all-time milk, health incidents), species distribution and units-capacity charts.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| FARM-01 | CRUD | Create farm — required field | Submit with `farm_name` blank | Client blocks with "Please enter a farm name."; all other fields (`owner_name`, `contact_number`, `address`, `city`, `province`, `country`, `total_area_acres`, `notes`) are optional |
| FARM-02 | CRUD | Create farm — valid minimal | Submit with only `farm_name` | `POST /api/farms` succeeds, `is_active` defaults `true` |
| FARM-03 | Edge Case | `total_area_acres` = 0 | Submit `total_area_acres: 0` | API rejects (400) — validator requires `.positive()`, but the DB column default is `0.00` and the UI does **not** client-side validate this before submit |
| FARM-04 | Edge Case | `total_area_acres` negative | Submit `-5` | API rejects (400) |
| FARM-05 | Edge Case | Duplicate farm name | Create two farms with identical `farm_name` | **Both succeed** — no uniqueness constraint at schema or validator level |
| FARM-06 | CRUD | Inline field update | Blur out of any editable field in the detail panel | Auto-saves via `PUT /api/farms/:id` with no explicit Save button |
| FARM-07 | CRUD | Update `farm_name` to empty | Blur with `farm_name` empty | Rejected — `updateFarmSchema.farm_name` still enforces `min(1)` if the field is present in the payload |
| FARM-08 | CRUD | Toggle `is_active` | Click active/inactive toggle | Persists immediately via `PUT` |
| FARM-09 | CRUD | Delete farm | Click Delete → confirm | `DELETE /api/farms/:id`; if the deleted farm was selected, detail panel clears (`selected` → `null`) |
| FARM-10 | Automation | Delete farm cascade | Delete a farm that has units and animals | **All units under that farm are deleted** (`onDelete: Cascade`); **all animals on that farm are deleted**, which transitively cascades their `growth_logs`, `milk_logs`, `pregnancy_records` too |
| FARM-11 | Edge Case | Delete farm — no pre-check warning beyond dialog text | Delete a farm with dependents | No count/impact preview is shown — only the generic confirm text "...and all its data..."; deletion always succeeds (no "N animals will be deleted" guard) |
| FARM-12 | Filter | Farms list filters | Inspect `GET /api/farms` | **No query params supported at all** — always returns every farm; no search/filter UI on the page either |
| FARM-13 | Dashboard | Farm detail stat tiles | Select a farm with animals/units | Animals = active count; Units = count; "Daily milk" = **all-time** sum (misnamed — no date filter applied); Health incidents = summed across all statuses |
| FARM-14 | Edge Case | 404 on bad farm id | Request a non-existent farm id | `NotFoundError` → 404 with code `NOT_FOUND` |
| FARM-15 | Edge Case | Empty farms list | No farms exist | "No farms yet." — detail panel never renders, no auto-selection |
| FARM-16 | Edge Case | Auto-select stale after delete | Delete a farm that is **not** the selected one | `selected` stays on the still-selected farm (only resets if the *selected* farm itself was deleted) |
| FARM-17 | Edge Case | Generic error surfacing | Trigger any API error on create/update | Full-screen modal "Something went wrong" with raw `err.message` — no field-level inline errors |

---

## 3. Units

**Route:** `/units` — single page, farm-tab → unit-tab → detail, all client-side state (no URL sync). Backed by `services/units.service.ts`, `validators/units.validator.ts`.

**Features:** per-farm unit tiles, create/inline-edit/delete units, unit detail with occupancy gauge, an extensive **client-side-only** animal filter panel scoped to the selected unit, lifecycle distribution chart.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| UNIT-01 | CRUD | Create unit — required fields | Submit with `farm_id` or `unit_name` blank | Blocked client-side: "Please select a farm." / "Please enter a unit name." |
| UNIT-02 | CRUD | Create unit — defaults | Open New Unit modal | `unit_type` defaults `"Barn"`, `capacity` defaults `"50"` |
| UNIT-03 | Edge Case | `capacity` = 0 | Submit `capacity: 0` | API rejects — validator requires `.min(1)`, despite the Prisma column default being `0` |
| UNIT-04 | Edge Case | `capacity` negative | Submit `-1` | Rejected |
| UNIT-05 | CRUD | Inline field update | Blur any field (`unit_name`, `unit_type`, `capacity`, `description`, `notes`) | Auto-saves via `PUT /api/units/:id` |
| UNIT-06 | Edge Case | Reassign unit to a different farm | Update `farm_id` on an existing unit via the API | **Allowed** — validator permits it, but animals still pointing at this unit via `unit_id` are **not** re-synced; a unit can end up on a different farm than its housed animals believe |
| UNIT-07 | CRUD | Delete unit | Click Delete → confirm | `DELETE /api/units/:id` |
| UNIT-08 | Automation | Delete unit — animal impact | Delete a unit with animals assigned | Animals are **not** deleted — `unit_id` is set to `NULL` (optional FK, no explicit `onDelete`, defaults to `SetNull`) |
| UNIT-09 | Filter | Server-side farm filter | `GET /api/units?farm_id=<id>` | Returns only that farm's units — but note the page itself fetches **all** units unfiltered and does farm-scoping client-side instead |
| UNIT-10 | Filter | Animal search (in-unit) | Type free text in the unit-detail search box | Matches if `JSON.stringify(animal)` (any field, serialized) contains the query, case-insensitive |
| UNIT-11 | Filter | Health filter (in-unit) | Select `Open` / `In Progress` / `Resolved` / `Critical` | Filters against the latest `health_incidents[0].status` only |
| UNIT-12 | Filter | Vaccination filter (in-unit) | Select `Up to date` / `Due soon` / `Overdue` / `None on record` | Computed client-side: no record→"None on record"; no `next_due_date`→"Up to date"; overdue if past; due within 7 days→"Due soon" |
| UNIT-13 | Filter | Pregnancy filter (in-unit) | Select `Pregnant` / `Not Pregnant` | "Pregnant" only if `isCompletedPregnancy()` is false for the animal's latest record |
| UNIT-14 | Filter | Heat Cycle filter (in-unit) | Select `In Heat` / `Not in Heat` | "In Heat" only if latest heat record exists with `heat_end_date: null` |
| UNIT-15 | Filter | Weight range filter (in-unit) | Set `minWeight`/`maxWeight` | Filters against latest `growth_logs[0].weight_kg`, falling back to `birth_weight_kg` |
| UNIT-16 | Filter | Last checkup / last vaccination date range | Set from/to dates | Filters against latest `health_incidents[0].incident_date` / `vaccination_records[0].vaccination_date` respectively |
| UNIT-17 | Filter | Clear filters | Click "Clear" | Resets every filter field; active-filter badge count returns to 0 |
| UNIT-18 | Dashboard | Capacity gauge | Select a unit | `occupancy = active animals in unit`, `max = unit.capacity ?? 0` |
| UNIT-19 | Dashboard | Daily milk stat (misnamed) | Select a unit with milk history | Shows **all-time** sum for that unit's active animals, not a per-day figure |
| UNIT-20 | Navigation | Animal row "View" | Click a row in the unit's animal table | Navigates to `/animals/<id>` |
| UNIT-21 | Edge Case | Empty unit | Select a unit with zero animals | "No animals housed in this unit." (unfiltered) vs. "No animals match the current filters." (filtered) — distinct messages |
| UNIT-22 | Edge Case | No units for farm | Select a farm with zero units | "No units for this farm yet."; New Unit modal still openable |
| UNIT-23 | Edge Case | No farms at all | Zero farms exist | "New unit" button still visible; farm `<select>` in the modal has no options, so submission is always blocked by the client-side check |

---

## 4. Species & Breeds

**Route:** `/species-breeds` — one page, two side-by-side panels (Species master, Breeds detail filtered by selected species). Two fully separate entities/services/validators presented together. Backed by `services/species.service.ts` + `services/breeds.service.ts`.

**Features:** species list, breed list scoped to selected species, create/delete for both. **No edit UI exists for either entity**, even though `PUT` endpoints exist server-side.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| SPBR-01 | CRUD | Create species | Submit "New species" with a name | `POST /api/species` succeeds |
| SPBR-02 | Edge Case | Create species — blank name | Submit with empty `species_name` | API rejects (400, "Species name is required") — but the **UI has no `onError` handler wired up**, so the modal just stays open with **no visible error message** (silent failure) |
| SPBR-03 | Edge Case | Duplicate species name | Create a second species with an identical `species_name` | Rejected by DB unique constraint → 409 CONFLICT — again **silently swallowed** by the UI (no `onError`) |
| SPBR-04 | Edge Case | Species uniqueness case-sensitivity | Create "Cattle" then "cattle" | Behavior depends on Postgres column collation (not explicitly case-insensitive) — verify actual DB behavior |
| SPBR-05 | CRUD | Delete species | Click trash icon → confirm | `DELETE /api/species/:id`; if selected, `selectedSpecies` resets to `null` |
| SPBR-06 | Automation | Delete species cascade | Delete a species with breeds, none of which have animals | All breeds under that species are deleted (`onDelete: Cascade`) |
| SPBR-07 | Edge Case | Delete species with breeds that have animals | Attempt to delete a species whose breed(s) have animal records | **Fails with a raw HTTP 500 "A database error occurred"** — FK violation (`P2003`) on `animals.breed_id` is not specially handled, unlike `P2002`/`P2025`; UI has no error handler here either, so the failure is effectively invisible to the user |
| SPBR-08 | CRUD | Create breed | Select a species, submit "New breed" | `species_id` pre-fills to the currently selected species; `POST /api/breeds` |
| SPBR-09 | Edge Case | Create breed — blank name | Submit with empty `breed_name` | Rejected (400) — again no `onError`, silent failure in UI |
| SPBR-10 | Edge Case | Duplicate breed under same species | Create two breeds with the same name under one species | Rejected — `@@unique([species_id, breed_name])` → 409, silently swallowed by UI |
| SPBR-11 | CRUD | Same breed name, different species | Create "Holstein" under Species A and Species B | **Both succeed** — uniqueness is scoped per-species |
| SPBR-12 | Edge Case | `average_milk_production` negative | Submit a negative number | Rejected — validator requires `.min(0)` |
| SPBR-13 | CRUD | Delete breed with no animals | Delete an unused breed | Succeeds |
| SPBR-14 | Edge Case | Delete breed with animals | Attempt to delete a breed that has animal records | **Raw HTTP 500**, same unhandled FK-violation issue as SPBR-07; confirm dialog silently closes with the row still present on refetch |
| SPBR-15 | Filter | Breeds panel scoping | Select a species | Breeds panel shows only that species' breeds — but this filtering happens **client-side** (`GET /api/breeds` is called with no `species_id` param, despite the API supporting one) |
| SPBR-16 | Edge Case | Empty states | No species / no breeds for selected species / no species selected | "No species added yet." / "No breeds for {name} yet." / "Select a species to view its breeds." |
| SPBR-17 | Dashboard | Main Dashboard species/breed counts | Load `/` | Quick Actions strip shows `speciesCount`/`breedCount` = **raw** `prisma.species.count()`/`prisma.breeds.count()` — includes inactive rows, unlike this page's own species list which nests only `is_active:true` breeds |
| SPBR-18 | Navigation | No deep-linking | Check any module for a link into `/species-breeds` | None exists — Dashboard's Species Distribution chart links to `/animals?species_id=`, not here |

---

## 5. Animals

**Routes:** `/animals` (list + embedded `AnimalsDashboard`), `/animals/[id]` (detail with client-side tabs: Profile, Growth, Health, Milk, Breeding, Vaccination — **tab state is not URL-synced**, so a tab can't be deep-linked or survive a refresh). Backed by `services/animal.service.ts`, `services/animal-stats.service.ts`, `validators/animal.validator.ts`, `lib/animal-rules.ts`, `lib/animal-status.ts`.

**Features:** the largest module — full CRUD (create/read/update, **no delete UI**), 12 list filters (several relational/derived), an 11-tile own-dashboard, per-animal sub-resources (health incidents, growth logs), lineage tracking, and the landing point for cross-module "register newborn" and many drill-down links.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| ANML-01 | CRUD | Create animal — required fields | Submit missing `farm_id`/`breed_id`/`tag_number`/`gender`/`date_of_birth` | Rejected (400) per `createAnimalSchema` |
| ANML-02 | CRUD | Create animal — tag uniqueness | Create two animals with the same `tag_number` on the same farm | Rejected — `@@unique([farm_id, tag_number])` |
| ANML-03 | CRUD | Create animal — tag reuse across farms | Create two animals with the same `tag_number` on **different** farms | **Both succeed** — uniqueness is scoped per-farm |
| ANML-04 | CRUD | Create animal — lifecycle stage enum | Submit `lifecycle_stage` outside the 10-value enum | Rejected on **create** (enum-restricted) |
| ANML-05 | Edge Case | Update animal — lifecycle stage bypass | `PUT` with an arbitrary `lifecycle_stage` string (e.g. "Foo") ≤20 chars | **Accepted** — `updateAnimalSchema.lifecycle_stage` is a free string, not the enum; the badge renders the default/unstyled fallback and the animal is excluded from `stage_bucket` filtering/distribution |
| ANML-06 | Edge Case | No delete UI | Look for a delete button on `/animals` or `/animals/[id]` | **None exists** — `DELETE /api/animals/[id]` works via direct API call, and `useDeleteAnimal()` is defined but never invoked anywhere in the UI |
| ANML-07 | Edge Case | Delete animal with dependent records | Attempt to delete (via API) an animal with any health incident, heat cycle, vaccination record, breeding record, or as a registered parent | **Raw HTTP 500** — these relations are `onDelete: NoAction`, and the FK violation isn't specially handled |
| ANML-08 | Automation | Delete animal — cascading children | Delete an animal with **no** blocking relations above | `growth_logs`, `milk_logs`, `pregnancy_records` cascade-delete automatically |
| ANML-09 | Edge Case | "Health" field on detail page is non-functional | Change the Health select on `AnimalStatusCard` and blur | **No-op** — the blur handler re-sends the current `lifecycle_stage`/`is_active` values, never the selected health status; nothing persists |
| ANML-10 | CRUD | Update lineage | Set `mother_id`/`father_id` via the picker | Picker is filtered to gender F/M respectively and excludes the animal itself; saves on blur |
| ANML-11 | CRUD | Update location | Change `farm_id` | `unit_id` is automatically cleared to `null` on farm change |
| ANML-12 | CRUD | Toggle active status | Click active/inactive toggle | Persists via `PUT` |
| ANML-13 | CRUD | Growth log — no edit/delete | Try to edit or delete an existing growth log entry | **Not possible** — only `GET`/`POST` exist for growth logs; once created, a growth log is permanent |
| ANML-14 | Filter | `species_id` filter | Filter by species | Relational — resolves via `where.breeds = { species_id }`, not a direct animal column |
| ANML-15 | Filter | `pregnancy_status=PREGNANT` filter | Apply filter | Uses `getPregnantAnimalsFilter()` — a **live join** to `pregnancy_records` where status is Pending/Confirmed/In Progress, **not** the denormalized `animals.pregnancy_status` column |
| ANML-16 | Filter | `pregnancy_status=CALVED` / `FAILED` filter | Apply filter | Queries the raw `animals.pregnancy_status` column directly (denormalized, can drift — see Known Issues) |
| ANML-17 | Filter | `in_heat=true` filter | Apply filter | Matches animals with an open (unclosed) heat cycle record |
| ANML-18 | Filter | `vaccination_due=true` filter | Apply filter | Matches if **any** vaccination record has `next_due_date <= today+7d` (includes overdue, no lower bound) — note this differs from the dashboard's "Vaccination Due" KPI, which checks only the animal's **latest** record |
| ANML-19 | Filter | `breeding_eligible=true` filter | Apply filter | Compound: female, active, age ≥15 months, not pregnant, `lifecycle_stage` not in `{Dry, Retired, Sold, Deceased, Calf}` |
| ANML-20 | Filter | `has_health_issue=true` filter | Apply filter | Matches animals with a health incident in status `{Sick, Critical, Injured, Open, In Progress}` |
| ANML-21 | Filter | `stage_bucket` filter | Filter by `Calves`/`Heifers`/`Adults`/`Seniors` | Maps to specific `lifecycle_stage` sets; **`Sold` and `Deceased` map to no bucket** — animals in those stages are excluded from bucket filtering and from the Stage Distribution chart entirely |
| ANML-22 | Filter | `tag_number` filter | Enter partial tag text | Case-insensitive substring (`contains`) match |
| ANML-23 | Dashboard | Pregnant KPI vs. list filter consistency | Compare AnimalsDashboard's "Pregnant" tile to the `pregnancy_status=PREGNANT` filtered list count | **Must match** — both now use `getPregnantAnimalsFilter()` (fixed to share one source of truth) |
| ANML-24 | Dashboard | Vaccination Due KPI vs. list filter | Compare AnimalsDashboard's "Vaccination Due" tile count to `vaccination_due=true` filtered list count | **Can legitimately differ** — KPI uses each animal's *latest* record only; filter uses *any* record — document as expected divergence, not a bug to "fix" |
| ANML-25 | Dashboard | Breed Distribution chart | Load AnimalsDashboard with >6 breeds represented | Shows top 6 breeds by count + an "Other" bucket (non-drillable, no href) |
| ANML-26 | Navigation | Quick-filter chips | Click any chip (All/Females/Males/Pregnant/Lactating/Calves/In Heat/Vaccination Due/Breeding Eligible) | Clears all other chip-controlled filters first, then applies only the clicked one |
| ANML-27 | Navigation | Register Newborn handoff | Arrive via `/animals?newborn=1&mother_id=X&birth_date=Y` (from Pregnancy page) | New Animal modal auto-opens, pre-filled with `mother_id`, `date_of_birth`, `lifecycle_stage=Calf`; sire pre-filled from the mother's most recent breeding record if resolvable; query string is stripped from the URL after read |
| ANML-28 | Edge Case | `ageInMonths` day-of-month rounding | Compare an animal born on the 28th, checked one day before its monthly anniversary | Age may be miscounted by a full month due to calendar-only arithmetic (ignores day-of-month) |
| ANML-29 | Edge Case | Empty filtered list | Apply filters matching zero animals | "No animals match these filters." |
| ANML-30 | Edge Case | AnimalsDashboard stats fetch failure | Simulate `/api/animals/stats` error | "Couldn't load herd overview" |
| ANML-31 | Edge Case | New Animal modal species/breed prefill race | Open New Animal modal before species/breeds have finished loading | Fields may render blank until data arrives (prefill effect only runs if not already set, and can run before data loads) |
| ANML-32 | Dashboard | Health incident severity color mapping | Log incidents of varying severity | Mild=3(teal), Moderate=5(amber), Severe=8(red), Critical=10(red); thresholds: ≥8 red, ≥5 amber, else teal |

---

## 6. Milk Production

**Route:** `/milk-production` — a "daily register" (one row per animal per day, up to 3 sessions aggregated). Two parallel APIs: session-level (`milk_logs`) and a raw-SQL "daily" grouped view. Backed by `services/milk.service.ts`, `validators/milk-log.validator.ts`, `lib/milk-quality.ts`.

**Features:** per-session create, per-day edit (upsert covering all 3 sessions + grade/notes), per-session or whole-day delete, quality grade badges, daily/monthly aggregate KPIs, 14-day trend feeding the main Dashboard.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| MILK-01 | CRUD | Create session record | Submit a valid Morning/Afternoon/Evening entry | `POST /api/milk-logs` succeeds |
| MILK-02 | Edge Case | `milk_liters` = 0 or negative | Submit `0` or `-1` | Rejected — validator requires `.positive()` |
| MILK-03 | Edge Case | Duplicate session (client-side guard) | Try to add a session that already exists for that animal+date | Client intercepts with a "Session already recorded" dialog offering "Edit it instead" — does not submit |
| MILK-04 | Edge Case | Duplicate session (server-side race) | Force a duplicate `(animal_id, production_date, session)` via concurrent/direct API calls | Rejected — DB unique constraint + app-level `ConflictError` (409), message suggests editing instead |
| MILK-05 | CRUD | Edit a day | Open Edit Day modal for an existing date | Upserts per-session values (`undefined`=untouched, `null`=delete that session, number=create/update); `quality_grade`/`notes` apply to the **whole day**, overwriting all 3 sessions uniformly |
| MILK-06 | CRUD | Delete a single session | Click delete on one session within a day | `DELETE /api/milk-logs/[id]` removes just that session |
| MILK-07 | CRUD | Delete entire day | Delete the whole day's record | `DELETE /api/milk-logs/daily` removes all sessions for that animal+date |
| MILK-08 | Edge Case | Delete day with nothing to delete | Call delete-day for an animal+date with zero existing sessions | Throws `NotFoundError` (404) even though it's semantically a no-op |
| MILK-09 | Edge Case | Milk record for a non-lactating animal | Log milk for a Dry/Calf/Male animal via the Edit Day modal or direct API | **Allowed** — only the *New Record* modal's animal picker restricts to lactating females; no server-side lifecycle check exists |
| MILK-10 | Filter | Animal filter | Filter the main table by animal | UI dropdown offers **all** animals, not just lactating ones (contrast with the New Record picker) |
| MILK-11 | Filter | Date range filter | Set `date_from`/`date_to` | Inclusive both ends on the daily view (raw SQL `>=`/`<=`); the session-level endpoint instead uses `>= date_from` and `< date_to+1day` — behaviorally similar but implemented differently, worth boundary-testing both |
| MILK-12 | Filter | Search filter | Type text | ILIKE match on tag_number OR animal_name |
| MILK-13 | Filter | `milk_min`/`milk_max` (session-level API only) | Query with a liters range | Filters `milk_liters` between bounds — not exposed as a UI control on the main page |
| MILK-14 | Dashboard | Today Milk / Animals (today) / Avg Yield | Load page on a day with records | SUM of today's liters; distinct animal count today; average = today total ÷ animals milked (0 if none) |
| MILK-15 | Dashboard | This Month Total | Load mid-month | SUM for the current calendar month (1st through today) |
| MILK-16 | Dashboard | Top Producer | Load with multiple animals milked today | Animal with highest today's total; label `"<name-or-tag> - <L>L"`; shows "—" if none |
| MILK-17 | Dashboard | Morning/Afternoon/Evening (today) | Load with session data | Per-session sum for today, 1 decimal place |
| MILK-18 | Automation | Quality grade is manual only | Check for any auto-grading logic | **None exists** — `lib/milk-quality.ts` is pure display/badge styling; grade is always a direct user selection, never inferred from liters/animal state |
| MILK-19 | Edge Case | AnimalMilkTab sort ignored | Open an animal's Milk tab (sorted by `production_date asc` in the request) | Server **silently drops** `sortBy`/`sortDir` (not in `milkLogQuerySchema`) and always returns `desc` order; the chart consumes this unsorted while the table separately re-reverses it — inconsistency between chart and table on the same tab |
| MILK-20 | Navigation | Dashboard drill-downs | Click Today's Milk KPI or a trend point on `/` | Lands on `/milk-production` with `date_from`/`date_to` set to the relevant day |
| MILK-21 | Edge Case | Empty state | No milk records exist | "No milk records found." |

---

## 7. Vaccinations

**Route:** `/vaccinations` (list + embedded client-computed dashboard); also embedded read/create-only inside `/animals/[id]` → Vaccination tab. Backed by `services/vaccination.service.ts`, `validators/vaccination.validator.ts`, `lib/vaccination-status.ts`, and the automated `services/pregnancy-workflow.service.ts` / `services/breeding-workflow.service.ts`.

**Features:** manual vaccination logging, status-driven filter tiles, **two independent automated reminder workflows** (pregnancy-driven and breeding-driven), and a coverage donut on the main dashboard.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| VACC-01 | CRUD | Create vaccination record | Submit animal + vaccine name (+ optional dates/notes) | `POST /api/vaccinations` succeeds |
| VACC-02 | Edge Case | Create without animal or vaccine name | Bypass the UI's `alert()` guards via direct API call | **Schema accepts it** — `animal_id` and `vaccine_name` are both nullable/optional at the Zod level; only client-side `alert()`s block this in normal UI use |
| VACC-03 | Edge Case | No edit/delete UI at all | Look for edit/delete controls on any vaccination record, anywhere in the app | **None exist** — `useUpdateVaccination()`/`useDeleteVaccination()` hooks are defined but never called; a manually-entered mistake cannot be corrected or removed from the UI |
| VACC-04 | Filter | Status tiles (client-computed) | Click Overdue/Due Today/Due in 7 Days/Upcoming/Completed/All/Auto Generated | Filtering happens **client-side** over up to 100 fetched records, not via the API's `status` query param |
| VACC-05 | Edge Case | >100 total vaccination records | Have more than 100 vaccination records in the system | A "Showing first N of M records" banner appears; **all page stats/filters/search operate only on the first 100** — silently incomplete beyond that |
| VACC-06 | Edge Case | `status=auto_generated` is a page-only pseudo-filter | Inspect the "Auto Generated" tile's filter value | Not a valid value in the API's `vaccinationQuerySchema.status` enum — would 400 if sent server-side; only meaningful client-side (`source === "pregnancy_workflow"`) |
| VACC-07 | Filter | Per-record status thresholds | Set `next_due_date` at various offsets from today | No date → `completed`; `< today` → `overdue`; `= today` → `due_today`; `today < date <= today+7` → `due_soon`; `> today+7` → `upcoming` |
| VACC-08 | Filter | Per-animal aggregate status | View an animal with multiple vaccination records | Computed from the **latest** record only (by `vaccination_date`, falling back to `next_due_date`): no records → `never_vaccinated`; overdue → `overdue`; due within 7 days → `due_for_vaccination`; else `vaccinated` (including "no next_due_date at all" = treated as a completed one-time vaccine) |
| VACC-09 | Automation | Pregnancy → vaccination reminders | Confirm a pregnancy (`status="Confirmed"`) | Two records auto-created: "Dry-Off Vaccination" at EDD−60 days, "Pre-Calving Vaccination" at EDD−30 days; `source="pregnancy_workflow"`, `vaccination_date=null` |
| VACC-10 | Automation | Gestation-length species lookup | Confirm a pregnancy with no explicit `expected_delivery_date`, animal's species is Buffalo | EDD computed as `insemination_date + 310 days` (species-specific table: Cattle/Cow/Dairy=283, Buffalo=310, Sheep/Ovine=147, Goat/Caprine=150, Pig/Swine=114, Horse/Equine=340, Camel=390, Deer=230, Llama=350, Alpaca=345; unmatched → 283 default) |
| VACC-11 | Automation | Workflow idempotency | Call `triggerWorkflow` twice for the same pregnancy (e.g. via a status round-trip) | No duplicate reminders — dedup checked by `(pregnancy_id, vaccine_name, source)` |
| VACC-12 | Automation | Workflow cancellation | Mark a Confirmed pregnancy Failed/Aborted, or mark it Delivered manually, or delete it | All **pending** (not-yet-administered) auto-generated reminders for that pregnancy are deleted; already-administered ones are preserved |
| VACC-13 | Automation | Workflow date rescheduling | Change `expected_delivery_date` on an already-Confirmed pregnancy | Pending reminders' `next_due_date` recalculated proportionally; already-administered records untouched |
| VACC-14 | Automation | Calving cancels remaining reminders | Record a calving linked to a `pregnancy_id` with pending Dry-Off/Pre-Calving reminders | Those pending reminders are deleted (moot post-delivery) |
| VACC-15 | Automation | Breeding → vaccination reminders (separate workflow) | Create a breeding record with `female_animal_id` and `breeding_date` set | Two records auto-created **regardless of `result`**: "Pregnancy Check" at +30 days, "Pregnancy Check (60 Day)" at +60 days, `source="breeding_workflow"` |
| VACC-16 | Automation | Breeding workflow reschedule/cancel | Edit a breeding record's date, or delete it | Pending breeding-workflow reminders reschedule / are cancelled respectively, mirroring the pregnancy workflow |
| VACC-17 | Dashboard | Vaccination Coverage donut | Load `/` with multiple vaccine types on record | Ratio can exceed 100% (records, not distinct animals); "Top vaccines administered" shows top 6 by count |
| VACC-18 | Navigation | Auto-generated record badge | View an auto-generated record in the table | Purple "Auto Generated" badge with a link to `/pregnancy` (no filter carried); "Not yet administered" shown in italics instead of a date |
| VACC-19 | Edge Case | Delete animal with vaccination records | Attempt to delete an animal that has any vaccination record | Fails — `animal_id` FK is `onDelete: NoAction`, surfaces as a raw 500 (see Animals ANML-07) |
| VACC-20 | Edge Case | Delete pregnancy/breeding with linked records | Delete a pregnancy or breeding record that has associated vaccination records | Vaccination rows **survive**, orphaned with `pregnancy_id`/`breeding_id` set to `NULL` (`onDelete: SetNull`) |
| VACC-21 | Edge Case | Timezone boundary | Test status computation right around local midnight in a non-UTC timezone | Status boundary is based on **local** date (`todayDateString()` subtracts local TZ offset), not UTC — verify no off-by-one-day around midnight |
| VACC-22 | Edge Case | Two different "vaccination due" definitions | Compare the Animals list `vaccination_due=true` filter to the Animals dashboard's "Vaccination Due" KPI and to `AnimalStatusCard`'s badge, for an animal with multiple vaccine types at different due dates | These can legitimately disagree — one checks *any* record ≤7 days, the others check only the *latest* record |
| VACC-23 | Edge Case | Empty/partial states | No records; >100 records | "No vaccination records match these filters."; partial-data banner as in VACC-05 |

---

## 8. Breeding

**Route:** `/breeding` — single page, all CRUD in-modal. Backed by `services/breeding.service.ts`, `services/breeding-workflow.service.ts`, `validators/breeding.validator.ts`.

**Features:** breeding record log (natural mating / AI / embryo transfer), auto-close of an active heat cycle on record creation, auto-generated pregnancy-check vaccination reminders (see VACC-15/16).

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| BRED-01 | CRUD | Create breeding record — required fields | Submit with `female_animal_id`/`breeding_date` blank | Blocked **client-side only** via `alert()` — the Zod schema itself has **no required fields**, so a direct API call could create a fully empty/orphan record |
| BRED-02 | CRUD | Update — omit animal fields | `PUT` without `female_animal_id`/`male_animal_id` in the payload | These relations are **disconnected** (not left untouched) — sending a partial update can silently null out sire/dam links |
| BRED-03 | CRUD | Method switching | Change method to "Artificial Insemination" | `male_animal_id` clears; switching to "Natural Mating"/"Embryo Transfer" clears `semen_batch_id`; payload forces `male_animal_id: null` whenever method is AI |
| BRED-04 | Filter | `result` filter | Filter by `Pending` | Matches records where `result === "Pending"` **OR** `result IS NULL` |
| BRED-05 | Filter | `method` filter | Filter by method | Free-string `contains`, case-insensitive (not a strict enum server-side) |
| BRED-06 | Dashboard | KPI tiles | Load page | Total Records, Natural Matings, AI Breedings, Successful, Pending Results, Success Rate (`round(success/(success+failed)*100)`, `0` if none resolved yet) — computed over **all** records (page fetches with `pageSize:1000`), not just the current filtered view |
| BRED-07 | Automation | Auto-close active heat cycle | Create a **new** breeding record for a female with an unclosed heat cycle | Checkbox "mark the heat cycle back to normal" defaults **checked**; on success, `PUT /api/heat-cycles/[id]` sets `heat_end_date` to the breeding date + current time-of-day |
| BRED-08 | Edge Case | Heat-cycle-close only fires on create | Edit an existing breeding record for a female currently in heat | **No heat cycle mutation occurs** — the close logic is gated to `editingId === null` |
| BRED-09 | Automation | Vaccination reminders trigger unconditionally | Create a breeding record with any `result` value (including "Failed") | Pregnancy-check reminders (+30d, +60d) are still created — not gated by a successful result |
| BRED-10 | Automation | Delete breeding record | Delete a record with pending workflow reminders | Pending reminders cancelled; **any heat cycle it previously closed stays closed** (not reopened) |
| BRED-11 | Edge Case | No pregnancy guard on breeding | Create a breeding record for a female with an active/confirmed pregnancy | **Allowed** — no `isActivePregnancy`/`canBreedAnimal` check exists in `breeding.service.ts`; `canBreedAnimal()` helper exists in `lib/pregnancy-status.ts` but is dead code, never called anywhere |
| BRED-12 | Navigation | Prefill from Heat Cycles | Arrive via `/breeding?animal_id=X` (from a Heat Cycles "Breed" button) | Create modal opens pre-filled with `female_animal_id`; URL resets to `/breeding` after read |
| BRED-13 | Navigation | Breeding Results pie (Dashboard) | Click a slice on `/` | `/breeding?result=<label>` using the raw DB value, which matches this page's filter format exactly |
| BRED-14 | Edge Case | `result` query-enum stricter than storage | Create a record with an arbitrary `result` string via direct API, then try to filter by it | `breedingQuerySchema.result` is a strict enum (`Success|Failed|Pending`) — filtering by a non-matching custom value fails Zod validation (400) even though creation allowed it |

---

## 9. Heat Cycles

**Route:** `/heat-cycles` — single page. Backed by `services/heat-cycle.service.ts`, `validators/heat-cycle.validator.ts`, `lib/heat-cycle-status.ts`.

**Features:** cycle logging, live-computed status per animal (In Heat / Due Today / Upcoming / Overdue / Pregnant), herd-wide average-cycle-length estimation, "Needs Attention" panels, one-click navigation into Breeding.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| HEAT-01 | CRUD | Create record — required fields | Submit with `animal_id`/`heat_start_date` blank | Blocked client-side via `alert()`; Zod schema itself does not require them |
| HEAT-02 | Edge Case | `confidence_score` bounds | Submit `-1` or `6` | Rejected — validator requires `0`–`5` inclusive |
| HEAT-03 | Automation | Cycle-length estimation | Have an animal with ≥2 dated heat-start records with a sane gap | Per-animal cycle length = mean of gaps within `[10,60]` days, rounded |
| HEAT-04 | Edge Case | Cycle-length sanity clamp | Record two consecutive heat starts 8 days apart (or 65 days apart) for the same animal | That gap is **excluded** from the average; falls back to herd `globalAvg` if it was the animal's only usable gap |
| HEAT-05 | Automation | Herd-wide fallback | New herd with zero valid gap data anywhere | `globalAvg` = `DEFAULT_CYCLE_DAYS` = 21 |
| HEAT-06 | Filter | `status` filter — scope | Filter by any status bucket | Only ever matches an animal's **latest** heat-start record — older history rows are never reachable via status filter |
| HEAT-07 | Filter | `due_this_week` vs `upcoming` overlap | Compare both buckets for a record 5 days out | Appears in **both** — `due_this_week` = Due Today OR (Upcoming AND ≤7 days); `upcoming` = all Upcoming, unbounded |
| HEAT-08 | Edge Case | `detection_method` filter is non-functional | Apply the Detection Method filter (UI dropdown, and Dashboard's method-chart drill-down) | **Silently returns unfiltered results** — no `where.detection_method` clause exists in `findAll()`; the param isn't even in the query schema, so Zod drops it |
| HEAT-09 | Automation | Pregnant animal overrides status | An animal has both an open heat-cycle record and an active pregnancy | Status displays `"Pregnant"` regardless of the heat-cycle dates (checked via `isActivePregnancy`) |
| HEAT-10 | Edge Case | No guard against logging heat on a pregnant animal | Create a new heat cycle record for a currently-pregnant animal | **Allowed** — the pregnancy check is display-only, not enforced at create time; the animal combobox doesn't filter out pregnant animals either |
| HEAT-11 | Dashboard | KPI tiles exclude active pregnancies | Load page with a pregnant, heat-cycle-open animal | That animal is excluded from In Heat / Due Today / This Week / Overdue counts (contrast with Dashboard's own raw "In Heat Now" count, which does **not** exclude pregnant animals — see Known Issues) |
| HEAT-12 | Dashboard | "Needs Attention" list scope | Have several animals due within a week | "This Week" counter includes up to 7 days out, but the visible **list** only shows records due within 24 hours (`dueSoonList`) — count and list scope differ |
| HEAT-13 | Navigation | "Breed" button | Click Breed on an in-heat, non-pregnant animal's row | Navigates to `/breeding?animal_id=<id>`; button is hidden entirely for animals with an active pregnancy |
| HEAT-14 | Edge Case | Confidence badge color boundaries | Set confidence to exactly `0`, `2.5`, `3`, `5` | ≥5 green, ≥3 amber, else red — `0` and `2.5` both render red |
| HEAT-15 | Edge Case | Empty state | No heat cycle records | "No heat cycle records found." |

---

## 10. Pregnancy

**Route:** `/pregnancy` — single page, entirely client-side status filtering over up to 1000 fetched records. Backed by `services/pregnancy.service.ts`, `services/pregnancy-workflow.service.ts`, `validators/pregnancy.validator.ts`, `lib/pregnancy-status.ts`.

**Features:** the only module with server-enforced required fields (`animal_id`, `insemination_date`); the source of the pregnancy → vaccination auto-workflow; "Register Newborn" handoff into Animals; the most complex status/filter logic in the app (see Known Issues).

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| PREG-01 | CRUD | Create record — required fields | Submit without `animal_id`/`insemination_date` | Rejected server-side (400) — the **only** module enforcing this at the Zod layer, not just client-side |
| PREG-02 | CRUD | Create — default status | Submit without `status` | Defaults to `"Pending"` |
| PREG-03 | Edge Case | `status="Aborted"` is reachable only via API | Try to select "Aborted" in the create/edit form | **Not offered** — `STATUS_OPTIONS` UI list is `Pending/Confirmed/In Progress/Delivered/Failed` only; the API/service correctly handles "Aborted" as terminal if set directly |
| PREG-04 | Filter | Client vs. server filtering divergence | Compare the page's own status tabs to `GET /api/pregnancy-records?status=` | Page computes everything **client-side** via `getPregnancyStatus()`; the server-side `buildPregnancyStatusWhere()` exists for other callers (e.g. deep links) and largely mirrors the same logic but not identically (see PREG-08) |
| PREG-05 | Filter | `due_soon` window | Set a Confirmed pregnancy's EDD to 10 days out, then 20 days out | 10 days → matches `due_soon` (window is **14 days**, inclusive both ends); 20 days → does not |
| PREG-06 | Filter | `overdue`/`due_soon`/`confirmed` require exact status | Set an "In Progress" pregnancy's EDD to a past date | Server-side `overdue` bucket does **not** match it (requires `status="Confirmed"` exactly) — it falls into `pending` instead |
| PREG-07 | Filter | `failed` bucket excludes "Aborted" | Filter server-side by `status=failed` on a record with `status="Aborted"` | **Does not match** — `buildPregnancyStatusWhere("failed")` is `{status:"Failed"}` exact literal only, despite `isFailedPregnancy()` elsewhere treating Failed and Aborted as equivalent |
| PREG-08 | Edge Case | Client badge mislabels "Aborted" | View a record with `status="Aborted"` on `/pregnancy` | `getPregnancyStatus()` falls into the generic "not Confirmed" branch → displays **amber "Aborted" as a pending-style badge**, not a red failed one — inconsistent with `TERMINAL_PREGNANCY_STATUSES` treating it as terminal |
| PREG-09 | Dashboard | Confirmed KPI | Load page | Count of records with `status === "Confirmed"` exactly |
| PREG-10 | Dashboard | Pending Confirmation KPI | Load page with an Aborted record present | Counts any status not in `{Confirmed, Delivered, Failed}` — **includes "Aborted"** in this bucket too, consistent with PREG-08's mislabeling |
| PREG-11 | Dashboard | Due This Month KPI | Load mid-month with a delivery due later this month | Calendar-month window (distinct from the 14-day `due_soon` bucket its own tab uses) |
| PREG-12 | Dashboard | Overdue Deliveries KPI | Have a `"Pending"` record with a stale insemination date far in the past | The raw dashboard count can include it (computed from dates on **any** status), even though its own status badge would show "Pending," not "Overdue" — count and badge can disagree |
| PREG-13 | Dashboard | Avg Gestation Progress | Load with active (non-Delivered/Failed) records | Average of each record's `gestationPercent` (0–100, clamped); `0` if no active records |
| PREG-14 | Navigation | Main Dashboard "Confirmed Pregnant" drill-down | Click the KPI on `/` | Lands on `/pregnancy?status=confirmed` (lowercase) — correctly matches this page's tab |
| PREG-15 | Edge Case | Main Dashboard pie chart drill-down mismatch | Click a slice on the "Pregnancy Status" pie chart (`/`) | Lands on `/pregnancy?status=Confirmed` (raw **capitalized** DB value) — the `/pregnancy` page's filter is **case-sensitive** against lowercase keys, so **no tab highlights and no rows may match** even though matching records exist |
| PREG-16 | Navigation | "Register Newborn" | On a record with `actual_delivery_date` set, click the Baby icon (or the edit-modal footer button) | Navigates to `/animals?newborn=1&mother_id=<id>&birth_date=<date>` |
| PREG-17 | Automation | Confirm → workflow trigger | Change status from Pending to Confirmed | `pregnancy_status="PREGNANT"` set on the animal; `triggerWorkflow()` fires, creating the Dry-Off/Pre-Calving reminders (see VACC-09) |
| PREG-18 | Automation | Re-confirm is idempotent | Submit an already-Confirmed record with `status="Confirmed"` again | No duplicate workflow trigger (branch requires `!wasConfirmed && nowConfirmed`) |
| PREG-19 | Edge Case | Delivered → Failed with no guard | Manually edit a Delivered record's status to Failed | **Allowed**, no warning — animal's `pregnancy_status` is nulled and `cancelWorkflow` is called (no-op if already cancelled by a prior calving) |
| PREG-20 | Edge Case | Delete with multiple active pregnancies | An animal somehow has two simultaneous active pregnancy records (no schema constraint prevents this); delete one | Animal's `pregnancy_status` is reset to `null` **without checking** whether the other active record still exists — can incorrectly clear pregnant status while a real active pregnancy remains |
| PREG-21 | Edge Case | EDD change reschedules reminders | Change `expected_delivery_date` on an already-Confirmed pregnancy | `updateWorkflowDates()` fires only if the new date differs from the old one (string-sliced date comparison) |
| PREG-22 | Edge Case | AnimalStatusCard badge vs. Expected Delivery field mismatch | An animal has an older active record and a newer terminal (Failed/Delivered) record, out of date order | Badge uses the **most recent by `insemination_date`**; the Expected Delivery field uses the first record matching `isActivePregnancy` — these can point at two different records and disagree |
| PREG-23 | Edge Case | Empty/loading states | No records match / data loading | "Loading…" row while fetching; "No pregnancy records found." when empty |

---

## 11. Calving

**Route:** `/calving` — single page, **no filters, no URL-synced state, no drill-down links anywhere** (the only module with zero `buildFilterUrl` usage in or out). Backed by `services/calving.service.ts`, `validators/calving.validator.ts`.

**Features:** records a birth event and cascades mother/pregnancy state; explicitly does **not** create an `animals` row for the calf (that's a separate manual step from the Pregnancy page); all cascades are one-way/permanent by design.

| ID | Category | Test Case | Steps / Input | Expected Result |
|---|---|---|---|---|
| CALV-01 | CRUD | Create record — required fields | Submit without `mother_id`/`calving_date` | Rejected server-side (400) |
| CALV-02 | Edge Case | `calf_gender` length | Submit a multi-character string directly via API | Rejected — schema requires exactly 1 character if present; the UI correctly sends `null` for "— Unknown —", not `""` |
| CALV-03 | Edge Case | `calf_id` is dead in the UI | Look for a way to link an existing animal record as the calf | **No UI control exists** for `calf_id` — only reachable via direct API call; the form only has a free-text "Calf Tag Number" field and a gender select |
| CALV-04 | Automation | Mother state update | Record any calving | `animals.update({pregnancy_status:"CALVED", lactation_status:"LACTATING"})` — unconditional, always runs |
| CALV-05 | Automation | Linked pregnancy marked Delivered | Record a calving with `pregnancy_id` set | `pregnancy_records.actual_delivery_date = calving_date`, `status = "Delivered"` |
| CALV-06 | Automation | Pending reminders cancelled | Record a calving linked to a pregnancy with pending Dry-Off/Pre-Calving reminders | Those pending reminders are deleted |
| CALV-07 | Edge Case | Calving without a linked pregnancy | Submit a calving with `pregnancy_id` left blank/None, even though the mother has an active pregnancy record | **Allowed** — mother's `pregnancy_status`/`lactation_status` still flip to CALVED/LACTATING, but steps 2–3 (marking the pregnancy Delivered, cancelling reminders) are silently skipped, leaving an orphaned still-"Confirmed" pregnancy record alongside a "CALVED" animal — denormalized-field-vs-relational-truth divergence |
| CALV-08 | Edge Case | No pregnancy/eligibility guard | Record a calving for a mother with **no** pregnancy record at all | **Allowed** — `canRecordCalving()` exists in `lib/pregnancy-status.ts` but is dead code, never called; the mother's state still flips to CALVED/LACTATING regardless |
| CALV-09 | Edge Case | Duplicate calving for the same pregnancy | Create two calving records both linking the same `pregnancy_id` | **No uniqueness guard** — the second create just re-applies the same (idempotent) updates; no duplicate-detection warning is shown |
| CALV-10 | Edge Case | Update does not re-run cascade | Edit an existing calving record's `mother_id`, `outcome`, or `pregnancy_id` | **No cascade re-sync occurs** — `update()` is a plain field update only |
| CALV-11 | Edge Case | Delete does not revert anything | Delete a calving record | Mother's `pregnancy_status`/`lactation_status` are **not** reverted; the linked pregnancy record stays "Delivered"; cancelled vaccination reminders are **not** restored — explicitly permanent/one-way by design (confirm dialog states this) |
| CALV-12 | Automation | No animal record created for the calf | Record a calving with a `calf_tag` filled in | **No `animals` row is created** — registering the calf as an actual animal is a separate manual step reachable only from the **Pregnancy** page's "Register Newborn" link, not from Calving |
| CALV-13 | Edge Case | >100 total calving records | Have more than 100 calving records | The API fetch caps at 100 (`pageSize:"100"`); both the table and KPI cards **silently under-count** beyond that — no warning banner shown (unlike Vaccinations' partial-data banner) |
| CALV-14 | Dashboard | KPI tiles | Load page | Total Calvings, Live Births, Twins, This Month (calendar-month window), Heifers Born (`calf_gender="F"`), Bull Calves (`calf_gender="M"`) — none are clickable |
| CALV-15 | Navigation | Main Dashboard has no Calving presence | Look for any Calving stat/chart/alert on `/` | **None exists** — Calving activity only surfaces indirectly via Pregnancy's "Delivered" status and Animals' `lactation_status`/`pregnancy_status` |
| CALV-16 | Edge Case | Empty state | No calving records exist | Dedicated empty illustration: "No calving records yet" + "Record First Calving" call-to-action |

---

## Known Issues / Cross-Cutting Risks

Concrete inconsistencies and bugs found during this inspection — useful as a standing regression-watch list, not just one-off test cases:

1. **No delete UI for Animals or Vaccinations** (ANML-06, VACC-03) — both `DELETE` endpoints and hooks exist but are never wired to a button. Vaccinations additionally has no edit UI at all.
2. **FK-violation deletes surface as raw HTTP 500s, not friendly errors** — deleting a breed/species with animals (SPBR-07/14), or an animal with health/heat/vaccination/breeding history (ANML-07, VACC-19), all hit `onDelete: NoAction` constraints that `handleApiError` doesn't specially handle.
3. **Species & Breeds create forms have no `onError` handler** (SPBR-02/03/09/10) — validation failures and duplicate-name conflicts fail completely silently in the UI.
4. **Two independent, sometimes-disagreeing "pregnant" signals**: the live `pregnancy_records` join (`getPregnantAnimalsFilter()`, used by dashboard counts and the `PREGNANT` filter) vs. the denormalized `animals.pregnancy_status` column (used by `canBreedAnimal`/`canStartHeatCycle`, and by `CALVED`/`FAILED` filter values). Most `pregnancy_status` writes are wrapped in `.catch(() => {})`, so a failed write can silently desync the two.
5. **Dead business-rule guards**: `canBreedAnimal()`, `canStartHeatCycle()`, `canRecordCalving()` all exist in `lib/pregnancy-status.ts` but are **never called anywhere** — nothing actually prevents breeding a pregnant animal (BRED-11), logging heat on a pregnant animal (HEAT-10), or recording a calving with no underlying pregnancy (CALV-08).
6. **`detection_method` filter on Heat Cycles is completely non-functional** (HEAT-08) — present in the UI, the URL, and the Dashboard's chart drill-down, but absent from the query schema and `findAll()` where-clause.
7. **Case-sensitive status mismatch between Dashboard pie charts and their target pages**: the Pregnancy Status and Breeding Results pie charts pass raw, capitalized DB values as `status=`/`result=`. Breeding's own page filter also expects raw capitalized values (works correctly, BRED-13), but Pregnancy's page filter expects lowercase computed keys (`confirmed`, `pending`, ...) — so the Pregnancy pie chart's own drill-down is broken (PREG-15) while Breeding's isn't.
8. **Two vaccination-due definitions coexist**: "any record due within 7 days" (Animals list filter) vs. "latest record's status" (Animals dashboard KPI, `AnimalStatusCard`, `AnimalVaccinationTab`) — expect legitimate count mismatches (VACC-22).
9. **`"Aborted"` pregnancy status is inconsistently treated as terminal**: `TERMINAL_PREGNANCY_STATUSES`/`isFailedPregnancy()`/`isCompletedPregnancy()` treat it as failed/terminal, but `getPregnancyStatus()` (the badge function) has no explicit branch for it and displays it as an amber "pending"-style badge (PREG-08); the server-side `failed` filter bucket also excludes it (PREG-07). The create/edit form doesn't even offer it as an option (PREG-03).
10. **Dashboard's "In Heat Now" count includes pregnant animals; the Heat Cycles page's own "In Heat" KPI excludes them** (DASH-26, HEAT-11) — the two numbers can diverge for the same herd state.
11. **Several modules cap client-side data fetches at 100–1000 records with only partial/no warning**: Vaccinations shows a banner past 100 (VACC-05); Calving silently under-counts past 100 with **no** banner (CALV-13); Breeding/Pregnancy fetch up to 1000 for their own dashboard stats.
12. **`updateAnimalSchema.lifecycle_stage` is unrestricted** even though `createAnimalSchema.lifecycle_stage` is enum-locked (ANML-05) — an update can set an animal to a stage string that then falls out of both the badge styling and the stage-bucket distribution/filter.
13. **"Daily milk" stat labels are misleading** on both Farms and Units detail panels (FARM-13, UNIT-19) — they show **all-time** sums, not a per-day figure, despite the label.
