# TerraDairy Database Diagrams

This document describes the database that is actually implemented in
`prisma/schema.prisma`, followed by a proposed financial layer. The diagrams
show the important fields only; they are not a replacement for the Prisma
schema.

## Legend

- **PK**: primary key
- **FK**: foreign key
- **1:N**: one-to-many
- **1:1**: one-to-one
- Solid green nodes: existing implemented models
- Dashed orange nodes: proposed financial models
- A relationship labelled `optional` has a nullable foreign key
- `poly` means the existing model stores a type and id pair without a database FK

## Diagram 1: TerraDairy — Existing Database Schema

```mermaid
flowchart LR
  subgraph FARM[Farm and animal master data]
    farms["Farm<br/>PK farm_id<br/>farm_name"]
    units["Unit / housing area<br/>PK unit_id<br/>FK farm_id<br/>unit_name, unit_type"]
    species["Species<br/>PK species_id<br/>species_name UNIQUE"]
    breeds["Breed<br/>PK breed_id<br/>FK species_id<br/>breed_name"]
    animals["Animal<br/>PK animal_id<br/>FK farm_id, unit_id, breed_id<br/>tag_number, gender, date_of_birth<br/>mother_id, father_id"]
  end

  subgraph REPRO[Reproduction and lifecycle]
    breeding["Breeding record<br/>PK breeding_id<br/>FK female_animal_id, male_animal_id<br/>breeding_date, method, result"]
    pregnancy["Pregnancy record<br/>PK pregnancy_id<br/>FK animal_id, breeding_id<br/>insemination_date, status<br/>expected_delivery_date"]
    calving["Calving record<br/>PK calving_id<br/>FK mother_id, calf_id, pregnancy_id<br/>calving_date, outcome"]
    lactation["Lactation period<br/>PK period_id<br/>FK animal_id, pregnancy_id, calving_id<br/>period_type, start_date, end_date"]
    heat["Heat cycle record<br/>PK heat_cycle_id<br/>FK animal_id<br/>heat_start_date, heat_end_date<br/>detection_method"]
  end

  subgraph HEALTH[Animal health]
    health["Health incident<br/>PK incident_id<br/>FK animal_id (optional)<br/>disease_name, severity, status"]
    treatment["Treatment record<br/>PK treatment_id<br/>FK incident_id, batch_id, inventory_item_id<br/>treatment_date, dosage"]
    vaccination["Vaccination record<br/>PK vaccination_id<br/>FK animal_id, pregnancy_id, breeding_id<br/>FK batch_id, inventory_item_id<br/>vaccine_name, vaccination_date"]
    groupbatch["Group treatment batch<br/>PK batch_id<br/>FK farm_id, unit_id, inventory_item_id<br/>treatment_type, treatment_date<br/>animal_count, total_quantity"]
    growth["Growth log<br/>PK growth_log_id<br/>FK animal_id<br/>weight_kg, recorded_date"]
  end

  subgraph MILK[Milk production]
    milk["Milk log<br/>PK milk_log_id<br/>FK animal_id<br/>production_date, session<br/>milk_liters, quality_grade"]
  end

  subgraph INV[Inventory]
    items["Inventory item<br/>PK item_id<br/>FK farm_id (optional)<br/>item_name, category, quantity<br/>unit_cost, supplier"]
    lots["Inventory lot<br/>PK lot_id<br/>FK item_id<br/>lot_number, quantity, remaining_quantity<br/>unit_cost, received_date, expiry_date"]
    movements["Inventory transaction<br/>PK transaction_id<br/>FK item_id, lot_id, user_id<br/>transaction_type, quantity<br/>transaction_date, reference"]
  end

  subgraph ACCESS[Users, audit and notifications]
    users["User<br/>PK user_id<br/>email UNIQUE, name, role"]
    roles["Role permission<br/>PK id<br/>role, permission_key<br/>UNIQUE role + permission_key"]
    audit["Audit log<br/>PK id<br/>FK user_id<br/>entity, entity_id, action<br/>old_values, new_values"]
    notifications["Notification<br/>PK id<br/>FK user_id<br/>type, title, is_read<br/>entity_type, entity_id (poly)"]
  end

  subgraph CHAT[Messaging]
    conversations["Chat conversation<br/>PK conversation_id<br/>type, last_message_at"]
    participants["Conversation participant<br/>PK participant_id<br/>FK conversation_id, user_id<br/>UNIQUE conversation + user"]
    messages["Chat message<br/>PK message_id<br/>FK conversation_id, sender_id<br/>body, message_type"]
    attachments["Message attachment<br/>PK attachment_id<br/>FK message_id (optional)<br/>file_name, storage_key, media_type"]
    reads["Message read<br/>PK read_id<br/>FK message_id, user_id<br/>read_at<br/>UNIQUE message + user"]
    presence["User presence<br/>PK user_id / FK user_id<br/>last_seen_at"]
  end

  farms -->|1:N| units
  farms -->|1:N| animals
  farms -->|1:N| items
  farms -->|1:N| groupbatch
  species -->|1:N| breeds
  breeds -->|1:N| animals
  units -->|1:N, optional from animal| animals
  animals -->|1:N as mother| animals
  animals -->|1:N as father| animals

  animals -->|1:N female| breeding
  animals -->|1:N male| breeding
  animals -->|1:N| pregnancy
  breeding -->|1:N, optional link| pregnancy
  animals -->|1:N as mother| calving
  animals -->|1:N as calf, optional| calving
  pregnancy -->|1:N, optional link| calving
  animals -->|1:N| lactation
  pregnancy -->|1:N, optional link| lactation
  calving -->|1:N, optional link| lactation
  animals -->|1:N, optional| heat

  animals -->|1:N| growth
  animals -->|1:N, optional| health
  health -->|1:N| treatment
  groupbatch -->|1:N| treatment
  items -->|1:N, optional| treatment
  animals -->|1:N, optional| vaccination
  pregnancy -->|1:N, optional| vaccination
  breeding -->|1:N, optional| vaccination
  groupbatch -->|1:N| vaccination
  items -->|1:N, optional| vaccination
  animals -->|1:N| milk

  items -->|1:N| lots
  items -->|1:N| movements
  lots -->|1:N, optional| movements
  users -->|1:N, optional| movements

  users -->|1:N| audit
  users -->|1:N| notifications
  conversations -->|1:N| participants
  users -->|1:N| participants
  conversations -->|1:N| messages
  users -->|1:N sender| messages
  messages -->|1:N| attachments
  messages -->|1:N| reads
  users -->|1:N| reads
  users -->|1:1, optional| presence

  classDef existing fill:#edf8f1,stroke:#2f855a,stroke-width:1.5px,color:#173b2b
  class farms,units,species,breeds,animals,breeding,pregnancy,calving,lactation,heat,health,treatment,vaccination,groupbatch,growth,milk,items,lots,movements,users,roles,audit,notifications,conversations,participants,messages,attachments,reads,presence existing
```

