# TerraDairy AI Source Map

**Status:** Architecture analysis only — no implementation in this document.  
**Last reviewed:** 2026-09-04  
**Scope:** AI Farm Assistant (`/animals/assistant`, `POST /api/assistant/chat`)

---

## 1. Purpose

This document defines **where the TerraDairy AI Farm Assistant must retrieve information** and how sources relate to each other. It is based on the **current codebase** (Prisma schema, REST APIs, AI tools, orchestrator, prompts) and describes the **target architecture** for a future veterinarian-approved knowledge base.

The assistant must never guess farm facts. It must use the **most authoritative source available** for each question type.

---

## 2. Primary Information Sources

| ID | Source | What it answers | Current status in TerraDairy |
|----|--------|-----------------|------------------------------|
| **A** | **TerraDairy Database** | Facts recorded on **this farm**: animals, milk, health events, inventory, breeding, pregnancy, calving, vaccinations, dashboard KPIs | **Implemented** — 30 read-only AI tools query PostgreSQL via Prisma/services |
| **B** | **Veterinary / Farm Knowledge Base** | Approved veterinary and husbandry knowledge: disease signs, causes, prevention, protocols, nutrition, management guidance | **Not implemented** — no document store, embeddings, pgvector, or RAG pipeline exists |
| **C** | **External Web / Google Search Grounding** | Latest research, current regulations, information missing from the approved KB, time-sensitive external guidance | **Partially implemented** — Gemini REST + `{ google_search: {} }` for WEB/COMBINED routes only |

**Gemini (LLM reasoning)** is not a fourth “source of truth.” It synthesizes answers from A, B, and/or C. It must not invent farm records or replace approved veterinary content.

---

## 3. Core Rule — Database Is Authoritative for Farm Facts

> If a question asks about something that **happened**, **exists**, or is **recorded on this farm**, the **database is the only authoritative source**.

| Question pattern | Authoritative source | Must NOT use |
|------------------|---------------------|--------------|
| “How many animals do I have?” | **DATABASE** | Web, Vet KB |
| “How many cows are pregnant?” | **DATABASE** | Web, Vet KB |
| “Which animals have mastitis **records**?” | **DATABASE** | Web, Vet KB |
| “How much milk did we produce last month?” | **DATABASE** | Web, Vet KB |
| “How much medicine is left?” | **DATABASE** | Web, Vet KB |
| “Which animals are overdue for vaccination?” | **DATABASE** | Web, Vet KB |
| “Show history for tag TD-042” | **DATABASE** | Web, Vet KB |
| “What notifications do I have?” | **DATABASE** (user-scoped) | Web, Vet KB |

**If the database does not contain the requested farm fact**, the assistant must say the information is **unavailable in TerraDairy records** — not search the web or veterinary KB to fabricate farm-specific numbers, names, dates, or counts.

---

## 4. Information → Authoritative Source

Categories are derived from the **actual Prisma schema** (`prisma/schema.prisma`, 27 models) and existing AI tools.

### 4.1 Farm organization & reference data

| Information | Authoritative source | DB tables / AI access today |
|-------------|---------------------|-----------------------------|
| Farm list, owner, location, active status | **DATABASE** | `farms` — `getFarms`, `getFarmStatistics`, `compareFarms` |
| Unit names, capacity, type | **DATABASE** (indirect) | `units` — via animals/farm stats; **no dedicated unit tool** |
| Species / breed catalog | **DATABASE** (indirect) | `species`, `breeds` — via `getAnimals`, `getBreedMilkRanking`; **no standalone breed/species tool** |
| Breed reference average milk (catalog field) | **DATABASE** | `breeds.average_milk_production` — `getBreedMilkRanking` |
| Dashboard KPIs, herd overview, capacity | **DATABASE** | `getDashboardSummary` (aggregates many tables) |
| User notifications (current user) | **DATABASE** | `notifications` — `getNotificationsSummary` (scoped to `ctx.userId`) |

### 4.2 Animals & lifecycle

