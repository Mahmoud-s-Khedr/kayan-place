# Module 5 Integration Guide: Services

## Purpose

This guide covers:

- service order creation
- user update/cancel flows
- user and admin service listing
- admin status changes
- service rating after completion

Shared contract:

- [frontend-integration-shared-contract.md](./frontend-integration-shared-contract.md)

## Flow-by-Flow Implementation

### Create Service Order

1. User submits `serviceType`, `description`, and `address` to `POST /api/services`.
2. Backend creates the service with initial status `not_started`.

### Update Service Order

1. User sends `PATCH /api/services/:id`.
2. `description` and `address` are editable by the user.
3. Update is allowed only while status is `not_started`.

### List My Services

Use `GET /api/services/me` with optional:

- `serviceType`
- `fromDate`
- `toDate`
- `sortBy=createdAt`
- `sortDirection=asc|desc`

### Admin List and Status Update

Admin routes:

- `GET /api/admin/services`
- `PATCH /api/admin/services/:id/status`

### Cancel Service

- user route: `POST /api/services/:id/cancel`
- allowed only while status is `not_started`

### Rate Finished Service

After status becomes `finished`, the owner can call:

- `POST /api/ratings`

## Endpoint Contract

### `POST /api/services`

Auth: bearer token required

Request:

```json
{
  "serviceType": "maintenance",
  "description": "Fix AC noise issue in bedroom.",
  "address": "Cairo, Nasr City"
}
```

Validation:

- `serviceType`: `designing`, `maintenance`, `renewal`
- `description`: required non-empty string
- `address`: required non-empty string

Success:

- `201`
- `data.service`

Important returned fields:

- `id`
- `user_id`
- `service_type`
- `description`
- `address`
- `status`
- `cancelled_at`
- `created_at`
- `updated_at`

### `PATCH /api/services/:id`

Allowed only while status is `not_started`.

Request:

```json
{
  "description": "Updated: AC noise issue plus weak cooling in living room.",
  "address": "Cairo, New Cairo"
}
```

Validation:

- `description`: optional non-empty string
- `address`: optional non-empty string

Success:

- `200`
- updated `data.service`

### `GET /api/services/me`

Supported query params:

- `serviceType`
- `fromDate`
- `toDate`
- `sortBy`: `createdAt`
- `sortDirection`: `asc`, `desc`

Defaults:

- `sortBy` defaults to `createdAt`
- `sortDirection` defaults to `desc`

Success:

- `200`
- `data.items[]`

### `POST /api/services/:id/cancel`

Allowed only while status is `not_started`.

Success:

- `200`
- updated `data.service`

### `GET /api/admin/services`

Auth: admin bearer token required

Supported query params:

- `serviceType`
- `fromDate`
- `toDate`
- `sortBy`: `createdAt`
- `sortDirection`: `asc`, `desc`

Success:

- `200`
- `data.items[]`
- each item includes nested `user`

### `PATCH /api/admin/services/:id/status`

Auth: admin bearer token required

Request:

```json
{
  "status": "in_progress"
}
```

Allowed enum values:

- `not_started`
- `in_progress`
- `cancelled`
- `finished`

Important backend note:

- The backend validates the enum only.
- It does not enforce a strict transition matrix for admin service status updates.
- Frontend/admin UX should still follow the safe progression:
  - `not_started -> in_progress -> finished`
  - or cancel before completion when business rules allow it

### `POST /api/ratings`

Service rating request:

```json
{
  "itemType": "service",
  "itemId": 88,
  "ratingValue": 5
}
```

Rules:

- user must own the service
- service status must be `finished`
- duplicate rating is rejected

## Error Handling

- `400`: invalid payload, invalid enum, update/cancel blocked by current status, rating before completion, duplicate rating
- `401`: missing or invalid bearer token
- `403`: non-admin using admin routes, or other authenticated access-control failures on endpoints that perform explicit participant checks
- `404`: service order not found

## QA Checklist

- User can create service with valid payload.
- User can update service while `not_started`.
- User cannot update or cancel after processing starts.
- `GET /api/services/me` works with type, date, and sort filters.
- Admin list returns user context and honors supported query params.
- Admin status updates accept valid enum values.
- Frontend follows the canonical status progression even though backend does not strictly enforce it.
- User can rate only after `finished`.
- Duplicate service rating fails.