### Reading the existing schema

- A farm owns units, animals, inventory items, and group treatment batches.
- An animal belongs to one farm and one breed, may be assigned to a unit, and
  can point to another animal as its mother or father. The `(farm_id,
  tag_number)` pair is unique.
- Milk, growth, health, heat, pregnancy, lactation, breeding, calving, and
  vaccination records are connected through animal and workflow foreign keys.
- Treatments and vaccinations can reference inventory items and group treatment
  batches. The schema therefore already records operational consumption context,
  but it does not record a monetary ledger.
- Inventory is represented by items, optional lots, and stock movements. A
  stock-in movement can carry a reference, supplier, and unit cost through the
  related item/lot data.
- Users connect to audit logs, notifications, inventory movements, and chat.
  `role_permissions` currently has no FK to `users` or another model.

## Diagram 2: TerraDairy — Proposed Integrated Database Schema

The green nodes and relationships below are existing. Orange dashed nodes are
the suggested additions only. The proposed design intentionally reuses
inventory and production records instead of copying them into accounting
tables.

```mermaid
flowchart LR
  subgraph EXISTING[Existing TerraDairy modules]
    farms["Farm<br/>PK farm_id<br/>farm_name"]
    units["Unit<br/>PK unit_id<br/>FK farm_id"]
    species["Species<br/>PK species_id<br/>species_name"]
    breeds["Breed<br/>PK breed_id<br/>FK species_id"]
    animals["Animal<br/>PK animal_id<br/>FK farm_id, unit_id, breed_id<br/>tag_number, lifecycle_stage"]
    breeding["Breeding record<br/>PK breeding_id<br/>FK female_animal_id, male_animal_id"]
    pregnancy["Pregnancy record<br/>PK pregnancy_id<br/>FK animal_id, breeding_id"]
    calving["Calving record<br/>PK calving_id<br/>FK mother_id, calf_id, pregnancy_id"]
    lactation["Lactation period<br/>PK period_id<br/>FK animal_id, pregnancy_id, calving_id"]
    heat["Heat cycle record<br/>PK heat_cycle_id<br/>FK animal_id"]
    growth["Growth log<br/>PK growth_log_id<br/>FK animal_id"]
    health["Health incident<br/>PK incident_id<br/>FK animal_id"]
    treatment["Treatment record<br/>PK treatment_id<br/>FK incident_id, batch_id, inventory_item_id"]
    vaccination["Vaccination record<br/>PK vaccination_id<br/>FK animal_id, pregnancy_id, breeding_id<br/>FK batch_id, inventory_item_id"]
    groupbatch["Group treatment batch<br/>PK batch_id<br/>FK farm_id, unit_id, inventory_item_id"]
    milk["Milk log<br/>PK milk_log_id<br/>FK animal_id<br/>production_date, milk_liters"]
    items["Inventory item<br/>PK item_id<br/>FK farm_id (optional)<br/>item_name, category, unit_cost"]
    lots["Inventory lot<br/>PK lot_id<br/>FK item_id<br/>quantity, unit_cost, supplier"]
    movements["Inventory transaction<br/>PK transaction_id<br/>FK item_id, lot_id, user_id<br/>transaction_type, quantity, transaction_date"]
    users["User<br/>PK user_id<br/>email UNIQUE, role"]
    conversations["Chat conversation<br/>PK conversation_id"]
    participants["Conversation participant<br/>PK participant_id<br/>FK conversation_id, user_id"]
    messages["Chat message<br/>PK message_id<br/>FK conversation_id, sender_id"]
    attachments["Message attachment<br/>PK attachment_id<br/>FK message_id"]
    reads["Message read<br/>PK read_id<br/>FK message_id, user_id"]
    presence["User presence<br/>PK user_id / FK user_id"]
    audit["Audit log<br/>PK id<br/>FK user_id"]
    notifications["Notification<br/>PK id<br/>FK user_id<br/>entity_id (poly)"]
    roles["Role permission<br/>PK id<br/>role, permission_key"]
  end

  subgraph FINANCE[PROPOSED financial layer]
    categories["Financial category<br/>PK category_id<br/>name, kind: INCOME or EXPENSE<br/>UNIQUE name + kind"]
    financial["Financial transaction<br/>PK financial_transaction_id<br/>FK farm_id, category_id<br/>FK animal_id (optional)<br/>FK inventory_transaction_id (optional)<br/>transaction_date, amount<br/>payment_method, counterparty<br/>description, status"]
  end

  farms -->|1:N| units
  farms -->|1:N| animals
  farms -->|1:N| items
  farms -->|1:N| groupbatch
  species -->|1:N| breeds
  breeds -->|1:N| animals
  units -->|1:N optional| animals
  animals -->|1:N mother/father| animals
  animals -->|1:N female/male| breeding
  animals -->|1:N| pregnancy
  breeding -->|1:N optional| pregnancy
  animals -->|1:N mother/calf| calving
  pregnancy -->|1:N optional| calving
  animals -->|1:N| lactation
  pregnancy -->|1:N optional| lactation
  calving -->|1:N optional| lactation
  animals -->|1:N| heat
  animals -->|1:N| growth
  animals -->|1:N optional| health
  health -->|1:N| treatment
  groupbatch -->|1:N| treatment
  items -->|1:N optional| treatment
  animals -->|1:N optional| vaccination
  pregnancy -->|1:N optional| vaccination
  breeding -->|1:N optional| vaccination
  groupbatch -->|1:N| vaccination
  items -->|1:N optional| vaccination
  animals -->|1:N| milk
  items -->|1:N| lots
  items -->|1:N| movements
  lots -->|1:N optional| movements
  users -->|1:N optional| movements
  users -->|1:N| audit
  users -->|1:N| notifications
  conversations -->|1:N| participants
  users -->|1:N| participants
  conversations -->|1:N| messages
  users -->|1:N sender| messages
  messages -->|1:N| attachments
  messages -->|1:N| reads
  users -->|1:N| reads
  users -->|1:1 optional| presence

  farms -->|1:N| financial
  categories -->|1:N| financial
  animals -.->|optional animal cost/revenue| financial
  movements -.->|optional source for stock-in expense| financial
  items -.->|optional source context| financial
  milk -.->|source for milk revenue| financial

  classDef existing fill:#edf8f1,stroke:#2f855a,stroke-width:1.5px,color:#173b2b
  classDef proposed fill:#fff4df,stroke:#c05621,stroke-width:2px,stroke-dasharray:6 4,color:#542d16
  class farms,units,species,breeds,animals,breeding,pregnancy,calving,lactation,heat,growth,health,treatment,vaccination,groupbatch,milk,items,lots,movements,users,conversations,participants,messages,attachments,reads,presence,audit,notifications,roles existing
  class categories,financial proposed
```