| Information | Authoritative source | DB tables / AI access today |
|-------------|---------------------|-----------------------------|
| Animal count (active/inactive, filters) | **DATABASE** | `animals` — `getAnimals` |
| Tag, name, gender, DOB, birth weight | **DATABASE** | `animals` — `getAnimals`, `getAnimalHistory` |
| Lifecycle stage, pregnancy status, lactation status | **DATABASE** | `animals` (denormalized) — `getAnimals`, filters |
| Lineage (mother/father) | **DATABASE** | `animals` self-FK — `getAnimalHistory` |
| Full per-animal timeline | **DATABASE** | Multiple tables — `getAnimalHistory` |
| Growth / weight over time | **DATABASE** | `growth_logs` — `getAnimalHistory` |
| Recently added animals | **DATABASE** | `animals.created_at` — via dashboard/reports, not a dedicated tool |

### 4.3 Milk production

| Information | Authoritative source | DB tables / AI access today |
|-------------|---------------------|-----------------------------|
| Daily/session milk volumes | **DATABASE** | `milk_logs` — `getMilkProduction`, `getTopMilkProducers` |
| Milk trends, totals, averages by period | **DATABASE** | `milk_logs` — `getMilkProduction`, `generateMilkAnalysisReport`, dashboard |
| Top producers, rankings | **DATABASE** | `milk_logs` + `animals` — `getTopMilkProducers` |
| Breed performance from actual logs | **DATABASE** | `milk_logs` — `getBreedMilkRanking` |
| Quality grade, session notes | **DATABASE** | `milk_logs` — via production tools / history |

### 4.4 Health & treatment

| Information | Authoritative source | DB tables / AI access today |
|-------------|---------------------|-----------------------------|
| Health incidents (disease, severity, symptoms recorded) | **DATABASE** | `health_incidents` — `getHealthIncidents`, `generateHealthReport` |
| Treatments given (medicine, dosage, date) | **DATABASE** | `treatment_records` — `getTreatments` |
| Group treatment batches | **DATABASE** | `group_treatment_batches` — **not directly exposed to AI** (linked via vaccinations/treatments) |
| Veterinarian who treated (ID only) | **DATABASE** | `health_incidents.veterinarian_id` — **no vet master table** |
| What mastitis **is** / general signs / causes | **VET KB** → **WEB** if KB insufficient | Not from farm DB unless asking about **records** |
| Which of **my** cows may have mastitis | **DATABASE + VET KB** (+ **WEB** if needed) | Incidents + milk trends + approved disease knowledge |

### 4.5 Vaccination

| Information | Authoritative source | DB tables / AI access today |
|-------------|---------------------|-----------------------------|
| Vaccination dates, next due, overdue | **DATABASE** | `vaccination_records` — `getVaccinationStatus`, `generateVaccinationReport` |
| Workflow-linked reminders (pregnancy/breeding) | **DATABASE** | `vaccination_records.source`, FKs — same tools |
| Standard vaccination **protocols** (general) | **VET KB** → **WEB** | Not farm records |
| Which animals **on my farm** need vaccination | **DATABASE** | `getVaccinationStatus` |

### 4.6 Breeding, heat, pregnancy, calving

| Information | Authoritative source | DB tables / AI access today |
|-------------|---------------------|-----------------------------|
| Breeding / AI events, results | **DATABASE** | `breeding_records` — `getBreedingRecords`, `generateBreedingReport` |
| Repeat breeders | **DATABASE** | `breeding_records` — `getRepeatBreeders` |
| Semen batch ID on record | **DATABASE** | `breeding_records.semen_batch_id` (free text; **no semen inventory table**) |
| Heat cycles, in-heat status | **DATABASE** | `heat_cycle_records` — `getHeatCycles`, `getRepeatHeatAnimals` |
| Pregnancy confirmation, due dates, status | **DATABASE** | `pregnancy_records` — `getPregnancyRecords`, `generatePregnancyAnalysisReport` |
| Calving outcomes, calf registration | **DATABASE** | `calving_records` — `getCalvingRecords`, `getCalvingSummary` |
| Normal gestation length (general) | **VET KB** → **WEB** | Not farm-specific |
| What to prepare for **my** approaching calvings | **DATABASE + VET KB** (+ **WEB** if needed) | Pregnancy records + approved guidance |

### 4.7 Inventory & supplies

| Information | Authoritative source | DB tables / AI access today |
|-------------|---------------------|-----------------------------|
| Stock quantities, reorder levels, expiry | **DATABASE** | `inventory_items` — `getInventory` |
| Inventory movements (in/out/adjustments) | **DATABASE** | `inventory_transactions` — **not exposed to AI** |
| General medicine usage guidelines | **VET KB** → **WEB** | Not farm stock levels |

