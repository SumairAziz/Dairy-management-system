# TerraDairy — API Reference

Complete reference for all TerraDairy REST API endpoints. Base URL: `/api`.

---

## Authentication

All endpoints except `/api/auth/*` require a valid JWT session cookie. Authenticate via NextAuth at `/api/auth/signin` (POST with `email` and `password`).

Unauthenticated requests receive:

```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }
```

Status: `401 Unauthorized`

### RBAC Permissions

| Resource | ADMIN | MANAGER | VETERINARIAN | WORKER | VIEWER |
|---|---|---|---|---|---|
| animals | CRUD | CRUD | R | R | R |
| milk | CRUD | CRUD | R | C,R | R |
| health | CRUD | CRUD | CRUD | C,R | R |
| farms | CRUD | CRUD | R | R | R |
| vaccinations | CRUD | CRUD | CRUD | C,R | R |
| breeding | CRUD | CRUD | CRUD | R | R |
| heatCycles | CRUD | CRUD | R | R | R |
| units | CRUD | CRUD | R | R | R |
| species | CRUD | CRUD | R | R | R |
| breeds | CRUD | CRUD | R | R | R |
| pregnancy | CRUD | CRUD | CRUD | R | R |

C = Create, R = Read, U = Update, D = Delete

---

## Standard Response Formats

### Success (single resource)

```json
{ "success": true, "data": { ... } }
```

Status: `200 OK` (or `201 Created` for POST)

### Success (paginated list)

```json
{
  "success": true,
  "data": [ ... ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

Status: `200 OK`

### No Content (DELETE)

Status: `204 No Content` (empty body)

### Error

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

### Validation Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      { "field": "email", "message": "Invalid email address" }
    ]
  }
}
```

Status: `400 Bad Request`

### Common Error Codes

| Code | Status | When |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `CONFLICT` | 409 | Duplicate unique value (Prisma P2002) |
| `DATABASE_ERROR` | 500 | Unhandled Prisma error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Auth

### POST /api/auth/register

Register a new user. No authentication required.

**Permissions:** Public

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | Yes | Max 100 characters |
| email | string | Yes | Must be valid email, unique |
| password | string | Yes | Min 6 characters |
| role | enum | No | `ADMIN`, `MANAGER`, `VETERINARIAN`, `WORKER`, `VIEWER` (default: `VIEWER`) |

**Response:** `201 Created`

```json
{ "success": true, "data": { "id": 1, "email": "john@example.com", "name": "John Doe", "role": "VIEWER" } }
```

**Errors:** `409 CONFLICT` if email already registered, `400 VALIDATION_ERROR` for invalid input.

---

## Animals

### GET /api/animals

List animals with pagination, filtering, and sorting.

**Permissions:** All roles (read)

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| page | number | 1 | Page number |
| pageSize | number | 20 | 1-100 |
| sortBy | string | `animal_id` | `animal_id`, `tag_number`, `gender`, `date_of_birth`, `lifecycle_stage`, `created_at` |
| sortDir | string | `desc` | `asc` or `desc` |
| farm_id | number | — | Filter by farm |
| unit_id | number | — | Filter by unit |
| breed_id | number | — | Filter by breed |
| species_id | number | — | Filter by species |
| gender | enum | — | `M` or `F` |
| lifecycle_stage | string | — | `Calf`, `Heifer`, `Lactating`, `Dry`, etc. |
| tag_number | string | — | Partial match search |
| is_active | string | — | `true` or `false` |

**Response:** `200` with paginated array of Animal objects.

### POST /api/animals

Create a new animal.

**Permissions:** ADMIN, MANAGER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| farm_id | number | Yes | Positive integer |
| breed_id | number | Yes | Positive integer |
| tag_number | string | Yes | Max 50 chars, unique per farm |
| gender | enum | Yes | `M` or `F` |
| date_of_birth | string | Yes | ISO date string |
| animal_name | string | No | Max 100 chars |
| unit_id | number | No | Nullable |
| mother_id | number | No | Nullable, must exist |
| father_id | number | No | Nullable, must exist |
| birth_weight_kg | number | No | Positive |
| lifecycle_stage | enum | No | Default: `Calf` |
| is_active | boolean | No | Default: `true` |