## Proposed financial entities

### `financial_categories`

Reusable farm-independent labels such as `Milk sales`, `Animal sales`, `Feed`,
`Medicines`, `Vaccinations`, `Veterinary`, `Labor`, `Utilities`, `Equipment`,
`Maintenance`, and `Other`. The `kind` field separates income from expenses.
Keeping categories in a table makes category-based reports stable while still
allowing administrators to add categories later.

### `financial_transactions`

The accounting event table. Recommended important fields are:

- `financial_transaction_id` (PK)
- `farm_id` (required FK to the existing `farms` table)
- `category_id` (required FK to `financial_categories`)
- `animal_id` (nullable FK to `animals`)
- `inventory_transaction_id` (nullable FK to `inventory_transactions`)
- `transaction_date`, `amount`, and `description`
- `payment_method` and `counterparty` as controlled values or snapshots
- `status` such as `DRAFT`, `POSTED`, or `VOID`

One row can represent a milk sale, animal sale, farm utility bill, labor cost,
or any other income/expense. A farm-level expense leaves `animal_id` null. An
animal purchase, treatment bill, feed allocation, or animal sale can set it.

## How the integration works

1. **Milk revenue:** create a financial income transaction in the `Milk sales`
   category and retain the relevant date and description. The existing `milk_logs`
   remain production records; they are not copied into the ledger. If sales are
   recorded in batches, the transaction can carry a reference to the reporting
   period or an external receipt.