### 4.8 Reports & analytics

| Information | Authoritative source | DB tables / AI access today |
|-------------|---------------------|-----------------------------|
| Daily / weekly / monthly farm reports | **DATABASE** | `generateDailyReport`, `generateWeeklyReport`, `generateMonthlyReport` |
| Farm comparison, milk/pregnancy/vaccination/breeding/health reports | **DATABASE** | `generate*Report` tools (9 report tools) |
| “Health risk report” for **my farm** | **DATABASE + VET KB** | Routed as COMBINED; closest DB tool is `generateHealthReport` — **no dedicated risk-scoring tool** |

### 4.9 General veterinary & agricultural knowledge

| Information | Authoritative source | Notes |
|-------------|---------------------|-------|
| Disease definition, etiology, pathogenesis | **VET KB** | Future approved documents |
| Clinical signs, differential considerations | **VET KB** | |
| Diagnostic approach (general) | **VET KB** | |
| Prevention, biosecurity, management practices | **VET KB** | |
| Treatment protocols (approved) | **VET KB** | With vet disclaimer in UI |
| Calf feeding **guidelines** (general) | **VET KB** → **WEB** | |
| Reproductive management **standards** | **VET KB** → **WEB** | |
| Nutrition requirements (general) | **VET KB** → **WEB** | |
| Latest research, new regulations | **WEB** | When KB is stale or silent |
| Market prices, external market trends | **WEB** | Never DATABASE |

### 4.10 System, audit, collaboration (out of scope for assistant)

| Information | Authoritative source | AI access |
|-------------|---------------------|-----------|
| User accounts, roles, permissions | **DATABASE** (admin APIs) | **Not exposed** — assistant has `assistant:read` only |
| Audit log history | **DATABASE** | **Not exposed** |
| Team chat messages / attachments | **DATABASE** + file storage | **Not exposed** — separate product surface |
| Data export (CSV) | **DATABASE** via export API | **Not exposed** |

---

## 5. Source Priority Hierarchy

```
Farm-specific facts:     DATABASE  >  everything else

Approved vet knowledge:  VET KB    >  WEB (general web)

Current / missing info:  WEB       (only when VET KB does not cover or is outdated)

Synthesis layer:         GEMINI    (never overrides authoritative sources)
```

**Rules:**

1. Never answer a farm fact from Web or Vet KB.
2. Never present Web content as if it were an approved TerraDairy veterinary protocol without labeling it.
3. Prefer **VET KB** over **WEB** for stable clinical/husbandry knowledge once the KB exists.
4. Use **WEB** for recency (“latest research”, “current regulations”) or KB gaps.
5. For **COMBINED** questions, retrieve **DATABASE first**, then **VET KB**, then **WEB** only if still insufficient.

---

## 6. Veterinary Knowledge Base (Future — Source B)

### 6.1 What the Vet KB is

The veterinary knowledge base will hold **veterinarian-reviewed documents** covering:

- Diseases (e.g. mastitis, ketosis, calf scours)
- Clinical signs and differential considerations
- Causes and risk factors
- Diagnostic information (general)
- Prevention and biosecurity
- Treatment and management protocols
- Nutrition, calf management, reproductive management
- Other approved dairy/veterinary reference material

### 6.2 What the Vet KB is NOT

- **Not farm records** — it does not store this farm’s animal counts, milk logs, or treatment history.
- **Not a substitute for the database** when the user asks “what happened on my farm.”
- **Not unreviewed web content** — crawled pages belong in Source C unless formally ingested and approved.

### 6.3 Document trust metadata (future design)

Each document (or chunk) should carry metadata:

| Field | Purpose |
|-------|---------|
| `title` | Human-readable document name |
| `topic` / `disease` | Retrieval routing (e.g. “mastitis”) |
| `species` | Cattle, buffalo, etc. |
| `author`, `veterinarian`, `qualification`, `institution` | Provenance |
| `review_date`, `version` | Freshness tracking |
| `approval_status` | **`APPROVED`** required for authoritative use |
| `source` | Origin (internal SOP, extension bulletin, etc.) |
| `effective_date`, `expiration_date` / `next_review_date` | Lifecycle |