**Response:** `201 Created` with the created Animal object.

### GET /api/animals/:id

Get a single animal with all relations (breed, farm, unit, species, mother, father, growth logs, health incidents, milk logs, vaccination records, breeding records, pregnancy records, heat cycle records).

**Permissions:** All roles (read)

**Response:** `200` with full Animal object.

**Errors:** `404 NOT_FOUND` if animal does not exist.

### PUT /api/animals/:id

Update an animal. All fields are optional.

**Permissions:** ADMIN, MANAGER

**Request Body:** Same as POST but all fields optional.

**Response:** `200` with updated Animal object.

### DELETE /api/animals/:id

Delete an animal permanently.

**Permissions:** ADMIN, MANAGER

**Response:** `204 No Content`

---

## Growth Logs (nested under Animals)

### GET /api/animals/:id/growth-logs

List growth logs for a specific animal.

**Permissions:** All roles (read)

**Response:** `200` with array of GrowthLog objects.

### POST /api/animals/:id/growth-logs

Add a growth log entry.

**Permissions:** ADMIN, MANAGER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| weight_kg | number | Yes | Positive |
| recorded_date | string | Yes | ISO date string |
| notes | string | No | Nullable |

**Response:** `201 Created`

---

## Health Incidents (nested under Animals)

### GET /api/animals/:id/health-incidents

List health incidents for a specific animal.

**Permissions:** All roles (read)

### POST /api/animals/:id/health-incidents

Report a new health incident.

**Permissions:** ADMIN, MANAGER, VETERINARIAN, WORKER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| incident_date | string | No | Nullable |
| disease_name | string | No | Max 100 chars |
| severity | string | No | Max 20 chars |
| symptoms | string | No | Nullable |
| treatment | string | No | Nullable |
| status | string | No | Max 20 chars |
| veterinarian_id | number | No | Nullable |

### PUT /api/animals/:id/health-incidents/:incidentId

Update a health incident.

**Permissions:** ADMIN, MANAGER, VETERINARIAN

**Request Body:** Same fields as POST, all optional.

### DELETE /api/animals/:id/health-incidents/:incidentId

Delete a health incident.

**Permissions:** ADMIN, MANAGER, VETERINARIAN

**Response:** `204 No Content`

---

## Farms

### GET /api/farms

List all farms with pagination.

**Permissions:** All roles (read)

**Query Parameters:** `page`, `pageSize`

**Response:** `200` with paginated Farm objects including `_count: { animals, units }`.

### POST /api/farms

Create a farm.

**Permissions:** ADMIN, MANAGER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| farm_name | string | Yes | Max 100 chars |
| owner_name | string | No | Max 100 chars |
| contact_number | string | No | Max 20 chars |
| address | string | No | Nullable |
| city | string | No | Max 100 chars |
| province | string | No | Max 100 chars |
| country | string | No | Max 100 chars |
| total_area_acres | number | No | Positive |
| is_active | boolean | No | Default: `true` |

**Response:** `201 Created`

### GET /api/farms/:id

Get farm details including stats (animal count, unit count, daily milk production, species distribution, health status groups).

**Permissions:** All roles (read)

### PUT /api/farms/:id

Update a farm.

**Permissions:** ADMIN, MANAGER

### DELETE /api/farms/:id

Delete a farm.

**Permissions:** ADMIN, MANAGER

**Response:** `204 No Content`

---

## Units

### GET /api/units

List units. Optionally filter by farm.

**Permissions:** All roles (read)

**Query Parameters:** `page`, `pageSize`, `farm_id`

### POST /api/units

Create a unit.

**Permissions:** ADMIN, MANAGER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| farm_id | number | Yes | Positive integer |
| unit_name | string | Yes | Max 100 chars |
| unit_type | string | Yes | Max 50 chars |
| capacity | number | No | Non-negative integer |
| description | string | No | Nullable |
| is_active | boolean | No | Default: `true` |

**Response:** `201 Created`

### GET /api/units/:id