2. **Animal revenue and costs:** link the transaction to `animal_id` for animal
   purchase cost, medical cost, feed allocation, or sale revenue. This enables
   animal profitability as income minus linked expenses.
3. **Inventory purchases:** for a stock-in purchase, link the financial row to
   the existing `inventory_transaction_id`. The amount can be captured at
   posting time from the lot/item quantity and unit cost, while the inventory
   movement remains the stock ledger. This avoids a second purchase table.
4. **Shared treatment:** a group treatment or farm operating cost can remain
   farm-level with `animal_id` null. If later the business wants per-animal
   allocation, create child financial rows or an allocation mechanism rather
   than pretending the group batch belongs to one animal.
5. **Reports:** filter `financial_transactions` by `farm_id`, date range, kind,
   and category. Profit is posted income minus posted expenses; cash flow can
   additionally filter by payment status and payment date if those fields are
   added in the implementation phase.

## Assumptions and current gaps

- The checkout contains `prisma/schema.prisma` but no `prisma/migrations`
  directory. The diagrams therefore treat the Prisma schema as the current
  database source of truth.
- There is no implemented farm-user membership FK. Users are not shown as farm
  owners or farm members in the diagrams; adding that would be a separate access
  model decision.
- `inventory_items.supplier` and stock/lot supplier values are free text. The
  proposal keeps `counterparty` as a transaction snapshot instead of inventing a
  supplier/customer table. A later procurement module could add one and migrate
  these values.
- `health_incidents.veterinarian_id` is an integer without a Prisma relation, so
  it is not drawn as a user FK.
- `breeding_records.semen_batch_id` is a free-form string. It is not drawn as a
  relation to inventory because the schema explicitly documents that semen
  inventory is not implemented.
- `notifications.entity_type` and `entity_id` are a polymorphic reference, not
  a database-enforced FK; the diagram marks this as `poly`.
- The current inventory model stores `unit_cost`, but a stock-out does not itself
  identify a monetary expense or an animal allocation. Financial posting rules
  will need to define whether expenses are recognized at purchase, consumption,
  or both, and must avoid counting the same cost twice.
- Payment method, customer identity, invoice numbers, payment date, currency,
  and tax are not currently present. They should be added only when the financial
  workflow requirements are settled.

No Prisma schema, migration, application code, or database data is changed by
this document.