**Only `APPROVED` documents** may be cited as authoritative veterinary knowledge. Draft or expired documents must not be used for treatment/protocol answers.

### 6.4 Future retrieval pattern

1. Route question to **VET KB** (semantic search / RAG over approved chunks).
2. Return top chunks with metadata for citation.
3. If confidence low or topic missing → escalate to **WEB** (with clear labeling).
4. Pass retrieved chunks + (optional) farm tool results to **Gemini** for synthesis.

---

## 7. External Web Knowledge (Source C)

### 7.1 When to use WEB

- Latest veterinary research or evolving guidance
- Current regulations and compliance information
- Topics **not covered** in the approved Vet KB
- General questions where **recency** matters more than institutional approval
- External market information

### 7.2 When NOT to use WEB

- Any farm-specific count, name, ID, date, or status
- Inventory quantities on this farm
- “How many…”, “which of my…”, “our milk production…”
- Substituting for missing DB rows

### 7.3 Current implementation (today)

- **File:** `lib/ai/web-search.ts`
- **Mechanism:** Gemini REST `generateContent` with `tools: [{ google_search: {} }]`
- **Routes:** WEB-only and COMBINED (phase 2) in `lib/ai/orchestrator.ts`
- **Requires:** `GEMINI_API_KEY` even when chat provider is OpenAI
- **Retry/fallback:** `lib/ai/gemini-retry.ts` (503 backoff + model fallback)

**Target state:** WEB becomes **secondary** to Vet KB for general knowledge; today it is the **only** non-database knowledge source.

---

## 8. Combined Questions

Questions that require **farm data + external knowledge** must use multiple sources in order.

### Example 1 — “Which of my cows could have mastitis?”

| Step | Source | Data |
|------|--------|------|
| 1 | **DATABASE** | `getHealthIncidents`, `getAnimals`, milk production trends, lactation status |
| 2 | **VET KB** | Mastitis signs, risk factors, differential considerations |
| 3 | **WEB** (optional) | Only if KB lacks sufficient detail |
| 4 | **Gemini** | Compare records to knowledge; recommend checks; escalate if severe |

**Do not** skip DATABASE because the question mentions a disease name.

### Example 2 — “My 7-day-old calf weighs 40 kg. How much milk should it receive?”

| Step | Source | Data |
|------|--------|------|
| 1 | **DATABASE** | Identify calf if tag/name given — `getAnimals` / `getAnimalHistory`, `growth_logs` |
| 2 | **VET KB** | Approved calf feeding protocol for age/weight band |
| 3 | **WEB** (optional) | If KB silent on edge case |
| 4 | **Gemini** | Personalized recommendation with disclaimers |

### Example 3 — “What causes mastitis?” (no farm reference)

| Step | Source | Data |
|------|--------|------|
| 1 | **VET KB** | Approved disease overview |
| 2 | **WEB** (if KB insufficient) | Current extension/research |
| 3 | **Gemini** | Clear educational answer |

**Do not** query DATABASE unless the user asks about **their** animals or records.

### Current routing (today)

`lib/ai/source-router.ts` classifies into:

- **DATABASE** — tools only
- **WEB** — web grounding only (no DB tools)
- **COMBINED** — DB tool loop → web grounding → optional Gemini synthesis

There is **no VET KB route yet**. General knowledge questions currently go to **WEB** only.

---

## 9. Do Not Over-Query

| Question | Call | Do NOT call |
|----------|------|-------------|
| “How many animals are on my farm?” | **DATABASE** (`getAnimals` / `getDashboardSummary`) | WEB, Vet KB |
| “What causes mastitis?” | **VET KB** (future); today **WEB** | DATABASE |
| “Which of my cows may have mastitis?” | **DATABASE + VET KB** (+ WEB if needed) | — |
| “Latest mastitis research” | **WEB** (+ VET KB for context) | DATABASE |
| “How much medicine is left?” | **DATABASE** (`getInventory`) | WEB, Vet KB |

The router must avoid invoking every source on every question.

---

## 10. Source Router Design

### 10.1 Target architecture

```
USER QUESTION
      │
      ▼
INTENT / SOURCE ROUTER
 (semantic + contextual signals)
      │
      ├──────────────┬──────────────┬──────────────┐
      │              │              │              │
      ▼              ▼              ▼              ▼
  DATABASE       VET KB           WEB         (none)
  (Prisma tools) (RAG/pgvector)  (Google Search)
      │              │              │
      └──────────────┴──────────────┘
                     │
                     ▼
              GEMINI REASONING
                     │
                     ▼
           PRACTICAL FARM MANAGER RESPONSE
```