**Permissions:** All roles (read)

### PUT /api/units/:id

**Permissions:** ADMIN, MANAGER

### DELETE /api/units/:id

**Permissions:** ADMIN, MANAGER

**Response:** `204 No Content`

---

## Species

### GET /api/species

List species with their breeds.

**Permissions:** All roles (read)

### POST /api/species

**Permissions:** ADMIN, MANAGER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| species_name | string | Yes | Max 100 chars, unique |
| scientific_name | string | No | Max 150 chars |
| description | string | No | Nullable |
| is_active | boolean | No | Default: `true` |

### GET /api/species/:id

### PUT /api/species/:id

### DELETE /api/species/:id

**Response:** `204 No Content`

---

## Breeds

### GET /api/breeds

List breeds. Optionally filter by species.

**Query Parameters:** `page`, `pageSize`, `species_id`

### POST /api/breeds

**Permissions:** ADMIN, MANAGER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| species_id | number | Yes | Positive integer |
| breed_name | string | Yes | Max 100 chars |
| origin_country | string | No | Max 100 chars |
| average_milk_production | number | No | Positive |
| description | string | No | Nullable |
| is_active | boolean | No | Default: `true` |

### GET /api/breeds/:id

### PUT /api/breeds/:id

### DELETE /api/breeds/:id

**Response:** `204 No Content`

---

## Milk Logs

### GET /api/milk-logs

List milk production records with filtering.

**Permissions:** All roles (read)

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| page | number | 1 | |
| pageSize | number | 20 | 1-100 |
| animal_id | number | — | Filter by animal |
| session | enum | — | `Morning`, `Afternoon`, `Evening` |
| date_from | string | — | ISO date, inclusive |
| date_to | string | — | ISO date, inclusive |
| milk_min | number | — | Minimum liters |
| milk_max | number | — | Maximum liters |

### POST /api/milk-logs

Record a milk production entry.

**Permissions:** ADMIN, MANAGER, WORKER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| animal_id | number | Yes | Positive integer |
| production_date | string | Yes | ISO date string |
| session | enum | Yes | `Morning`, `Afternoon`, `Evening` |
| milk_liters | number | Yes | Positive |
| quality_grade | string | No | Max 20 chars |
| notes | string | No | Nullable |

**Response:** `201 Created`

### GET /api/milk-logs/:id

Get a single milk log with the associated animal.

**Permissions:** All roles (read)

### DELETE /api/milk-logs/:id

Delete a milk log.

**Permissions:** ADMIN, MANAGER

**Response:** `204 No Content`

### GET /api/milk-logs/stats

Get aggregated milk production statistics.

**Permissions:** All roles (read)

**Response:** `200`

```json
{
  "success": true,
  "data": {
    "todayProduction": 156.5,
    "animalsMilkedToday": 12,
    "avgYieldPerAnimal": 13.0,
    "monthlyProduction": 4250.0,
    "sessions": {
      "Morning": 58.2,
      "Afternoon": 52.1,
      "Evening": 46.2
    },
    "topProducerLabel": "Bessie - 18.5L"
  }
}
```

---

## Breeding Records

### GET /api/breeding-records

**Query Parameters:** `page`, `pageSize`, `female_animal_id`, `male_animal_id`, `method`

### POST /api/breeding-records

**Permissions:** ADMIN, MANAGER, VETERINARIAN

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| female_animal_id | number | No | Nullable |
| male_animal_id | number | No | Nullable |
| breeding_date | string | No | Nullable |
| method | string | No | Max 30 chars |
| result | string | No | Max 20 chars |
| notes | string | No | Nullable |

### GET /api/breeding-records/:id

Includes female and male animal relations.

### PUT /api/breeding-records/:id

**Permissions:** ADMIN, MANAGER, VETERINARIAN

### DELETE /api/breeding-records/:id

**Response:** `204 No Content`

---

## Heat Cycles

### GET /api/heat-cycles

**Query Parameters:** `page`, `pageSize`, `animal_id`, `date_from`, `date_to`

### POST /api/heat-cycles

