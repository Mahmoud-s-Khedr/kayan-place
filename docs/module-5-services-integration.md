# Module 5 Integration Guide: Services

## 1. Purpose and Audience

This guide is for frontend web and mobile teams integrating Module 5 (Services) with the backend.

It covers:
- service order creation and update
- user service listing with filtering/sorting
- admin service listing and status management
- service cancellation and service rating rules

## 2. Prerequisites

- Backend base URL is reachable (example: `http://localhost:800` in local Docker setup).
- User and admin authentication flows are already integrated (Module 1).
- Authenticated requests include a valid bearer token where required.
- Profile/session flows are working (Module 2).

## 3. End-to-End Flows

### 3.1 Create Service Order (User)

1. User creates service order using `POST /api/services`.
2. Backend creates service with initial status `not_started`.

Typical create payload:

```json
{
  "serviceType": "maintenance",
  "description": "Fix AC noise issue in bedroom.",
  "address": "Cairo, Nasr City"
}
```

### 3.2 Update Service Order (User)

1. User updates own service using `PATCH /api/services/:id`.
2. Only description is updatable by user.
3. Update is allowed only while service status is `not_started`.

Typical update payload:

```json
{
  "description": "Updated: AC noise issue plus weak cooling in living room."
}
```

### 3.3 My Service Orders (User)

Endpoint:
- `GET /api/services/me`

Query options:
- `serviceType` (`designing`, `maintenance`, `renewal`)
- `fromDate`, `toDate`
- `sortBy` (`createdAt`)
- `sortDirection` (`asc`, `desc`)

Examples:
- `GET /api/services/me?serviceType=maintenance&sortBy=createdAt&sortDirection=desc`
- `GET /api/services/me?fromDate=2026-01-01&toDate=2026-12-31&sortBy=createdAt&sortDirection=asc`

### 3.4 List All Service Orders (Admin)

Endpoint:
- `GET /api/admin/services`

Query options:
- `serviceType` (`designing`, `maintenance`, `renewal`)
- `fromDate`, `toDate`
- `sortBy` (`createdAt`)
- `sortDirection` (`asc`, `desc`)

Admin response list includes related user context per service order.

### 3.5 Update Service Order Status (Admin)

Endpoint:
- `PATCH /api/admin/services/:id/status`

Supported statuses:
- `not_started`
- `in_progress`
- `cancelled`
- `finished`

Typical admin status payload:

```json
{
  "status": "in_progress"
}
```

### 3.6 Cancel Service

User endpoint:
- `POST /api/services/:id/cancel`

Rule:
- Cancellation by user is allowed only while status is `not_started`.

Admin cancellation:
- Admin can set service status to `cancelled` using `PATCH /api/admin/services/:id/status`.

### 3.7 Service Rating

Users can rate a service one time only after status is `finished`.

Endpoint:
- `POST /api/ratings`

Service rating payload:

```json
{
  "itemType": "service",
  "itemId": 88,
  "ratingValue": 5
}
```

Duplicate rating on the same service by the same user is rejected.

## 4. Endpoint Map (High Level)

User:
- `POST /api/services`
- `PATCH /api/services/:id`
- `GET /api/services/me`
- `POST /api/services/:id/cancel`
- `POST /api/ratings` (service rating shape)

Admin:
- `GET /api/admin/services`
- `PATCH /api/admin/services/:id/status`

## 5. Client Validation and Error Handling

### 5.1 Client-Side Validation

- `serviceType`: required; one of `designing`, `maintenance`, `renewal`.
- `description`: required, non-empty on create.
- `address`: required, non-empty on create.
- List query validation:
  - `sortBy` must be `createdAt`.
  - `sortDirection` must be `asc` or `desc`.
- Service rating:
  - `itemType` must be `service`
  - `itemId` must be numeric
  - `ratingValue` must be between `1` and `5`

### 5.2 Error Branches

- `400`:
  - invalid payload
  - invalid status enum
  - update/cancel not allowed for current status
  - rating before service is `finished`
  - duplicate service rating
- `401`:
  - missing or invalid bearer token
- `403`:
  - trying to access/update/cancel/rate another user service
  - non-admin access to admin services endpoints
- `404`:
  - service order not found

## 6. Minimal QA Integration Checklist

- User can create service with valid type/description/address.
- User can update own service while status is `not_started`.
- User cannot update/cancel own service after processing starts.
- `GET /api/services/me` supports expected filter/sort query combinations.
- Admin can list services with user context and apply filter/sort query params.
- Admin can update service statuses using valid enum values.
- User can rate only after service reaches `finished`.
- Duplicate service rating is rejected.
- Unauthorized and cross-user access branches return expected errors.