### 10.2 Router decision signals

Use **semantic meaning**, not keywords alone. Signals include:

| Signal | Likely route |
|--------|--------------|
| Possessive farm language: “my”, “our”, “on my farm”, “we vaccinated” | **DATABASE** or **COMBINED** |
| Animal tag pattern (e.g. `TD-042`) | **DATABASE** |
| Dated operational queries (“last month”, “this year”, specific dates) | **DATABASE** |
| Counts, lists, rankings, reports, dashboard | **DATABASE** |
| Disease knowledge without farm reference (“what causes…”, “signs of…”) | **VET KB** → **WEB** |
| “Latest”, “current research”, “regulations”, market prices | **WEB** |
| Farm data + advice (“my calves… should…”, “prepare for calving”) | **COMBINED** |
| Follow-up in a farm-scoped conversation | Inherit **DATABASE** context |

### 10.3 Current implementation (today)

| Component | Location | Behavior |
|-----------|----------|----------|
| Router | `lib/ai/source-router.ts` | Regex heuristics → `DATABASE` \| `WEB` \| `COMBINED` |
| Orchestrator | `lib/ai/orchestrator.ts` | Executes route before any tool/web call |
| System prompt | `lib/ai/prompts/system-prompt.ts` | Declares 3-source model (DB / web / combined) |
| Per-request addon | `lib/ai/prompts/source-routing-prompt.ts` | Reinforces route constraints |
| Chat entry | `app/api/assistant/chat/route.ts` | Auth + `runAssistant()` |

**Gap:** No `VET_KB` route. Regex router may misclassify edge cases (e.g. “mastitis” triggers WEB even in farm context unless COMBINED patterns match).

### 10.4 Recommended future routes

| Route | Sources invoked | Example |
|-------|-----------------|---------|
| `DATABASE` | A only | Herd counts, milk totals |
| `VET_KB` | B only | “What causes mastitis?” |
| `WEB` | C only (rare once KB exists) | “Latest EU dairy regulations” |
| `DATABASE + VET_KB` | A + B | “Which of my cows may have mastitis?” |
| `DATABASE + VET_KB + WEB` | A + B + C | Complex advisory with recency requirement |
| `VET_KB + WEB` | B + C | General knowledge + latest updates |

---

## 11. Answer Architecture (Future Responses)

Goal: **most useful answer for a dairy farm manager**, not the longest possible answer.

**Priority order (adapt to question type):**

1. **Direct answer** — one or two sentences first
2. **Relevant farm data** — from DATABASE when applicable
3. **Practical interpretation** — what the numbers mean operationally
4. **Recommended checks / actions** — concrete next steps on the farm
5. **Warning / escalation** — when vet intervention or urgent action is indicated
6. **Supporting veterinary knowledge** — from VET KB (and WEB if labeled)
7. **Sources / citations** — document title, reviewer, or web source label

Structure is **question-dependent**. A count question may need only (1) + (2). A COMBINED health question needs (1)–(7).

**Current behavior:** Markdown prose, optional `ui-table` / `ui-chart` / `ui-report` blocks; report tools return pre-built structured blocks.

---

## 12. Existing Project Inventory

### 12.1 Database (Prisma — 27 models)

**Core farm:** `farms`, `units`, `animals`, `species`, `breeds`  
**Production:** `milk_logs`, `growth_logs`  
**Health:** `health_incidents`, `treatment_records`, `group_treatment_batches`  
**Reproduction:** `breeding_records`, `heat_cycle_records`, `pregnancy_records`, `calving_records`  
**Vaccination:** `vaccination_records`  
**Inventory:** `inventory_items`, `inventory_transactions`  
**Users & system:** `users`, `role_permissions`, `audit_logs`, `notifications`  
**Team chat:** `chat_conversations`, `chat_conversation_participants`, `chat_messages`, `chat_message_attachments`, `chat_message_reads`, `user_presence`

### 12.2 REST APIs (representative)

~64 route handlers under `app/api/`, including:

- Dashboard, animals, milk-logs, vaccinations, breeding, pregnancy, heat-cycles
- Health (nested under `/api/animals/[id]/health-incidents`)
- Inventory, farms, units, species, breeds, calving, group-treatments
- Auth, users, roles, notifications, audit-logs, export
- **AI:** `POST /api/assistant/chat`
- Team chat (separate from AI assistant)

### 12.3 AI assistant stack (current)

| Layer | Details |
|-------|---------|
| Entry | `POST /api/assistant/chat` — requires `assistant:read` permission |
| Orchestrator | `lib/ai/orchestrator.ts` — stateless; client sends full transcript |
| Providers | OpenAI (default) or Gemini — `AI_PROVIDER` env |
| Tools | 30 read-only functions in `lib/ai/tools/*.tools.ts` |
| Web | `lib/ai/web-search.ts` — Gemini + Google Search |
| Security | `lib/ai/security.ts` — Zod validation on every tool call, history caps |
| UI | `app/animals/assistant/page.tsx`, `components/assistant/*` |
| Conversation storage | Browser `localStorage` only (no server-side chat history) |

### 12.4 Existing AI database tools (30)

| Domain | Tools |
|--------|-------|
| Animals | `getAnimals`, `getAnimalHistory` |
| Farms | `getFarms`, `getFarmStatistics`, `compareFarms` |
| Milk | `getMilkProduction`, `getTopMilkProducers`, `getBreedMilkRanking` |
| Vaccination | `getVaccinationStatus` |
| Breeding | `getBreedingRecords`, `getRepeatBreeders` |
| Reproduction | `getHeatCycles`, `getRepeatHeatAnimals`, `getPregnancyRecords`, `getCalvingRecords`, `getCalvingSummary` |
| Health | `getHealthIncidents`, `getTreatments` |
| Dashboard | `getDashboardSummary`, `getNotificationsSummary` |
| Inventory | `getInventory` |
| Reports | `generateDailyReport`, `generateWeeklyReport`, `generateMonthlyReport`, `generateFarmComparisonReport`, `generateMilkAnalysisReport`, `generatePregnancyAnalysisReport`, `generateVaccinationReport`, `generateBreedingReport`, `generateHealthReport` |

**Non-registry invocation:** `google_search` (web grounding) appears in `toolsUsed` but is not in `TOOL_REGISTRY`.

### 12.5 Embeddings / RAG / pgvector

| Capability | Status |
|------------|--------|
| pgvector extension | **Not present** |
| Embedding columns / vector tables | **Not present** |
| Document ingestion pipeline | **Not present** |
| Veterinary knowledge base | **Not present** |
| RAG retrieval layer | **Not present** |
| AI document upload | **Not present** (team chat uploads only — `uploads/chat/`) |

### 12.6 What should NOT be changed (without explicit approval)

- Read-only AI tool contract (no create/update/delete via assistant)
- Prisma schema for existing farm operations (for this analysis phase)
- RBAC model (`role_permissions`, `requirePermission`)
- Database-as-source-of-truth rule for farm facts
- Existing REST CRUD APIs used by the web app
- Team chat subsystem (orthogonal to AI assistant)

---

## 13. Gap Analysis

### 13.1 What the AI can answer today (DATABASE route)

- Herd counts and filters (pregnant, lactating, in heat, by farm/unit/breed)
- Per-animal history and profiles
- Milk production aggregates, trends, top producers, breed rankings
- Vaccination status (overdue, due soon, completed)
- Breeding records and repeat breeders
- Heat cycles and repeat heat animals
- Pregnancy and calving records / summaries
- Health incidents and treatments
- Inventory stock levels (with filters)
- Dashboard-style KPIs and user notifications
- Nine structured report types

### 13.2 Database entities NOT exposed to AI

| Entity / data | Gap |
|---------------|-----|
| `units` (standalone listing) | No `getUnits` tool |
| `species` / `breeds` CRUD catalog | Only indirect access |
| `group_treatment_batches` | No dedicated tool |
| `inventory_transactions` | No movement history tool |
| `audit_logs` | Not available to assistant |
| Users / roles / permissions | Not available (by design) |
| Semen inventory | No table; `semen_batch_id` is free text |
| Veterinarian master data | `veterinarian_id` without FK table |
| Export endpoints | Not wired to AI |
| Multi-farm user scoping | Most tools query all farms; only notifications are user-scoped |