**Permissions:** ADMIN, MANAGER, VETERINARIAN

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| animal_id | number | No | Nullable |
| heat_start_date | string | No | Nullable |
| heat_end_date | string | No | Nullable |
| detection_method | string | No | Max 20 chars |
| confidence_score | number | No | 0-5, nullable |
| notes | string | No | Nullable |

### GET /api/heat-cycles/:id

### PUT /api/heat-cycles/:id

### DELETE /api/heat-cycles/:id

**Response:** `204 No Content`

---

## Vaccinations

### GET /api/vaccinations

**Query Parameters:** `page`, `pageSize`, `animal_id`, `vaccine_name` (partial match), `upcoming` (`true`/`false` — filters where `next_due_date >= now`)

### POST /api/vaccinations

**Permissions:** ADMIN, MANAGER, VETERINARIAN, WORKER

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| animal_id | number | No | Nullable |
| vaccine_name | string | No | Max 100 chars |
| vaccination_date | string | No | Nullable |
| next_due_date | string | No | Nullable |
| administered_by | string | No | Max 100 chars |
| notes | string | No | Nullable |

### GET /api/vaccinations/:id

### PUT /api/vaccinations/:id

**Permissions:** ADMIN, MANAGER, VETERINARIAN

### DELETE /api/vaccinations/:id

**Response:** `204 No Content`

---

## Pregnancy Records

### GET /api/pregnancy-records

**Query Parameters:** `page`, `pageSize`, `animal_id`, `status`

### POST /api/pregnancy-records

**Permissions:** ADMIN, MANAGER, VETERINARIAN

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| animal_id | number | Yes | Positive integer |
| insemination_date | string | Yes | ISO date string |
| pregnancy_confirmed | boolean | No | Nullable |
| confirmation_date | string | No | Nullable |
| expected_delivery_date | string | No | Nullable |
| actual_delivery_date | string | No | Nullable |
| status | string | No | Default: `Pending` |

### GET /api/pregnancy-records/:id

### PUT /api/pregnancy-records/:id

**Permissions:** ADMIN, MANAGER, VETERINARIAN

### DELETE /api/pregnancy-records/:id

**Response:** `204 No Content`

---

## Dashboard

### GET /api/dashboard

Returns aggregated analytics for the dashboard.

**Permissions:** All roles (read)

**Response:** `200`

```json
{
  "success": true,
  "data": {
    "totals": {
      "animalCount": 150,
      "speciesCount": 4,
      "breedCount": 12,
      "farmCount": 3,
      "unitCount": 15,
      "dailyMilk": 156.5,
      "pregnantCount": 28
    },
    "health": [
      { "status": "Healthy", "_count": 120 },
      { "status": "Under Treatment", "_count": 18 },
      { "status": "Critical", "_count": 3 }
    ],
    "vaccination": [
      { "vaccine_name": "Anthrax Vaccine", "_count": 45 },
      { "vaccine_name": "FMD Vaccine", "_count": 38 }
    ],
    "recent": [ ... ],
    "milkByFarm": [
      { "farm_id": 1, "farm_name": "Green Pastures", "liters": 85.2 }
    ],
    "speciesDist": [
      { "label": "Holstein", "value": 80 },
      { "label": "Jersey", "value": 45 }
    ],
    "milkTrend": [
      { "label": "Jun 12", "value": 148.5 },
      { "label": "Jun 13", "value": 152.0 }
    ],
    "breedingStats": [
      { "label": "Success", "value": 25 },
      { "label": "Failed", "value": 8 },
      { "label": "Pending", "value": 12 }
    ],
    "heatCycleByMethod": [
      { "label": "Visual", "value": 30 },
      { "label": "Sensor", "value": 15 }
    ],
    "pregnancyByStatus": [
      { "label": "Pending", "value": 5 },
      { "label": "Confirmed", "value": 10 },
      { "label": "In Progress", "value": 8 },
      { "label": "Delivered", "value": 4 },
      { "label": "Failed", "value": 1 }
    ],
    "lifecycleDist": [
      { "label": "Lactating", "value": 60 },
      { "label": "Dry", "value": 25 },
      { "label": "Calf", "value": 30 },
      { "label": "Heifer", "value": 20 },
      { "label": "Pregnant Heifer", "value": 10 },
      { "label": "Bull", "value": 5 }
    ],
    "upcomingVaccinations": 7,
    "farmCapacity": [
      { "label": "Green Pastures", "value": 55, "max": 80 },
      { "label": "Sunny Acres", "value": 40, "max": 60 }
    ]
  }
}
```

