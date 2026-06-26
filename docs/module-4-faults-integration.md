# Module 4 Integration Guide: Faults

## Purpose

This guide covers:

- fault creation
- fault image upload handoff
- fault update and cancellation
- user and admin listing
- enforced admin status transitions
- post-completion rating

Shared contract:

- [frontend-integration-shared-contract.md](./frontend-integration-shared-contract.md)

## Flow-by-Flow Implementation

### Create Fault

1. Upload optional image files first.
2. Send `POST /api/faults`.
3. Backend creates the fault with initial status `received`.

### Upload Fault Images

Recommended current upload-intent payload, aligned with the repo harness:

```json
{
  "ownerType": "product",
  "purpose": "product_image",
  "filename": "fault-1.jpg",
  "mimeType": "image/jpeg",
  "fileSizeBytes": 204800
}
```

Current backend rule for successful fault association:

- file must exist
- file must be uploaded
- file purpose must be `product_image`
- file MIME type must start with `image/`

### Update Fault

1. Send `PATCH /api/faults/:id`.
2. This is only allowed while status is `received`.
3. The user may update `title`, `description`, `severity`, `address`, and `imageFileIds`.

### List My Faults

Use `GET /api/faults/me` with optional filters:

- `status`
- `severity`
- `fromDate`
- `toDate`
- `sortBy`: `createdAt`, `severity`
- `sortDirection`: `asc`, `desc`

### Admin Review and Status Update

Admin routes:

- `GET /api/admin/faults`
- `PATCH /api/admin/faults/:id/status`

Unlike orders and services, fault transitions are currently enforced by backend logic.

### Cancel Fault

- User route: `POST /api/faults/:id/cancel`
- Only allowed while status is `received`

### Rate Finished Fault

Once status is `finished`, the owner can submit:

- `POST /api/ratings`

## Endpoint Contract

### `POST /api/faults`

Auth: bearer token required

Request:

```json
{
  "title": "Water leak",
  "description": "Leak from kitchen ceiling.",
  "severity": "high",
  "address": "Cairo, Nasr City",
  "imageFileIds": [101, 102]
}
```

Validation:

- `title`: required non-empty string
- `description`: required non-empty string
- `severity`: `normal`, `high`, `urgent`, `emergent`
- `address`: required non-empty string
- `imageFileIds`: optional integer array

Success:

- `201`
- `data.fault`

### `PATCH /api/faults/:id`

Allowed only while current status is `received`.

Request example:

```json
{
  "description": "Leak is now affecting hallway wall.",
  "severity": "urgent",
  "address": "Cairo, New Cairo",
  "imageFileIds": [101]
}
```

Success:

- `200`
- updated `data.fault`

### `GET /api/faults/me`

Supported query params:

- `status`
- `severity`
- `fromDate`
- `toDate`
- `sortBy`: `createdAt`, `severity`
- `sortDirection`: `asc`, `desc`

Defaults:

- `sortBy` defaults to `createdAt`
- `sortDirection` defaults to `desc`

Severity sorting behavior:

- backend sorts by severity priority:
  - `normal`
  - `high`
  - `urgent`
  - `emergent`

Success:

- `200`
- `data.items[]`

Important fault fields:

- `id`
- `user_id`
- `title`
- `description`
- `severity`
- `address`
- `status`
- `cancelled_at`
- `created_at`
- `updated_at`
- `images[]`

### `POST /api/faults/:id/cancel`

Allowed only while current status is `received`.

Success:

- `200`
- updated `data.fault`

### `GET /api/admin/faults`

Auth: admin bearer token required

Supported query params:

- `status`: `received`, `assigned`, `on_the_way`, `in_progress`, `finished`, `cancelled`
- `severity`: `normal`, `high`, `urgent`, `emergent`
- `fromDate`
- `toDate`
- `sortBy`: `createdAt`, `severity`
- `sortDirection`: `asc`, `desc`
- `page`: integer, min `1`
- `limit`: integer, min `1`, max `100`

Success:

- `200`
- `data.items[]`
- each fault includes nested `user`

### `PATCH /api/admin/faults/:id/status`

Auth: admin bearer token required

Request:

```json
{
  "status": "assigned"
}
```

Allowed statuses:

- `received`
- `assigned`
- `on_the_way`
- `in_progress`
- `finished`
- `cancelled`

Current enforced transition matrix:

- `received -> assigned` or `cancelled`
- `assigned -> on_the_way` or `cancelled`
- `on_the_way -> in_progress` or `cancelled`
- `in_progress -> finished` or `cancelled`
- `finished ->` no further transitions
- `cancelled ->` no further transitions

### `POST /api/ratings`

Fault rating request:

```json
{
  "itemType": "fault",
  "itemId": 55,
  "ratingValue": 5
}
```

Rules:

- authenticated user must own the fault
- fault status must be `finished`
- duplicate rating is rejected

## Error Handling

- `400`: invalid payload, invalid transition, invalid file purpose, pending file, non-image file, update/cancel blocked by current status, duplicate rating, rating before completion
- `401`: missing or invalid bearer token
- `403`: authenticated user tries to access another user’s fault or non-admin hits admin route
- `404`: fault not found

Ownership/state distinction:

- same-user missing resource: `404`
- different-user authenticated access may be `403` or `404` depending on the endpoint
- invalid current status for same owner: `400`

## QA Checklist

- User can create fault with optional uploaded image IDs.
- Fault creation rejects missing, pending, non-image, or wrong-purpose files.
- User can update fault while status is `received`.
- User cannot update or cancel after processing begins.
- `GET /api/faults/me` works with status, severity, date, and sort combinations.
- Admin list includes nested user info.
- Admin valid transitions succeed.
- Admin invalid transitions fail with `400`.
- User can cancel only while `received`.
- User can rate only after `finished`.
- Duplicate fault rating fails.