### 13.3 Architecture gaps for multi-source future

| Gap | Impact |
|-----|--------|
| No Vet KB (Source B) | General knowledge relies entirely on WEB today |
| No RAG / pgvector | Cannot retrieve approved documents |
| Regex-only router | Misrouting risk; not true semantic intent |
| WEB used for all general knowledge | No approved, citable institutional content |
| WEB requires Gemini; chat may use OpenAI | Split provider dependency |
| No `VET_KB` orchestrator path | Cannot implement Source B without new pipeline |
| “Health risk report” routing | No dedicated risk tool — only `generateHealthReport` |
| Prompt references 3 sources, not 4 | System prompt will need Vet KB section when built |

### 13.4 Risks

| Risk | Description |
|------|-------------|
| **Hallucinated farm facts** | Mitigated by tools + prompts; still depends on model obeying routing |
| **Web substituted for DB** | Router regex edge cases (e.g. disease name + farm context) |
| **Unapproved clinical advice** | WEB content is not veterinarian-approved today |
| **Stale KB** | Future risk if approved documents expire without review workflow |
| **Over-querying** | 30 tools exposed on every DATABASE call — model may over-call |
| **No farm tenancy isolation** | Assistant may surface data across all farms in DB |
| **Stateless conversations** | Long threads rely on client history; no server audit of AI queries |
| **Provider split** | OpenAI chat + Gemini web increases config and failure modes |

---

## 14. Recommended Implementation Phases

### Phase 0 — Stabilize current stack (no new sources)

- Keep DATABASE / WEB / COMBINED routing
- Harden Gemini retry/fallback and error surfaces
- Improve router tests for edge cases (farm + disease terms)
- Document env vars (`AI_PROVIDER`, `GEMINI_*`, `OPENAI_*`)

### Phase 1 — Veterinary knowledge base foundation

- Design Prisma models (or document store) for vet documents + metadata + `APPROVED` workflow
- Add pgvector (or external vector store) and embedding pipeline
- Build ingestion: PDF/Markdown upload → chunk → embed → index
- Admin UI for upload, review, approve, expire
- **Do not** change DATABASE tools

### Phase 2 — RAG retrieval layer (Source B)

- `lib/ai/vet-kb/` — retrieve approved chunks by topic/species
- New route: `VET_KB` and `DATABASE + VET_KB`
- Update orchestrator: call KB before WEB for general knowledge
- Citations in responses (title, reviewer, version)

### Phase 3 — Router upgrade

- Replace or augment regex router with LLM/lightweight classifier
- Explicit 4-source routing: DATABASE | VET_KB | WEB | COMBINED variants
- Regression test suite from `__tests__/lib/ai/source-router.test.ts` + new KB cases

### Phase 4 — Reduce WEB dependency

- Default general knowledge to VET KB
- WEB only for recency gaps, regulations, research
- COMBINED synthesis templates in prompts

### Phase 5 — Optional enhancements

- Missing DB tools (`getUnits`, inventory transactions, group treatments)
- Farm-scoped queries tied to user permissions
- Server-side conversation logging (audit, not RAG)
- Dedicated health risk scoring tool

---

## 15. Environment & Configuration (reference)

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER` | `openai` (default) or `gemini` for tool-calling chat |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI provider |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MODEL_FALLBACK` | Gemini provider + web grounding |
| `GEMINI_RETRY_MAX`, `GEMINI_RETRY_BASE_MS` | 503 retry/backoff |

---

## 16. Related Files

| Path | Role |
|------|------|
| `prisma/schema.prisma` | Database schema |
| `app/api/assistant/chat/route.ts` | AI API entry |
| `lib/ai/orchestrator.ts` | Route execution |
| `lib/ai/source-router.ts` | Pre-call classification |
| `lib/ai/tools/registry.ts` | Tool catalog |
| `lib/ai/prompts/system-prompt.ts` | Global assistant instructions |
| `lib/ai/prompts/source-routing-prompt.ts` | Per-request source constraints |
| `lib/ai/web-search.ts` | Source C (today) |
| `lib/ai/providers/` | LLM adapters |
| `lib/ai/gemini-config.ts`, `lib/ai/gemini-retry.ts` | Gemini resilience |

---

*End of source map. Implementation of Vet KB, RAG, and router changes requires a separate approved work item.*