---

## Audit Logs

### GET /api/audit-logs

Query the audit trail. Records all mutations (CREATE, UPDATE, DELETE) across all entities.

**Permissions:** ADMIN, MANAGER (read)

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| page | number | 1 | |
| pageSize | number | 20 | 1-100 |
| entity | string | — | Entity name: `animals`, `farms`, `milk_logs`, etc. |
| user_id | number | — | Filter by user who performed the action |
| action | string | — | `CREATE`, `UPDATE`, or `DELETE` |

**Response:** `200` with paginated AuditLog objects including the associated user.

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "entity": "animals",
      "entity_id": 42,
      "action": "CREATE",
      "old_values": null,
      "new_values": { "tag_number": "TAG-001", "gender": "F" },
      "created_at": "2025-01-15T10:30:00.000Z",
      "users": { "user_id": 1, "name": "Admin", "email": "admin@farm.com", "role": "ADMIN" }
    }
  ],
  "total": 500,
  "page": 1,
  "pageSize": 20
}
```

---

## Notifications

### GET /api/notifications

List notifications for the authenticated user.

**Permissions:** Authenticated users

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| unread | string | Set to `true` to only return unread notifications |

### PATCH /api/notifications

Bulk action on notifications.

**Request Body:**

```json
{ "action": "mark_all_read" }
```

**Response:**

```json
{ "success": true, "data": { "marked": 5 } }
```

### PATCH /api/notifications/:id

Mark a single notification as read.

**Permissions:** Authenticated users (user-scoped — can only read own notifications)

**Response:** `200` with updated notification.

### DELETE /api/notifications/:id

Delete a notification.

**Permissions:** Authenticated users (user-scoped)

**Response:** `204 No Content`

### GET /api/notifications/unread-count

Get the count of unread notifications for the authenticated user.

**Response:**

```json
{ "success": true, "data": { "count": 3 } }
```

---

## Route Summary

| Endpoint | GET | POST | PUT | PATCH | DELETE |
|---|---|---|---|---|---|
| `/api/auth/register` | | x | | | |
| `/api/animals` | x | x | | | |
| `/api/animals/:id` | x | | x | | x |
| `/api/animals/:id/growth-logs` | x | x | | | |
| `/api/animals/:id/health-incidents` | x | x | | | |
| `/api/animals/:id/health-incidents/:incidentId` | | | x | | x |
| `/api/farms` | x | x | | | |
| `/api/farms/:id` | x | | x | | x |
| `/api/units` | x | x | | | |
| `/api/units/:id` | x | | x | | x |
| `/api/species` | x | x | | | |
| `/api/species/:id` | x | | x | | x |
| `/api/breeds` | x | x | | | |
| `/api/breeds/:id` | x | | x | | x |
| `/api/milk-logs` | x | x | | | |
| `/api/milk-logs/:id` | x | | | | x |
| `/api/milk-logs/stats` | x | | | | |
| `/api/breeding-records` | x | x | | | |
| `/api/breeding-records/:id` | x | | x | | x |
| `/api/heat-cycles` | x | x | | | |
| `/api/heat-cycles/:id` | x | | x | | x |
| `/api/vaccinations` | x | x | | | |
| `/api/vaccinations/:id` | x | | x | | x |
| `/api/pregnancy-records` | x | x | | | |
| `/api/pregnancy-records/:id` | x | | x | | x |
| `/api/dashboard` | x | | | | |
| `/api/audit-logs` | x | | | | |
| `/api/notifications` | x | | x | | |
| `/api/notifications/:id` | | | x | | x |
| `/api/notifications/unread-count` | x | | | | |

**Total: 29 route files, ~55 HTTP handlers**